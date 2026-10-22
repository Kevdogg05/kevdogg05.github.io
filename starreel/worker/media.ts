// ffmpeg and ffprobe: running them, reading probe output, and building the
// argument lists for each pipeline step. The builders are pure so the exact
// commands are unit tested.

import { spawn } from "node:child_process";
import type { TimeRange } from "@/lib/types";

export class MediaError extends Error {
  constructor(
    message: string,
    /** Retrying won't help (the file itself is the problem). */
    readonly permanent = false,
  ) {
    super(message);
    this.name = "MediaError";
  }
}

export class ProcessError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | null,
    readonly stderrTail: string,
  ) {
    super(`${command} exited with code ${code}:\n${stderrTail}`);
    this.name = "ProcessError";
  }
}

export interface RunOptions {
  cwd?: string;
  signal?: AbortSignal;
}

/** Runs a tool, resolving with stdout and stderr; rejects with the stderr tail. */
export function run(command: string, args: string[], options: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    const onAbort = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error: NodeJS.ErrnoException) => {
      options.signal?.removeEventListener("abort", onAbort);
      reject(error.code === "ENOENT" ? new Error(`${command} was not found. Is it installed and on PATH?`) : error);
    });
    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", onAbort);
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (options.signal?.aborted) return reject(options.signal.reason ?? new Error("Aborted"));
      if (code === 0) return resolve({ stdout: out, stderr: err });
      reject(new ProcessError(command, code, err.trim().split("\n").slice(-12).join("\n")));
    });
  });
}

// ---------------------------------------------------------------------------
// Probing

export interface MediaInfo {
  duration: number;
  /** Display size: rotation and pixel aspect ratio applied. */
  width: number;
  height: number;
  fps: number | null;
  videoCodec: string | null;
  hasAudio: boolean;
  audioCodec: string | null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  sample_aspect_ratio?: string;
  duration?: string;
  disposition?: { attached_pic?: number };
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
}

interface ProbeOutput {
  streams?: ProbeStream[];
  format?: { duration?: string };
}

function ratio(value: string | undefined): number | null {
  const [num, den] = (value ?? "").split(/[/:]/).map(Number);
  return num > 0 && den > 0 ? num / den : null;
}

export function parseProbe(output: ProbeOutput): MediaInfo {
  const streams = output.streams ?? [];
  // Skip cover art, which ffprobe also reports as a video stream.
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video?.width || !video.height) throw new MediaError("This file has no video picture in it.", true);
  const audio = streams.find((s) => s.codec_type === "audio");

  const duration = Number(output.format?.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0.1) throw new MediaError("This video is empty or too short.", true);

  const rotation = Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const sar = ratio(video.sample_aspect_ratio) ?? 1;
  let width = Math.round(video.width * sar);
  let height = video.height;
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];

  const fps = ratio(video.avg_frame_rate);
  return {
    duration,
    width,
    height,
    fps: fps === null ? null : Math.round(fps * 100) / 100,
    videoCodec: video.codec_name ?? null,
    hasAudio: Boolean(audio),
    audioCodec: audio?.codec_name ?? null,
  };
}

export async function probe(ffprobe: string, file: string, signal?: AbortSignal): Promise<MediaInfo> {
  let stdout: string;
  try {
    ({ stdout } = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { signal }));
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new MediaError("This file couldn't be read as a video. It may be damaged or in an unusual format.", true);
  }
  return parseProbe(JSON.parse(stdout) as ProbeOutput);
}

/**
 * Fits a size inside a box whose long side is `maxLong` and short side is
 * 9/16 of that (1280 → 1280×720 or 720×1280). Never upscales; even numbers.
 */
