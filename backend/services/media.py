"""ffmpeg helpers shared by the audio and video services."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

from services.common import PipelineError, ProgressCallback

logger = logging.getLogger(__name__)

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
        for line in proc.stdout:
            if not (on_progress and expected_duration):
                continue
            key, _, value = line.strip().partition("=")
            if key == "out_time_us" and value.isdigit():
                on_progress(min(1.0, int(value) / 1_000_000 / expected_duration))
        if proc.wait() != 0:
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
    """Transcode an engine's output into an MP4 every browser can play and seek."""
    run_ffmpeg(
        ffmpeg,
        [
            "-i", str(src),
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k",
            "-movflags", "+faststart",
            str(dst),
        ],
        expected_duration=expected_duration,
        on_progress=on_progress,
    )
