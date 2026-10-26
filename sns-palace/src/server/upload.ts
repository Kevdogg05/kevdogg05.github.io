// Upload validation: which files count as videos, and a stream guard that
// enforces the size limit and checks the file really is a video container
// (by its first bytes, not just its name) while it streams through.

import { Transform, type TransformCallback } from "node:stream";
import { HttpError } from "@/server/http";

const EXTENSIONS: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
};

const TYPE_TO_EXT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXTENSIONS).map(([ext, type]) => [type, ext])),
  "video/mpeg4": "mp4",
  "video/3gpp2": "3gp",
  "video/avi": "avi",
};

/** Picks the stored extension from the file name, falling back to its MIME type. */
export function videoExtension(contentType: string | null, filename: string | null): string {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName !== filename?.toLowerCase() && EXTENSIONS[fromName]) return fromName;
  if (TYPE_TO_EXT[type]) return TYPE_TO_EXT[type];
  throw new HttpError(415, "That doesn't look like a video. Try an MP4, MOV or WebM file.");
}

export function contentTypeForExtension(ext: string): string {
  return EXTENSIONS[ext] ?? "application/octet-stream";
}

/** Recognises MP4/MOV/3GP (ISO-BMFF), WebM/MKV (EBML) and AVI (RIFF) headers. */
export function looksLikeVideo(header: Buffer): boolean {
  if (header.length < 12) return false;
  const box = header.toString("latin1", 4, 8);
  if (["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box)) return true;
  if (header.readUInt32BE(0) === 0x1a45dfa3) return true;
  return header.toString("latin1", 0, 4) === "RIFF" && header.toString("latin1", 8, 12) === "AVI ";
}

export class UploadGuard extends Transform {
  private received = 0;
  private header: Buffer | null = Buffer.alloc(0);

  constructor(private readonly maxBytes: number) {
    super();
  }

  get bytes(): number {
    return this.received;
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.received += chunk.length;
    if (this.received > this.maxBytes) {
      callback(new HttpError(413, "That video is too big."));
      return;
    }
    if (this.header) {
      // Hold the first bytes back until there are enough to recognise the format.
      this.header = Buffer.concat([this.header, chunk]);
      if (this.header.length < 12) {
        callback();
        return;
      }
      if (!looksLikeVideo(this.header)) {
        callback(new HttpError(415, "That doesn't look like a video. Try an MP4, MOV or WebM file."));
        return;
      }
      const buffered = this.header;
      this.header = null;
      callback(null, buffered);
      return;
    }
    callback(null, chunk);
  }

  _flush(callback: TransformCallback): void {
    if (this.header) {
      callback(new HttpError(415, "That file is too small to be a video."));
      return;
    }
    callback();
  }
}

/** Header values are percent-encoded by the client so any title survives. */
export function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function cleanTitle(raw: string): string {
  const title = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(title).slice(0, 80).join("") || "My awesome video";
}
