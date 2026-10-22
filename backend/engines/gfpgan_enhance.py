"""Restore the face in every frame of a video with GFPGAN v1.4.

Run by the OpenAvatarStudio backend as a subprocess:

    python gfpgan_enhance.py INPUT.mp4 OUTPUT.mp4 --weights DIR --ffmpeg PATH

Prints "progress <done>/<total>" lines so the backend can drive its progress
bar. The input's audio track is copied to the output unchanged.
"""

from __future__ import annotations

import argparse
import importlib
import importlib.util
import subprocess
import sys
import types
from pathlib import Path

import cv2
import numpy as np
import torch


def load_gfpgan_clean():
    """Import GFPGAN's dependency-free ("clean") architecture.

    Importing the gfpgan package runs its __init__, which pulls in basicsr's
    training stack, and basicsr no longer installs on Python 3.13. The two
    architecture files use basicsr only for a registry decorator and for weight
    initialisation, which loading trained weights overrides, so stub those and
    load the files directly.
    """
    spec = importlib.util.find_spec("gfpgan")
    if spec is None or not spec.submodule_search_locations:
        raise SystemExit("The gfpgan package is not installed (run backend/scripts/setup_gfpgan.sh)")

    def stub(name: str, **attrs) -> None:
        module = types.ModuleType(name)
        module.__dict__.update(attrs)
        sys.modules[name] = module

    registry = types.SimpleNamespace(register=lambda *args, **kwargs: (lambda cls: cls))
    stub("basicsr")
    stub("basicsr.utils")
    stub("basicsr.utils.registry", ARCH_REGISTRY=registry)
    stub("basicsr.archs")
    stub("basicsr.archs.arch_util", default_init_weights=lambda *args, **kwargs: None)

    package = types.ModuleType("oas_gfpgan_archs")
    package.__path__ = [str(Path(spec.submodule_search_locations[0]) / "archs")]
    sys.modules[package.__name__] = package
    return importlib.import_module("oas_gfpgan_archs.gfpganv1_clean_arch").GFPGANv1Clean


class FaceRestorer:
    # Re-parse the face mask this often; in between, the cached mask (which lives
    # in aligned-face coordinates, so it follows head motion) is reused. Parsing
    # every frame roughly doubles the CPU cost for a visually identical result.
    MASK_REFRESH_FRAMES = 50
    # facexlib's ParseNet classes: keep skin, brows, eyes, ears, nose and mouth;
    # drop background (0), neck (14), clothes (16), hair (17) and hat (18).
    FACE_CLASSES = [c for c in range(19) if c not in (0, 14, 16, 17, 18)]

    def __init__(self, weights: Path, device: torch.device):
        from facexlib.utils.face_restoration_helper import FaceRestoreHelper

        GFPGANv1Clean = load_gfpgan_clean()
        self.device = device
        # Hyper-parameters of the released GFPGANv1.4 checkpoint.
        self.model = GFPGANv1Clean(
            out_size=512, num_style_feat=512, channel_multiplier=2, decoder_load_path=None,
            fix_decoder=False, num_mlp=8, input_is_latent=True, different_w=True,
            narrow=1, sft_half=True,
        )
        state = torch.load(weights / "GFPGANv1.4.pth", map_location="cpu", weights_only=True)
        self.model.load_state_dict(state["params_ema" if "params_ema" in state else "params"])
        self.model.eval().to(device)
        # Used for face detection, alignment and its parsing network.
        self.helper = FaceRestoreHelper(
            1, face_size=512, crop_ratio=(1, 1), det_model="retinaface_resnet50",
            save_ext="png", use_parse=True, device=device, model_rootpath=str(weights),
        )
        self.mask: np.ndarray | None = None
        self.frames_since_mask = 0

    @torch.no_grad()
    def restore(self, frame: np.ndarray) -> np.ndarray:
        """Return `frame` (BGR) with its most central face restored."""
        helper = self.helper
        helper.clean_all()
        helper.read_image(frame)
        helper.get_face_landmarks_5(only_center_face=True, eye_dist_threshold=5)
        helper.align_warp_face()
        if not helper.cropped_faces:
            return frame

        restored = self._run_model(helper.cropped_faces[0])
        if self.mask is None or self.frames_since_mask >= self.MASK_REFRESH_FRAMES:
            self.mask = self._face_mask(restored)
            self.frames_since_mask = 0
        self.frames_since_mask += 1

        height, width = frame.shape[:2]
        inverse = cv2.invertAffineTransform(helper.affine_matrices[0])
        face = cv2.warpAffine(restored, inverse, (width, height)).astype(np.float32)
        mask = cv2.warpAffine(self.mask, inverse, (width, height), flags=cv2.INTER_CUBIC)[:, :, None]
        blended = mask * face + (1 - mask) * frame.astype(np.float32)
        return blended.clip(0, 255).astype(np.uint8)

    def _run_model(self, face: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).to(self.device)
        # Fixed noise keeps the restored texture stable from frame to frame.
        output = self.model((tensor - 0.5) / 0.5, return_rgb=False, randomize_noise=False)[0]
        restored = (output.squeeze(0).clamp(-1, 1) + 1) / 2
        restored = restored.permute(1, 2, 0).cpu().numpy()[:, :, ::-1]  # RGB -> BGR
        return (restored * 255.0).round().astype(np.uint8)

    def _face_mask(self, face: np.ndarray) -> np.ndarray:
        """Soft 0..1 mask of the face area, in aligned 512x512 coordinates."""
        rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).to(self.device)
        classes = self.helper.face_parse((tensor - 0.5) / 0.5)[0].argmax(dim=1).squeeze().cpu().numpy()
        mask = np.isin(classes, self.FACE_CLASSES).astype(np.float32)
        # Same feathering as facexlib's paste-back, minus the hard border.
        mask = cv2.GaussianBlur(mask, (101, 101), 11)
        mask = cv2.GaussianBlur(mask, (101, 101), 11)
        border = 10
        mask[:border, :] = mask[-border:, :] = 0
        mask[:, :border] = mask[:, -border:] = 0
        return mask


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--weights", type=Path, required=True, help="directory holding the .pth files")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    restorer = FaceRestorer(args.weights, device)

    video = cv2.VideoCapture(str(args.input))
    fps = video.get(cv2.CAP_PROP_FPS) or 25
    width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"progress 0/{total}", flush=True)

    encoder = subprocess.Popen(
        [
            args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
            "-i", str(args.input),
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-shortest",
            str(args.output),
        ],
        stdin=subprocess.PIPE,
    )
    assert encoder.stdin is not None
    done = 0
    while True:
        ok, frame = video.read()
        if not ok:
            break
        encoder.stdin.write(np.ascontiguousarray(restorer.restore(frame)).tobytes())
        done += 1
        print(f"progress {done}/{max(total, done)}", flush=True)
    video.release()
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise SystemExit("ffmpeg failed to encode the enhanced video")
    if done == 0:
        raise SystemExit("The input video has no frames")


if __name__ == "__main__":
    main()
