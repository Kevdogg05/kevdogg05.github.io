#!/usr/bin/env bash
# Install SadTalker (whole-face animation with blinks, expressions and head
# motion) for OpenAvatarStudio:
#   - clones OpenTalker/SadTalker at a pinned commit into backend/engines/SadTalker
#   - applies engines/sadtalker-compat.patch (NumPy 2 fixes, lazy enhancer import)
#   - installs its dependencies into backend/.venv
#   - downloads its 256px checkpoints and face-alignment weights, checking each
# Pick SadTalker per video in the dashboard. It is slow without a GPU.
#
# SadTalker is Apache-2.0 (its README notes the non-commercial restriction was removed).
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$BACKEND/engines/SadTalker"
COMMIT=cd4c0465ae0b54a6f85af57f5c65fec9fe23e7f8
PATCH="$BACKEND/engines/sadtalker-compat.patch"
RELEASE=https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc
source "$BACKEND/scripts/_common.sh"

ensure_venv
install_torch
install_face_libs
echo "==> Installing SadTalker dependencies"
"$PY" -m pip install -r "$BACKEND/requirements-sadtalker.txt"

echo "==> Fetching SadTalker ${COMMIT:0:7}"
if [ ! -d "$DEST/.git" ]; then
  git clone --quiet https://github.com/OpenTalker/SadTalker "$DEST"
fi
if [ "$(git -C "$DEST" rev-parse HEAD)" != "$COMMIT" ]; then
  git -C "$DEST" checkout --quiet "$COMMIT"
fi
if git -C "$DEST" apply --reverse --check "$PATCH" 2>/dev/null; then
  echo "    compatibility patch already applied"
else
  git -C "$DEST" apply "$PATCH"
  echo "    applied compatibility patch"
fi

download "$RELEASE/SadTalker_V0.0.2_256.safetensors" "$DEST/checkpoints/SadTalker_V0.0.2_256.safetensors" \
  c211f5d6de003516bf1bbda9f47049a4c9c99133b1ab565c6961e5af16477bff
download "$RELEASE/mapping_00109-model.pth.tar" "$DEST/checkpoints/mapping_00109-model.pth.tar" \
  84a8642468a3fcfdd9ab6be955267043116c2bec2284686a5262f1eaf017f64c
face_weight alignment detection
# SadTalker looks for its face weights in ./gfpgan/weights; share ours.
mkdir -p "$DEST/gfpgan"
ln -sfn ../../gfpgan/weights "$DEST/gfpgan/weights"

echo
echo "SadTalker is ready. Restart the backend (./dev.sh) and pick it in the dashboard."
