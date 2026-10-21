"""Request and response models for the HTTP API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from services.pipeline import JobStatus, Stage


class ComponentStatus(BaseModel):
    name: str
    ready: bool
    detail: str


class HealthResponse(BaseModel):
    status: str
    version: str
    tts: ComponentStatus
    lipsync: ComponentStatus
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


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    stage: Stage
    progress: int = Field(ge=0, le=100)
    message: str
    error: str | None
    audio_url: str | None
    video_url: str | None
    duration_seconds: float | None
    created_at: datetime
    updated_at: datetime
