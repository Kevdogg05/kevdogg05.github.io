import { LoaderCircle, Timer, WandSparkles, X } from "lucide-react";
import { isActive, type Job } from "@/lib/api";
import { formatDuration } from "@/lib/format";

interface ControlBarProps {
  /** The video shown in the preview, if any. */
  job: Job | null;
  submitting: boolean;
  /** Videos queued or rendering, across the whole library. */
  queued: number;
  canGenerate: boolean;
  blocker: string | null;
  submitError: string | null;
  onGenerate: () => void;
  onCancel: (job: Job) => void;
}

export function ControlBar({
  job,
  submitting,
  queued,
  canGenerate,
  blocker,
  submitError,
  onGenerate,
  onCancel,
}: ControlBarProps) {
  const failed = job?.status === "failed";
  const cancelled = job?.status === "cancelled";
  const completed = job?.status === "completed";
  const active = job ? isActive(job) : false;
  const progress = job?.progress ?? 0;

  const status = !job
    ? null
    : job.status === "queued"
      ? job.queue_position === 1
        ? "Queued: starts when the current video finishes"
        : `Queued: ${aheadOf(job)} ${aheadOf(job) === 1 ? "video" : "videos"} ahead`
      : failed
        ? `Failed: ${job.error ?? job.message}`
        : job.message;

  const hint = submitError ?? blocker;

  return (
    <div className="sticky bottom-0 z-20 border-t border-white/[0.06] bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-5 lg:px-6">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="group relative flex h-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition hover:from-violet-500 hover:to-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none sm:w-64"
        >
          {submitting ? (
            <LoaderCircle className="size-4.5 animate-spin" aria-hidden />
          ) : (
            <WandSparkles className="size-4.5" aria-hidden />
          )}
          {submitting ? "Submitting…" : "Generate Avatar Video"}
        </button>

        <div className="min-w-0 flex-1">
          {job ? (
            <>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span
                  className={`truncate font-medium ${
                    failed ? "text-red-300" : completed ? "text-emerald-300" : cancelled ? "text-zinc-400" : "text-zinc-200"
                  }`}
                >
                  {status}
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums text-zinc-400">
                  {job.render_seconds != null && (
                    <span className="flex items-center gap-1" title="Render time">
                      <Timer className="size-3.5" aria-hidden />
                      {formatDuration(job.render_seconds)}
                    </span>
                  )}
                  <span className="font-semibold text-zinc-200">{progress}%</span>
                  {active && (
                    <button
                      type="button"
                      onClick={() => onCancel(job)}
                      className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-zinc-300 transition hover:bg-white/5"
                    >
                      <X className="size-3" aria-hidden />
                      Cancel
                    </button>
                  )}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Generation progress"
              >
                <div
                  className={`relative h-full rounded-full transition-[width] duration-500 ease-out ${
                    failed
                      ? "bg-red-500"
                      : completed
                        ? "bg-emerald-500"
                        : cancelled
                          ? "bg-zinc-600"
                          : "bg-gradient-to-r from-violet-500 to-indigo-400"
                  }`}
                  style={{ width: `${Math.max(progress, failed ? 100 : 2)}%` }}
                >
                  {job.status === "running" && (
                    <span className="absolute inset-0 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  )}
                </div>
              </div>
              {(hint || queued > 0) && (
                <p className={`mt-1.5 truncate text-xs ${submitError ? "text-red-300" : "text-zinc-500"}`}>
                  {hint ?? `${queued} in progress: new videos join the queue.`}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              {submitError ? (
                <span className="text-red-300">{submitError}</span>
              ) : (
                (blocker ?? (queued > 0 ? `${queued} in progress: new videos join the queue.` : "Ready when you are."))
              )}{" "}
              <span className="hidden text-zinc-600 md:inline">· Tip: Ctrl/⌘ + Enter in the script box generates.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function aheadOf(job: Job): number {
  return Math.max(0, (job.queue_position ?? 1) - 1);
}
