// Local database driver: one SQLite file shared by the web app and the worker.
// Uses Node's built-in node:sqlite, so there is nothing native to install.
// Mirrors supabase/schema.sql, including the claim_next_video queue semantics.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { VideoRecord, VideoStatus } from "@/lib/types";
import {
  ABANDONED_ERROR,
  PATCHABLE_COLUMNS,
  type ClaimOptions,
  type NewVideo,
  type UpdateCondition,
  type VideoPatch,
  type VideoRepository,
} from "@/server/db/repository";

const SCHEMA = `
create table if not exists videos (
  id                text primary key,
  title             text not null check (length(title) between 1 and 80),
  status            text not null default 'pending' check (status in ('pending', 'approved')),
  raw_url           text not null,
  edited_url        text,
  thumbnail_url     text,
  transcript_json   text,
  created_at        text not null,
  raw_key           text not null,
  preview_key       text,
  edited_key        text,
  edited_webm_key   text,
  thumbnail_key     text,
  original_filename text,
  content_type      text,
  size_bytes        integer,
  pipeline_status   text not null default 'queued'
                    check (pipeline_status in ('queued', 'processing', 'ready', 'failed')),
  pipeline_stage    text,
  pipeline_error    text,
  attempts          integer not null default 0,
  locked_by         text,
  locked_at         text,
  analysis          text,
  updated_at        text not null,
  approved_at       text
);
create index if not exists videos_feed_idx on videos (approved_at desc) where status = 'approved';
create index if not exists videos_queue_idx on videos (created_at) where pipeline_status in ('queued', 'processing');
create index if not exists videos_created_idx on videos (created_at desc);
`;

const JSON_COLUMNS = new Set(["transcript_json", "analysis"]);

type Row = Record<string, SQLInputValue>;

function toRecord(row: Row | undefined): VideoRecord | null {
  if (!row) return null;
  const record: Record<string, unknown> = { ...row };
  for (const column of JSON_COLUMNS) {
    const value = record[column];
    record[column] = typeof value === "string" ? JSON.parse(value) : null;
  }
  return record as unknown as VideoRecord;
}

function toValue(column: string, value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (JSON_COLUMNS.has(column)) return JSON.stringify(value);
  return value as SQLInputValue;
}

const nowIso = () => new Date().toISOString();

export class SqliteVideoRepository implements VideoRepository {
  readonly driver = "local" as const;
  private readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    // WAL + a busy timeout let the web app and the worker share the file.
    this.db.exec("pragma journal_mode = wal; pragma busy_timeout = 5000; pragma foreign_keys = on;");
    this.db.exec(SCHEMA);
  }

  async create(video: NewVideo): Promise<VideoRecord> {
    const now = nowIso();
    const row = this.db
      .prepare(
        `insert into videos (id, title, raw_url, raw_key, original_filename, content_type, size_bytes,
                             created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning *`,
      )
      .get(
        video.id,
        video.title,
        video.raw_url,
        video.raw_key,
        video.original_filename,
        video.content_type,
        video.size_bytes,
        now,
        now,
      ) as Row;
    return toRecord(row)!;
  }

  async get(id: string): Promise<VideoRecord | null> {
    return toRecord(this.db.prepare("select * from videos where id = ?").get(id) as Row | undefined);
  }

  async list(options: { status?: VideoStatus; limit?: number } = {}): Promise<VideoRecord[]> {
    const limit = options.limit ?? 200;
    const rows = options.status
      ? this.db
          .prepare(
            `select * from videos where status = ?
             order by ${options.status === "approved" ? "approved_at" : "created_at"} desc limit ?`,
          )
          .all(options.status, limit)
      : this.db.prepare("select * from videos order by created_at desc limit ?").all(limit);
    return (rows as Row[]).map((row) => toRecord(row)!);
  }

  async countPending(): Promise<number> {
    const row = this.db.prepare("select count(*) as n from videos where status = 'pending'").get() as { n: number };
    return Number(row.n);
  }

  async update(id: string, patch: VideoPatch, condition: UpdateCondition = {}): Promise<VideoRecord | null> {
    const columns = Object.keys(patch).filter((key): key is (typeof PATCHABLE_COLUMNS)[number] =>
      (PATCHABLE_COLUMNS as readonly string[]).includes(key),
    );
    const assignments = [...columns.map((column) => `${column} = ?`), "updated_at = ?"];
    const values: SQLInputValue[] = [...columns.map((column) => toValue(column, patch[column])), nowIso()];

    const where = ["id = ?"];
    values.push(id);
    if (condition.lockedBy !== undefined) {
      where.push("locked_by = ?");
      values.push(condition.lockedBy);
    }
    if (condition.pipelineStatusIn?.length) {
      where.push(`pipeline_status in (${condition.pipelineStatusIn.map(() => "?").join(", ")})`);
      values.push(...condition.pipelineStatusIn);
    }

    const row = this.db
      .prepare(`update videos set ${assignments.join(", ")} where ${where.join(" and ")} returning *`)
      .get(...values) as Row | undefined;
    return toRecord(row);
  }

  async delete(id: string): Promise<VideoRecord | null> {
    return toRecord(this.db.prepare("delete from videos where id = ? returning *").get(id) as Row | undefined);
  }

  async claimNext({ workerId, staleSeconds, maxAttempts }: ClaimOptions): Promise<VideoRecord | null> {
    const now = nowIso();
    const staleBefore = new Date(Date.now() - staleSeconds * 1000).toISOString();
    this.db.exec("begin immediate");
    try {
      this.db
        .prepare(
          `update videos set pipeline_status = 'failed', pipeline_error = ?, locked_by = null, locked_at = null,
                             updated_at = ?
            where pipeline_status = 'processing' and locked_at < ? and attempts >= ?`,
        )
        .run(ABANDONED_ERROR, now, staleBefore, maxAttempts);

      const row = this.db
        .prepare(
          `update videos
              set pipeline_status = 'processing', pipeline_stage = 'probe', pipeline_error = null,
                  attempts = attempts + 1, locked_by = ?, locked_at = ?, updated_at = ?
            where id = (
              select id from videos
               where attempts < ?
                 and (pipeline_status = 'queued' or (pipeline_status = 'processing' and locked_at < ?))
               order by created_at limit 1)
           returning *`,
        )
        .get(workerId, now, now, maxAttempts, staleBefore) as Row | undefined;
      this.db.exec("commit");
      return toRecord(row);
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
