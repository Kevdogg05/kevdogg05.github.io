"""Which device the ML engines will run on, for time estimates in the UI."""

from __future__ import annotations

import importlib.util
import logging

logger = logging.getLogger(__name__)

_device: str | None = None


def detect_device() -> str:
    """Return "cuda" when PyTorch sees a GPU, else "cpu". Imports torch (slow),
    so call it from a background thread."""
    global _device
    if _device is None:
        device = "cpu"
        if importlib.util.find_spec("torch") is not None:
            try:
                import torch

                device = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:  # noqa: BLE001 - a broken torch install means CPU-only
                logger.exception("Could not query PyTorch for a GPU")
        _device = device
    return _device


def current_device() -> str:
    """The detected device, or "unknown" until detect_device() has finished."""
    return _device or "unknown"
