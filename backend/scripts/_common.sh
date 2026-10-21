# Shared helpers for the engine setup scripts. Sourced, not executed.
# Expects BACKEND to point at the backend/ directory.

PY="$BACKEND/.venv/bin/python"

ensure_venv() {
  if [ ! -x "$PY" ]; then
    echo "==> Creating backend virtualenv"
    python3 -m venv "$BACKEND/.venv"
    "$PY" -m pip install --upgrade pip
    "$PY" -m pip install -r "$BACKEND/requirements.txt"
  fi
}

# PyTorch: the default (CUDA) build when an NVIDIA GPU is present, otherwise the
# much smaller CPU-only build. macOS wheels on PyPI already are CPU/MPS builds.
install_torch() {
  if "$PY" -c "import torch, torchaudio" 2>/dev/null; then
    echo "==> PyTorch $("$PY" -c 'import torch; print(torch.__version__)') already installed"
    return
  fi
  if [ "$(uname -s)" = "Linux" ] && ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "==> Installing CPU-only PyTorch"
    if "$PY" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu; then
      return
    fi
    echo "    The CPU wheel index is unreachable; falling back to PyPI (a much larger download)"
  fi
  echo "==> Installing PyTorch"
  "$PY" -m pip install torch torchaudio
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# download URL DEST SHA256: fetch once, verify the checksum, keep it on success.
download() {
  local url=$1 dest=$2 sha=$3
  if [ -f "$dest" ] && [ "$(sha256_of "$dest")" = "$sha" ]; then
    echo "    $(basename "$dest") already downloaded"
    return
  fi
  echo "==> Downloading $(basename "$dest")"
  mkdir -p "$(dirname "$dest")"
  curl -fL --retry 3 --progress-bar -o "$dest.part" "$url"
  if [ "$(sha256_of "$dest.part")" != "$sha" ]; then
    rm -f "$dest.part"
    echo "Checksum mismatch for $url" >&2
    exit 1
  fi
  mv "$dest.part" "$dest"
}

# set_env KEY VALUE: add or replace KEY in backend/.env.
set_env() {
  "$PY" - "$BACKEND/.env" "$1" "$2" <<'PYEOF'
import pathlib, re, sys
path, key, value = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
lines = path.read_text().splitlines() if path.exists() else []
lines = [line for line in lines if not re.match(rf"\s*{re.escape(key)}\s*=", line)]
path.write_text("\n".join([*lines, f"{key}={value}"]) + "\n")
PYEOF
  echo "    backend/.env: $1=$2"
}
