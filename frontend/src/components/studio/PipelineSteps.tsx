import { AudioLines, Check, FileText, Film, LoaderCircle, ScanFace, X, type LucideIcon } from "lucide-react";
import type { Job, JobStage } from "@/lib/api";

const STEPS: { stage: JobStage; label: string; icon: LucideIcon }[] = [
  { stage: "script", label: "Script", icon: FileText },
  { stage: "audio", label: "Voice", icon: AudioLines },
  { stage: "lipsync", label: "Lip-sync", icon: ScanFace },
  { stage: "encode", label: "Video file", icon: Film },
];

const ORDER: JobStage[] = ["queued", "script", "audio", "lipsync", "encode", "done"];

type StepState = "pending" | "active" | "done" | "failed";

function stepState(step: JobStage, job: Job | null): StepState {
  if (!job) return "pending";
  const current = ORDER.indexOf(job.stage);
  const index = ORDER.indexOf(step);
  if (index < current || job.stage === "done") return "done";
  if (index > current) return "pending";
  return job.status === "failed" ? "failed" : "active";
}

const STYLES: Record<StepState, string> = {
  pending: "border-white/[0.06] text-zinc-500",
  active: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  done: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200",
  failed: "border-red-500/40 bg-red-500/10 text-red-200",
};

export function PipelineSteps({ job }: { job: Job | null }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Generation pipeline">
      {STEPS.map(({ stage, label, icon: Icon }, i) => {
        const state = stepState(stage, job);
        return (
          <li
            key={stage}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${STYLES[state]}`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.04]">
              {state === "active" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : state === "done" ? (
                <Check className="size-4" aria-hidden />
              ) : state === "failed" ? (
                <X className="size-4" aria-hidden />
              ) : (
                <Icon className="size-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-zinc-500">Step {i + 1}</span>
              <span className="block truncate font-medium">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
