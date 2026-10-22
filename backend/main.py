"""OpenAvatarStudio API.

Run with:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import Settings, load_settings
from schemas import (
    AvatarUploadResponse,
    ComponentStatus,
    CostEstimateOut,
    EngineOut,
    EnhancerOut,
    GenerateRequest,
    HealthResponse,
    JobListResponse,
    JobResponse,
    VoiceOut,
    VoicesResponse,
)
from services import hardware, media
from services.audio import create_tts_provider
from services.common import CostEstimate, PipelineError
from services.enhance import FaceEnhancer
from services.jobs import Job, JobStatus, JobStore, now
from services.pipeline import JobConflict, Pipeline
from services.storage import AvatarStore, UploadRejected
from services.video import create_lipsync_engines

VERSION = "0.1.0"
MEDIA_PREFIX = "/media"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    settings.jobs_dir.mkdir(parents=True, exist_ok=True)

    tts = create_tts_provider(settings)
    engines = create_lipsync_engines(settings)
    enhancer = FaceEnhancer(settings)
    avatars = AvatarStore(settings.avatars_dir, settings.max_upload_bytes)
    jobs = JobStore(settings.database_path, settings.storage_dir)
    pipeline = Pipeline(settings, tts, engines, enhancer, jobs, avatars)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Load the voice model and probe for a GPU in the background so neither
        # the first job nor the first health check has to wait for them.
        threading.Thread(target=tts.warm_up, name="oas-tts-warmup", daemon=True).start()
        threading.Thread(target=hardware.detect_device, name="oas-device", daemon=True).start()
        pipeline.start()  # resume queued jobs, mark interrupted ones
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

    def queue_positions() -> dict[str, int]:
        return {job.id: i + 1 for i, job in enumerate(jobs.with_status(JobStatus.QUEUED))}

    def job_response(job: Job, positions: dict[str, int] | None = None) -> JobResponse:
        if positions is None and job.status is JobStatus.QUEUED:
            positions = queue_positions()
        render_seconds = None
        if job.started_at:
            render_seconds = round(((job.finished_at or now()) - job.started_at).total_seconds(), 1)
        return JobResponse(
            job_id=job.id,
            script=job.script,
            voice_id=job.voice_id,
            engine=job.engine,
            enhance=job.enhance,
            head_motion=job.head_motion,
            status=job.status,
            stage=job.stage,
            progress=job.progress,
            message=job.message,
            error=job.error,
            queue_position=(positions or {}).get(job.id),
            avatar_url=media_url(avatars.find(job.avatar_id)),
            audio_url=media_url(job.audio_path),
            video_url=media_url(job.video_path),
            poster_url=media_url(job.poster_path),
            duration_seconds=job.duration_seconds,
            render_seconds=render_seconds,
            size_bytes=job.size_bytes,
            created_at=job.created_at,
            updated_at=job.updated_at,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )

    def ensure_ready(engine_name: str, enhance: bool) -> None:
        """Refuse up front rather than queueing a job that is bound to fail."""
        engine = engines.get(engine_name)
        if engine is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Unknown engine '{engine_name}'. Choose one of: {', '.join(engines)}",
            )
        for label, component_status in [
            (engine.label, engine.status()),
            *([("Face enhancement", enhancer.status())] if enhance else []),
        ]:
            if not component_status.ready:
                raise HTTPException(
                    status.HTTP_409_CONFLICT, f"{label} is not ready: {component_status.detail}"
                )

    def existing_job(job_id: str) -> Job:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        return job

    @app.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        tts_status = tts.status()
        ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)
        device = hardware.current_device()

        def estimate(cost: CostEstimate) -> CostEstimateOut | None:
            if device != "cpu":
                return None
            return CostEstimateOut(
                fixed_seconds=cost.fixed_seconds, seconds_per_second=cost.seconds_per_second
            )

        engine_list = []
        for engine in engines.values():
            engine_status = engine.status()
            engine_list.append(
                EngineOut(
                    name=engine.name,
                    ready=engine_status.ready,
                    detail=engine_status.detail,
                    label=engine.label,
                    summary=engine.summary,
                    supports_head_motion=engine.supports_head_motion,
                    cpu_estimate=estimate(engine.cpu_cost),
                )
            )
        default = next(e for e in engine_list if e.name == settings.lipsync_engine)
        enhancer_status = enhancer.status()
        return HealthResponse(
            status="ok",
            version=VERSION,
            device=device,
            tts=ComponentStatus(name=tts.name, ready=tts_status.ready, detail=tts_status.detail),
            lipsync=ComponentStatus(name=default.name, ready=default.ready, detail=default.detail),
            engines=engine_list,
            enhancer=EnhancerOut(
                name=enhancer.name,
                ready=enhancer_status.ready,
                detail=enhancer_status.detail,
                cpu_estimate=estimate(enhancer.cpu_cost),
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
        if avatars.find(body.avatar_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Avatar not found; upload it again")
        engine_name = body.engine or settings.lipsync_engine
        ensure_ready(engine_name, body.enhance)
        job = pipeline.submit(
            body.script,
            body.voice_id,
            body.avatar_id,
            engine=engine_name,
            enhance=body.enhance,
            head_motion=body.head_motion,
        )
        return job_response(job)

    @app.get("/api/jobs", response_model=JobListResponse)
    def list_jobs(
        limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)
    ) -> JobListResponse:
        """The video library, newest first."""
        positions = queue_positions()
        total, storage_bytes = jobs.summary()
        active = len(positions) + len(jobs.with_status(JobStatus.RUNNING))
        return JobListResponse(
            jobs=[job_response(job, positions) for job in jobs.list(limit, offset)],
            total=total,
            active=active,
            storage_bytes=storage_bytes,
            server_time=now(),
        )

    @app.get("/api/jobs/{job_id}", response_model=JobResponse)
    def get_job(job_id: str) -> JobResponse:
        return job_response(existing_job(job_id))

    @app.post("/api/jobs/{job_id}/cancel", response_model=JobResponse)
    def cancel_job(job_id: str) -> JobResponse:
        existing_job(job_id)
        try:
            return job_response(pipeline.cancel(job_id))
        except JobConflict as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    @app.post("/api/jobs/{job_id}/retry", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
    def retry_job(job_id: str) -> JobResponse:
        """Render the same script, voice, avatar and options again as a new job."""
        job = existing_job(job_id)
        if avatars.find(job.avatar_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "The avatar image no longer exists")
        ensure_ready(job.engine, job.enhance)
        try:
            return job_response(pipeline.retry(job_id))
        except JobConflict as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    @app.delete("/api/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_job(job_id: str) -> Response:
        """Delete a finished job and its files."""
        existing_job(job_id)
        try:
            pipeline.delete(job_id)
        except JobConflict as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/", include_in_schema=False)
    def root(request: Request) -> dict[str, str]:
        return {"name": "OpenAvatarStudio API", "docs": str(request.url_for("swagger_ui_html"))}

    return app


app = create_app()
