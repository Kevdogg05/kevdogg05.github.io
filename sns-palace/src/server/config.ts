// Typed, validated settings from the environment (.env.local in development).
//
// Each area is parsed on first use, so the worker never needs the PINs and the
// web app never needs pipeline settings. Invalid values fail loudly with every
// problem listed, instead of surfacing later as a confusing runtime error.

import path from "node:path";
import { z } from "zod";

export class ConfigError extends Error {
  constructor(area: string, issues: string[]) {
    super(`SnS Palace ${area} settings are missing or invalid:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

/** process.env with empty strings removed, so `KEY=` falls back to the default. */
function readEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );
}

function parse<T extends z.ZodType>(area: string, schema: T): z.output<T> {
  const result = schema.safeParse(readEnv());
  if (!result.success) {
    throw new ConfigError(
      area,
      result.error.issues.map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`),
    );
  }
  return result.data;
}

function memo<T>(load: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= load());
}

const pin = (min: number) =>
  z.string().regex(new RegExp(`^\\d{${min},12}$`), `must be ${min} to 12 digits`);

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((value) => ["true", "1", "yes"].includes(value));

// ---------------------------------------------------------------------------

const authSchema = z
  .object({
    FAMILY_PIN: pin(4),
    PARENT_PIN: pin(6),
    SESSION_SECRET: z.string().min(32, "must be at least 32 characters (try: openssl rand -base64 48)"),
    FAMILY_SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    PARENT_SESSION_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  })
  .refine((env) => env.FAMILY_PIN !== env.PARENT_PIN, {
    path: ["PARENT_PIN"],
    message: "must be different from FAMILY_PIN",
  })
  .transform((env) => ({
    familyPin: env.FAMILY_PIN,
    parentPin: env.PARENT_PIN,
    sessionSecret: env.SESSION_SECRET,
    familySessionSeconds: env.FAMILY_SESSION_DAYS * 86_400,
    parentSessionSeconds: env.PARENT_SESSION_MINUTES * 60,
  }));

export type AuthConfig = z.output<typeof authSchema>;
export const getAuthConfig = memo(() => parse("access", authSchema));

// ---------------------------------------------------------------------------

const localDataDir = z
  .string()
  .default("./data")
  // Runtime data, not part of the app: keep the build from tracing it.
  .transform((dir) => path.resolve(/*turbopackIgnore: true*/ process.cwd(), dir));

const databaseSchema = z.discriminatedUnion("DATABASE_DRIVER", [
  z
    .object({
      DATABASE_DRIVER: z.literal("supabase"),
      SUPABASE_URL: z.url({ message: "must be your project URL, e.g. https://abcd.supabase.co" }),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "must be the service-role (secret) key"),
    })
    .transform((env) => ({
      driver: "supabase" as const,
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    })),
  z
    .object({ DATABASE_DRIVER: z.literal("local"), LOCAL_DATA_DIR: localDataDir })
    .transform((env) => ({
      driver: "local" as const,
      file: path.join(env.LOCAL_DATA_DIR, "sns-palace.db"),
    })),
]);

export type DatabaseConfig = z.output<typeof databaseSchema>;
export const getDatabaseConfig = memo(() =>
  parse("database", z.preprocess(withDefault("DATABASE_DRIVER", "supabase"), databaseSchema)),
);

// ---------------------------------------------------------------------------

const storageSchema = z.discriminatedUnion("STORAGE_DRIVER", [
  z
    .object({
      STORAGE_DRIVER: z.literal("cloudinary"),
      CLOUDINARY_CLOUD_NAME: z.string().min(1),
      CLOUDINARY_API_KEY: z.string().min(1),
      CLOUDINARY_API_SECRET: z.string().min(1),
      CLOUDINARY_FOLDER: z
        .string()
        .regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/, "letters, digits, - and _ only, separated by /")
        .default("sns-palace"),
    })
    .transform((env) => ({
      driver: "cloudinary" as const,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      folder: env.CLOUDINARY_FOLDER,
    })),
  z
    .object({ STORAGE_DRIVER: z.literal("local"), LOCAL_DATA_DIR: localDataDir })
    .transform((env) => ({ driver: "local" as const, root: path.join(env.LOCAL_DATA_DIR, "media") })),
]);

