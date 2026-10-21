"""Voice generation (script -> speech WAV).

Providers:
  placeholder  Offline, dependency-free. Synthesises a speech-paced hum whose
               length and rhythm follow the script, so the rest of the pipeline
               (lip-sync, muxing, progress) can be developed without a model.
  coqui        Open-source Coqui TTS, runs locally (scripts/setup_coqui.sh).
  elevenlabs   ElevenLabs REST API (set ELEVENLABS_API_KEY).

Pick one with OAS_TTS_PROVIDER. Every provider writes a 16-bit PCM WAV file.
"""

from __future__ import annotations

import array
import hashlib
import importlib.util
import logging
import math
import random
import re
import threading
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import requests

from config import Settings
from services import media
from services.common import PipelineError, ProviderStatus, ProviderUnavailableError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Voice:
    id: str
    name: str
    description: str


class TTSProvider(Protocol):
    name: str

    def status(self) -> ProviderStatus: ...

    def warm_up(self) -> None:
        """Optionally load models ahead of the first request."""
        ...

    def list_voices(self) -> list[Voice]: ...

    def synthesize(self, text: str, voice_id: str, out_path: Path) -> None:
        """Write speech for `text` to `out_path` as a WAV file."""
        ...


# --------------------------------------------------------------------------- #
# Placeholder
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class _PlaceholderVoice:
    voice: Voice
    pitch_hz: float
    syllable_seconds: float


_PLACEHOLDER_VOICES = [
    _PlaceholderVoice(Voice("nova", "Nova", "Warm, friendly narrator"), 205.0, 0.17),
    _PlaceholderVoice(Voice("atlas", "Atlas", "Deep and calm"), 110.0, 0.19),
    _PlaceholderVoice(Voice("lumen", "Lumen", "Bright and upbeat"), 260.0, 0.15),
    _PlaceholderVoice(Voice("echo", "Echo", "Neutral newsreader"), 150.0, 0.16),
]

_WORD_RE = re.compile(r"[A-Za-z0-9']+|[.,;:!?]")
_VOWEL_GROUP_RE = re.compile(r"[aeiouy]+", re.IGNORECASE)


