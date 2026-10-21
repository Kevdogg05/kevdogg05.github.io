"""OpenAvatarStudio API.

Run with:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import Settings, load_settings
from schemas import (
    AvatarUploadResponse,
    ComponentStatus,
    GenerateRequest,
    HealthResponse,
    JobResponse,
    VoiceOut,
    VoicesResponse,
)
from services import media
from services.audio import create_tts_provider
from services.common import PipelineError
from services.pipeline import Job, JobStore, Pipeline
from services.storage import AvatarStore, UploadRejected
from services.video import create_lipsync_engine

VERSION = "0.1.0"
MEDIA_PREFIX = "/media"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    settings.jobs_dir.mkdir(parents=True, exist_ok=True)

    tts = create_tts_provider(settings)
    engine = create_lipsync_engine(settings)
    avatars = AvatarStore(settings.avatars_dir, settings.max_upload_bytes)
    jobs = JobStore()
    pipeline = Pipeline(settings, tts, engine, jobs)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        pipeline.shutdown()

    app = FastAPI(title="OpenAvatarStudio API", version=VERSION, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Uploaded avatars and rendered audio/video, served with HTTP range support.
    app.mount(MEDIA_PREFIX, StaticFiles(directory=settings.storage_dir), name="media")

    def media_url(path: Path | None) -> str | None:
        if path is None:
            return None
        return f"{MEDIA_PREFIX}/{path.relative_to(settings.storage_dir).as_posix()}"

    def job_response(job: Job) -> JobResponse:
        return JobResponse(
            job_id=job.id,
            status=job.status,
            stage=job.stage,
            progress=job.progress,
            message=job.message,
            error=job.error,
            audio_url=media_url(job.audio_path),
            video_url=media_url(job.video_path),
            duration_seconds=job.duration_seconds,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    @app.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        tts_status = tts.status()
        engine_status = engine.status()
        ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)
        return HealthResponse(
            status="ok",
            version=VERSION,
            tts=ComponentStatus(name=tts.name, ready=tts_status.ready, detail=tts_status.detail),
            lipsync=ComponentStatus(
                name=engine.name, ready=engine_status.ready, detail=engine_status.detail
            ),
            ffmpeg=ComponentStatus(
                name="ffmpeg", ready=ffmpeg is not None, detail=ffmpeg or "not found"
            ),
        )

    @app.get("/api/voices", response_model=VoicesResponse)
    def list_voices() -> VoicesResponse:
        try:
            voices = tts.list_voices()
        except PipelineError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        return VoicesResponse(
            provider=tts.name,
            voices=[VoiceOut(id=v.id, name=v.name, description=v.description) for v in voices],
        )

    @app.post(
        "/api/avatars/upload",
        response_model=AvatarUploadResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def upload_avatar(file: UploadFile = File(...)) -> AvatarUploadResponse:
        try:
            avatar = await avatars.save(file)
        except UploadRejected as exc:
            raise HTTPException(exc.status_code, exc.detail) from exc
        finally:
            await file.close()
        return AvatarUploadResponse(
            avatar_id=avatar.id,
            url=media_url(avatar.path),
            content_type=avatar.content_type,
            size_bytes=avatar.size_bytes,
        )

    @app.post("/api/generate", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
    def generate(body: GenerateRequest) -> JobResponse:
        """Start the Script -> Audio -> Lip-Sync -> Video pipeline; poll /api/jobs/{id}."""
        if len(body.script) > settings.max_script_chars:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Script is longer than {settings.max_script_chars} characters",
            )
        avatar_path = avatars.find(body.avatar_id)
        if avatar_path is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Avatar not found; upload it again")
        job = pipeline.submit(body.script, body.voice_id, body.avatar_id, avatar_path)
        return job_response(job)

    @app.get("/api/jobs/{job_id}", response_model=JobResponse)
    def get_job(job_id: str) -> JobResponse:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        return job_response(job)

    @app.get("/", include_in_schema=False)
    def root(request: Request) -> dict[str, str]:
        return {"name": "OpenAvatarStudio API", "docs": str(request.url_for("swagger_ui_html"))}

    return app


app = create_app()
