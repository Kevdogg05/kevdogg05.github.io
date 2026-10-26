import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteVideoRepository } from "@/server/db/sqlite";

let repo: SqliteVideoRepository;

beforeEach(() => {
  repo = new SqliteVideoRepository(":memory:");
});

afterEach(() => repo.close());

function newVideo(title: string) {
  const id = randomUUID();
  return {
    id,
    title,
    raw_url: `local:raw/${id}.mp4`,
    raw_key: `raw/${id}.mp4`,
    original_filename: `${title}.mp4`,
    content_type: "video/mp4",
    size_bytes: 1234,
  };
}

const claimOptions = { workerId: "w1", staleSeconds: 300, maxAttempts: 3 };

describe("SqliteVideoRepository", () => {
  it("creates pending, queued videos", async () => {
    const video = await repo.create(newVideo("Lego build"));
    expect(video).toMatchObject({ title: "Lego build", status: "pending", pipeline_status: "queued", attempts: 0 });
    expect(await repo.get(video.id)).toEqual(video);
    expect(await repo.countPending()).toBe(1);
  });

  it("round-trips JSON columns", async () => {
    const video = await repo.create(newVideo("Cat"));
    const transcript = { engine: "test", model: null, language: "en", text: "hi", words: [], edited_words: [] };
    const updated = await repo.update(video.id, { transcript_json: transcript });
    expect(updated?.transcript_json).toEqual(transcript);
    expect(updated?.analysis).toBeNull();
  });

  it("claims oldest first, once", async () => {
    const first = await repo.create(newVideo("First"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.create(newVideo("Second"));

    const claimed = await repo.claimNext(claimOptions);
    expect(claimed).toMatchObject({ id: first.id, pipeline_status: "processing", attempts: 1, locked_by: "w1" });
    expect((await repo.claimNext({ ...claimOptions, workerId: "w2" }))?.id).toBe(second.id);
    expect(await repo.claimNext(claimOptions)).toBeNull();
  });

  it("reclaims abandoned work and fails it after the last attempt", async () => {
    const video = await repo.create(newVideo("Clip"));
    await repo.claimNext(claimOptions);
    const longAgo = new Date(Date.now() - 600_000).toISOString();

    await repo.update(video.id, { locked_at: longAgo });
    expect(await repo.claimNext({ ...claimOptions, workerId: "w2" })).toMatchObject({ attempts: 2, locked_by: "w2" });

    await repo.update(video.id, { locked_at: longAgo, attempts: 3 });
    expect(await repo.claimNext(claimOptions)).toBeNull();
    expect(await repo.get(video.id)).toMatchObject({ pipeline_status: "failed", locked_by: null });
  });

  it("guards updates with the worker's lock and pipeline state", async () => {
    const video = await repo.create(newVideo("Clip"));
    await repo.claimNext(claimOptions);
    expect(await repo.update(video.id, { pipeline_stage: "render" }, { lockedBy: "someone-else" })).toBeNull();
    expect(await repo.update(video.id, { pipeline_stage: "render" }, { lockedBy: "w1" })).toMatchObject({
      pipeline_stage: "render",
    });
    expect(await repo.update(video.id, { pipeline_status: "queued" }, { pipelineStatusIn: ["ready", "failed"] })).toBeNull();
  });

  it("lists the feed by approval time and deletes rows", async () => {
    const a = await repo.create(newVideo("A"));
    const b = await repo.create(newVideo("B"));
    await repo.update(a.id, { status: "approved", approved_at: "2026-10-22T10:00:00.000Z" });
    await repo.update(b.id, { status: "approved", approved_at: "2026-10-22T11:00:00.000Z" });
    expect((await repo.list({ status: "approved" })).map((v) => v.title)).toEqual(["B", "A"]);
    expect(await repo.countPending()).toBe(0);

    expect((await repo.delete(a.id))?.title).toBe("A");
    expect(await repo.delete(a.id)).toBeNull();
    expect((await repo.list()).map((v) => v.title)).toEqual(["B"]);
  });

  it("enforces the same checks as the Postgres schema", async () => {
    await expect(repo.create(newVideo(""))).rejects.toThrow(/CHECK constraint/);
    const video = await repo.create(newVideo("Clip"));
    await expect(repo.update(video.id, { status: "published" as never })).rejects.toThrow(/CHECK constraint/);
  });
});
