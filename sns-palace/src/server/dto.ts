// What the browser is allowed to see. Storage keys, provider URLs and worker
// bookkeeping stay on the server; media links point at /api/media, which
// re-checks the session on every request.

import { createHash } from "node:crypto";
import type { FeedVideo, MediaVariant, ReviewVideo, VideoRecord } from "@/lib/types";

/** The storage key a variant is served from, if it exists yet. */
export function keyForVariant(video: VideoRecord, variant: MediaVariant): string | null {
  switch (variant) {
    case "raw":
      return video.raw_key;
    case "preview":
      return video.preview_key;
    case "edited":
      return video.edited_key;
    case "webm":
      return video.edited_webm_key;
    case "thumbnail":
      return video.thumbnail_key;
  }
}

function mediaUrl(video: VideoRecord, variant: MediaVariant): string | null {
  const key = keyForVariant(video, variant);
  if (!key) return null;
  // A new render gets a new key, so the version busts browser caches.
  const version = createHash("sha256").update(key).digest("base64url").slice(0, 10);
  return `/api/media/${video.id}/${variant}?v=${version}`;
}

export function toFeedVideo(video: VideoRecord): FeedVideo {
  return {
    id: video.id,
    title: video.title,
    createdAt: video.created_at,
    approvedAt: video.approved_at,
    duration: video.analysis?.edited_duration ?? null,
    media: { edited: mediaUrl(video, "edited"), webm: mediaUrl(video, "webm"), thumbnail: mediaUrl(video, "thumbnail") },
  };
}

export function toReviewVideo(video: VideoRecord): ReviewVideo {
  const transcript = video.transcript_json;
  return {
    id: video.id,
    title: video.title,
    status: video.status,
    createdAt: video.created_at,
    updatedAt: video.updated_at,
    approvedAt: video.approved_at,
    originalFilename: video.original_filename,
    sizeBytes: video.size_bytes === null ? null : Number(video.size_bytes),
    pipeline: {
      status: video.pipeline_status,
      stage: video.pipeline_stage,
      error: video.pipeline_error,
      attempts: video.attempts,
    },
    media: {
      raw: mediaUrl(video, "raw")!,
      preview: mediaUrl(video, "preview"),
      edited: mediaUrl(video, "edited"),
      webm: mediaUrl(video, "webm"),
      thumbnail: mediaUrl(video, "thumbnail"),
    },
    analysis: video.analysis,
    transcript: transcript
      ? { engine: transcript.engine, text: transcript.text, wordCount: transcript.words.length }
      : null,
  };
}

/** Kids may only ever see approved, finished videos. */
export function isOnFeed(video: VideoRecord): boolean {
  return video.status === "approved" && video.edited_key !== null;
}
