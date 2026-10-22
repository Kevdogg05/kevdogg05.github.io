"""Request and response models for the HTTP API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from services.jobs import JobStatus, Stage


class ComponentStatus(BaseModel):
    name: str
    ready: bool
    detail: str


class CostEstimateOut(BaseModel):
    fixed_seconds: float
    seconds_per_second: float


class EngineOut(ComponentStatus):
    label: str
    summary: str
    supports_head_motion: bool
    # Rough render time on this machine; only reported when running on CPU.
    cpu_estimate: CostEstimateOut | None


class EnhancerOut(ComponentStatus):
    cpu_estimate: CostEstimateOut | None


class HealthResponse(BaseModel):
    status: str
    version: str
    device: str  # "cpu", "cuda" or "unknown" (while still detecting)
    tts: ComponentStatus
    lipsync: ComponentStatus  # the default engine
    engines: list[EngineOut]
    enhancer: EnhancerOut
    ffmpeg: ComponentStatus


class VoiceOut(BaseModel):
    id: str
    name: str
    description: str


class VoicesResponse(BaseModel):
    provider: str
    voices: list[VoiceOut]


class AvatarUploadResponse(BaseModel):
    avatar_id: str
    url: str
    content_type: str
    size_bytes: int


class GenerateRequest(BaseModel):
    script: str = Field(min_length=1)
    voice_id: str = Field(min_length=1)
    avatar_id: str = Field(min_length=1)
    engine: str | None = None  # defaults to OAS_LIPSYNC_ENGINE
    enhance: bool = False
    head_motion: bool = False


class JobResponse(BaseModel):
    job_id: str
    script: str
    voice_id: str
    engine: str
    enhance: bool
    head_motion: bool
    status: JobStatus
    stage: Stage
    progress: int = Field(ge=0, le=100)
    message: str
    error: str | None
    queue_position: int | None  # 1 = next to start; only for queued jobs
    avatar_url: str | None
    audio_url: str | None
    video_url: str | None
    poster_url: str | None
    duration_seconds: float | None
    render_seconds: float | None  # time spent rendering so far, or in total
    size_bytes: int
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
    active: int  # queued + running
    storage_bytes: int
    server_time: datetime  # for "5 min ago" labels without trusting the client clock
