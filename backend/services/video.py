"""Lip-sync rendering (avatar image + speech WAV -> talking-head video).

Engines:
  placeholder  Built in. Composes the avatar on a blurred backdrop with an
               audio-reactive waveform and muxes the speech. No lip movement,
               but it exercises the whole pipeline end to end.
  wav2lip      https://github.com/Rudrabha/Wav2Lip run as a subprocess
               (scripts/setup_wav2lip.sh installs a patched checkout).
  sadtalker    https://github.com/OpenTalker/SadTalker run as a subprocess
               (scripts/setup_sadtalker.sh). Animates the whole face: blinks,
               expressions and, optionally, head motion. Slow on CPU.

Every engine is available per job; OAS_LIPSYNC_ENGINE picks the default.
External engines are invoked through a Python interpreter (OAS_WAV2LIP_PYTHON /
OAS_SADTALKER_PYTHON, default: this one) rather than imported, so they can live
in their own environment.
"""

from __future__ import annotations

import logging
import math
import re
import shlex
import shutil
import tempfile
from pathlib import Path
from typing import Protocol

from config import Settings
from services import media
from services.common import (
    CostEstimate,
    PipelineError,
    ProgressCallback,
    ProviderStatus,
    ProviderUnavailableError,
    RenderOptions,
)
from services.external import ffmpeg_on_path, run_engine

logger = logging.getLogger(__name__)

FPS = 25


class LipSyncEngine(Protocol):
    name: str
    label: str
    summary: str
    supports_head_motion: bool
    cpu_cost: CostEstimate
    # True when render() already produces the framed, browser-ready MP4.
    outputs_web_mp4: bool

    def status(self) -> ProviderStatus: ...

    def render(
        self,
        avatar: Path,
        audio: Path,
        work_dir: Path,
        on_progress: ProgressCallback,
        options: RenderOptions,
    ) -> Path:
        """Render a video of `avatar` speaking `audio`; return the output path."""
        ...


# --------------------------------------------------------------------------- #
# Placeholder
# --------------------------------------------------------------------------- #


