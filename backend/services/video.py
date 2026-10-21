"""Lip-sync rendering (avatar image + speech WAV -> talking-head video).

Engines:
  placeholder  Built in. Composes the avatar on a blurred backdrop with an
               audio-reactive waveform and muxes the speech. No lip movement,
               but it exercises the whole pipeline end to end.
  wav2lip      https://github.com/Rudrabha/Wav2Lip run as a subprocess
               (scripts/setup_wav2lip.sh installs a patched checkout).
  sadtalker    https://github.com/OpenTalker/SadTalker run as a subprocess.

Pick one with OAS_LIPSYNC_ENGINE. External engines are invoked through a Python
interpreter (OAS_WAV2LIP_PYTHON / OAS_SADTALKER_PYTHON, default: this one)
rather than imported, so they can live in their own environment.
"""

from __future__ import annotations

import logging
import math
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import threading
from collections import deque
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

from config import Settings
from services import media
from services.common import (
    PipelineError,
    ProgressCallback,
    ProviderStatus,
    ProviderUnavailableError,
)

logger = logging.getLogger(__name__)

FPS = 25


class LipSyncEngine(Protocol):
    name: str
    # True when render() already produces the framed, browser-ready MP4.
    outputs_web_mp4: bool

    def status(self) -> ProviderStatus: ...

    def render(
        self, avatar: Path, audio: Path, work_dir: Path, on_progress: ProgressCallback
    ) -> Path:
        """Render a video of `avatar` speaking `audio`; return the output path."""
        ...


# --------------------------------------------------------------------------- #
# Placeholder
# --------------------------------------------------------------------------- #


class PlaceholderEngine:
    name = "placeholder"
    outputs_web_mp4 = True

    def __init__(self, settings: Settings):
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)

    def status(self) -> ProviderStatus:
        if not self._ffmpeg:
            return ProviderStatus(False, "ffmpeg not found (install it or `pip install imageio-ffmpeg`)")
        return ProviderStatus(True, "Static avatar preview with waveform (no lip-sync)")

    def render(
        self, avatar: Path, audio: Path, work_dir: Path, on_progress: ProgressCallback
    ) -> Path:
        if not self._ffmpeg:
            raise ProviderUnavailableError("ffmpeg not found")
        out = work_dir / "render.mp4"
        graph = ";".join([
            media.canvas_filter("0:v", "base"),
            # Audio-reactive waveform along the bottom edge.
            f"[1:a]showwaves=s={media.CANVAS_WIDTH}x120:mode=cline:scale=sqrt:rate={FPS}:"
            "colors=0xA78BFA@0.85[waves]",
            "[base][waves]overlay=0:H-h-24:shortest=1,format=yuv420p[v]",
        ])
        media.run_ffmpeg(
            self._ffmpeg,
            [
                "-loop", "1", "-framerate", str(FPS), "-i", str(avatar),
                "-i", str(audio),
                "-filter_complex", graph,
                "-map", "[v]", "-map", "1:a",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-shortest", "-movflags", "+faststart",
                str(out),
            ],
            expected_duration=media.wav_duration(audio),
            on_progress=on_progress,
        )
        return out


# --------------------------------------------------------------------------- #
# External open-source engines
# --------------------------------------------------------------------------- #


def _run_engine(
    name: str,
    cmd: list[str],
    *,
    cwd: Path,
    timeout: int,
    env: dict[str, str] | None = None,
    on_line: Callable[[str], None] | None = None,
) -> list[str]:
    """Run an engine, streaming each output line (tqdm's \\r updates included)
    to `on_line`. Returns the last lines of output; raises on failure."""
    logger.info("Running %s: %s", name, shlex.join(cmd))
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            env={**os.environ, "PYTHONUNBUFFERED": "1", **(env or {})},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            errors="replace",
        )
    except FileNotFoundError as exc:
        raise ProviderUnavailableError(f"{name}: could not start {cmd[0]!r}") from exc

    timed_out = threading.Event()

    def kill() -> None:
        timed_out.set()
        proc.kill()

    watchdog = threading.Timer(timeout, kill)
    watchdog.start()
    tail: deque[str] = deque(maxlen=40)
    buffer = ""
    try:
        assert proc.stdout is not None
        while chunk := proc.stdout.read(256):
            buffer += chunk
            *lines, buffer = re.split(r"[\r\n]", buffer)
            for line in filter(None, (raw.strip() for raw in lines)):
                tail.append(line)
                if on_line:
                    on_line(line)
        if buffer.strip():
            tail.append(buffer.strip())
        returncode = proc.wait()
    finally:
        watchdog.cancel()
        if proc.poll() is None:
            proc.kill()

    if timed_out.is_set():
        raise PipelineError(f"{name} timed out after {timeout}s")
    if returncode != 0:
        raise PipelineError(f"{name} failed (exit {returncode}): {_explain_failure(tail)}")
    return list(tail)


