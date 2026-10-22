"""The persistent video library: restarts, queueing, cancel, retry, delete, retention."""

import os
import textwrap
import time
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import Settings
from main import create_app
from services.jobs import Job, JobStatus, JobStore, now
from tests.conftest import make_png
from tests.test_api import wait_for_job

SCRIPT = "Hello from the library tests."


def upload(client: TestClient) -> str:
    response = client.post("/api/avatars/upload", files={"file": ("f.png", make_png(), "image/png")})
    return response.json()["avatar_id"]


def generate(client: TestClient, avatar_id: str, **options) -> dict:
    response = client.post(
        "/api/generate",
        json={"script": SCRIPT, "voice_id": "nova", "avatar_id": avatar_id, **options},
    )
    assert response.status_code == 202, response.text
    return response.json()


def wait_until(predicate, timeout: float = 20.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if result := predicate():
            return result
        time.sleep(0.05)
    raise AssertionError("condition not met in time")


@pytest.fixture
def slow_wav2lip(tmp_path: Path, monkeypatch) -> Path:
    """A Wav2Lip checkout whose inference runs for a minute unless killed."""
    root = tmp_path / "SlowWav2Lip"
    for name in ("checkpoints/wav2lip_gan.pth", "face_detection/detection/sfd/s3fd.pth"):
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text("")
    pid_file = tmp_path / "engine.pid"
    (root / "inference.py").write_text(textwrap.dedent(
        f"""
        import os, pathlib, time
        print("Length of mel chunks: 10", flush=True)
        pathlib.Path({str(pid_file)!r}).write_text(str(os.getpid()))
        time.sleep(60)
        """
    ))
    return root


def process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    # A killed child the backend has not reaped yet still "exists" as a zombie.
    with open(f"/proc/{pid}/stat") as stat:
        return stat.read().split()[2] != "Z"


def test_jobs_survive_a_backend_restart(settings: Settings):
    with TestClient(create_app(settings)) as client:
        job = wait_for_job(client, generate(client, upload(client))["job_id"])
    assert job["status"] == "completed"

    with TestClient(create_app(settings)) as client:  # a fresh process, same storage
        library = client.get("/api/jobs").json()
        again = client.get(f"/api/jobs/{job['job_id']}").json()
        poster = client.get(again["poster_url"])
    assert library["total"] == 1 and library["jobs"][0]["job_id"] == job["job_id"]
    assert again["status"] == "completed" and again["script"] == SCRIPT
    assert again["size_bytes"] > 0 and again["render_seconds"] > 0
    assert poster.status_code == 200 and poster.content[:2] == b"\xff\xd8"  # JPEG
    kept = {p.name for p in (settings.jobs_dir / job["job_id"]).iterdir()}
    assert kept == {"video.mp4", "audio.wav", "poster.jpg"}


def test_restart_resumes_queued_jobs_and_flags_interrupted_ones(settings: Settings):
    with TestClient(create_app(settings)) as client:
        avatar_id = upload(client)
    store = JobStore(settings.database_path, settings.storage_dir)
    base = Job(id="", script=SCRIPT, voice_id="nova", avatar_id=avatar_id, engine="placeholder")
    store.add(replace(base, id="a" * 32, status=JobStatus.RUNNING, started_at=now()))
    store.add(replace(base, id="b" * 32))

    with TestClient(create_app(settings)) as client:
        interrupted = client.get(f"/api/jobs/{'a' * 32}").json()
        resumed = wait_for_job(client, "b" * 32)
    assert interrupted["status"] == "failed" and "Retry" in interrupted["error"]
    assert resumed["status"] == "completed"


def test_cancel_a_running_job_kills_its_engine(settings: Settings, slow_wav2lip: Path, tmp_path: Path):
    settings = replace(settings, wav2lip_dir=slow_wav2lip)
    with TestClient(create_app(settings)) as client:
        job_id = generate(client, upload(client), engine="wav2lip")["job_id"]
        pid = int(wait_until(lambda: (tmp_path / "engine.pid").exists() and (tmp_path / "engine.pid").read_text()))
        assert process_alive(pid)

        response = client.post(f"/api/jobs/{job_id}/cancel")
        assert response.status_code == 200
        job = wait_for_job(client, job_id, timeout=10)
        assert job["status"] == "cancelled"
        wait_until(lambda: not process_alive(pid), timeout=5)

        assert client.post(f"/api/jobs/{job_id}/cancel").status_code == 409  # already finished


def test_queue_positions_and_cancelling_a_queued_job(settings: Settings, slow_wav2lip: Path, tmp_path: Path):
    settings = replace(settings, wav2lip_dir=slow_wav2lip)
    with TestClient(create_app(settings)) as client:
        avatar_id = upload(client)
        first = generate(client, avatar_id, engine="wav2lip")["job_id"]
        second = generate(client, avatar_id, engine="wav2lip")["job_id"]
        wait_until(lambda: (tmp_path / "engine.pid").exists())

        library = client.get("/api/jobs").json()
        by_id = {j["job_id"]: j for j in library["jobs"]}
        assert library["active"] == 2
        assert by_id[first]["status"] == "running" and by_id[first]["queue_position"] is None
        assert by_id[second]["status"] == "queued" and by_id[second]["queue_position"] == 1

        cancelled = client.post(f"/api/jobs/{second}/cancel").json()
        assert cancelled["status"] == "cancelled" and cancelled["started_at"] is None
        client.post(f"/api/jobs/{first}/cancel")
        wait_for_job(client, first, timeout=10)
        assert client.get(f"/api/jobs/{second}").json()["started_at"] is None  # never ran


def test_retry_and_delete(settings: Settings):
    with TestClient(create_app(settings)) as client:
        original = wait_for_job(client, generate(client, upload(client), voice_id="atlas")["job_id"])

        retried = client.post(f"/api/jobs/{original['job_id']}/retry")
        assert retried.status_code == 202
        copy = wait_for_job(client, retried.json()["job_id"])
        assert copy["job_id"] != original["job_id"]
        assert (copy["script"], copy["voice_id"], copy["status"]) == (SCRIPT, "atlas", "completed")

        assert client.delete(f"/api/jobs/{original['job_id']}").status_code == 204
        assert client.get(f"/api/jobs/{original['job_id']}").status_code == 404
        assert not (settings.jobs_dir / original["job_id"]).exists()
        assert client.get("/api/jobs").json()["total"] == 1


def test_active_jobs_cannot_be_deleted(settings: Settings, slow_wav2lip: Path, tmp_path: Path):
    settings = replace(settings, wav2lip_dir=slow_wav2lip)
    with TestClient(create_app(settings)) as client:
        job_id = generate(client, upload(client), engine="wav2lip")["job_id"]
        wait_until(lambda: (tmp_path / "engine.pid").exists())
        assert client.delete(f"/api/jobs/{job_id}").status_code == 409
        client.post(f"/api/jobs/{job_id}/cancel")
        wait_for_job(client, job_id, timeout=10)


def test_retention_deletes_old_videos_and_unused_avatars(settings: Settings):
    with TestClient(create_app(settings)) as client:
        old_avatar = upload(client)
        old_job = wait_for_job(client, generate(client, old_avatar)["job_id"])
        fresh_avatar = upload(client)  # never used, but recent
    store = JobStore(settings.database_path, settings.storage_dir)
    store.update(old_job["job_id"], created_at=now() - timedelta(days=10))
    long_ago = time.time() - 10 * 86400
    os.utime(settings.avatars_dir / f"{old_avatar}.png", (long_ago, long_ago))

    with TestClient(create_app(replace(settings, retention_days=7))) as client:
        assert client.get(f"/api/jobs/{old_job['job_id']}").status_code == 404
    assert not (settings.jobs_dir / old_job["job_id"]).exists()
    assert not (settings.avatars_dir / f"{old_avatar}.png").exists()
    assert (settings.avatars_dir / f"{fresh_avatar}.png").exists()
