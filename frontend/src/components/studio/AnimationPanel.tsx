import { Clapperboard } from "lucide-react";
import { Panel } from "./Panel";
import type { CostEstimate, EngineInfo, EnhancerInfo, Health } from "@/lib/api";
import { formatEstimate } from "@/lib/format";

interface AnimationPanelProps {
  health: Health | null;
  engineId: string;
  onEngineChange: (engineId: string) => void;
  headMotion: boolean;
  onHeadMotionChange: (on: boolean) => void;
  enhance: boolean;
  onEnhanceChange: (on: boolean) => void;
  /** Expected length of the video, for render-time estimates (0 = unknown). */
  videoSeconds: number;
  disabled?: boolean;
}

export function AnimationPanel({
  health,
  engineId,
  onEngineChange,
  headMotion,
  onHeadMotionChange,
  enhance,
  onEnhanceChange,
  videoSeconds,
  disabled,
}: AnimationPanelProps) {
  if (!health) {
    return (
      <Panel icon={Clapperboard} title="Animation">
        <p className="text-xs text-zinc-500">Waiting for the backend…</p>
      </Panel>
    );
  }

  const engine = health.engines.find((e) => e.name === engineId);
  const estimate = (cost: CostEstimate | null) =>
    cost && videoSeconds > 0 ? formatEstimate(cost, videoSeconds) : null;
  const total = totalEstimate(engine, health.enhancer, enhance, videoSeconds);

  return (
    <Panel
      icon={Clapperboard}
      title="Animation"
      aside={
        health.device !== "unknown" && (
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
            {health.device === "cuda" ? "GPU" : "CPU"}
          </span>
        )
      }
    >
      <div role="radiogroup" aria-label="Animation engine" className="flex flex-col gap-2">
        {health.engines.map((option) => {
          const selected = option.name === engineId;
          const unavailable = !option.ready;
          return (
            <button
              key={option.name}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled || unavailable}
              onClick={() => onEngineChange(option.name)}
              title={unavailable ? option.detail : undefined}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${
                selected
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-white/[0.08] bg-zinc-950/40 enabled:hover:border-white/20"
              } ${unavailable ? "opacity-50" : ""}`}
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                  selected ? "border-violet-400" : "border-zinc-600"
                }`}
              >
                {selected && <span className="size-2 rounded-full bg-violet-400" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">{option.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {unavailable ? "Not installed" : estimate(option.cpu_estimate)}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                  {unavailable ? option.detail : option.summary}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-1 border-t border-white/[0.06] pt-3">
        <Toggle
          label="Head motion"
          hint={
            engine?.supports_head_motion
              ? "Natural head movement while speaking"
              : `Not available with ${engine?.label ?? "this engine"}`
          }
          checked={headMotion && Boolean(engine?.supports_head_motion)}
          onChange={onHeadMotionChange}
          disabled={disabled || !engine?.supports_head_motion}
        />
        <Toggle
          label="Enhance face"
          hint={
            health.enhancer.ready
              ? `Sharpens eyes, teeth and lips with GFPGAN${
                  estimate(health.enhancer.cpu_estimate) ? ` (${estimate(health.enhancer.cpu_estimate)} more)` : ""
                }`
              : health.enhancer.detail
          }
          checked={enhance && health.enhancer.ready}
          onChange={onEnhanceChange}
          disabled={disabled || !health.enhancer.ready}
        />
      </div>

      {total && (
        <p className="mt-2 text-xs text-zinc-500">
          Estimated render time on this CPU: <span className="font-medium text-zinc-300">{total}</span>
        </p>
      )}
    </Panel>
  );
}

function totalEstimate(
  engine: EngineInfo | undefined,
  enhancer: EnhancerInfo,
  enhance: boolean,
  videoSeconds: number,
): string | null {
  if (!engine?.cpu_estimate || videoSeconds <= 0) return null;
  const parts = [engine.cpu_estimate, ...(enhance && enhancer.cpu_estimate ? [enhancer.cpu_estimate] : [])];
  const combined = parts.reduce((sum, cost) => ({
    fixed_seconds: sum.fixed_seconds + cost.fixed_seconds,
    seconds_per_second: sum.seconds_per_second + cost.seconds_per_second,
  }));
  return formatEstimate(combined, videoSeconds);
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-violet-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-zinc-200">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </button>
  );
}