def _explain_failure(tail: deque[str]) -> str:
    output = "\n".join(tail)
    if "Face not detected" in output:
        return (
            "no face was found in the avatar. Use a clear, well-lit, front-facing "
            "photo where the whole face is visible."
        )
    missing = re.search(r"No module named '([^']+)'", output)
    if missing:
        return (
            f"its Python environment is missing the '{missing.group(1)}' package "
            "(run backend/scripts/setup_wav2lip.sh)."
        )
    errors = [line for line in tail if "Error" in line or "error" in line]
    return (errors[-1] if errors else output[-600:]) or "no output"


def _ffmpeg_on_path(ffmpeg: str | None, bin_dir: Path) -> dict[str, str]:
    """Wav2Lip shells out to a bare `ffmpeg`; expose ours if PATH has none."""
    if shutil.which("ffmpeg") or not ffmpeg:
        return {}
    bin_dir.mkdir(parents=True, exist_ok=True)
    link = bin_dir / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if not link.exists():
        try:
            link.symlink_to(ffmpeg)
        except OSError:
            shutil.copyfile(ffmpeg, link)
            link.chmod(0o755)
    return {"PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"}


class Wav2LipEngine:
    name = "wav2lip"
    outputs_web_mp4 = False

    def __init__(self, settings: Settings):
        self._dir = settings.wav2lip_dir
        self._checkpoint = settings.wav2lip_checkpoint or (
            self._dir / "checkpoints" / "wav2lip_gan.pth" if self._dir else None
        )
        self._python = settings.wav2lip_python
        self._batch_size = max(1, settings.wav2lip_batch_size)
        self._timeout = settings.engine_timeout_seconds
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)

    def status(self) -> ProviderStatus:
        if not self._dir or not (self._dir / "inference.py").exists():
            return ProviderStatus(
                False,
                f"Wav2Lip not found at {self._dir}: run backend/scripts/setup_wav2lip.sh "
                "or set OAS_WAV2LIP_DIR",
            )
        if not self._checkpoint or not self._checkpoint.exists():
            return ProviderStatus(False, f"Wav2Lip checkpoint not found: {self._checkpoint}")
        detector = self._dir / "face_detection" / "detection" / "sfd" / "s3fd.pth"
        if not detector.exists():
            return ProviderStatus(False, f"Face detector weights not found: {detector}")
        return ProviderStatus(True, f"Wav2Lip ({self._checkpoint.name})")

    def render(
        self, avatar: Path, audio: Path, work_dir: Path, on_progress: ProgressCallback
    ) -> Path:
        status = self.status()
        if not status.ready:
            raise ProviderUnavailableError(status.detail)
        assert self._dir is not None and self._checkpoint is not None

        # Wav2Lip writes scratch files to ./temp, so run it inside the job directory.
        (work_dir / "temp").mkdir(exist_ok=True)
        out_name = "wav2lip.mp4"
        tracker = _Wav2LipProgress(self._batch_size, on_progress)
        on_progress(0.02, "Lip-sync: detecting the face")

        # Unpatched Wav2Lip treats --face as a still image only if the text after
        # the *first* dot in the path is png/jpg, so use a dot-free directory.
        with tempfile.TemporaryDirectory(prefix="oas_wav2lip_") as tmp:
            face = Path(tmp) / f"face{avatar.suffix}"
            shutil.copyfile(avatar, face)
            _run_engine(
                "Wav2Lip",
                [
                    self._python, str(self._dir / "inference.py"),
                    "--checkpoint_path", str(self._checkpoint),
                    "--face", str(face),
                    # Relative to cwd: Wav2Lip passes these through an unquoted shell command.
                    "--audio", audio.name if audio.parent == work_dir else str(audio),
                    "--outfile", out_name,
                    "--wav2lip_batch_size", str(self._batch_size),
                ],
                cwd=work_dir,
                timeout=self._timeout,
                env=_ffmpeg_on_path(self._ffmpeg, Path(tmp) / "bin"),
                on_line=tracker.feed,
            )
        out = work_dir / out_name
        if not out.exists():
            raise PipelineError("Wav2Lip finished but produced no video")
        return out


