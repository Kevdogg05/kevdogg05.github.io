// Cloudinary storage driver.
//
// Every asset is uploaded with the "authenticated" delivery type, so Cloudinary
// refuses to serve it without a signature. The server signs a URL per request
// and streams the bytes through /api/media (behind the household login), so
// signed URLs never reach the browser and nobody outside can fetch a video.
// Cloudinary's CDN still serves the bytes, including byte ranges for seeking.

import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import type { MediaVariant } from "@/lib/types";
import { MEDIA_HEADERS, type MediaStorage, type PutOptions, type StoredAsset } from "@/server/storage/types";

const CHUNK_BYTES = 20 * 1024 * 1024; // Cloudinary's minimum is 5 MB
const UPLOAD_TIMEOUT_MS = 10 * 60_000;

// Request headers worth forwarding upstream, and response headers worth returning.
const FORWARD_REQUEST = ["range", "if-range", "if-none-match", "if-modified-since"];
const FORWARD_RESPONSE = ["content-type", "content-length", "content-range", "etag", "last-modified"];

interface CloudinaryOptions {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

function resourceType(kind: MediaVariant): "image" | "video" {
  return kind === "thumbnail" ? "image" : "video";
}

export class CloudinaryMediaStorage implements MediaStorage {
  readonly driver = "cloudinary" as const;

  constructor(private readonly options: CloudinaryOptions) {
    cloudinary.config({
      cloud_name: options.cloudName,
      api_key: options.apiKey,
      api_secret: options.apiSecret,
      secure: true,
      urlAnalytics: false,
    });
  }

  /** "edited/abc.mp4" → public id "sns-palace/edited/abc" + format "mp4". */
  private locate(key: string) {
    const dot = key.lastIndexOf(".");
    if (dot <= 0) throw new Error(`Invalid storage key: ${key}`);
    return { publicId: `${this.options.folder}/${key.slice(0, dot)}`, format: key.slice(dot + 1) };
  }

  private uploadOptions(options: PutOptions): UploadApiOptions {
    return {
      resource_type: resourceType(options.kind),
      type: "authenticated",
      public_id: `${this.options.folder}/${options.kind}/${options.name}`,
      overwrite: false,
      unique_filename: false,
      timeout: UPLOAD_TIMEOUT_MS,
    };
  }

  private toAsset(options: PutOptions, result: UploadApiResponse): StoredAsset {
    const format = result.format || options.ext;
    return { key: `${options.kind}/${options.name}.${format}`, url: result.secure_url, bytes: result.bytes };
  }

  async putStream(source: Readable, options: PutOptions): Promise<StoredAsset> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      // Holds at most one chunk in memory and waits for each chunk to upload
      // before reading more, so a slow Cloudinary connection slows the client
      // instead of filling the server's memory.
      const sink = cloudinary.uploader.upload_chunked_stream(
        { ...this.uploadOptions(options), chunk_size: CHUNK_BYTES },
        (error, response) => (error || !response ? reject(error ?? new Error("Empty upload response")) : resolve(response)),
      );
      pipeline(source, sink).catch(reject);
    });
    return this.toAsset(options, result);
  }

  async putFile(filePath: string, options: PutOptions): Promise<StoredAsset> {
    const uploadOptions = this.uploadOptions(options);
    const result =
      options.kind === "thumbnail"
        ? await cloudinary.uploader.upload(filePath, uploadOptions)
        : await new Promise<UploadApiResponse>((resolve, reject) => {
            cloudinary.uploader.upload_large(filePath, { ...uploadOptions, chunk_size: CHUNK_BYTES }, (error, response) =>
              error || !response ? reject(error ?? new Error("Empty upload response")) : resolve(response),
            );
          });
    return this.toAsset(options, result);
  }

  /** A signed delivery URL for the original asset. Server-side use only. */
  private signedUrl(key: string, kind: MediaVariant): string {
    const { publicId, format } = this.locate(key);
    return cloudinary.url(publicId, {
      resource_type: resourceType(kind),
      type: "authenticated",
      sign_url: true,
      secure: true,
      format,
    });
  }

  async download(key: string, kind: MediaVariant, destination: string): Promise<void> {
    const response = await fetch(this.signedUrl(key, kind));
    if (!response.ok || !response.body) {
      throw new Error(`Cloudinary download failed (${response.status}) for ${key}`);
    }
    await pipeline(Readable.fromWeb(response.body as NodeReadableStream), createWriteStream(destination));
  }

  async serve(key: string, kind: MediaVariant, request: Request): Promise<Response> {
    const headers = new Headers();
    for (const name of FORWARD_REQUEST) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const upstream = await fetch(this.signedUrl(key, kind), {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      signal: request.signal,
    });

    const out = new Headers(MEDIA_HEADERS);
    for (const name of FORWARD_RESPONSE) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    if (upstream.status >= 400 && upstream.status !== 416) {
      await upstream.body?.cancel();
      return new Response(upstream.status === 404 ? "Not found" : "Media unavailable", {
        status: upstream.status === 404 ? 404 : 502,
      });
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }

  async delete(key: string, kind: MediaVariant): Promise<void> {
    const { publicId } = this.locate(key);
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType(kind),
      type: "authenticated",
      invalidate: true,
    });
    if (result?.result !== "ok" && result?.result !== "not found") {
      throw new Error(`Cloudinary could not delete ${key}: ${JSON.stringify(result)}`);
    }
  }
}
