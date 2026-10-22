import { formatDuration, formatSeconds } from "@/lib/format";
import type { VideoAnalysis } from "@/lib/types";

/** The raw upload as a bar: kept stretches in green, removed pauses striped red. */
export function CutTimeline({ analysis }: { analysis: VideoAnalysis }) {
  const total = analysis.raw_duration || 1;
  const pct = (seconds: number) => `${(seconds / total) * 100}%`;
  const summary = analysis.cuts.length
    ? `${analysis.cuts.length} pause${analysis.cuts.length === 1 ? "" : "s"} removed, ${formatSeconds(analysis.removed_duration)} in total`
    : "Nothing was cut";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>Cut map of the raw upload</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-400" aria-hidden /> kept
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rose-400" aria-hidden /> cut
          </span>
        </span>
      </div>
      <div className="relative h-7 overflow-hidden rounded-lg bg-emerald-400/85" role="img" aria-label={summary}>
        {analysis.cuts.map((cut) => (
          <div
            key={`${cut.start}-${cut.end}`}
            title={`Cut ${formatDuration(cut.start)}–${formatDuration(cut.end)} (${formatSeconds(cut.end - cut.start)})`}
            className="absolute inset-y-0 border-x border-rose-950/40 bg-rose-400 bg-[repeating-linear-gradient(-45deg,rgb(0_0_0/0.18)_0_5px,transparent_5px_10px)]"
            style={{ left: pct(cut.start), width: pct(cut.end - cut.start) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
        <span>0:00</span>
        <span>{summary}</span>
        <span>{formatDuration(analysis.raw_duration)}</span>
      </div>
    </div>
  );
}
