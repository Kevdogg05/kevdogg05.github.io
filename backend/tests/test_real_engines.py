"""End-to-end run on the real Coqui TTS + Wav2Lip install (slow; opt-in).

    OAS_TEST_FACE=/path/to/portrait.jpg .venv/bin/python -m pytest tests/test_real_engines.py
"""

import os
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import load_settings
from main import create_app
from tests.test_api import wait_for_job

FACE = os.environ.get("OAS_TEST_FACE")
pytestmark = pytest.mark.skipif(not FACE, reason="set OAS_TEST_FACE to a portrait photo to run")


def test_coqui_and_wav2lip_render_a_talking_head(tmp_path: Path):
    settings = replace(
        load_settings(), storage_dir=tmp_path, tts_provider="coqui", lipsync_engine="wav2lip"
    )
    with TestClient(create_app(settings)) as client:
        health = client.get("/api/health").json()
        assert health["lipsync"]["ready"], health["lipsync"]["detail"]
        voice = client.get("/api/voices").json()["voices"][0]["id"]

        face = Path(FACE)
        upload = client.post(
            "/api/avatars/upload", files={"file": (face.name, face.read_bytes(), "image/jpeg")}
        )
        assert upload.status_code == 201, upload.text
        job = client.post(
            "/api/generate",
            json={
                "script": "Hello! This video was rendered entirely on local, open-source models.",
                "voice_id": voice,
                "avatar_id": upload.json()["avatar_id"],
            },
        ).json()
        job = wait_for_job(client, job["job_id"], timeout=900)

    assert job["status"] == "completed", job["error"]
    assert job["duration_seconds"] > 2
    assert (tmp_path / "jobs" / job["job_id"] / "wav2lip.mp4").exists()
