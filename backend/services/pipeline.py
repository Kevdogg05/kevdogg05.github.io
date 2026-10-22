"""Generation orchestration: Script -> Audio -> Lip-Sync -> Video file.

Jobs are persisted (services/jobs.py) and run on a small worker pool
(OAS_MAX_CONCURRENT_JOBS, default 1, since lip-sync models usually saturate a
GPU), so several videos can be queued. On startup, queued jobs resume and jobs
that were mid-render are marked as interrupted. A queued or running job can be
cancelled; running engine subprocesses are killed. Finished jobs keep only the
final video, its audio and a poster frame.
"""

from __future__ import annotations

import logging
import re
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path

from config import Settings
from services import media
from services.audio import TTSProvider
from services.common import (
    JobCancelled,
    PipelineError,
    ProgressCallback,
    RenderOptions,
    current_cancel,
)
from services.enhance import FaceEnhancer
from services.jobs import Job, JobStatus, JobStore, Stage, now
from services.storage import AvatarStore
from services.video import LipSyncEngine

logger = logging.getLogger(__name__)

# What a finished job keeps on disk; engines' intermediate files are removed.
KEEP_FILES = {"video.mp4", "audio.wav", "poster.jpg"}
INTERRUPTED = "Interrupted because the backend restarted. Use Retry to render it again."


