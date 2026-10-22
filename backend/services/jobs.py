"""Generation jobs and their SQLite-backed store.

Jobs live in storage/oas.db, so the video library survives backend restarts.
Paths are stored relative to the storage directory, so it can be moved.
"""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass, field, fields, replace
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def finished(self) -> bool:
        return self in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)


class Stage(str, Enum):
    QUEUED = "queued"
    SCRIPT = "script"
    AUDIO = "audio"
    LIPSYNC = "lipsync"
    ENHANCE = "enhance"
    ENCODE = "encode"
    DONE = "done"


def now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Job:
    id: str
    script: str
    voice_id: str
    avatar_id: str
    engine: str
    enhance: bool = False
    head_motion: bool = False
    status: JobStatus = JobStatus.QUEUED
    stage: Stage = Stage.QUEUED
    progress: int = 0
    message: str = "Waiting for a free renderer"
    error: str | None = None
    audio_path: Path | None = None
    video_path: Path | None = None
    poster_path: Path | None = None
    duration_seconds: float | None = None
    size_bytes: int = 0
    created_at: datetime = field(default_factory=now)
    updated_at: datetime = field(default_factory=now)
    started_at: datetime | None = None
    finished_at: datetime | None = None


_PATHS = ("audio_path", "video_path", "poster_path")
_TIMES = ("created_at", "updated_at", "started_at", "finished_at")
_BOOLS = ("enhance", "head_motion")
_COLUMNS = [f.name for f in fields(Job)]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    script TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    avatar_id TEXT NOT NULL,
    engine TEXT NOT NULL,
    enhance INTEGER NOT NULL,
    head_motion INTEGER NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    progress INTEGER NOT NULL,
    message TEXT NOT NULL,
    error TEXT,
    audio_path TEXT,
    video_path TEXT,
    poster_path TEXT,
    duration_seconds REAL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS jobs_by_created ON jobs (created_at);
CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs (status, created_at);
"""


class JobStore:
    """Thread-safe job registry. Jobs are immutable snapshots."""

    def __init__(self, db_path: Path, storage_dir: Path) -> None:
        self._storage = storage_dir
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(db_path, check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.executescript(_SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # -- writes ------------------------------------------------------------ #

    def add(self, job: Job) -> None:
        row = self._to_row(job)
        with self._lock:
            self._db.execute(
                f"INSERT INTO jobs ({', '.join(_COLUMNS)}) VALUES ({', '.join('?' * len(_COLUMNS))})",
                [row[c] for c in _COLUMNS],
            )

    def update(self, job_id: str, **changes) -> Job:
        with self._lock:
            current = self._get(job_id)
            if current is None:
                raise KeyError(job_id)
            job = replace(current, updated_at=now(), **changes)
            row = self._to_row(job)
            columns = [c for c in _COLUMNS if c != "id"]
            self._db.execute(
                f"UPDATE jobs SET {', '.join(f'{c} = ?' for c in columns)} WHERE id = ?",
                [row[c] for c in columns] + [job_id],
            )
            return job

    def delete(self, job_id: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    # -- reads ------------------------------------------------------------- #

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._get(job_id)

    def list(self, limit: int = 50, offset: int = 0) -> list[Job]:
        """Newest first."""
        return self._query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)

    def with_status(self, *statuses: JobStatus) -> list[Job]:
        """Oldest first, i.e. in queue order."""
        marks = ", ".join("?" * len(statuses))
        return self._query(
            f"SELECT * FROM jobs WHERE status IN ({marks}) ORDER BY created_at",
            *(s.value for s in statuses),
        )

    def finished_before(self, cutoff: datetime) -> list[Job]:
        done = [s.value for s in JobStatus if s.finished]
        return self._query(
            f"SELECT * FROM jobs WHERE status IN ({', '.join('?' * len(done))}) AND created_at < ?",
            *done,
            cutoff.isoformat(),
        )

    def summary(self) -> tuple[int, int]:
        """(number of jobs, bytes on disk across all jobs)."""
        with self._lock:
            row = self._db.execute("SELECT COUNT(*), COALESCE(SUM(size_bytes), 0) FROM jobs").fetchone()
        return int(row[0]), int(row[1])

    def avatar_ids_in_use(self) -> set[str]:
        with self._lock:
            return {r[0] for r in self._db.execute("SELECT DISTINCT avatar_id FROM jobs")}

    # -- helpers ----------------------------------------------------------- #

    def _get(self, job_id: str) -> Job | None:
        row = self._db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return self._from_row(row) if row else None

    def _query(self, sql: str, *params) -> list[Job]:
        with self._lock:
            return [self._from_row(r) for r in self._db.execute(sql, params)]

    def _to_row(self, job: Job) -> dict:
        row = {name: getattr(job, name) for name in _COLUMNS}
        row["status"], row["stage"] = job.status.value, job.stage.value
        for name in _BOOLS:
            row[name] = int(row[name])
        for name in _PATHS:
            path = row[name]
            row[name] = path.relative_to(self._storage).as_posix() if path else None
        for name in _TIMES:
            row[name] = row[name].isoformat() if row[name] else None
        return row

    def _from_row(self, row: sqlite3.Row) -> Job:
        values = dict(row)
        values["status"], values["stage"] = JobStatus(values["status"]), Stage(values["stage"])
        for name in _BOOLS:
            values[name] = bool(values[name])
        for name in _PATHS:
            values[name] = self._storage / values[name] if values[name] else None
        for name in _TIMES:
            values[name] = datetime.fromisoformat(values[name]) if values[name] else None
        return Job(**values)