class _Wav2LipProgress:
    """Turns Wav2Lip's console output into progress updates.

    It prints the number of mel chunks (one per output frame), loads the model
    after the first batch, then advances one tqdm step per batch of frames.
    """

    _MEL_CHUNKS_RE = re.compile(r"Length of mel chunks: (\d+)")
    _TQDM_RE = re.compile(r"(\d+)/(\d+) \[")

    def __init__(self, batch_size: int, report: ProgressCallback):
        self._batch_size = batch_size
        self._report = report
        self._batches: int | None = None
        self._model_loaded = False

    def feed(self, line: str) -> None:
        if match := self._MEL_CHUNKS_RE.search(line):
            self._batches = math.ceil(int(match.group(1)) / self._batch_size)
            self._report(0.08, "Lip-sync: loading the Wav2Lip model")
        elif line.startswith("Model loaded"):
            self._model_loaded = True
            self._report(0.15, f"Lip-sync: rendering frames (batch 1 of {self._batches})")
        elif self._model_loaded and (match := self._TQDM_RE.search(line)):
            done, total = int(match.group(1)), int(match.group(2))
            if total == self._batches and done:
                message = (
                    "Lip-sync: muxing audio"
                    if done == total
                    else f"Lip-sync: rendering frames (batch {done + 1} of {total})"
                )
                self._report(0.15 + 0.8 * done / total, message)


class SadTalkerEngine:
    name = "sadtalker"
    outputs_web_mp4 = False

    def __init__(self, settings: Settings):
        self._dir = settings.sadtalker_dir
        self._python = settings.sadtalker_python
        self._extra_args = shlex.split(settings.sadtalker_extra_args)
        self._timeout = settings.engine_timeout_seconds

    def status(self) -> ProviderStatus:
        if not self._dir or not (self._dir / "inference.py").exists():
            return ProviderStatus(False, "Set OAS_SADTALKER_DIR to a SadTalker checkout")
        if not (self._dir / "checkpoints").is_dir():
            return ProviderStatus(False, "SadTalker checkpoints missing (run scripts/download_models.sh)")
        return ProviderStatus(True, "SadTalker")

    def render(
        self, avatar: Path, audio: Path, work_dir: Path, on_progress: ProgressCallback
    ) -> Path:
        status = self.status()
        if not status.ready:
            raise ProviderUnavailableError(status.detail)
        assert self._dir is not None
        result_dir = work_dir / "sadtalker"
        result_dir.mkdir(parents=True, exist_ok=True)
        on_progress(0.05, "Lip-sync: running SadTalker")
        _run_engine(
            "SadTalker",
            [
                self._python, "inference.py",
                "--driven_audio", str(audio),
                "--source_image", str(avatar),
                "--result_dir", str(result_dir),
                *self._extra_args,
            ],
            cwd=self._dir,
            timeout=self._timeout,
        )
        # SadTalker names its output after a timestamp; the job dir holds only this run.
        videos = sorted(result_dir.rglob("*.mp4"), key=lambda p: p.stat().st_mtime)
        if not videos:
            raise PipelineError("SadTalker finished but produced no video")
        return videos[-1]


# --------------------------------------------------------------------------- #


def create_lipsync_engine(settings: Settings) -> LipSyncEngine:
    engines = {
        "placeholder": PlaceholderEngine,
        "wav2lip": Wav2LipEngine,
        "sadtalker": SadTalkerEngine,
    }
    try:
        return engines[settings.lipsync_engine](settings)
    except KeyError:
        raise ValueError(
            f"Unknown OAS_LIPSYNC_ENGINE '{settings.lipsync_engine}'. "
            f"Choose one of: {', '.join(engines)}"
        ) from None
