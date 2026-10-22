"""Generation orchestration: Script -> Audio -> Lip-Sync -> Video file.

Jobs run on a small worker pool (OAS_MAX_CONCURRENT_JOBS, default 1, since
lip-sync models usually saturate a GPU) and report progress into an in-memory
store that the API polls. Swap JobStore for Redis and the executor for a task
queue (Celery, RQ, Arq) when running more than one backend process.
"""

from __future__ import annotations

import logging
import re
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from config import Settings
from services import media
from services.audio import TTSProvider
from services.common import PipelineError, ProgressCallback, RenderOptions
from services.enhance import FaceEnhancer
from services.video import LipSyncEngine

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Stage(str, Enum):
    QUEUED = "queued"
    SCRIPT = "script"
    AUDIO = "audio"
    LIPSYNC = "lipsync"
    ENHANCE = "enhance"
    ENCODE = "encode"
    DONE = "done"


def stage_ranges(enhance: bool) -> dict[Stage, tuple[int, int]]:
    """Share of the overall progress bar each stage owns: (start %, end %).

    Animation dominates the run time, and enhancement costs about as much again.
    """
    if enhance:
        return {
            Stage.SCRIPT: (0, 3), Stage.AUDIO: (3, 10), Stage.LIPSYNC: (10, 55),
            Stage.ENHANCE: (55, 96), Stage.ENCODE: (96, 100),
        }
    return {Stage.SCRIPT: (0, 3), Stage.AUDIO: (3, 10), Stage.LIPSYNC: (10, 94), Stage.ENCODE: (94, 100)}


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Job:
    id: str
    script: str
    voice_id: str
    avatar_id: str
    engine: str
    enhance: bool = False
    head_motion: bool = False
    status: JobStatus = JobStatus.QUEUED
    stage: Stage = Stage.QUEUED
    progress: int = 0
    message: str = "Waiting for a free renderer"
    error: str | None = None
    audio_path: Path | None = None
    video_path: Path | None = None
    duration_seconds: float | None = None
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


class JobStore:
    """Thread-safe in-memory job registry. Jobs are immutable snapshots."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def add(self, job: Job) -> None:
        with self._lock:
            self._jobs[job.id] = job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **changes) -> Job:
        with self._lock:
            job = replace(self._jobs[job_id], updated_at=_now(), **changes)
            self._jobs[job_id] = job
            return job


def normalize_script(script: str) -> str:
    return re.sub(r"\s+", " ", script).strip()


class Pipeline:
    def __init__(
        self,
        settings: Settings,
        tts: TTSProvider,
        engines: dict[str, LipSyncEngine],
        enhancer: FaceEnhancer,
        store: JobStore,
    ) -> None:
        self._settings = settings
        self._tts = tts
        self._engines = engines
        self._enhancer = enhancer
        self._store = store
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)
        self._executor = ThreadPoolExecutor(
            max_workers=settings.max_concurrent_jobs, thread_name_prefix="oas-job"
        )

    def submit(
        self,
        script: str,
        voice_id: str,
        avatar_id: str,
        avatar_path: Path,
        *,
        engine: str,
        enhance: bool = False,
        head_motion: bool = False,
    ) -> Job:
        """Queue a job. The caller has checked that `engine` exists and is ready."""
        job = Job(
            id=uuid.uuid4().hex,
            script=script,
            voice_id=voice_id,
            avatar_id=avatar_id,
            engine=engine,
            enhance=enhance,
            head_motion=head_motion and self._engines[engine].supports_head_motion,
        )
        self._store.add(job)
        self._executor.submit(self._run, job.id, avatar_path)
        return job

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    # ------------------------------------------------------------------ #

    def _run(self, job_id: str, avatar_path: Path) -> None:
        work_dir = self._settings.jobs_dir / job_id
        work_dir.mkdir(parents=True, exist_ok=True)
        try:
            self._execute(job_id, avatar_path, work_dir)
        except PipelineError as exc:
            logger.warning("Job %s failed: %s", job_id, exc)
            self._store.update(job_id, status=JobStatus.FAILED, error=str(exc), message="Generation failed")
        except Exception as exc:  # noqa: BLE001 - surface anything unexpected to the client
            logger.exception("Job %s crashed", job_id)
            self._store.update(
                job_id, status=JobStatus.FAILED, error=f"Unexpected error: {exc}", message="Generation failed"
            )

    def _execute(self, job_id: str, avatar_path: Path, work_dir: Path) -> None:
        job = self._store.get(job_id)
        assert job is not None

        # 1. Script (and the avatar it will be spoken by)
        self._enter(job_id, Stage.SCRIPT, "Preparing script and avatar")
        text = normalize_script(job.script)
        if not text:
            raise PipelineError("The script is empty")
        avatar = work_dir / "avatar.png"
        media.prepare_avatar(avatar_path, avatar)

        # 2. Audio
        self._enter(job_id, Stage.AUDIO, f"Generating voice ({self._tts.name})")
        audio_path = work_dir / "audio.wav"
        self._tts.synthesize(text, job.voice_id, audio_path)
        duration = media.wav_duration(audio_path)
        self._store.update(job_id, audio_path=audio_path, duration_seconds=round(duration, 2))

        # 3. Lip-sync / animation
        engine = self._engines[job.engine]
        self._enter(job_id, Stage.LIPSYNC, f"Animating avatar ({engine.label})")
        rendered = engine.render(
            avatar,
            audio_path,
            work_dir,
            self._stage_progress(job_id, Stage.LIPSYNC),
            RenderOptions(head_motion=job.head_motion),
        )

        # 3b. Optional face enhancement
        if job.enhance:
            self._enter(job_id, Stage.ENHANCE, "Enhancing faces")
            enhanced = work_dir / "enhanced.mp4"
            self._enhancer.enhance(rendered, enhanced, self._stage_progress(job_id, Stage.ENHANCE))
            rendered = enhanced

        # 4. Video file
        self._enter(job_id, Stage.ENCODE, "Encoding final video")
        final_path = work_dir / "video.mp4"
        if engine.outputs_web_mp4 and not job.enhance:
            shutil.move(rendered, final_path)
        else:
            if not self._ffmpeg:
                raise PipelineError("ffmpeg is required to encode the final video")
            media.to_web_mp4(
                self._ffmpeg,
                rendered,
                final_path,
                expected_duration=duration,
                on_progress=self._stage_progress(job_id, Stage.ENCODE),
            )

        self._store.update(
            job_id,
            status=JobStatus.COMPLETED,
            stage=Stage.DONE,
            progress=100,
            message="Video ready",
            video_path=final_path,
        )

    def _range(self, job_id: str, stage: Stage) -> tuple[int, int]:
        job = self._store.get(job_id)
        assert job is not None
        return stage_ranges(job.enhance)[stage]

    def _enter(self, job_id: str, stage: Stage, message: str) -> None:
        self._store.update(
            job_id,
            status=JobStatus.RUNNING,
            stage=stage,
            progress=self._range(job_id, stage)[0],
            message=message,
        )

    def _stage_progress(self, job_id: str, stage: Stage) -> ProgressCallback:
        start, end = self._range(job_id, stage)

        def report(fraction: float, message: str | None = None) -> None:
            progress = int(start + (end - start) * max(0.0, min(1.0, fraction)))
            changes = {"message": message} if message else {}
            self._store.update(job_id, progress=progress, **changes)

        return report
