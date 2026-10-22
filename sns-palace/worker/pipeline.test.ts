// End-to-end: a real clip through the real ffmpeg pipeline, using the local
// database and storage drivers. Speech is stood in for by tones at known times
// and a fake transcriber that "hears" words inside them.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Transcript, VideoRecord } from "@/lib/types";
import type { PipelineConfig } from "@/server/config";
import { SqliteVideoRepository } from "@/server/db/sqlite";
import { LocalMediaStorage } from "@/server/storage/local";
import { probe } from "./media";
import { processVideo } from "./pipeline";
import type { Transcriber } from "./transcribe";
import { toTranscript } from "./transcribe";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const config: PipelineConfig = {
  transcriber: "none",
  whisperPython: "python3",
  whisperModel: "base.en",
  openaiApiKey: null,
  openaiModel: "whisper-1",
  minSilence: 1.5,
  noiseDb: -35,
  padding: 0.25,
  captions: true,
  normalizeAudio: true,
  webm: true,
  outputMaxSize: 1280,
  crf: 30,
  preset: "ultrafast",
  ffmpeg: "ffmpeg",
  ffprobe: "ffprobe",
  pollMs: 100,
  maxAttempts: 3,
  staleSeconds: 300,
};

const WORDS = [
  { text: "Hello", start: 2.2, end: 2.6 },
  { text: "rocket", start: 2.8, end: 3.5 },
  { text: "launch!", start: 7.2, end: 7.9 },
  { text: "Bye", start: 8.2, end: 8.8 },
];

class FakeTranscriber implements Transcriber {
  readonly name = "fake";
  calls = 0;
  constructor(private readonly onTranscribe?: () => Promise<void>) {}
  async transcribe(): Promise<Transcript> {
    this.calls += 1;
    await this.onTranscribe?.();
    return toTranscript("fake", null, "en", WORDS);
  }
}

let dir: string;
let clip: string;
let repo: SqliteVideoRepository;
let storage: LocalMediaStorage;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "sns-palace-pipeline-"));
  clip = path.join(dir, "clip.mp4");
  if (!hasFfmpeg) return;
  // 11 s portrait clip; sound only at 2-4 s and 7-9 s; tagged with a GPS location.
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30",
    "-f", "lavfi", "-i", "aevalsrc='if(between(t,2,4)+between(t,7,9),0.5*sin(2*PI*440*t),0)':s=48000:d=11",
    "-t", "11", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
    "-metadata", "location=+37.7749-122.4194/",
    clip,
  ]);
});

afterAll(() => rm(dir, { recursive: true, force: true }));

beforeEach(async () => {
  repo?.close();
  repo = new SqliteVideoRepository(":memory:");
  const media = path.join(dir, `media-${randomUUID()}`);
  storage = new LocalMediaStorage(media);
});

async function enqueue(file: string): Promise<VideoRecord> {
  const id = randomUUID();
  const raw = await storage.putFile(file, { kind: "raw", name: id, ext: "mp4", contentType: "video/mp4" });
  await repo.create({
    id,
    title: "Rocket launch",
    raw_url: raw.url,
    raw_key: raw.key,
    original_filename: "clip.mp4",
    content_type: "video/mp4",
    size_bytes: raw.bytes,
  });
  return (await repo.claimNext({ workerId: "test", staleSeconds: 300, maxAttempts: 3 }))!;
}

const deps = (transcriber: Transcriber | null) => ({
  repo,
  storage,
  config,
  transcriber,
  workerId: "test",
  signal: new AbortController().signal,
});

async function storedFiles(): Promise<string[]> {
  const root = (storage as unknown as { root: string }).root;
  const kinds = await readdir(root).catch(() => [] as string[]);
  const files = await Promise.all(kinds.map(async (kind) => (await readdir(path.join(root, kind))).map((f) => `${kind}/${f}`)));
  return files.flat().sort();
}

