"""Running external engines (Wav2Lip, SadTalker, GFPGAN) as subprocesses."""

from __future__ import annotations

import logging
import os
import re
import shlex
import shutil
import subprocess
import threading
import time
from collections import deque
from collections.abc import Callable
from pathlib import Path

from services.common import JobCancelled, PipelineError, ProviderUnavailableError, current_cancel

logger = logging.getLogger(__name__)


class Supervisor:
    """Kills a subprocess when it times out or the current job is cancelled.

    Use as a context manager around the code that waits for the process, then
    call raise_if_stopped() once it has exited.
    """

    def __init__(self, name: str, proc: subprocess.Popen, timeout: float | None = None):
        self._name = name
        self._proc = proc
        self._timeout = timeout
        self._deadline = time.monotonic() + timeout if timeout else None
        self._cancel = current_cancel.get()
        self._done = threading.Event()
        self.cancelled = self.timed_out = False
        self._thread = threading.Thread(target=self._watch, name=f"oas-watch-{name}", daemon=True)

    def __enter__(self) -> Supervisor:
        self._thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self._done.set()
        self._thread.join()
        if self._proc.poll() is None:
            self._proc.kill()
            self._proc.wait()

    def _watch(self) -> None:
        while not self._done.wait(0.2):
            if self._cancel is not None and self._cancel.is_set():
                self.cancelled = True
            elif self._deadline is not None and time.monotonic() > self._deadline:
                self.timed_out = True
            else:
                continue
            self._proc.kill()
            return

    def raise_if_stopped(self) -> None:
        if self.cancelled:
            raise JobCancelled()
        if self.timed_out:
            raise PipelineError(f"{self._name} timed out after {self._timeout:.0f}s")


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

    tail: deque[str] = deque(maxlen=40)
    buffer = ""
    with Supervisor(name, proc, timeout) as supervisor:
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

    supervisor.raise_if_stopped()
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
