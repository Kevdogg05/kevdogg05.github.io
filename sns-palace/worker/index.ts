// The SnS Palace editing worker: watches the queue and edits each new upload.
//
//   npm run worker            keep running (Ctrl-C finishes cleanly)
//   npm run worker -- --once  edit everything waiting, then exit (cron-friendly)
//
// Reads the same .env.local as the web app. Run it from the project folder.

import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { loadEnvConfig } from "@next/env";
import { getPipelineConfig } from "@/server/config";
import { getRepository } from "@/server/db";
import { getStorage } from "@/server/storage";
import { run } from "./media";
import { processVideo } from "./pipeline";
import { createTranscriber } from "./transcribe";

const log = (message: string) => console.log(`[worker ${new Date().toLocaleTimeString()}] ${message}`);

async function pause(ms: number, signal: AbortSignal) {
  await sleep(ms, undefined, { signal }).catch(() => {});
}

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
  const once = process.argv.includes("--once");
  const config = getPipelineConfig();

  for (const tool of [config.ffmpeg, config.ffprobe]) {
    await run(tool, ["-version"]).catch((error) => {
      throw new Error(`${tool} is required: ${error instanceof Error ? error.message : error}`);
    });
  }
  const [repo, storage] = await Promise.all([getRepository(), getStorage()]);
  const transcriber = createTranscriber(config);
  const problem = await transcriber?.check?.();
  if (problem) log(`warning: ${problem}`);
  const workerId = `${hostname()}:${process.pid}:${randomBytes(3).toString("hex")}`;

  const shutdown = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      if (shutdown.signal.aborted) process.exit(130); // second Ctrl-C: stop now
      log("stopping: the current video goes back to the queue (Ctrl-C again to force)");
      shutdown.abort(new Error("Worker shutting down"));
    });
  }

  log(
    `ready as ${workerId}: database=${repo.driver}, storage=${storage.driver}, ` +
      `transcriber=${transcriber?.name ?? "none"}${config.transcriber === "local" ? ` (${config.whisperModel})` : ""}`,
  );

  let backoff = 0;
  while (!shutdown.signal.aborted) {
    let video;
    try {
      video = await repo.claimNext({ workerId, staleSeconds: config.staleSeconds, maxAttempts: config.maxAttempts });
      backoff = 0;
    } catch (error) {
      backoff = Math.min(30_000, Math.max(config.pollMs, backoff * 2));
      log(`database unavailable (${error instanceof Error ? error.message : error}); retrying in ${backoff / 1000}s`);
      await pause(backoff, shutdown.signal);
      continue;
    }

    if (!video) {
      if (once) break;
      await pause(config.pollMs, shutdown.signal);
      continue;
    }

    log(`editing "${video.title}" (${video.id}), attempt ${video.attempts}/${config.maxAttempts}`);
    const started = Date.now();
    const outcome = await processVideo(video, {
      repo,
      storage,
      config,
      transcriber,
      workerId,
      signal: shutdown.signal,
      log: (message) => log(`  ${message}`),
    });
    log(`  → ${outcome} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    // Give a transient problem (network, storage) a moment before retrying.
    if (outcome === "requeued") await pause(config.pollMs * video.attempts, shutdown.signal);
  }
  log("stopped");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
