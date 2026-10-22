const WORDS_PER_SECOND = 2.5;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Rough spoken length of a script at a typical narration pace. */
export function estimateSpeechSeconds(text: string): number {
  return Math.round(countWords(text) / WORDS_PER_SECOND);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Rough render time for `videoSeconds` of output, e.g. "~25 s" or "~1 h 5 min". */
export function formatEstimate(
  cost: { fixed_seconds: number; seconds_per_second: number },
  videoSeconds: number,
): string {
  const total = cost.fixed_seconds + cost.seconds_per_second * videoSeconds;
  if (total < 60) return `~${Math.max(5, Math.round(total / 5) * 5)} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
