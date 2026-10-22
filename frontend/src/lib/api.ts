// Typed client for the OpenAvatarStudio FastAPI backend.

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobStage = "queued" | "script" | "audio" | "lipsync" | "enhance" | "encode" | "done";

export interface ComponentStatus {
  name: string;
  ready: boolean;
  detail: string;
}

/** Rough render time: fixed seconds plus seconds per second of video. */
export interface CostEstimate {
  fixed_seconds: number;
  seconds_per_second: number;
}

export interface EngineInfo extends ComponentStatus {
  label: string;
  summary: string;
  supports_head_motion: boolean;
  /** Only reported when the backend runs on CPU. */
  cpu_estimate: CostEstimate | null;
}

export interface EnhancerInfo extends ComponentStatus {
  cpu_estimate: CostEstimate | null;
}

export interface Health {
  status: string;
  version: string;
  device: "cpu" | "cuda" | "unknown";
  tts: ComponentStatus;
  /** The default lip-sync engine. */
  lipsync: ComponentStatus;
  engines: EngineInfo[];
  enhancer: EnhancerInfo;
  ffmpeg: ComponentStatus;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
}

export interface VoicesResponse {
  provider: string;
  voices: Voice[];
}

export interface UploadedAvatar {
  avatar_id: string;
  url: string;
  content_type: string;
  size_bytes: number;
}

export interface Job {
  job_id: string;
  engine: string;
  enhance: boolean;
  head_motion: boolean;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  error: string | null;
  audio_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateRequest {
  script: string;
  voice_id: string;
  avatar_id: string;
  engine: string;
  enhance: boolean;
  head_motion: boolean;
}

/**
 * Backend origin. Set NEXT_PUBLIC_API_URL to override; otherwise port 8000 on
 * whatever host served the page, so LAN and localhost access both work.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

/** Turns a backend-relative media path (e.g. /media/jobs/…/video.mp4) into a full URL. */
export function mediaUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${apiBase()}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, init);
  } catch {
    throw new ApiError(`Cannot reach the backend at ${apiBase()}`, 0);
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    // FastAPI sends either {detail: "..."} or {detail: [{msg: "..."}, ...]}.
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ");
    }
  } catch {
    // fall through to the status text
  }
  return `${response.status} ${response.statusText}`.trim();
}

export const api = {
  health: () => request<Health>("/api/health"),

  voices: () => request<VoicesResponse>("/api/voices"),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadedAvatar>("/api/avatars/upload", { method: "POST", body: form });
  },

  generate: (body: GenerateRequest) =>
    request<Job>("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  job: (jobId: string) => request<Job>(`/api/jobs/${encodeURIComponent(jobId)}`),
};
