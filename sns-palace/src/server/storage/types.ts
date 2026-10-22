import type { Readable } from "node:stream";
import type { MediaVariant } from "@/lib/types";

export interface StoredAsset {
  /** Driver key, e.g. "edited/3f2c…-a1b2.mp4". Stored in videos.*_key. */
  key: string;
  /** Provider URL for the asset (Cloudinary secure_url, or local:<key>). */
  url: string;
  bytes: number;
}

export interface PutOptions {
  kind: MediaVariant;
  /** File name without extension; unique per asset. */
  name: string;
  /** Extension without the dot, e.g. "mp4". */
  ext: string;
  contentType: string;
}

export interface MediaStorage {
  readonly driver: "cloudinary" | "local";
  /** Streams an upload straight into storage without buffering the whole file. */
  putStream(source: Readable, options: PutOptions): Promise<StoredAsset>;
  putFile(filePath: string, options: PutOptions): Promise<StoredAsset>;
  /** Copies an asset to a local file (the worker's scratch space). */
  download(key: string, kind: MediaVariant, destination: string): Promise<void>;
  /** Streams an asset to the browser, honouring Range and conditional headers. */
  serve(key: string, kind: MediaVariant, request: Request): Promise<Response>;
  /** Deletes an asset. Deleting one that is already gone succeeds. */
  delete(key: string, kind: MediaVariant): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Headers every media response carries. */
export const MEDIA_HEADERS = {
  "Accept-Ranges": "bytes",
  // Keys change on every render, so a cached copy never goes stale; "private"
  // keeps shared caches from storing a household's videos.
  "Cache-Control": "private, max-age=86400",
  "X-Content-Type-Options": "nosniff",
} as const;