describe.skipIf(!hasFfmpeg)("processVideo", () => {
  it("trims the pauses, captions the words and publishes everything", async () => {
    const claimed = await enqueue(clip);
    expect(await processVideo(claimed, deps(new FakeTranscriber()))).toBe("ready");

    const video = (await repo.get(claimed.id))!;
    expect(video).toMatchObject({ status: "pending", pipeline_status: "ready", pipeline_error: null, locked_by: null });
    expect(video.edited_key).toMatch(/^edited\/.+\.mp4$/);
    expect(video.edited_webm_key).toMatch(/^webm\/.+\.webm$/);
    expect(video.thumbnail_key).toMatch(/^thumbnail\/.+\.jpg$/);
    expect(video.preview_key).toMatch(/^preview\/.+\.mp4$/);

    const analysis = video.analysis!;
    const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(0.06);
    expect(analysis.cuts).toHaveLength(3);
    [[0, 1.75], [4.25, 6.75], [9.25, 11]].forEach(([start, end], i) => {
      near(analysis.cuts[i].start, start);
      near(analysis.cuts[i].end, end);
    });
    near(analysis.removed_duration, 6);
    expect(Math.abs(analysis.edited_duration - 5)).toBeLessThan(0.15);
    expect(analysis).toMatchObject({ word_count: 4, has_audio: true, captions: true, warnings: [] });
    expect(Object.keys(analysis.timings_ms)).toEqual(["probe", "preview", "transcribe", "silence", "render", "publish"]);

    // Words are re-timed onto the edit: "launch!" was at 7.2 s, after 4.25 s of cuts.
    const launch = video.transcript_json!.edited_words.find((w) => w.text === "launch!")!;
    expect(Math.abs(launch.start_us / 1e6 - 2.95)).toBeLessThan(0.06);
    expect(video.transcript_json!.text).toBe("Hello rocket launch! Bye");

    // The edit is a playable H.264/AAC file without the phone's location tag.
    const root = (storage as unknown as { root: string }).root;
    const editedPath = path.join(root, video.edited_key!);
    const info = await probe("ffprobe", editedPath);
    expect(info).toMatchObject({ width: 360, height: 640, videoCodec: "h264", audioCodec: "aac" });
    const webm = await probe("ffprobe", path.join(root, video.edited_webm_key!));
    expect(webm).toMatchObject({ width: 360, height: 640, videoCodec: "vp9", audioCodec: "opus" });
    expect(Math.abs(webm.duration - info.duration)).toBeLessThan(0.1);
    expect(analysis.output.webm_bytes).toBeGreaterThan(0);
    const tags = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", editedPath]).toString();
    expect(tags).not.toContain("37.7749");
    const rawTags = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", clip]).toString();
    expect(rawTags).toContain("37.7749");
  });

  it("replaces the previous edit's files when a video is edited again", async () => {
    const claimed = await enqueue(clip);
    await processVideo(claimed, deps(null));
    const first = (await repo.get(claimed.id))!;
    expect(first.analysis!.warnings).toContain("Transcription is turned off (TRANSCRIBER=none), so there are no captions.");
    expect(first.analysis!.captions).toBe(false);

    await repo.update(claimed.id, { pipeline_status: "queued", attempts: 0 });
    const again = (await repo.claimNext({ workerId: "test", staleSeconds: 300, maxAttempts: 3 }))!;
    expect(await processVideo(again, deps(new FakeTranscriber()))).toBe("ready");
    const second = (await repo.get(claimed.id))!;
    expect(second.edited_key).not.toBe(first.edited_key);

    // Only the raw upload and the newest edit's four files remain.
    expect(await storedFiles()).toEqual(
      [second.edited_key, second.edited_webm_key, second.preview_key, second.raw_key, second.thumbnail_key].sort(),
    );
  });

  it("fails a damaged file once, with a reason a parent can read", async () => {
    const broken = path.join(dir, "broken.mp4");
    await writeFile(broken, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42"), Buffer.alloc(4000, 7)]));
    const claimed = await enqueue(broken);
    expect(await processVideo(claimed, deps(null))).toBe("failed");
    const video = (await repo.get(claimed.id))!;
    expect(video.pipeline_status).toBe("failed");
    expect(video.pipeline_stage).toBe("probe");
    expect(video.pipeline_error).toMatch(/^Reading the upload failed: This file couldn't be read as a video/);
    expect(await storedFiles()).toEqual([video.raw_key]);
  });

  it("stops and cleans up when a parent deletes the video mid-edit", async () => {
    const claimed = await enqueue(clip);
    // Simulate DELETE /api/videos/:id while the worker is transcribing.
    const transcriber = new FakeTranscriber(async () => {
      const row = (await repo.get(claimed.id))!;
      for (const [key, kind] of [[row.raw_key, "raw"], [row.preview_key, "preview"], [row.thumbnail_key, "thumbnail"]] as const) {
        if (key) await storage.delete(key, kind);
      }
      await repo.delete(claimed.id);
    });
    expect(await processVideo(claimed, deps(transcriber))).toBe("gone");
    expect(await storedFiles()).toEqual([]);
  });
});
