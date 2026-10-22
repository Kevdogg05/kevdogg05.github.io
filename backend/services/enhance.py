"""Face enhancement: GFPGAN v1.4 restores the face in every rendered frame.

Lip-sync models generate the face at low resolution (Wav2Lip: 96 px, SadTalker:
256 px), so the mouth and eyes come out soft. engines/gfpgan_enhance.py runs as
a subprocess (OAS_ENHANCER_PYTHON, default: this interpreter) and restores the
face frame by frame. It is optional per job and costs about as much CPU time as
a SadTalker render; a GPU makes it quick.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

from config import BACKEND_DIR, Settings
from services import media
from services.common import (
    CostEstimate,
    PipelineError,
    ProgressCallback,
    ProviderStatus,
    ProviderUnavailableError,
)
from services.external import run_engine

SCRIPT = BACKEND_DIR / "engines" / "gfpgan_enhance.py"
WEIGHTS = ("GFPGANv1.4.pth", "detection_Resnet50_Final.pth", "parsing_parsenet.pth")
_PROGRESS_RE = re.compile(r"^progress (\d+)/(\d+)$")


class FaceEnhancer:
    name = "gfpgan"
    label = "GFPGAN v1.4"
    cpu_cost = CostEstimate(5, 45)

    def __init__(self, settings: Settings, script: Path | None = None):
        self._weights = settings.face_weights_dir
        self._python = settings.enhancer_python
        self._script = script or SCRIPT
        self._timeout = settings.engine_timeout_seconds
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)

    def status(self) -> ProviderStatus:
        missing = [name for name in WEIGHTS if not (self._weights / name).exists()]
        if missing:
            return ProviderStatus(
                False, f"Face enhancer weights missing ({', '.join(missing)}): run backend/scripts/setup_gfpgan.sh"
            )
        if package := self._missing_package():
            return ProviderStatus(
                False, f"Python package '{package}' missing: run backend/scripts/setup_gfpgan.sh"
            )
        if not self._ffmpeg:
            return ProviderStatus(False, "ffmpeg not found")
        return ProviderStatus(True, self.label)

    def _missing_package(self) -> str | None:
        # Only checkable when the enhancer shares this interpreter.
        if self._python != sys.executable:
            return None
        return next(
            (p for p in ("gfpgan", "facexlib", "torchvision") if importlib.util.find_spec(p) is None),
            None,
        )

    def enhance(self, src: Path, dst: Path, on_progress: ProgressCallback) -> None:
        status = self.status()
        if not status.ready:
            raise ProviderUnavailableError(status.detail)
        assert self._ffmpeg is not None

        def track(line: str) -> None:
            if match := _PROGRESS_RE.match(line):
                done, total = int(match.group(1)), int(match.group(2))
                if total:
                    on_progress(done / total, f"Enhancing faces (frame {done} of {total})")

        on_progress(0.0, "Enhancing faces: loading GFPGAN")
        run_engine(
            "Face enhancer",
            [
                self._python, str(self._script), str(src), str(dst),
                "--weights", str(self._weights), "--ffmpeg", self._ffmpeg,
            ],
            cwd=dst.parent,
            timeout=self._timeout,
            on_line=track,
        )
        if not dst.exists():
            raise PipelineError("The face enhancer finished but produced no video")
