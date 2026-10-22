"""Types shared by the pipeline services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class ProgressCallback(Protocol):
    def __call__(self, fraction: float, message: str | None = None) -> None:
        """Report completion (0.0–1.0) and, optionally, a new status message."""


class PipelineError(Exception):
    """A failure whose message is safe and useful to show the user."""


class ProviderUnavailableError(PipelineError):
    """The configured TTS provider or render engine is not installed or configured."""


@dataclass(frozen=True)
class ProviderStatus:
    ready: bool
    detail: str


@dataclass(frozen=True)
class RenderOptions:
    """Per-job choices that engines may honour."""

    head_motion: bool = False  # only engines with supports_head_motion use it


@dataclass(frozen=True)
class CostEstimate:
    """Rough CPU render time: a fixed cost plus seconds per second of video.

    Measured on a 4-core x86 CPU without a GPU; a CUDA GPU is far faster.
    """

    fixed_seconds: float
    seconds_per_second: float
