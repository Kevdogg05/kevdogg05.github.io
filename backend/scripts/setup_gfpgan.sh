#!/usr/bin/env bash
# Install face enhancement (GFPGAN v1.4) into backend/.venv and download its
# weights into backend/engines/gfpgan/weights. Enable it per video with the
# "Enhance face" switch in the dashboard.
#
# NOTE: GFPGAN is Apache-2.0, but its licence lists StyleGAN2-derived code
# under NVIDIA's licence, which restricts commercial use. See
# https://github.com/TencentARC/GFPGAN/blob/master/LICENSE
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$BACKEND/scripts/_common.sh"

ensure_venv
install_torch
install_face_libs
face_weight detection parsing gfpgan

echo
echo "Face enhancement is ready. Restart the backend (./dev.sh) to use it."
