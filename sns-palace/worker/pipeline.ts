// The automatic editing pipeline for one video:
//
//   probe       download the raw upload and read its streams
//   preview     thumbnail + browser-safe copy, published at once for parents
//   transcribe  word-level transcript (faster-whisper or OpenAI)
//   silence     find pauses with ffmpeg silencedetect and plan the cuts
//   render      one ffmpeg pass: trim, join, scale, burn captions, level audio,
//               encoded as H.264 MP4, plus a VP9 WebM copy unless turned off
//   publish     upload the edit and mark the video ready for review
//
// Every database write is conditional on this worker still holding the
// video's lock, so a deleted video or a takeover after a stall is noticed and
// whatever this run uploaded is removed again.

import { randomBytes } from "node:crypto";
import { cp, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MediaVariant,
  PipelineStage,
  Transcript,
  TranscriptJson,
  VideoAnalysis,
  VideoRecord,
} from "@/lib/types";
import type { PipelineConfig } from "@/server/config";
import type { VideoPatch, VideoRepository } from "@/server/db/repository";
import type { MediaStorage, StoredAsset } from "@/server/storage/types";
import { buildAss, groupCaptionLines, maxCharsFor } from "./captions";
import { parseSilenceDetect, planEdit, remapWords, type EditPlan } from "./edit-plan";
import {
  extractAudioArgs,
  fitDimensions,
  MediaError,
  previewArgs,
  probe,
  renderArgs,
  run,
  silenceDetectArgs,
  thumbnailArgs,
} from "./media";
import type { Transcriber } from "./transcribe";

export const DEFAULT_FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");
/** Family name of the bundled worker/fonts/Fredoka-Bold.ttf. */
const CAPTION_FONT = "Fredoka";

export interface PipelineDeps {
  repo: VideoRepository;
  storage: MediaStorage;
  config: PipelineConfig;
  transcriber: Transcriber | null;
  workerId: string;
  /** Stops the run (worker shutdown). */
  signal: AbortSignal;
  fontsDir?: string;
  log?: (message: string) => void;
}

/** ready: edited · requeued: will retry · failed: gave up · gone: deleted or taken over · released: shutdown */
export type PipelineOutcome = "ready" | "requeued" | "failed" | "gone" | "released";

