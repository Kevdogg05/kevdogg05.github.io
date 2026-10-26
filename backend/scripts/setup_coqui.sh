#!/usr/bin/env bash
# Install Coqui TTS into backend/.venv, download the voice model and enable it.
#   OAS_COQUI_MODEL  model to fetch (default tts_models/en/vctk/vits, Apache-2.0)
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${OAS_COQUI_MODEL:-tts_models/en/vctk/vits}"
source "$BACKEND/scripts/_common.sh"

if ! command -v espeak-ng >/dev/null 2>&1 && ! command -v espeak >/dev/null 2>&1; then
  echo "WARNING: espeak-ng is not installed, and Coqui's VITS voices need it to read text." >&2
  echo "  Debian/Ubuntu: sudo apt install espeak-ng    macOS: brew install espeak-ng" >&2
fi

ensure_venv
install_torch
echo "==> Installing Coqui TTS"
"$PY" -m pip install -r "$BACKEND/requirements-coqui.txt"

echo "==> Downloading $MODEL (cached for later runs)"
"$PY" - "$MODEL" <<'PYEOF'
import sys
from TTS.api import TTS
tts = TTS(sys.argv[1], progress_bar=False)
print(f"    loaded; {len(tts.speakers or [])} speakers")
PYEOF

set_env OAS_TTS_PROVIDER coqui
[ "$MODEL" = "tts_models/en/vctk/vits" ] || set_env OAS_COQUI_MODEL "$MODEL"
echo
echo "Coqui TTS is ready. Restart the backend (./dev.sh) to use it."
