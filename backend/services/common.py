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
