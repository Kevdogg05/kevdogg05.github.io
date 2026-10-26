"""End-to-end run on the real Coqui TTS + animation engines (slow; opt-in).

    OAS_TEST_FACE=/path/to/portrait.jpg .venv/bin/python -m pytest tests/test_real_engines.py

OAS_TEST_ENGINES picks engines (default "wav2lip"; e.g. "wav2lip,sadtalker") and
OAS_TEST_ENHANCE=1 adds GFPGAN face enhancement. SadTalker takes minutes on CPU.
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
ENGINES = os.environ.get("OAS_TEST_ENGINES", "wav2lip").split(",")
ENHANCE = os.environ.get("OAS_TEST_ENHANCE") == "1"
pytestmark = pytest.mark.skipif(not FACE, reason="set OAS_TEST_FACE to a portrait photo to run")


@pytest.mark.parametrize("engine", ENGINES)
def test_real_engines_render_a_talking_head(tmp_path: Path, engine: str):
    settings = replace(load_settings(), storage_dir=tmp_path, tts_provider="coqui")
    with TestClient(create_app(settings)) as client:
        health = client.get("/api/health").json()
        status = next(e for e in health["engines"] if e["name"] == engine)
        assert status["ready"], status["detail"]
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
                "engine": engine,
                "enhance": ENHANCE,
                "head_motion": True,
            },
        ).json()
        job = wait_for_job(client, job["job_id"], timeout=3600)

    assert job["status"] == "completed", job["error"]
    assert job["duration_seconds"] > 2
    assert (tmp_path / "jobs" / job["job_id"] / "video.mp4").exists()