class LostVideo extends Error {
  constructor() {
    super("The video was deleted or handed to another worker.");
    this.name = "LostVideo";
  }
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  probe: "Reading the upload",
  preview: "Making the preview",
  transcribe: "Listening for words",
  silence: "Finding pauses",
  render: "Rendering the edit",
  publish: "Saving the edit",
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const extension = (key: string) => key.split(".").pop() ?? "mp4";

export async function processVideo(claimed: VideoRecord, deps: PipelineDeps): Promise<PipelineOutcome> {
  const { repo, storage, config } = deps;
  const log = deps.log ?? (() => {});
  const lock = { lockedBy: deps.workerId };
  const name = `${claimed.id}-${randomBytes(4).toString("hex")}`;
  const work = await mkdtemp(path.join(tmpdir(), `sns-palace-${claimed.id.slice(0, 8)}-`));

  const lost = new AbortController();
  const signal = AbortSignal.any([deps.signal, lost.signal]);
  // Uploads the database doesn't point at yet: removed if the run fails.
  const pending = new Map<string, MediaVariant>();
  const warnings: string[] = [];
  const timings: Partial<Record<PipelineStage, number>> = {};
  let stage: PipelineStage = "probe";

  const save = async (patch: VideoPatch) => {
    const row = await repo.update(claimed.id, patch, lock);
    if (!row) throw new LostVideo();
    return row;
  };

  const step = async <T>(next: PipelineStage, task: () => Promise<T>): Promise<T> => {
    if (signal.aborted) throw signal.reason;
    stage = next;
    if (next !== "probe") await save({ pipeline_stage: next }); // the claim already set "probe"
    const started = performance.now();
    const result = await task();
    timings[next] = Math.round(performance.now() - started);
    return result;
  };

  const upload = async (file: string, kind: MediaVariant, ext: string, contentType: string): Promise<StoredAsset> => {
    const asset = await deps.storage.putFile(file, { kind, name, ext, contentType });
    pending.set(asset.key, kind);
    return asset;
  };

  const removeQuietly = async (assets: [string | null, MediaVariant][]) => {
    await Promise.all(
      assets
        .filter((entry): entry is [string, MediaVariant] => Boolean(entry[0]))
        .map(([key, kind]) => storage.delete(key, kind).catch((error) => log(`could not delete ${key}: ${error}`))),
    );
  };

  const heartbeat = setInterval(
    () => {
      repo
        .update(claimed.id, { locked_at: new Date().toISOString() }, lock)
        .then((row) => row || lost.abort(new LostVideo()))
        .catch((error) => log(`heartbeat failed: ${error instanceof Error ? error.message : error}`));
    },
    Math.min(60_000, Math.max(5_000, (config.staleSeconds * 1000) / 4)),
  );

  try {
    // 1. Probe ---------------------------------------------------------------
    const rawFile = path.join(work, `raw.${extension(claimed.raw_key)}`);
    const info = await step("probe", async () => {
      await storage.download(claimed.raw_key, "raw", rawFile);
      return probe(config.ffprobe, rawFile, signal);
    });
    log(`${info.width}x${info.height} ${info.videoCodec}, ${info.duration.toFixed(1)}s, audio: ${info.audioCodec ?? "none"}`);

    // 2. Preview: published straight away so parents see something while the edit runs.
    await step("preview", async () => {
      const thumbFile = path.join(work, "thumbnail.jpg");
      const previewFile = path.join(work, "preview.mp4");
      await run(config.ffmpeg, thumbnailArgs(rawFile, thumbFile, info), { signal });
      await run(config.ffmpeg, previewArgs(rawFile, previewFile, info, { threads: config.threads }), { signal });
      const [thumb, preview] = await Promise.all([
        upload(thumbFile, "thumbnail", "jpg", "image/jpeg"),
        upload(previewFile, "preview", "mp4", "video/mp4"),
      ]);
      await save({ thumbnail_key: thumb.key, thumbnail_url: thumb.url, preview_key: preview.key });
      pending.clear();
      // A re-edit replaces the previous run's files.
      await removeQuietly([
        [claimed.thumbnail_key !== thumb.key ? claimed.thumbnail_key : null, "thumbnail"],
        [claimed.preview_key !== preview.key ? claimed.preview_key : null, "preview"],
      ]);
    });

    // 3. Transcribe: captions are a bonus, so a failure here is a warning, not an error.
    const wav = info.hasAudio ? path.join(work, "audio.wav") : null;
    const transcript = await step("transcribe", async (): Promise<Transcript | null> => {
      if (!wav) {
        warnings.push("No sound track, so there are no captions.");
        return null;
      }
      await run(config.ffmpeg, extractAudioArgs(rawFile, wav), { signal });
      if (!deps.transcriber) {
        warnings.push("Transcription is turned off (TRANSCRIBER=none), so there are no captions.");
        return null;
      }
      try {
        const result = await deps.transcriber.transcribe(wav, { workDir: work, ffmpeg: config.ffmpeg, signal });
        if (!result.words.length) warnings.push("No words were recognised, so there are no captions.");
        return result;
      } catch (error) {
        if (signal.aborted) throw error;
        warnings.push(`Captions skipped: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
        return null;
      }
    });

    // 4. Silence -------------------------------------------------------------
    let silencesDetected = 0;
    const plan: EditPlan = await step("silence", async () => {
      if (!wav) return planEdit({ duration: info.duration, silences: [], words: [] });
      const { stderr } = await run(config.ffmpeg, silenceDetectArgs(wav, config.noiseDb, config.minSilence), { signal });
      const silences = parseSilenceDetect(stderr, info.duration);
      silencesDetected = silences.length;
      return planEdit({
        duration: info.duration,
        silences,
        words: transcript?.words ?? [],
        settings: { minSilence: config.minSilence, padding: config.padding },
      });
    });
    if (plan.skippedReason) warnings.push(plan.skippedReason);

    // 5. Render --------------------------------------------------------------
    const size = fitDimensions(info.width, info.height, config.outputMaxSize);
    const editedWords = transcript ? remapWords(transcript.words, plan.kept) : [];
    const editedFile = path.join(work, "edited.mp4");
    const webmFile = config.webm ? path.join(work, "edited.webm") : null;
    const captioned = config.captions && editedWords.length > 0;
    await step("render", async () => {
      if (captioned) {
        const lines = groupCaptionLines(editedWords, { maxChars: maxCharsFor(size) });
        await writeFile(path.join(work, "captions.ass"), buildAss(lines, { ...size, fontName: CAPTION_FONT }));
        await cp(deps.fontsDir ?? DEFAULT_FONTS_DIR, path.join(work, "fonts"), { recursive: true });
      }
      await run(
        config.ffmpeg,
        renderArgs({
          input: rawFile,
          output: editedFile,
          webmOutput: webmFile,
          kept: plan.kept,
          hasAudio: info.hasAudio,
          ...size,
          // Relative to the working directory, so no filtergraph escaping is needed.
          captions: captioned ? { file: "captions.ass", fontsDir: "fonts" } : null,
          normalizeAudio: config.normalizeAudio,
          crf: config.crf,
          preset: config.preset,
          threads: config.threads,
        }),
        { signal, cwd: work },
      );
    });

    // 6. Publish -------------------------------------------------------------
    const [edited, webm] = await step("publish", () =>
      Promise.all([
        upload(editedFile, "edited", "mp4", "video/mp4"),
        webmFile ? upload(webmFile, "webm", "webm", "video/webm") : Promise.resolve(null),
      ]),
    );
    const output = await probe(config.ffprobe, editedFile, signal);
    const transcriptJson: TranscriptJson | null = transcript ? { ...transcript, edited_words: editedWords } : null;
    const analysis: VideoAnalysis = {
      raw_duration: round3(info.duration),
      edited_duration: round3(output.duration),
      removed_duration: round3(plan.cuts.reduce((sum, cut) => sum + cut.end - cut.start, 0)),
      cuts: plan.cuts,
      kept: plan.kept,
      silences_detected: silencesDetected,
      word_count: transcript?.words.length ?? 0,
      has_audio: info.hasAudio,
      captions: captioned,
      source: {
        width: info.width,
        height: info.height,
        fps: info.fps,
        video_codec: info.videoCodec,
        audio_codec: info.audioCodec,
      },
      output: {
        width: size.width,
        height: size.height,
        bytes: (await stat(editedFile)).size,
        webm_bytes: webmFile ? (await stat(webmFile)).size : null,
      },
      settings: { min_silence: config.minSilence, noise_db: config.noiseDb, padding: config.padding },
      warnings,
      timings_ms: timings,
    };

    await save({
      edited_key: edited.key,
      edited_url: edited.url,
      edited_webm_key: webm?.key ?? null,
      transcript_json: transcriptJson,
      analysis,
      pipeline_status: "ready",
      pipeline_stage: null,
      pipeline_error: null,
      locked_by: null,
      locked_at: null,
    });
    pending.clear();
    await removeQuietly([
      [claimed.edited_key !== edited.key ? claimed.edited_key : null, "edited"],
      [claimed.edited_webm_key !== webm?.key ? claimed.edited_webm_key : null, "webm"],
    ]);
    log(
      `ready: ${analysis.raw_duration}s → ${analysis.edited_duration}s, ${plan.cuts.length} cuts, ` +
        `${analysis.word_count} words${captioned ? ", captioned" : ""}`,
    );
    return "ready";
  } catch (error) {
    await removeQuietly([...pending]);
    const reason = lost.signal.aborted ? lost.signal.reason : error;

    if (reason instanceof LostVideo) {
      log(reason.message);
      return "gone";
    }
    if (deps.signal.aborted) {
      // Shutting down: hand the video back without spending an attempt.
      await repo
        .update(
          claimed.id,
          { pipeline_status: "queued", pipeline_stage: null, attempts: Math.max(0, claimed.attempts - 1), locked_by: null, locked_at: null },
          lock,
        )
        .catch(() => {});
      return "released";
    }

    const detail = error instanceof Error ? error.message : String(error);
    const message = `${STAGE_LABELS[stage]} failed: ${detail}`.slice(0, 1000);
    const permanent = error instanceof MediaError && error.permanent;
    const retry = !permanent && claimed.attempts < config.maxAttempts;
    log(`${retry ? "will retry" : "failed"}: ${message}`);
    await repo
      .update(
        claimed.id,
        retry
          ? { pipeline_status: "queued", pipeline_stage: null, pipeline_error: `Retrying after: ${message}`, locked_by: null, locked_at: null }
          : { pipeline_status: "failed", pipeline_stage: stage, pipeline_error: message, locked_by: null, locked_at: null },
        lock,
      )
      .catch((saveError) => log(`could not record the failure: ${saveError}`));
    return retry ? "requeued" : "failed";
  } finally {
    clearInterval(heartbeat);
    await rm(work, { recursive: true, force: true });
  }
}
