// Domain types shared by the app, the API and the editing worker.
// Safe to import from client components: no server code lives here.

export const VIDEO_STATUSES = ["pending", "approved"] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const PIPELINE_STATUSES = ["queued", "processing", "ready", "failed"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/** Pipeline steps in the order the worker runs them. */
export const PIPELINE_STAGES = ["probe", "preview", "transcribe", "silence", "render", "publish"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** edited = H.264/AAC MP4; webm = the same edit as VP9/Opus WebM, a fallback for browsers without H.264. */
export const MEDIA_VARIANTS = ["raw", "preview", "edited", "webm", "thumbnail"] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

/** A span of time in seconds. */
export interface TimeRange {
  start: number;
  end: number;
}

export interface TranscriptWord {
  text: string;
  start_us: number;
  end_us: number;
  /** Recogniser confidence from 0 to 1, when the engine reports one. */
  probability: number | null;
}

export interface Transcript {
  engine: string;
  model: string | null;
  language: string | null;
  text: string;
  /** Timed against the raw upload. */
  words: TranscriptWord[];
}

/** Stored in videos.transcript_json. */
export interface TranscriptJson extends Transcript {
  /** The same words, re-timed onto the edited (trimmed) video. */
  edited_words: TranscriptWord[];
}

/** Stored in videos.analysis: what the pipeline measured and changed. */
export interface VideoAnalysis {
  raw_duration: number;
  edited_duration: number;
  removed_duration: number;
  /** Removed spans, on the raw timeline. */
  cuts: TimeRange[];
  /** Kept spans, on the raw timeline. */
  kept: TimeRange[];
  silences_detected: number;
  word_count: number;
  has_audio: boolean;
  captions: boolean;
  source: {
    width: number;
    height: number;
    fps: number | null;
    video_codec: string | null;
    audio_codec: string | null;
  };
  output: { width: number; height: number; bytes: number; webm_bytes: number | null };
  settings: { min_silence: number; noise_db: number; padding: number };
  warnings: string[];
  timings_ms: Partial<Record<PipelineStage, number>>;
}

/** One row of the videos table. */
export interface VideoRecord {
  id: string;
  title: string;
  status: VideoStatus;
  raw_url: string;
  edited_url: string | null;
  thumbnail_url: string | null;
  transcript_json: TranscriptJson | null;
  created_at: string;
  raw_key: string;
  preview_key: string | null;
  edited_key: string | null;
  edited_webm_key: string | null;
  thumbnail_key: string | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  pipeline_status: PipelineStatus;
  pipeline_stage: PipelineStage | null;
  pipeline_error: string | null;
  attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  analysis: VideoAnalysis | null;
  updated_at: string;
  approved_at: string | null;
}

// ---------------------------------------------------------------------------
// API shapes (what the browser receives)

export interface FeedVideo {
  id: string;
  title: string;
  createdAt: string;
  approvedAt: string | null;
  duration: number | null;
  media: { edited: string | null; webm: string | null; thumbnail: string | null };
}

export interface ReviewVideo {
  id: string;
  title: string;
  status: VideoStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  originalFilename: string | null;
  sizeBytes: number | null;
  pipeline: {
    status: PipelineStatus;
    stage: PipelineStage | null;
    error: string | null;
    attempts: number;
  };
  media: {
    raw: string;
    preview: string | null;
    edited: string | null;
    webm: string | null;
    thumbnail: string | null;
  };
  analysis: VideoAnalysis | null;
  transcript: { engine: string; text: string; wordCount: number } | null;
}

export interface FeedResponse {
  videos: FeedVideo[];
  /** Uploads still waiting for an edit or a grown-up's OK. */
  waitingCount: number;
  /** Largest upload the server accepts. */
  uploadLimitBytes: number;
}

export interface ReviewResponse {
  videos: ReviewVideo[];
  system: { database: string; storage: string };
}

export interface SessionState {
  family: boolean;
  parent: boolean;
  /** When the parent unlock runs out (ISO), if unlocked. */
  parentExpiresAt: string | null;
}

export type VideoAction =
  | { action: "approve" }
  | { action: "unapprove" }
  | { action: "reprocess" }
  | { action: "rename"; title: string };

/** What the Tailscale container (compose.yaml) reports, for "Add a device". */
export type TailscaleStatus =
  /** No Tailscale container to ask (not set up, or not running). */
  | { state: "off" }
  /** Not signed in yet; loginUrl signs it in when Tailscale offers one. */
  | { state: "not-connected"; loginUrl: string | null }
  /** Signed in, but HTTPS certificates are turned off for the tailnet. */
  | { state: "https-off"; name: string }
  | { state: "ready"; url: string };
