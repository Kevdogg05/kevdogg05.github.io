"""Running external engines (Wav2Lip, SadTalker, GFPGAN) as subprocesses."""

from __future__ import annotations

import logging
import os
import re
import shlex
import shutil
import subprocess
import threading
from collections import deque
from collections.abc import Callable
from pathlib import Path

from services.common import PipelineError, ProviderUnavailableError

logger = logging.getLogger(__name__)


def run_engine(
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
        raise PipelineError(f"{name} failed (exit {returncode}): {explain_failure(tail)}")
    return list(tail)


def explain_failure(tail: deque[str]) -> str:
    output = "\n".join(tail)
    # Wav2Lip and SadTalker phrase "no face in the photo" differently.
    if "Face not detected" in output or "can not detect the landmark" in output:
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


def ffmpeg_on_path(ffmpeg: str | None, bin_dir: Path) -> dict[str, str]:
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
