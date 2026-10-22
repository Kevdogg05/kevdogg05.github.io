import type { VideoRecord, VideoStatus } from "@/lib/types";

export interface NewVideo {
  id: string;
  title: string;
  raw_url: string;
  raw_key: string;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number;
}

/** Columns the app may change. id, created_at and updated_at are managed. */
export type VideoPatch = Partial<Omit<VideoRecord, "id" | "created_at" | "updated_at">>;

export const PATCHABLE_COLUMNS = [
  "title",
  "status",
  "raw_url",
  "edited_url",
  "thumbnail_url",
  "transcript_json",
  "raw_key",
  "preview_key",
  "edited_key",
  "edited_webm_key",
  "thumbnail_key",
  "original_filename",
  "content_type",
  "size_bytes",
  "pipeline_status",
  "pipeline_stage",
  "pipeline_error",
  "attempts",
  "locked_by",
  "locked_at",
  "analysis",
  "approved_at",
] as const satisfies readonly (keyof VideoPatch)[];

export interface ClaimOptions {
  workerId: string;
  staleSeconds: number;
  maxAttempts: number;
}

export interface UpdateCondition {
  /** Only update while this worker still holds the video's lock. */
  lockedBy?: string;
  /** Only update while the video's pipeline is in one of these states. */
  pipelineStatusIn?: VideoRecord["pipeline_status"][];
}

export interface VideoRepository {
  readonly driver: "supabase" | "local";
  create(video: NewVideo): Promise<VideoRecord>;
  get(id: string): Promise<VideoRecord | null>;
  /** Approved videos newest-approved first; otherwise newest uploads first. */
  list(options?: { status?: VideoStatus; limit?: number }): Promise<VideoRecord[]>;
  /** Uploads not on the feed yet. */
  countPending(): Promise<number>;
  /** Returns the updated row, or null if no row matched (deleted, or the condition failed). */
  update(id: string, patch: VideoPatch, condition?: UpdateCondition): Promise<VideoRecord | null>;
  /** Returns the deleted row, or null if it did not exist. */
  delete(id: string): Promise<VideoRecord | null>;
  /** Atomically takes the oldest queued (or abandoned) video for a worker. */
  claimNext(options: ClaimOptions): Promise<VideoRecord | null>;
}

export const ABANDONED_ERROR = "The editing worker stopped responding too many times.";