class PlaceholderEngine:
    name = "placeholder"
    label = "Preview"
    summary = "Still photo with an audio waveform. No lip-sync; instant."
    supports_head_motion = False
    cpu_cost = CostEstimate(1, 0.4)
    outputs_web_mp4 = True

    def __init__(self, settings: Settings):
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)

    def status(self) -> ProviderStatus:
        if not self._ffmpeg:
            return ProviderStatus(False, "ffmpeg not found (install it or `pip install imageio-ffmpeg`)")
        return ProviderStatus(True, "Static avatar preview with waveform (no lip-sync)")

    def render(
        self,
        avatar: Path,
        audio: Path,
        work_dir: Path,
        on_progress: ProgressCallback,
        options: RenderOptions,
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


class Wav2LipEngine:
    name = "wav2lip"
    label = "Wav2Lip"
    summary = "Accurate lip-sync on a still photo. Fast."
    supports_head_motion = False
    cpu_cost = CostEstimate(12, 0.7)
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
        self,
        avatar: Path,
        audio: Path,
        work_dir: Path,
        on_progress: ProgressCallback,
        options: RenderOptions,
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
            run_engine(
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
                env=ffmpeg_on_path(self._ffmpeg, Path(tmp) / "bin"),
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
    label = "SadTalker"
    summary = "Animates the whole face: blinks, expressions and optional head motion. Slow on CPU."
    supports_head_motion = True
    cpu_cost = CostEstimate(15, 95)
    outputs_web_mp4 = False

    CHECKPOINTS = ("SadTalker_V0.0.2_256.safetensors", "mapping_00109-model.pth.tar")
    FACE_WEIGHTS = ("alignment_WFLW_4HG.pth", "detection_Resnet50_Final.pth")

    def __init__(self, settings: Settings):
        self._dir = settings.sadtalker_dir
        self._python = settings.sadtalker_python
        self._batch_size = max(1, settings.sadtalker_batch_size)
        self._extra_args = shlex.split(settings.sadtalker_extra_args)
        self._timeout = settings.engine_timeout_seconds
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)

    def status(self) -> ProviderStatus:
        if not self._dir or not (self._dir / "inference.py").exists():
            return ProviderStatus(
                False,
                f"SadTalker not found at {self._dir}: run backend/scripts/setup_sadtalker.sh "
                "or set OAS_SADTALKER_DIR",
            )
        # SadTalker reads its face-alignment weights from ./gfpgan/weights.
        required = [self._dir / "checkpoints" / name for name in self.CHECKPOINTS]
        required += [self._dir / "gfpgan" / "weights" / name for name in self.FACE_WEIGHTS]
        missing = [path.name for path in required if not path.exists()]
        if missing:
            return ProviderStatus(False, f"SadTalker model files missing: {', '.join(missing)}")
        return ProviderStatus(True, "SadTalker 256px")

    def render(
        self,
        avatar: Path,
        audio: Path,
        work_dir: Path,
        on_progress: ProgressCallback,
        options: RenderOptions,
    ) -> Path:
        status = self.status()
        if not status.ready:
            raise ProviderUnavailableError(status.detail)
        assert self._dir is not None
        result_dir = work_dir / "sadtalker"
        result_dir.mkdir(parents=True, exist_ok=True)
        on_progress(0.01, "Animating: starting SadTalker")
        tail = run_engine(
            "SadTalker",
            [
                self._python, "inference.py",
                "--driven_audio", str(audio),
                "--source_image", str(avatar),
                "--result_dir", str(result_dir),
                "--checkpoint_dir", str(self._dir / "checkpoints"),
                # "full" animates the face inside the whole photo instead of a face crop.
                "--preprocess", "full",
                "--size", "256",
                "--batch_size", str(self._batch_size),
                *([] if options.head_motion else ["--still"]),
                *self._extra_args,
            ],
            # SadTalker resolves its config and weights relative to its checkout.
            cwd=self._dir,
            timeout=self._timeout,
            env=ffmpeg_on_path(self._ffmpeg, work_dir / "bin"),
            on_line=_SadTalkerProgress(on_progress).feed,
        )
        if any("Can't get the coeffs" in line for line in tail):
            raise PipelineError(
                "SadTalker could not find a face in the avatar. Use a clear, well-lit, "
                "front-facing photo where the whole face is visible."
            )
        # SadTalker names its output after a timestamp; the job dir holds only this run.
        videos = sorted(result_dir.glob("*.mp4"), key=lambda p: p.stat().st_mtime)
        if not videos:
            raise PipelineError("SadTalker finished but produced no video")
        return videos[-1]


class _SadTalkerProgress:
    """Maps SadTalker's tqdm stages ("Face Renderer:: 12/52 ...") to progress."""

    _TQDM_RE = re.compile(r"^(.*?)::\s*\d+%\|.*?\|\s*(\d+)/(\d+)")
    # stage prefix -> (start, end, message)
    _STAGES = {
        "landmark Det": (0.02, 0.04, "Animating: finding facial landmarks"),
        "3DMM Extraction In Video": (0.04, 0.06, "Animating: fitting a 3D face model"),
        "mel": (0.06, 0.07, "Animating: analysing the speech"),
        "audio2exp": (0.07, 0.08, "Animating: predicting expressions"),
        "Face Renderer": (0.08, 0.94, "Animating: rendering frames"),
        "seamlessClone": (0.94, 1.0, "Animating: blending the face into the photo"),
    }

    def __init__(self, report: ProgressCallback):
        self._report = report

    def feed(self, line: str) -> None:
        match = self._TQDM_RE.match(line)
        if not match or match.group(1).strip() not in self._STAGES:
            return
        start, end, message = self._STAGES[match.group(1).strip()]
        done, total = int(match.group(2)), int(match.group(3))
        if total and match.group(1).strip() == "Face Renderer":
            message = f"{message} (batch {min(done + 1, total)} of {total})"
        self._report(start + (end - start) * (done / total if total else 0), message)


# --------------------------------------------------------------------------- #


def create_lipsync_engines(settings: Settings) -> dict[str, LipSyncEngine]:
    """Every engine, keyed by name. OAS_LIPSYNC_ENGINE must name one of them."""
    engines: dict[str, LipSyncEngine] = {
        engine.name: engine
        for engine in (
            Wav2LipEngine(settings),
            SadTalkerEngine(settings),
            PlaceholderEngine(settings),
        )
    }
    if settings.lipsync_engine not in engines:
        raise ValueError(
            f"Unknown OAS_LIPSYNC_ENGINE '{settings.lipsync_engine}'. "
            f"Choose one of: {', '.join(engines)}"
        )
    return engines
