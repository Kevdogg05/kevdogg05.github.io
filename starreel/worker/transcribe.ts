// Speech-to-text with word timings, behind one small interface:
//   local  - faster-whisper on this machine (worker/transcribe.py); private
//   openai - OpenAI's Whisper API; sends the audio track to OpenAI
// Timestamps are stored as integer microseconds.

import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Transcript, TranscriptWord } from "@/lib/types";
import type { PipelineConfig } from "@/server/config";
import { ProcessError, run, speechMp3Args } from "./media";

export interface TranscribeContext {
  workDir: string;
  ffmpeg: string;
  signal: AbortSignal;
}

export interface Transcriber {
  readonly name: string;
  transcribe(wavPath: string, context: TranscribeContext): Promise<Transcript>;
  /** Startup self-check; returns a problem to warn about, or null. */
  check?(): Promise<string | null>;
}

interface RawWord {
  text: string;
  start: number;
  end: number;
  probability?: number | null;
}

export function toTranscript(engine: string, model: string | null, language: string | null, raw: RawWord[]): Transcript {
  const words: TranscriptWord[] = raw
    .map((word) => ({
      text: word.text.trim(),
      start_us: Math.round(word.start * 1e6),
      end_us: Math.round(Math.max(word.end, word.start) * 1e6),
      probability: typeof word.probability === "number" ? word.probability : null,
    }))
    .filter((word) => word.text)
    .sort((a, b) => a.start_us - b.start_us);
  return { engine, model, language, text: words.map((word) => word.text).join(" "), words };
}

const HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), "transcribe.py");
const EXIT_NOT_INSTALLED = 3;

export class LocalWhisperTranscriber implements Transcriber {
  readonly name = "faster-whisper";

  constructor(
    private readonly python: string,
    private readonly model: string,
  ) {}

  async transcribe(wavPath: string, { signal }: TranscribeContext): Promise<Transcript> {
    let stdout: string;
    try {
      ({ stdout } = await run(this.python, [HELPER, wavPath, "--model", this.model], { signal }));
    } catch (error) {
      if (error instanceof ProcessError) {
        if (error.code === EXIT_NOT_INSTALLED) {
          throw new Error(`faster-whisper isn't installed for ${this.python}. See worker/requirements.txt.`);
        }
        // The last stderr line of a Python traceback names the actual problem.
        throw new Error(`speech recognition failed: ${error.stderrTail.split("\n").at(-1)}`);
      }
      throw error;
    }
    const result = JSON.parse(stdout) as { language: string | null; model: string; words: RawWord[] };
    return toTranscript(this.name, result.model, result.language, result.words);
  }

  async check(): Promise<string | null> {
    try {
      await run(this.python, ["-c", "import faster_whisper"]);
      return null;
    } catch {
      return `faster-whisper isn't installed for ${this.python}, so videos won't get captions. See worker/requirements.txt.`;
    }
  }
}

const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

export class OpenAITranscriber implements Transcriber {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async transcribe(wavPath: string, { workDir, ffmpeg, signal }: TranscribeContext): Promise<Transcript> {
    // A small MP3 keeps uploads quick and long clips under the 25 MB API limit.
    const mp3 = path.join(workDir, "speech.mp3");
    await run(ffmpeg, speechMp3Args(wavPath, mp3), { signal });
    if ((await stat(mp3)).size > OPENAI_MAX_BYTES) throw new Error("The video is too long for the OpenAI API (about 70 minutes max).");

    const form = new FormData();
    form.set("file", await openAsBlob(mp3, { type: "audio/mpeg" }), "speech.mp3");
    form.set("model", this.model);
    form.set("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`OpenAI transcription failed (${response.status}): ${detail}`);
    }
    const data = (await response.json()) as { language?: string; words?: { word: string; start: number; end: number }[] };
    const words = (data.words ?? []).map((word) => ({ text: word.word, start: word.start, end: word.end }));
    return toTranscript(this.name, this.model, data.language ?? null, words);
  }
}

export function createTranscriber(config: PipelineConfig): Transcriber | null {
  switch (config.transcriber) {
    case "local":
      return new LocalWhisperTranscriber(config.whisperPython, config.whisperModel);
    case "openai":
      return new OpenAITranscriber(config.openaiApiKey!, config.openaiModel);
    case "none":
      return null;
  }
}