class PlaceholderTTS:
    """Generates a hum with one tone per syllable and pauses at punctuation."""

    name = "placeholder"
    sample_rate = 16_000

    def status(self) -> ProviderStatus:
        return ProviderStatus(True, "Built-in placeholder voice (no real speech)")

    def warm_up(self) -> None:
        pass

    def list_voices(self) -> list[Voice]:
        return [v.voice for v in _PLACEHOLDER_VOICES]

    def synthesize(self, text: str, voice_id: str, out_path: Path) -> None:
        preset = next((v for v in _PLACEHOLDER_VOICES if v.voice.id == voice_id), None)
        if preset is None:
            raise PipelineError(f"Unknown voice '{voice_id}' for the placeholder provider")

        # Seeded from the text so the same script always renders the same audio.
        rng = random.Random(hashlib.sha256(f"{voice_id}:{text}".encode()).digest())
        samples = array.array("h")
        self._silence(samples, 0.25)
        for token in _WORD_RE.findall(text):
            if token in ".!?":
                self._silence(samples, 0.45)
            elif token in ",;:":
                self._silence(samples, 0.25)
            else:
                syllables = max(1, len(_VOWEL_GROUP_RE.findall(token)))
                for _ in range(syllables):
                    pitch = preset.pitch_hz * rng.uniform(0.88, 1.15)
                    length = preset.syllable_seconds * rng.uniform(0.8, 1.25)
                    self._syllable(samples, pitch, length)
                self._silence(samples, 0.06)
        self._silence(samples, 0.35)

        with wave.open(str(out_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self.sample_rate)
            wav.writeframes(samples.tobytes())

    def _silence(self, samples: array.array, seconds: float) -> None:
        samples.extend([0] * int(seconds * self.sample_rate))

    def _syllable(self, samples: array.array, pitch: float, seconds: float) -> None:
        count = int(seconds * self.sample_rate)
        step = 2 * math.pi * pitch / self.sample_rate
        for i in range(count):
            envelope = math.sin(math.pi * i / count)  # smooth attack and release
            phase = step * i
            # A few harmonics read as "voice-like" rather than a pure beep.
            tone = math.sin(phase) + 0.5 * math.sin(2 * phase) + 0.25 * math.sin(3 * phase)
            samples.append(int(7000 * envelope * tone / 1.75))


# --------------------------------------------------------------------------- #
# Coqui TTS (open source, local)
# --------------------------------------------------------------------------- #


class CoquiTTS:
    """Coqui TTS, run in-process so the model stays loaded between jobs.

    The model is downloaded on first load (to Coqui's cache, ~/.local/share/tts by
    default) and loaded in the background at startup when OAS_COQUI_PRELOAD is on.
    """

    name = "coqui"

    def __init__(self, settings: Settings):
        self._model_name = settings.coqui_model
        self._voices = [_parse_speaker(entry, settings.coqui_model) for entry in settings.coqui_speakers]
        self._language = settings.coqui_language
        self._device = settings.coqui_device
        self._preload = settings.coqui_preload
        self._tts = None
        self._state = "idle"  # idle | loading | loaded | failed
        self._load_error: str | None = None
        self._lock = threading.Lock()

    def status(self) -> ProviderStatus:
        if importlib.util.find_spec("TTS") is None:
            return ProviderStatus(False, "Coqui TTS is not installed: run backend/scripts/setup_coqui.sh")
        if self._state == "loading":
            return ProviderStatus(False, f"Loading {self._model_name}…")
        if self._state == "failed":
            return ProviderStatus(False, f"Could not load {self._model_name}: {self._load_error}")
        when = "loaded" if self._state == "loaded" else "loads on first use"
        return ProviderStatus(True, f"Coqui TTS {self._model_name} ({when}, {self._device})")

    def warm_up(self) -> None:
        """Load the model ahead of the first request (called on a background thread)."""
        if not self._preload or importlib.util.find_spec("TTS") is None:
            return
        try:
            with self._lock:
                self._load()
        except Exception:  # noqa: BLE001 - recorded in status(); the next job retries
            logger.exception("Coqui TTS warm-up failed")

    def list_voices(self) -> list[Voice]:
        # Listing must not trigger a model download, so voices come from config.
        return self._voices

    def synthesize(self, text: str, voice_id: str, out_path: Path) -> None:
        with self._lock:  # Coqui models are not thread-safe
            tts = self._load()
            kwargs = {}
            if getattr(tts, "is_multi_speaker", False):
                speakers = tts.speakers or []
                if voice_id not in speakers:
                    raise PipelineError(
                        f"Speaker '{voice_id}' is not in {self._model_name}. "
                        f"Some valid speakers: {', '.join(map(str, speakers[:8]))}"
                    )
                kwargs["speaker"] = voice_id
            if getattr(tts, "is_multi_lingual", False):
                kwargs["language"] = self._language
            tts.tts_to_file(text=text, file_path=str(out_path), **kwargs)

    def _load(self):
        if self._tts is not None:
            return self._tts
        try:
            from TTS.api import TTS
        except ImportError as exc:
            self._state, self._load_error = "failed", "not installed"
            raise ProviderUnavailableError(
                "Coqui TTS is not installed. Run backend/scripts/setup_coqui.sh."
            ) from exc
        self._state = "loading"
        logger.info("Loading Coqui TTS model %s on %s", self._model_name, self._device)
        try:
            self._tts = TTS(self._model_name, progress_bar=False).to(self._device)
        except Exception as exc:
            self._state, self._load_error = "failed", str(exc)[:200]
            raise ProviderUnavailableError(
                f"Could not load Coqui model {self._model_name}: {exc}"
            ) from exc
        self._state, self._load_error = "loaded", None
        return self._tts


def _parse_speaker(entry: str, model_name: str) -> Voice:
    speaker, _, description = entry.partition("=")
    speaker = speaker.strip()
    return Voice(speaker, speaker, description.strip() or f"{model_name} speaker")


# --------------------------------------------------------------------------- #
# ElevenLabs (developer API)
# --------------------------------------------------------------------------- #


class ElevenLabsTTS:
    name = "elevenlabs"
    base_url = "https://api.elevenlabs.io/v1"

    def __init__(self, settings: Settings):
        self._api_key = settings.elevenlabs_api_key
        self._model = settings.elevenlabs_model
        self._ffmpeg = media.resolve_ffmpeg(settings.ffmpeg_path)
        self._voices: list[Voice] | None = None

    def status(self) -> ProviderStatus:
        if not self._api_key:
            return ProviderStatus(False, "ELEVENLABS_API_KEY is not set")
        return ProviderStatus(True, f"ElevenLabs ({self._model})")

    def warm_up(self) -> None:
        pass

    def list_voices(self) -> list[Voice]:
        if self._voices is None:
            data = self._request("GET", "/voices").json()
            self._voices = [
                Voice(
                    v["voice_id"],
                    v.get("name", v["voice_id"]),
                    ", ".join(str(x) for x in (v.get("labels") or {}).values()) or v.get("category", ""),
                )
                for v in data.get("voices", [])
            ]
        return self._voices

    def synthesize(self, text: str, voice_id: str, out_path: Path) -> None:
        if not self._ffmpeg:
            raise ProviderUnavailableError("ffmpeg is required to decode ElevenLabs audio")
        response = self._request(
            "POST",
            f"/text-to-speech/{voice_id}",
            params={"output_format": "mp3_44100_128"},
            json={"text": text, "model_id": self._model},
            headers={"Accept": "audio/mpeg"},
        )
        mp3_path = out_path.with_suffix(".mp3")
        mp3_path.write_bytes(response.content)
        media.to_wav(self._ffmpeg, mp3_path, out_path)

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        if not self._api_key:
            raise ProviderUnavailableError("ELEVENLABS_API_KEY is not set")
        headers = {"xi-api-key": self._api_key, **kwargs.pop("headers", {})}
        try:
            response = requests.request(
                method, f"{self.base_url}{path}", headers=headers, timeout=120, **kwargs
            )
        except requests.RequestException as exc:
            raise PipelineError(f"Could not reach ElevenLabs: {exc}") from exc
        if not response.ok:
            raise PipelineError(f"ElevenLabs returned {response.status_code}: {response.text[:300]}")
        return response


# --------------------------------------------------------------------------- #


def create_tts_provider(settings: Settings) -> TTSProvider:
    providers = {
        "placeholder": lambda: PlaceholderTTS(),
        "coqui": lambda: CoquiTTS(settings),
        "elevenlabs": lambda: ElevenLabsTTS(settings),
    }
    try:
        return providers[settings.tts_provider]()
    except KeyError:
        raise ValueError(
            f"Unknown OAS_TTS_PROVIDER '{settings.tts_provider}'. "
            f"Choose one of: {', '.join(providers)}"
        ) from None
