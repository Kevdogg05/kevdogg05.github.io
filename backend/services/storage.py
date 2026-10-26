"""Avatar image storage on the local filesystem."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

_ID_RE = re.compile(r"^[0-9a-f]{32}$")
# File type is decided by the bytes, never by the client's filename or header.
_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n", "image/png"),
    ".jpg": (b"\xff\xd8\xff", "image/jpeg"),
}
_CHUNK = 1024 * 1024


class UploadRejected(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class StoredAvatar:
    id: str
    path: Path
    content_type: str
    size_bytes: int


class AvatarStore:
    def __init__(self, directory: Path, max_bytes: int):
        self._dir = directory
        self._max_bytes = max_bytes
        self._dir.mkdir(parents=True, exist_ok=True)

    async def save(self, upload: UploadFile) -> StoredAvatar:
        data = bytearray()
        while chunk := await upload.read(_CHUNK):
            data.extend(chunk)
            if len(data) > self._max_bytes:
                raise UploadRejected(
                    413, f"Image is larger than {self._max_bytes // (1024 * 1024)} MB"
                )
        if not data:
            raise UploadRejected(400, "The uploaded file is empty")

        for suffix, (signature, content_type) in _SIGNATURES.items():
            if data.startswith(signature):
                break
        else:
            raise UploadRejected(415, "Only PNG and JPEG images are supported")

        avatar_id = uuid.uuid4().hex
        path = self._dir / f"{avatar_id}{suffix}"
        path.write_bytes(data)
        return StoredAvatar(avatar_id, path, content_type, len(data))

    def find(self, avatar_id: str) -> Path | None:
        if not _ID_RE.match(avatar_id):
            return None
        for suffix in _SIGNATURES:
            path = self._dir / f"{avatar_id}{suffix}"
            if path.exists():
                return path
        return None

    def delete_unused(self, in_use: set[str], *, older_than: datetime) -> None:
        """Remove uploads that no job references and that predate `older_than`."""
        for path in self._dir.iterdir():
            if path.stem in in_use or path.suffix not in _SIGNATURES:
                continue
            modified = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
            if modified < older_than:
                path.unlink(missing_ok=True)
