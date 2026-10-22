import { Check, LoaderCircle } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStage, type ReviewVideo } from "@/lib/types";

const LABELS: Record<PipelineStage, string> = {
  probe: "Read",
  preview: "Preview",
  transcribe: "Listen",
  silence: "Find pauses",
  render: "Edit + captions",
  publish: "Save",
};

const STUCK_AFTER_MS = 60_000;

/** Step-by-step progress of the editing worker for one video. */
export function PipelineProgress({ pipeline, updatedAt, now }: { pipeline: ReviewVideo["pipeline"]; updatedAt: string; now: number }) {
  const current = pipeline.status === "queued" ? -1 : PIPELINE_STAGES.indexOf(pipeline.stage ?? "probe");
  const waitingLong = pipeline.status === "queued" && now - new Date(updatedAt).getTime() > STUCK_AFTER_MS;

  return (
    <div className="rounded-2xl bg-sky-500/10 p-4 ring-1 ring-sky-400/20" aria-live="polite">
      <p className="mb-3 text-sm font-semibold text-sky-200">
        {pipeline.status === "queued"
          ? pipeline.error
            ? "Trying again shortly…"
            : "Waiting for the editing worker…"
          : `Editing: ${LABELS[pipeline.stage ?? "probe"].toLowerCase()}…`}
      </p>
      <ol className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((stage, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={stage}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                done ? "bg-emerald-500/20 text-emerald-300" : active ? "bg-sky-400 text-slate-950" : "bg-white/5 text-slate-500"
              }`}
            >
              {done ? <Check aria-hidden className="size-3.5" /> : active ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : null}
              {LABELS[stage]}
            </li>
          );
        })}
      </ol>
      {pipeline.error && pipeline.status === "queued" ? <p className="mt-3 text-xs text-amber-300">{pipeline.error}</p> : null}
      {waitingLong ? (
        <p className="mt-3 text-xs text-slate-400">
          Still waiting? Make sure the worker is running: <code className="rounded bg-white/10 px-1.5 py-0.5">npm run worker</code>
        </p>
      ) : null}
    </div>
  );
}
