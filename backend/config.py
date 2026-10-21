"""Runtime configuration, read from environment variables (and backend/.env if present).

Every setting has a working default so the app runs out of the box with the
placeholder voice and render engines. See .env.example for the full list.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:  # python-dotenv ships with uvicorn[standard]; .env support is optional.
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

BACKEND_DIR = Path(__file__).resolve().parent

if load_dotenv is not None:
    load_dotenv(BACKEND_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    return int(raw) if raw else default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = _env(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


def _env_path(name: str, default: Path | None = None) -> Path | None:
    raw = _env(name)
    if not raw:
        return default
    path = Path(raw).expanduser()
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


@dataclass(frozen=True)
class Settings:
    storage_dir: Path = BACKEND_DIR / "storage"
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    # Any port on localhost is allowed by default so `next dev -p <port>` just works.
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"

    max_upload_mb: int = 10
    max_script_chars: int = 5000
    max_concurrent_jobs: int = 1

    # Voice generation: placeholder | coqui | elevenlabs
    tts_provider: str = "placeholder"
    coqui_model: str = "tts_models/en/vctk/vits"
    coqui_speakers: list[str] = field(
        default_factory=lambda: ["p225", "p226", "p227", "p228", "p229", "p230"]
    )
    coqui_device: str = "cpu"
    elevenlabs_api_key: str = ""
    elevenlabs_model: str = "eleven_multilingual_v2"

    # Lip-sync / rendering: placeholder | wav2lip | sadtalker
    lipsync_engine: str = "placeholder"
    wav2lip_dir: Path | None = None
    wav2lip_checkpoint: Path | None = None
    wav2lip_python: str = sys.executable
    sadtalker_dir: Path | None = None
    sadtalker_python: str = sys.executable
    sadtalker_extra_args: str = "--still --preprocess full"
    engine_timeout_seconds: int = 1800

    ffmpeg_path: str = ""

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def avatars_dir(self) -> Path:
        return self.storage_dir / "avatars"

    @property
    def jobs_dir(self) -> Path:
        return self.storage_dir / "jobs"


def load_settings() -> Settings:
    defaults = Settings()
    return Settings(
        storage_dir=_env_path("OAS_STORAGE_DIR", defaults.storage_dir),
        cors_origins=_env_list("OAS_CORS_ORIGINS", defaults.cors_origins),
        cors_origin_regex=_env("OAS_CORS_ORIGIN_REGEX", defaults.cors_origin_regex),
        max_upload_mb=_env_int("OAS_MAX_UPLOAD_MB", defaults.max_upload_mb),
        max_script_chars=_env_int("OAS_MAX_SCRIPT_CHARS", defaults.max_script_chars),
        max_concurrent_jobs=max(1, _env_int("OAS_MAX_CONCURRENT_JOBS", defaults.max_concurrent_jobs)),
        tts_provider=_env("OAS_TTS_PROVIDER", defaults.tts_provider).lower(),
        coqui_model=_env("OAS_COQUI_MODEL", defaults.coqui_model),
        coqui_speakers=_env_list("OAS_COQUI_SPEAKERS", defaults.coqui_speakers),
        coqui_device=_env("OAS_COQUI_DEVICE", defaults.coqui_device),
        elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
        elevenlabs_model=_env("OAS_ELEVENLABS_MODEL", defaults.elevenlabs_model),
        lipsync_engine=_env("OAS_LIPSYNC_ENGINE", defaults.lipsync_engine).lower(),
        wav2lip_dir=_env_path("OAS_WAV2LIP_DIR"),
        wav2lip_checkpoint=_env_path("OAS_WAV2LIP_CHECKPOINT"),
        wav2lip_python=_env("OAS_WAV2LIP_PYTHON", defaults.wav2lip_python),
        sadtalker_dir=_env_path("OAS_SADTALKER_DIR"),
        sadtalker_python=_env("OAS_SADTALKER_PYTHON", defaults.sadtalker_python),
        sadtalker_extra_args=_env("OAS_SADTALKER_EXTRA_ARGS", defaults.sadtalker_extra_args),
        engine_timeout_seconds=_env_int("OAS_ENGINE_TIMEOUT_SECONDS", defaults.engine_timeout_seconds),
        ffmpeg_path=_env("OAS_FFMPEG_PATH"),
    )