export function fitDimensions(width: number, height: number, maxLong: number): { width: number; height: number } {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const scale = Math.min(1, maxLong / long, Math.round((maxLong * 9) / 16) / short);
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

// ---------------------------------------------------------------------------
// Argument builders

const BASE = ["-hide_banner", "-nostdin", "-nostats", "-y"];
// Phone videos carry GPS location and device details in their metadata; drop it.
const STRIP_METADATA = ["-map_metadata", "-1", "-map_chapters", "-1"];
const H264 = ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-fpsmax", "30"];
const WEB = ["-movflags", "+faststart"];

/** One representative frame from early in the video, as a JPEG. */
export function thumbnailArgs(input: string, output: string, info: MediaInfo, maxLong = 640): string[] {
  const { width, height } = fitDimensions(info.width, info.height, maxLong);
  const at = info.duration < 2 ? 0 : Math.min(1.5, info.duration * 0.2);
  return [
    ...BASE,
    "-ss", at.toFixed(3),
    "-i", input,
    "-map", "0:v:0",
    "-vf", `thumbnail=n=30,scale=${width}:${height}:flags=lanczos,setsar=1`,
    "-frames:v", "1",
    "-q:v", "3",
    ...STRIP_METADATA,
    output,
  ];
}

/** A small, fast copy of the untouched upload that every browser can play. */
export function previewArgs(input: string, output: string, info: MediaInfo, maxLong = 854): string[] {
  const { width, height } = fitDimensions(info.width, info.height, maxLong);
  return [
    ...BASE,
    "-i", input,
    "-map", "0:v:0",
    ...(info.hasAudio ? ["-map", "0:a:0"] : []),
    "-vf", `scale=${width}:${height}:flags=bicubic,setsar=1`,
    ...H264, "-preset", "veryfast", "-crf", "28",
    "-c:a", "aac", "-b:a", "96k", "-ac", "2",
    ...STRIP_METADATA,
    ...WEB,
    output,
  ];
}

/**
 * 16 kHz mono WAV for speech recognition and silence detection. first_pts=0
 * pads the start if the audio begins after the video, so times line up.
 */
export function extractAudioArgs(input: string, output: string): string[] {
  return [...BASE, "-i", input, "-map", "0:a:0", "-vn", "-af", "aresample=16000:async=1:first_pts=0", "-ac", "1", "-c:a", "pcm_s16le", output];
}

export function silenceDetectArgs(wav: string, noiseDb: number, minSilence: number): string[] {
  return [...BASE, "-i", wav, "-af", `silencedetect=noise=${noiseDb}dB:d=${minSilence}`, "-f", "null", "-"];
}

export interface RenderOptions {
  input: string;
  output: string;
  /** Also write a VP9/Opus WebM copy here, from the same decode and filters. */
  webmOutput: string | null;
  kept: TimeRange[];
  hasAudio: boolean;
  width: number;
  height: number;
  /** ASS file and fonts folder, relative to the ffmpeg working directory. */
  captions: { file: string; fontsDir: string } | null;
  normalizeAudio: boolean;
  crf: number;
  preset: string;
}

const t = (seconds: number) => seconds.toFixed(3);

/** The filtergraph that cuts, joins, scales, captions and levels the video in one pass. */
export function renderFilterGraph(o: Omit<RenderOptions, "input" | "output" | "webmOutput" | "crf" | "preset"> & { webm: boolean }): string {
  const n = o.kept.length;
  const parts: string[] = [];
  const range = (i: number) => `start=${t(o.kept[i].start)}:end=${t(o.kept[i].end)}`;

  parts.push(`[0:v:0]split=${n}${o.kept.map((_, i) => `[v${i}]`).join("")}`);
  o.kept.forEach((_, i) => parts.push(`[v${i}]trim=${range(i)},setpts=PTS-STARTPTS[vt${i}]`));
  if (o.hasAudio) {
    parts.push(`[0:a:0]asplit=${n}${o.kept.map((_, i) => `[a${i}]`).join("")}`);
    o.kept.forEach((_, i) => parts.push(`[a${i}]atrim=${range(i)},asetpts=PTS-STARTPTS[at${i}]`));
  }
  const inputs = o.kept.map((_, i) => (o.hasAudio ? `[vt${i}][at${i}]` : `[vt${i}]`)).join("");
  parts.push(`${inputs}concat=n=${n}:v=1:a=${o.hasAudio ? 1 : 0}[vc]${o.hasAudio ? "[ac]" : ""}`);

  const video = [`scale=${o.width}:${o.height}:flags=lanczos`, "setsar=1", "format=yuv420p"];
  if (o.captions) video.push(`ass=filename=${o.captions.file}:fontsdir=${o.captions.fontsDir}`);
  // With a WebM too, the finished picture and sound feed both encoders.
  parts.push(`[vc]${video.join(",")}${o.webm ? ",split=2[v][vw]" : "[v]"}`);

  if (o.hasAudio) {
    const audio = o.normalizeAudio ? "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000" : "aresample=48000";
    parts.push(`[ac]${audio}${o.webm ? ",asplit=2[a][aw]" : "[a]"}`);
  }
  return parts.join(";");
}

export function renderArgs(o: RenderOptions): string[] {
  const webm = o.webmOutput
    ? [
        "-map", "[vw]",
        ...(o.hasAudio ? ["-map", "[aw]", "-c:a", "libopus", "-b:a", "96k", "-ac", "2"] : []),
        // A compatibility copy, so speed matters more than size: realtime mode
        // encoded about 10x faster than "good" here (good caps cpu-used at 5).
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(Math.min(63, o.crf + 10)),
        "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-pix_fmt", "yuv420p", "-fpsmax", "30",
        ...STRIP_METADATA,
        o.webmOutput,
      ]
    : [];
  return [
    ...BASE,
    "-i", o.input,
    "-filter_complex", renderFilterGraph({ ...o, webm: Boolean(o.webmOutput) }),
    "-map", "[v]",
    ...(o.hasAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "128k", "-ac", "2"] : []),
    ...H264, "-preset", o.preset, "-crf", String(o.crf),
    ...STRIP_METADATA,
    ...WEB,
    o.output,
    ...webm,
  ];
}

/** Compact MP3 of the speech, for upload to a transcription API. */
export function speechMp3Args(wav: string, output: string): string[] {
  return [...BASE, "-i", wav, "-c:a", "libmp3lame", "-b:a", "48k", "-ac", "1", output];
}
