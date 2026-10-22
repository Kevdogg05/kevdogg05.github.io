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

# PyTorch (+ torchaudio, torchvision): the default CUDA build when an NVIDIA GPU
# is present, otherwise the much smaller CPU-only build. macOS wheels on PyPI
# already are CPU/MPS builds.
install_torch() {
  local torch_spec="torch"
  if "$PY" -c "import torch" 2>/dev/null; then
    if "$PY" -c "import torchaudio, torchvision" 2>/dev/null; then
      echo "==> PyTorch $("$PY" -c 'import torch; print(torch.__version__)') already installed"
      return
    fi
    # Match the companion packages to the installed torch instead of upgrading it.
    torch_spec="torch==$("$PY" -c 'import torch; print(torch.__version__.split("+")[0])')"
  fi
  if [ "$(uname -s)" = "Linux" ] && ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "==> Installing CPU-only PyTorch"
    if "$PY" -m pip install "$torch_spec" torchaudio torchvision --index-url https://download.pytorch.org/whl/cpu; then
      return
    fi
    echo "    The CPU wheel index is unreachable; falling back to PyPI (a much larger download)"
  fi
  echo "==> Installing PyTorch"
  "$PY" -m pip install "$torch_spec" torchaudio torchvision
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

FACE_WEIGHTS="$BACKEND/engines/gfpgan/weights"

# Face detection/restoration libraries shared by SadTalker and the enhancer.
install_face_libs() {
  echo "==> Installing face libraries"
  "$PY" -m pip install -r "$BACKEND/requirements-gfpgan.txt"
  # Without their declared dependencies; requirements-gfpgan.txt explains why.
  "$PY" -m pip install --no-deps facexlib==0.3.0 gfpgan==1.3.8
}

# face_weight NAME...: download shared face-model weights into engines/gfpgan/weights.
face_weight() {
  local name
  for name in "$@"; do
    case "$name" in
      alignment) download https://github.com/xinntao/facexlib/releases/download/v0.1.0/alignment_WFLW_4HG.pth \
        "$FACE_WEIGHTS/alignment_WFLW_4HG.pth" bbfd137307a4c7debd5c283b9b0ce539466cee417ac0a155e184d857f9f2899c ;;
      detection) download https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth \
        "$FACE_WEIGHTS/detection_Resnet50_Final.pth" 6d1de9c2944f2ccddca5f5e010ea5ae64a39845a86311af6fdf30841b0a5a16d ;;
      parsing) download https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth \
        "$FACE_WEIGHTS/parsing_parsenet.pth" 3d558d8d0e42c20224f13cf5a29c79eba2d59913419f945545d8cf7b72920de2 ;;
      gfpgan) download https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth \
        "$FACE_WEIGHTS/GFPGANv1.4.pth" e2cd4703ab14f4d01fd1383a8a8b266f9a5833dacee8e6a79d3bf21a1b6be5ad ;;
      *) echo "unknown face weight: $name" >&2; exit 1 ;;
    esac
  done
}
