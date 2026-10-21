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


def _env_bool(name: str, default: bool) -> bool:
    raw = _env(name).lower()
    return default if not raw else raw in ("1", "true", "yes", "on")


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
    # Entries are "speaker_id" or "speaker_id=Description". The defaults are VCTK
    # speakers spread across the pitch range, labelled by their measured median pitch.
    coqui_speakers: list[str] = field(
        default_factory=lambda: [
            "p241=Deep voice, ~94 Hz",
            "p230=Low voice, ~105 Hz",
            "p226=Mid-low voice, ~124 Hz",
            "p227=Mid-high voice, ~193 Hz",
            "p273=Bright voice, ~210 Hz",
            "p259=High voice, ~228 Hz",
        ]
    )
    coqui_language: str = "en"  # only used by multilingual models such as XTTS
    coqui_device: str = "cpu"
    coqui_preload: bool = True
    elevenlabs_api_key: str = ""
    elevenlabs_model: str = "eleven_multilingual_v2"

    # Lip-sync / rendering: placeholder | wav2lip | sadtalker
    lipsync_engine: str = "placeholder"
    # scripts/setup_wav2lip.sh installs a patched checkout here.
    wav2lip_dir: Path | None = BACKEND_DIR / "engines" / "Wav2Lip"
    wav2lip_checkpoint: Path | None = None
    wav2lip_python: str = sys.executable
    wav2lip_batch_size: int = 32
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
        coqui_language=_env("OAS_COQUI_LANGUAGE", defaults.coqui_language),
        coqui_device=_env("OAS_COQUI_DEVICE", defaults.coqui_device),
        coqui_preload=_env_bool("OAS_COQUI_PRELOAD", defaults.coqui_preload),
        elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
        elevenlabs_model=_env("OAS_ELEVENLABS_MODEL", defaults.elevenlabs_model),
        lipsync_engine=_env("OAS_LIPSYNC_ENGINE", defaults.lipsync_engine).lower(),
        wav2lip_dir=_env_path("OAS_WAV2LIP_DIR", defaults.wav2lip_dir),
        wav2lip_checkpoint=_env_path("OAS_WAV2LIP_CHECKPOINT"),
        wav2lip_python=_env("OAS_WAV2LIP_PYTHON", defaults.wav2lip_python),
        wav2lip_batch_size=_env_int("OAS_WAV2LIP_BATCH_SIZE", defaults.wav2lip_batch_size),
        sadtalker_dir=_env_path("OAS_SADTALKER_DIR"),
        sadtalker_python=_env("OAS_SADTALKER_PYTHON", defaults.sadtalker_python),
        sadtalker_extra_args=_env("OAS_SADTALKER_EXTRA_ARGS", defaults.sadtalker_extra_args),
        engine_timeout_seconds=_env_int("OAS_ENGINE_TIMEOUT_SECONDS", defaults.engine_timeout_seconds),
        ffmpeg_path=_env("OAS_FFMPEG_PATH"),
    )
