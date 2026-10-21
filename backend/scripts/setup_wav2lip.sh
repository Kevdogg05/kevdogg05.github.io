#!/usr/bin/env bash
# Install Wav2Lip for OpenAvatarStudio and enable it:
#   - clones Rudrabha/Wav2Lip at a pinned commit into backend/engines/Wav2Lip
#   - applies engines/wav2lip-compat.patch so it runs on current Python,
#     NumPy, librosa and PyTorch
#   - installs its dependencies into backend/.venv
#   - downloads the wav2lip_gan and s3fd (face detector) weights and checks them
#
# NOTE: the Wav2Lip weights are released for personal, research and
# non-commercial use only. See https://github.com/Rudrabha/Wav2Lip#license
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$BACKEND/engines/Wav2Lip"
COMMIT=bac9a81e63ecc153202353372e5724b83d9e6322
PATCH="$BACKEND/engines/wav2lip-compat.patch"

# The upstream links point at a SharePoint folder; these GitHub mirrors serve
# byte-identical files (s3fd's hash matches its upstream name, s3fd-619a3168…).
GAN_URL="${WAV2LIP_GAN_URL:-https://github.com/justinjohn0306/Wav2Lip/releases/download/models/wav2lip_gan.pth}"
GAN_SHA256=ca9ab7b7b812c0e80a6e70a5977c545a1e8a365a6c49d5e533023c034d7ac3d8
S3FD_URL="${WAV2LIP_S3FD_URL:-https://github.com/justinjohn0306/Wav2Lip/releases/download/models/s3fd.pth}"
S3FD_SHA256=619a31681264d3f7f7fc7a16a42cbbe8b23f31a256f75a366e5a1bcd59b33543

source "$BACKEND/scripts/_common.sh"

ensure_venv
install_torch
echo "==> Installing Wav2Lip dependencies"
"$PY" -m pip install -r "$BACKEND/requirements-wav2lip.txt"

echo "==> Fetching Wav2Lip ${COMMIT:0:7}"
if [ ! -d "$DEST/.git" ]; then
  git clone --quiet https://github.com/Rudrabha/Wav2Lip "$DEST"
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

download "$GAN_URL" "$DEST/checkpoints/wav2lip_gan.pth" "$GAN_SHA256"
download "$S3FD_URL" "$DEST/face_detection/detection/sfd/s3fd.pth" "$S3FD_SHA256"

set_env OAS_LIPSYNC_ENGINE wav2lip
echo
echo "Wav2Lip is ready. Restart the backend (./dev.sh) to use it."
