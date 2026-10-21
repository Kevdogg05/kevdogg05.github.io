"""Types shared by the pipeline services."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

ProgressCallback = Callable[[float], None]
"""Receives a completion fraction between 0.0 and 1.0."""


class PipelineError(Exception):
    """A failure whose message is safe and useful to show the user."""


class ProviderUnavailableError(PipelineError):
    """The configured TTS provider or render engine is not installed or configured."""


@dataclass(frozen=True)
class ProviderStatus:
    ready: bool
    detail: str
