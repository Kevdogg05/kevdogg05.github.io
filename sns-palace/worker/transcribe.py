#!/usr/bin/env python3
"""Word-level speech recognition for SnS Palace, on this machine.

Runs OpenAI's Whisper model through faster-whisper (CTranslate2), so the audio
never leaves the house. The editing worker calls it with a 16 kHz WAV and reads
one JSON object from stdout:

    {"language": "en", "model": "base.en",
     "words": [{"text": "Hi", "start": 0.52, "end": 0.71, "probability": 0.98}, ...]}

Times are seconds from the start of the audio. Setup:

    python3 -m venv worker/.venv
    worker/.venv/bin/pip install -r worker/requirements.txt
    # then set WHISPER_PYTHON=worker/.venv/bin/python in .env.local

The model downloads from Hugging Face on first use and is cached afterwards.
"""

import argparse
import json
import sys
import wave

EXIT_NOT_INSTALLED = 3


def load_wav(path):
    """The worker's 16 kHz mono 16-bit WAV as float32 samples in [-1, 1).

    Read here instead of by faster-whisper: its own decoder calls PyAV with an
    option (metadata_errors) that newer PyAV releases removed, so every file
    failed with "open() got an unexpected keyword argument". Given samples,
    faster-whisper skips PyAV, and the scaling matches its decoder exactly.
    """
    import numpy as np

    with wave.open(path, "rb") as wav:
        layout = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
        if layout != (1, 2, 16000):
            raise ValueError(f"expected a 16 kHz mono 16-bit WAV, got channels/bytes/rate {layout}")
        frames = wav.readframes(wav.getnframes())
    return np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("audio", help="16 kHz mono WAV file")
    parser.add_argument("--model", default="base.en", help="Whisper model name (default: base.en)")
    parser.add_argument("--device", default="auto", help="cpu, cuda or auto")
    parser.add_argument("--compute-type", default="auto", help="CTranslate2 compute type, e.g. int8")
    parser.add_argument("--language", default=None, help="Language code; detected when omitted")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper is not installed for this Python. "
            "Run: pip install -r worker/requirements.txt",
            file=sys.stderr,
        )
        return EXIT_NOT_INSTALLED

    audio = load_wav(args.audio)
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, info = model.transcribe(
        audio,
        language=args.language,
        word_timestamps=True,
        # Voice activity detection keeps Whisper from inventing words in silence.
        vad_filter=True,
        # Kids' clips are short and jump around; don't let one line bias the next.
        condition_on_previous_text=False,
        beam_size=5,
    )

    words = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if text:
                words.append(
                    {
                        "text": text,
                        "start": round(word.start, 6),
                        "end": round(word.end, 6),
                        "probability": round(word.probability, 4),
                    }
                )

    json.dump({"language": info.language, "model": args.model, "words": words}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
