"""ffmpeg helpers shared by the audio and video services."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from services.common import PipelineError, ProgressCallback
from services.external import Supervisor

logger = logging.getLogger(__name__)

# Every engine's output is framed onto this 16:9 canvas.
CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 720

def resolve_ffmpeg(configured: str = "") -> str | None:
    """Find an ffmpeg binary: explicit setting, then PATH, then the imageio-ffmpeg wheel."""
    if configured:
        return configured if Path(configured).exists() or shutil.which(configured) else None
    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001 - optional fallback, any failure means "not found"
        return None


def prepare_avatar(src: Path, dst: Path) -> None:
    """Normalise an uploaded portrait for the render engines.

    Applies the EXIF orientation (phone photos are often stored sideways, which
    defeats face detection), drops alpha and metadata, shrinks it to fit the
    canvas and makes both sides even, as H.264 requires.
    """
    try:
        with Image.open(src) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise PipelineError("The avatar image could not be read; please upload it again") from exc
    image.thumbnail((CANVAS_WIDTH, CANVAS_HEIGHT), Image.Resampling.LANCZOS)
    width, height = image.width - image.width % 2, image.height - image.height % 2
    if width < 64 or height < 64:
        raise PipelineError("The avatar image is too small; use one at least 64×64 pixels")
    image.crop((0, 0, width, height)).save(dst, format="PNG")


def canvas_filter(source: str, output: str) -> str:
    """ffmpeg filtergraph that centres `source` on a blurred, darkened copy of itself."""
    w, h = CANVAS_WIDTH, CANVAS_HEIGHT
    return ";".join([
        f"[{source}]split=2[bgsrc][fgsrc]",
        f"[bgsrc]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        "boxblur=24:2,eq=brightness=-0.18[bg]",
        f"[fgsrc]scale={w}:{h}:force_original_aspect_ratio=decrease[fg]",
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[{output}]",
    ])


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / float(wav.getframerate())


def run_ffmpeg(
    ffmpeg: str,
    args: list[str],
    *,
    expected_duration: float | None = None,
    on_progress: ProgressCallback | None = None,
) -> None:
    """Run ffmpeg, streaming its machine-readable progress to `on_progress`."""
    cmd = [ffmpeg, "-hide_banner", "-nostats", "-loglevel", "error", "-y"]
    if on_progress and expected_duration:
        cmd += ["-progress", "pipe:1"]
    cmd += args
    logger.debug("ffmpeg: %s", " ".join(cmd))

    # stderr goes to a temp file so a chatty ffmpeg can never block on a full pipe.
    with tempfile.TemporaryFile(mode="w+") as stderr:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=stderr, text=True)
        assert proc.stdout is not None
        with Supervisor("ffmpeg", proc) as supervisor:
            for line in proc.stdout:
                if not (on_progress and expected_duration):
                    continue
                key, _, value = line.strip().partition("=")
                if key == "out_time_us" and value.isdigit():
                    on_progress(min(1.0, int(value) / 1_000_000 / expected_duration))
            returncode = proc.wait()
        supervisor.raise_if_stopped()
        if returncode != 0:
            stderr.seek(0)
            detail = stderr.read().strip()[-500:] or "unknown error"
            raise PipelineError(f"ffmpeg failed: {detail}")


def to_wav(ffmpeg: str, src: Path, dst: Path) -> None:
    """Decode any audio file to 16-bit PCM WAV (the format lip-sync models expect)."""
    run_ffmpeg(ffmpeg, ["-i", str(src), "-vn", "-acodec", "pcm_s16le", str(dst)])


def to_web_mp4(
    ffmpeg: str,
    src: Path,
    dst: Path,
    *,
    expected_duration: float | None = None,
    on_progress: ProgressCallback | None = None,
) -> None:
    """Frame an engine's output on the canvas as an MP4 every browser can play and seek."""
    run_ffmpeg(
        ffmpeg,
        [
            "-i", str(src),
            "-filter_complex", canvas_filter("0:v", "framed") + ";[framed]format=yuv420p[v]",
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k",
            "-movflags", "+faststart",
            str(dst),
        ],
        expected_duration=expected_duration,
        on_progress=on_progress,
    )


def poster_frame(ffmpeg: str, video: Path, dst: Path, *, at_seconds: float = 1.0) -> None:
    """Save one frame of `video` as a 640px-wide JPEG for the video library."""
    run_ffmpeg(
        ffmpeg,
        ["-ss", f"{at_seconds:.2f}", "-i", str(video), "-frames:v", "1",
         "-vf", "scale=640:-2", "-q:v", "4", str(dst)],
    )
