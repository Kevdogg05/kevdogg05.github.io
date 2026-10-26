// Local storage driver: files under LOCAL_DATA_DIR/media, served with HTTP
// range support so videos seek instantly.

import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MediaVariant } from "@/lib/types";
import { parseRange } from "@/server/range";
import {
  contentTypeForKey,
  MEDIA_HEADERS,
  type MediaStorage,
  type PutOptions,
  type StoredAsset,
} from "@/server/storage/types";

const KEY_PATTERN = /^(raw|preview|edited|webm|thumbnail)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class LocalMediaStorage implements MediaStorage {
  readonly driver = "local" as const;

  constructor(private readonly root: string) {}

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key) || key.includes("..")) throw new Error(`Invalid storage key: ${key}`);
    return path.join(this.root, key);
  }

  private asset(key: string, bytes: number): StoredAsset {
    return { key, url: `local:${key}`, bytes };
  }

  async putStream(source: Readable, options: PutOptions): Promise<StoredAsset> {
    const key = `${options.kind}/${options.name}.${options.ext}`;
    const target = this.pathFor(key);
    const partial = `${target}.part`;
    await mkdir(path.dirname(target), { recursive: true });
    let bytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(null, chunk);
      },
    });
    try {
      await pipeline(source, counter, createWriteStream(partial, { flags: "wx" }));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
    return this.asset(key, bytes);
  }

  async putFile(filePath: string, options: PutOptions): Promise<StoredAsset> {
    const key = `${options.kind}/${options.name}.${options.ext}`;
    const target = this.pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(filePath, target);
    return this.asset(key, (await stat(target)).size);
  }

  async download(key: string, _kind: MediaVariant, destination: string): Promise<void> {
    await copyFile(this.pathFor(key), destination);
  }

  async serve(key: string, _kind: MediaVariant, request: Request): Promise<Response> {
    const file = this.pathFor(key);
    let info;
    try {
      info = await stat(file);
    } catch {
      return new Response("Not found", { status: 404 });
    }

    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = new Headers({
      ...MEDIA_HEADERS,
      "Content-Type": contentTypeForKey(key),
      ETag: etag,
      "Last-Modified": info.mtime.toUTCString(),
    });
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

    // If-Range: only honour Range when the client's copy is still current.
    const ifRange = request.headers.get("if-range");
    const range = ifRange && ifRange !== etag ? null : parseRange(request.headers.get("range"), info.size);
    if (range === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }

    const { start, end } = range ?? { start: 0, end: info.size - 1 };
    headers.set("Content-Length", String(info.size === 0 ? 0 : end - start + 1));
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    const body =
      request.method === "HEAD" || info.size === 0
        ? null
        : (Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>);
    return new Response(body, { status: range ? 206 : 200, headers });
  }

  async delete(key: string, _kind?: MediaVariant): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