class JobConflict(Exception):
    """The job is in the wrong state for the requested action."""


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
        avatars: AvatarStore,
    ) -> None:
        self._settings = settings
        self._tts = tts
        self._engines = engines
        self._enhancer = enhancer
        self._store = store
        self._avatars = avatars
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)
        self._executor = ThreadPoolExecutor(
            max_workers=settings.max_concurrent_jobs, thread_name_prefix="oas-job"
        )
        # Guards job state transitions between the API and the workers.
        self._lock = threading.Lock()
        self._cancel_events: dict[str, threading.Event] = {}
        self._shutting_down = False

    # -- lifecycle --------------------------------------------------------- #

    def start(self) -> None:
        """Recover jobs left over from the previous run, then apply retention."""
        for job in self._store.with_status(JobStatus.RUNNING):
            logger.warning("Job %s was interrupted by a restart", job.id)
            self._store.update(
                job.id, status=JobStatus.FAILED, error=INTERRUPTED,
                message="Generation failed", finished_at=now(),
            )
            self._tidy(job.id)
        for job in self._store.with_status(JobStatus.QUEUED):
            self._enqueue(job.id)
        self.apply_retention()

    def shutdown(self) -> None:
        # Stop engine subprocesses so a restart isn't held up by a long render.
        # Running jobs end as "interrupted"; queued ones stay queued for next time.
        self._shutting_down = True
        for event in list(self._cancel_events.values()):
            event.set()
        self._executor.shutdown(wait=False, cancel_futures=True)

    # -- actions ----------------------------------------------------------- #

    def submit(
        self,
        script: str,
        voice_id: str,
        avatar_id: str,
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
        self._enqueue(job.id)
        return job

    def retry(self, job_id: str) -> Job:
        """Queue a new job with the same script, voice, avatar and options."""
        job = self._require(job_id)
        if not job.status.finished:
            raise JobConflict("The job is still in progress")
        if job.engine not in self._engines:
            raise JobConflict(f"Engine '{job.engine}' is no longer available")
        return self.submit(
            job.script, job.voice_id, job.avatar_id,
            engine=job.engine, enhance=job.enhance, head_motion=job.head_motion,
        )

    def cancel(self, job_id: str) -> Job:
        with self._lock:
            job = self._require(job_id)
            if job.status.finished:
                raise JobConflict("The job has already finished")
            self._cancel_events.setdefault(job_id, threading.Event()).set()
            if job.status is JobStatus.QUEUED:
                # Never started: its worker will skip it.
                return self._store.update(
                    job_id, status=JobStatus.CANCELLED, message="Cancelled", finished_at=now()
                )
            # Running: the worker stops at its next check or kills the engine process.
            return self._store.update(job_id, message="Cancelling…")

    def delete(self, job_id: str) -> None:
        with self._lock:
            job = self._require(job_id)
            if not job.status.finished:
                raise JobConflict("Cancel the job before deleting it")
            self._store.delete(job_id)
        shutil.rmtree(self._work_dir(job_id), ignore_errors=True)

    def apply_retention(self) -> None:
        """Delete finished jobs, and avatars no job uses, older than OAS_RETENTION_DAYS."""
        days = self._settings.retention_days
        if days <= 0:
            return
        cutoff = now() - timedelta(days=days)
        for job in self._store.finished_before(cutoff):
            logger.info("Retention: deleting job %s from %s", job.id, f"{job.created_at:%Y-%m-%d}")
            self.delete(job.id)
        self._avatars.delete_unused(self._store.avatar_ids_in_use(), older_than=cutoff)

    # -- worker ------------------------------------------------------------ #

    def _enqueue(self, job_id: str) -> None:
        self._cancel_events.setdefault(job_id, threading.Event())
        self._executor.submit(self._run, job_id)

    def _run(self, job_id: str) -> None:
        with self._lock:
            job = self._store.get(job_id)
            if self._shutting_down or job is None or job.status is not JobStatus.QUEUED:
                return  # shutting down, or cancelled/deleted while waiting
            self._store.update(job_id, status=JobStatus.RUNNING, started_at=now(), message="Starting")
        cancel = self._cancel_events.setdefault(job_id, threading.Event())
        token = current_cancel.set(cancel)
        work_dir = self._work_dir(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)
        try:
            self._execute(job_id, work_dir, cancel)
        except JobCancelled:
            if self._shutting_down:
                self._finish(job_id, status=JobStatus.FAILED, error=INTERRUPTED, message="Generation failed")
            else:
                logger.info("Job %s cancelled", job_id)
                self._finish(job_id, status=JobStatus.CANCELLED, message="Cancelled")
        except PipelineError as exc:
            logger.warning("Job %s failed: %s", job_id, exc)
            self._finish(job_id, status=JobStatus.FAILED, error=str(exc), message="Generation failed")
        except Exception as exc:  # noqa: BLE001 - surface anything unexpected to the client
            logger.exception("Job %s crashed", job_id)
            self._finish(
                job_id, status=JobStatus.FAILED, error=f"Unexpected error: {exc}", message="Generation failed"
            )
        finally:
            current_cancel.reset(token)
            self._cancel_events.pop(job_id, None)
            self._tidy(job_id)
            self.apply_retention()

    def _execute(self, job_id: str, work_dir: Path, cancel: threading.Event) -> None:
        job = self._require(job_id)

        def checkpoint() -> None:
            if cancel.is_set():
                raise JobCancelled()

        # 1. Script (and the avatar it will be spoken by)
        self._enter(job_id, Stage.SCRIPT, "Preparing script and avatar")
        text = normalize_script(job.script)
        if not text:
            raise PipelineError("The script is empty")
        source = self._avatars.find(job.avatar_id)
        if source is None:
            raise PipelineError("The avatar image no longer exists; upload it again")
        avatar = work_dir / "avatar.png"
        media.prepare_avatar(source, avatar)
        checkpoint()

        # 2. Audio
        self._enter(job_id, Stage.AUDIO, f"Generating voice ({self._tts.name})")
        audio_path = work_dir / "audio.wav"
        self._tts.synthesize(text, job.voice_id, audio_path)
        duration = media.wav_duration(audio_path)
        self._store.update(job_id, audio_path=audio_path, duration_seconds=round(duration, 2))
        checkpoint()

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
        checkpoint()

        # 3b. Optional face enhancement
        if job.enhance:
            self._enter(job_id, Stage.ENHANCE, "Enhancing faces")
            enhanced = work_dir / "enhanced.mp4"
            self._enhancer.enhance(rendered, enhanced, self._stage_progress(job_id, Stage.ENHANCE))
            rendered = enhanced
            checkpoint()

        # 4. Video file (+ a poster frame for the library)
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
        poster = self._poster(final_path, work_dir / "poster.jpg", duration)

        self._finish(
            job_id,
            status=JobStatus.COMPLETED,
            stage=Stage.DONE,
            progress=100,
            message="Video ready",
            video_path=final_path,
            poster_path=poster,
        )

    def _poster(self, video: Path, poster: Path, duration: float) -> Path | None:
        if not self._ffmpeg:
            return None
        try:
            media.poster_frame(self._ffmpeg, video, poster, at_seconds=min(1.0, duration / 3))
        except PipelineError:
            logger.warning("Could not extract a poster frame from %s", video)
            return None
        return poster

    def _finish(self, job_id: str, **changes) -> None:
        self._store.update(job_id, finished_at=now(), **changes)

    def _tidy(self, job_id: str) -> None:
        """Remove engines' intermediate files and record what the job keeps on disk."""
        work_dir = self._work_dir(job_id)
        if not work_dir.is_dir():
            return
        size = 0
        for entry in work_dir.iterdir():
            if entry.name in KEEP_FILES and entry.is_file():
                size += entry.stat().st_size
            elif entry.is_dir() and not entry.is_symlink():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
        if self._store.get(job_id) is not None:
            self._store.update(job_id, size_bytes=size)

    # -- helpers ----------------------------------------------------------- #

    def _work_dir(self, job_id: str) -> Path:
        return self._settings.jobs_dir / job_id

    def _require(self, job_id: str) -> Job:
        job = self._store.get(job_id)
        if job is None:
            raise KeyError(job_id)
        return job

    def _range(self, job_id: str, stage: Stage) -> tuple[int, int]:
        return stage_ranges(self._require(job_id).enhance)[stage]

    def _enter(self, job_id: str, stage: Stage, message: str) -> None:
        self._store.update(
            job_id, stage=stage, progress=self._range(job_id, stage)[0], message=message
        )

    def _stage_progress(self, job_id: str, stage: Stage) -> ProgressCallback:
        start, end = self._range(job_id, stage)

        def report(fraction: float, message: str | None = None) -> None:
            progress = int(start + (end - start) * max(0.0, min(1.0, fraction)))
            changes = {"message": message} if message else {}
            self._store.update(job_id, progress=progress, **changes)

        return report
