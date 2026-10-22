// POST /api/upload: streams a raw video from the browser straight into storage
// (never buffered whole), records a pending, queued row, and returns at once.
// The editing worker picks the row up from the queue within a few seconds.
//
// This route is excluded from the proxy (see src/proxy.ts), so it checks the
// session itself, first thing.
//
// Request: the file as the raw body, with headers
//   Content-Type:   the file's MIME type
//   Content-Length: its size
//   X-File-Name:    encodeURIComponent(file name)
//   X-Video-Title:  encodeURIComponent(title)

import { randomUUID } from "node:crypto";
import { Readable, pipeline } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guard";
import { getUploadConfig } from "@/server/config";
import { getRepository } from "@/server/db";
import { assertSameOrigin, HttpError, json, route } from "@/server/http";
import { getStorage } from "@/server/storage";
import { cleanTitle, contentTypeForExtension, decodeHeader, UploadGuard, videoExtension } from "@/server/upload";

export const POST = route(async (request: NextRequest) => {
  requireRole(request, "family");
  assertSameOrigin(request);

  const { maxBytes } = getUploadConfig();
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0 || !request.body) {
    throw new HttpError(411, "Choose a video to upload.");
  }
  const limitMb = Math.round(maxBytes / 1024 / 1024);
  if (declared > maxBytes) throw new HttpError(413, `That video is too big. The limit is ${limitMb} MB.`);

  const filename = decodeHeader(request.headers.get("x-file-name")).slice(0, 255) || null;
  const title = cleanTitle(decodeHeader(request.headers.get("x-video-title")));
  const ext = videoExtension(request.headers.get("content-type"), filename);

  const id = randomUUID();
  const [storage, repo] = await Promise.all([getStorage(), getRepository()]);

  // pipeline() forwards a client disconnect or a guard rejection to storage,
  // which then discards the partial upload.
  const guard = new UploadGuard(maxBytes);
  pipeline(Readable.fromWeb(request.body as NodeReadableStream), guard, () => {});

  const asset = await storage.putStream(guard, {
    kind: "raw",
    name: id,
    ext,
    contentType: contentTypeForExtension(ext),
  });

  try {
    const video = await repo.create({
      id,
      title,
      raw_url: asset.url,
      raw_key: asset.key,
      original_filename: filename,
      content_type: contentTypeForExtension(ext),
      size_bytes: guard.bytes,
    });
    return json({ video: { id: video.id, title: video.title } }, { status: 201 });
  } catch (error) {
    await storage.delete(asset.key, "raw").catch((cleanup) => console.error("Could not remove orphaned upload", cleanup));
    throw error;
  }
});
