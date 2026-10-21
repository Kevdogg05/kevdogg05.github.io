"""Exercise the external engine adapters against fake Wav2Lip/SadTalker checkouts."""

import sys
import textwrap
from pathlib import Path

from fastapi.testclient import TestClient

from config import Settings
from main import create_app
from services import media
from services.video import _Wav2LipProgress
from tests.conftest import make_png
from tests.test_api import wait_for_job

# Stands in for a real inference.py: renders the face + audio with ffmpeg.
FAKE_INFERENCE = textwrap.dedent(
    """
    import argparse, os, subprocess, time
    p = argparse.ArgumentParser()
    for flag in ("--checkpoint_path", "--face", "--audio", "--outfile",
                 "--driven_audio", "--source_image", "--result_dir", "--preprocess",
                 "--wav2lip_batch_size"):
        p.add_argument(flag)
    p.add_argument("--still", action="store_true")
    a = p.parse_args()
    face, audio = a.face or a.source_image, a.audio or a.driven_audio
    if a.face:
        # Mirror Wav2Lip's real check, which reads the text after the first dot.
        assert a.face.split(".")[1] in ("jpg", "png", "jpeg"), a.face
    out = a.outfile or os.path.join(a.result_dir, time.strftime("%Y_%m_%d_%H.%M.%S") + ".mp4")
    subprocess.run([os.environ["FAKE_FFMPEG"], "-loglevel", "error", "-y", "-loop", "1",
                    "-i", face, "-i", audio, "-shortest", "-vf", "scale=128:128",
                    "-c:v", "mpeg4", "-c:a", "mp2", out], check=True)
    """
)


def fake_checkout(root: Path, *extra: str) -> Path:
    root.mkdir()
    (root / "inference.py").write_text(FAKE_INFERENCE)
    for name in extra:
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text("")
    return root


def run_job(settings: Settings, monkeypatch) -> dict:
    monkeypatch.setenv("FAKE_FFMPEG", media.resolve_ffmpeg())
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").json()["lipsync"]["ready"] is True
        upload = client.post("/api/avatars/upload", files={"file": ("f.png", make_png(), "image/png")})
        job = client.post(
            "/api/generate",
            json={"script": "Testing the engine adapter.", "voice_id": "echo",
                  "avatar_id": upload.json()["avatar_id"]},
        ).json()
        job = wait_for_job(client, job["job_id"])
        assert job["status"] == "completed", job["error"]
        video = client.get(job["video_url"]).content
        assert video[4:8] == b"ftyp"
        return job


def test_wav2lip_adapter(tmp_path: Path, monkeypatch):
    checkout = fake_checkout(
        tmp_path / "Wav2Lip", "checkpoints/wav2lip_gan.pth", "face_detection/detection/sfd/s3fd.pth"
    )
    # A dotted storage path reproduces the Wav2Lip extension-sniffing pitfall.
    settings = Settings(
        storage_dir=tmp_path / "with.dots" / "storage",
        lipsync_engine="wav2lip",
        wav2lip_dir=checkout,
        wav2lip_python=sys.executable,
    )
    run_job(settings, monkeypatch)


def test_sadtalker_adapter(tmp_path: Path, monkeypatch):
    checkout = fake_checkout(tmp_path / "SadTalker", "checkpoints/model.safetensors")
    settings = Settings(
        storage_dir=tmp_path / "storage",
        lipsync_engine="sadtalker",
        sadtalker_dir=checkout,
        sadtalker_python=sys.executable,
    )
    run_job(settings, monkeypatch)


def test_unconfigured_engine_reports_not_ready(tmp_path: Path):
    settings = Settings(
        storage_dir=tmp_path / "storage", lipsync_engine="wav2lip", wav2lip_dir=tmp_path / "missing"
    )
    with TestClient(create_app(settings)) as client:
        lipsync = client.get("/api/health").json()["lipsync"]
        assert lipsync["ready"] is False
        assert "setup_wav2lip.sh" in lipsync["detail"]


def test_wav2lip_progress_follows_its_console_output():
    reports = []
    tracker = _Wav2LipProgress(32, lambda fraction, message=None: reports.append((fraction, message)))
    # Captured from a real CPU run on a 4-second clip (101 frames, 4 batches of 32).
    for line in [
        "Using cpu for inference.",
        "Number of frames available for inference: 1",
        "(80, 335)",
        "Length of mel chunks: 101",
        "0%|          | 0/4 [00:00<?, ?it/s]",
        "0%|          | 0/1 [00:00<?, ?it/s]\x1b[A",  # face detection
        "100%|██████████| 1/1 [00:01<00:00,  1.70s/it]\x1b[A",
        "Load checkpoint from: checkpoints/wav2lip_gan.pth",
        "Model loaded",
        "25%|██▌       | 1/4 [00:06<00:19,  6.53s/it]",
        "50%|█████     | 2/4 [00:09<00:09,  4.54s/it]",
        "75%|███████▌  | 3/4 [00:12<00:03,  3.93s/it]",
        "100%|██████████| 4/4 [00:15<00:00,  3.38s/it]",
    ]:
        tracker.feed(line)
    assert [(round(fraction, 2), message) for fraction, message in reports] == [
        (0.08, "Lip-sync: loading the Wav2Lip model"),
        (0.15, "Lip-sync: rendering frames (batch 1 of 4)"),
        (0.35, "Lip-sync: rendering frames (batch 2 of 4)"),
        (0.55, "Lip-sync: rendering frames (batch 3 of 4)"),
        (0.75, "Lip-sync: rendering frames (batch 4 of 4)"),
        (0.95, "Lip-sync: muxing audio"),
    ]
