import time

from fastapi.testclient import TestClient

from services.pipeline import normalize_script


def wait_for_job(client: TestClient, job_id: str, timeout: float = 60.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("completed", "failed", "cancelled"):
            return job
        time.sleep(0.1)
    raise AssertionError(f"job {job_id} did not finish within {timeout}s")


def test_health_reports_components(client: TestClient):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["tts"] == {"name": "placeholder", "ready": True, "detail": body["tts"]["detail"]}
    assert body["lipsync"]["name"] == "placeholder"
    assert body["ffmpeg"]["ready"] is True


def test_cors_allows_local_frontend(client: TestClient):
    response = client.options(
        "/api/generate",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_voices_lists_placeholder_presets(client: TestClient):
    body = client.get("/api/voices").json()
    assert body["provider"] == "placeholder"
    assert [v["id"] for v in body["voices"]] == ["nova", "atlas", "lumen", "echo"]


def test_upload_serves_the_avatar(client: TestClient, avatar_id: str):
    # The fixture uploaded a PNG; it must be retrievable from the media mount.
    response = client.get(f"/media/avatars/{avatar_id}.png")
    assert response.status_code == 200
    assert response.content.startswith(b"\x89PNG")


def test_upload_rejects_non_images(client: TestClient):
    response = client.post(
        "/api/avatars/upload", files={"file": ("face.png", b"not really a png", "image/png")}
    )
    assert response.status_code == 415


def test_upload_rejects_empty_and_oversized_files(client: TestClient):
    empty = client.post("/api/avatars/upload", files={"file": ("a.png", b"", "image/png")})
    assert empty.status_code == 400
    huge = b"\x89PNG\r\n\x1a\n" + b"\0" * (1024 * 1024 + 1)
    too_big = client.post("/api/avatars/upload", files={"file": ("a.png", huge, "image/png")})
    assert too_big.status_code == 413


def test_generate_requires_a_known_avatar(client: TestClient):
    response = client.post(
        "/api/generate", json={"script": "Hi", "voice_id": "nova", "avatar_id": "0" * 32}
    )
    assert response.status_code == 404
    traversal = client.post(
        "/api/generate", json={"script": "Hi", "voice_id": "nova", "avatar_id": "../main"}
    )
    assert traversal.status_code == 404


def test_generate_rejects_overlong_scripts(client: TestClient, avatar_id: str, settings):
    script = "a" * (settings.max_script_chars + 1)
    response = client.post(
        "/api/generate", json={"script": script, "voice_id": "nova", "avatar_id": avatar_id}
    )
    assert response.status_code == 422


def test_generate_produces_a_playable_video(client: TestClient, avatar_id: str):
    response = client.post(
        "/api/generate",
        json={
            "script": "Hello! Welcome to OpenAvatarStudio, a self-hosted avatar video tool.",
            "voice_id": "atlas",
            "avatar_id": avatar_id,
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] in ("queued", "running")

    job = wait_for_job(client, response.json()["job_id"])
    assert job["status"] == "completed", job["error"]
    assert job["progress"] == 100 and job["stage"] == "done"
    assert job["duration_seconds"] > 2

    video = client.get(job["video_url"])
    assert video.status_code == 200
    assert video.content[4:8] == b"ftyp"  # MP4 container
    ranged = client.get(job["video_url"], headers={"Range": "bytes=0-99"})
    assert ranged.status_code == 206 and len(ranged.content) == 100


def test_unknown_voice_fails_the_job_with_a_message(client: TestClient, avatar_id: str):
    response = client.post(
        "/api/generate", json={"script": "Hello", "voice_id": "nobody", "avatar_id": avatar_id}
    )
    job = wait_for_job(client, response.json()["job_id"])
    assert job["status"] == "failed"
    assert "Unknown voice" in job["error"]


def test_normalize_script_collapses_whitespace():
    assert normalize_script("  Hello\n\n  world\t! ") == "Hello world !"