export type StorageConfig = z.output<typeof storageSchema>;
export const getStorageConfig = memo(() =>
  parse("storage", z.preprocess(withDefault("STORAGE_DRIVER", "cloudinary"), storageSchema)),
);

function withDefault(key: string, fallback: string) {
  return (env: unknown) => ({ [key]: fallback, ...(env as Record<string, string>) });
}

// ---------------------------------------------------------------------------

const uploadSchema = z
  .object({ MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(10_240).default(1024) })
  .transform((env) => ({ maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024 }));

export type UploadConfig = z.output<typeof uploadSchema>;
export const getUploadConfig = memo(() => parse("upload", uploadSchema));

// ---------------------------------------------------------------------------

// compose.yaml shares the Tailscale container's LocalAPI socket, so "Add a
// device" can show this device's https://<name>.<tailnet>.ts.net address.
const tailscaleSchema = z
  .object({ TAILSCALE_SOCKET: z.string().optional() })
  .transform((env) => ({ socket: env.TAILSCALE_SOCKET ?? null }));

export const getTailscaleConfig = memo(() => parse("tailscale", tailscaleSchema));

// ---------------------------------------------------------------------------

const pipelineSchema = z
  .object({
    TRANSCRIBER: z.enum(["local", "openai", "none"]).default("local"),
    WHISPER_PYTHON: z.string().default("python3"),
    WHISPER_MODEL: z.string().default("base.en"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_TRANSCRIBE_MODEL: z.string().default("whisper-1"),
    SILENCE_MIN_SECONDS: z.coerce.number().min(0.3).max(30).default(1.5),
    SILENCE_NOISE_DB: z.coerce.number().min(-90).max(-10).default(-35),
    SILENCE_PADDING_SECONDS: z.coerce.number().min(0).max(2).default(0.25),
    CAPTIONS: bool.default(true),
    NORMALIZE_AUDIO: bool.default(true),
    OUTPUT_WEBM: bool.default(true),
    OUTPUT_MAX_SIZE: z.coerce.number().int().min(320).max(3840).default(1280),
    VIDEO_CRF: z.coerce.number().int().min(14).max(40).default(23),
    VIDEO_PRESET: z
      .enum(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower"])
      .default("medium"),
    FFMPEG_THREADS: z.coerce.number().int().min(0).max(64).default(0),
    FFMPEG_PATH: z.string().default("ffmpeg"),
    FFPROBE_PATH: z.string().default("ffprobe"),
    WORKER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(3000),
    WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    WORKER_STALE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(300),
  })
  .refine((env) => env.TRANSCRIBER !== "openai" || env.OPENAI_API_KEY, {
    path: ["OPENAI_API_KEY"],
    message: "is required when TRANSCRIBER=openai",
  })
  .transform((env) => ({
    transcriber: env.TRANSCRIBER,
    whisperPython: env.WHISPER_PYTHON,
    whisperModel: env.WHISPER_MODEL,
    openaiApiKey: env.OPENAI_API_KEY ?? null,
    openaiModel: env.OPENAI_TRANSCRIBE_MODEL,
    minSilence: env.SILENCE_MIN_SECONDS,
    noiseDb: env.SILENCE_NOISE_DB,
    padding: env.SILENCE_PADDING_SECONDS,
    captions: env.CAPTIONS,
    normalizeAudio: env.NORMALIZE_AUDIO,
    webm: env.OUTPUT_WEBM,
    outputMaxSize: env.OUTPUT_MAX_SIZE,
    crf: env.VIDEO_CRF,
    preset: env.VIDEO_PRESET,
    threads: env.FFMPEG_THREADS,
    ffmpeg: env.FFMPEG_PATH,
    ffprobe: env.FFPROBE_PATH,
    pollMs: env.WORKER_POLL_MS,
    maxAttempts: env.WORKER_MAX_ATTEMPTS,
    staleSeconds: env.WORKER_STALE_SECONDS,
  }));

export type PipelineConfig = z.output<typeof pipelineSchema>;
export const getPipelineConfig = memo(() => parse("pipeline", pipelineSchema));
