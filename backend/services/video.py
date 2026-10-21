"""Lip-sync rendering (avatar image + speech WAV -> talking-head video).

Engines:
  placeholder  Built in. Composes the avatar on a blurred backdrop with an
               audio-reactive waveform and muxes the speech. No lip movement,
               but it exercises the whole pipeline end to end.
  wav2lip      https://github.com/Rudrabha/Wav2Lip run as a subprocess.
  sadtalker    https://github.com/OpenTalker/SadTalker run as a subprocess.

Pick one with OAS_LIPSYNC_ENGINE. The external engines usually live in their
own virtualenv/conda env with GPU dependencies, so they are invoked through
their own Python interpreter (OAS_WAV2LIP_PYTHON / OAS_SADTALKER_PYTHON)
rather than imported.
"""

from __future__ import annotations

import logging
import shlex
import shutil
import subprocess
import tempfile
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

CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 720
FPS = 25


class LipSyncEngine(Protocol):
    name: str
    # True when render() already produces browser-ready H.264/AAC MP4.
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
        w, h = CANVAS_WIDTH, CANVAS_HEIGHT
        graph = ";".join([
            "[0:v]split=2[bgsrc][fgsrc]",
            # Blurred, darkened cover of the avatar fills the 16:9 frame...
            f"[bgsrc]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            "boxblur=24:2,eq=brightness=-0.18[bg]",
            # ...with the full avatar centred on top of it.
            f"[fgsrc]scale={w}:{h}:force_original_aspect_ratio=decrease[fg]",
            "[bg][fg]overlay=(W-w)/2:(H-h)/2[base]",
            # Audio-reactive waveform along the bottom edge.
            f"[1:a]showwaves=s={w}x120:mode=cline:scale=sqrt:rate={FPS}:colors=0xA78BFA@0.85[waves]",
            f"[base][waves]overlay=0:H-h-24:shortest=1,format=yuv420p[v]",
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


def _run_engine(name: str, cmd: list[str], cwd: Path, timeout: int) -> None:
    logger.info("Running %s: %s", name, shlex.join(cmd))
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
    except FileNotFoundError as exc:
        raise ProviderUnavailableError(f"{name}: could not start {cmd[0]!r}") from exc
    except subprocess.TimeoutExpired as exc:
        raise PipelineError(f"{name} timed out after {timeout}s") from exc
    if result.returncode != 0:
        tail = (result.stderr or result.stdout).strip()[-600:]
        raise PipelineError(f"{name} failed (exit {result.returncode}): {tail}")


class Wav2LipEngine:
    name = "wav2lip"
    outputs_web_mp4 = False

    def __init__(self, settings: Settings):
        self._dir = settings.wav2lip_dir
        self._checkpoint = settings.wav2lip_checkpoint or (
            self._dir / "checkpoints" / "wav2lip_gan.pth" if self._dir else None
        )
        self._python = settings.wav2lip_python
        self._timeout = settings.engine_timeout_seconds

    def status(self) -> ProviderStatus:
        if not self._dir or not (self._dir / "inference.py").exists():
            return ProviderStatus(False, "Set OAS_WAV2LIP_DIR to a Wav2Lip checkout")
        if not self._checkpoint or not self._checkpoint.exists():
            return ProviderStatus(False, f"Wav2Lip checkpoint not found: {self._checkpoint}")
        return ProviderStatus(True, f"Wav2Lip ({self._checkpoint.name})")

    def render(
        self, avatar: Path, audio: Path, work_dir: Path, on_progress: ProgressCallback
    ) -> Path:
        status = self.status()
        if not status.ready:
            raise ProviderUnavailableError(status.detail)
        out = work_dir / "wav2lip.mp4"
        # Wav2Lip treats --face as a still image only if the text after the *first*
        # dot in the path is png/jpg, so hand it a copy in a dot-free directory.
        with tempfile.TemporaryDirectory(prefix="oas_wav2lip_") as tmp:
            face = Path(tmp) / f"face{avatar.suffix}"
            shutil.copyfile(avatar, face)
            _run_engine(
                "Wav2Lip",
                [
                    self._python, "inference.py",
                    "--checkpoint_path", str(self._checkpoint),
                    "--face", str(face),
                    "--audio", str(audio),
                    "--outfile", str(out),
                ],
                cwd=self._dir,
                timeout=self._timeout,
            )
        if not out.exists():
            raise PipelineError("Wav2Lip finished but produced no video")
        return out


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
        result_dir = work_dir / "sadtalker"
        result_dir.mkdir(parents=True, exist_ok=True)
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
