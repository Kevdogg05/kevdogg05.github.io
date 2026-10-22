import struct
import sys
import zlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import Settings  # noqa: E402
from main import create_app  # noqa: E402


def make_png(width: int = 96, height: int = 128) -> bytes:
    """A small RGB gradient PNG, built without any imaging library."""
    rows = b"".join(
        b"\x00" + bytes(c for x in range(width) for c in (x * 2 % 256, y * 2 % 256, 160))
        for y in range(height)
    )

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(storage_dir=tmp_path / "storage", max_upload_mb=1)


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def avatar_id(client: TestClient) -> str:
    response = client.post(
        "/api/avatars/upload", files={"file": ("face.png", make_png(), "image/png")}
    )
    assert response.status_code == 201, response.text
    return response.json()["avatar_id"]
