// Deciding what to cut. Pure and deterministic: the same silences and words
// always produce the same edit, which keeps it easy to test and to explain.
//
// A pause is cut when ffmpeg's silencedetect hears quiet for at least
// minSilence seconds *and* the transcript has no word in it, so a whispered
// word below the noise threshold is never chopped. Each cut keeps `padding`
// seconds of the pause on both sides so speech doesn't start or stop abruptly.

import type { TimeRange, TranscriptWord } from "@/lib/types";

export interface EditSettings {
  /** Pauses at least this long (seconds) are cut. */
  minSilence: number;
  /** Seconds of each pause kept next to the speech around it. */
  padding: number;
  /** Never cut within this many seconds of a recognised word. */
  wordGuard: number;
  /** If trimming would keep less than this share of the video, don't trim. */
  minKeepRatio: number;
  /** Kept slivers shorter than this (seconds) are folded into the cuts. */
  minSegment: number;
}

export const DEFAULT_EDIT_SETTINGS: EditSettings = {
  minSilence: 1.5,
  padding: 0.25,
  wordGuard: 0.1,
  minKeepRatio: 0.2,
  minSegment: 0.2,
};

export interface EditPlan {
  cuts: TimeRange[];
  kept: TimeRange[];
  keptDuration: number;
  /** Set when trimming was skipped on purpose. */
  skippedReason: string | null;
}

const EPSILON = 0.01;
const round = (seconds: number) => Math.round(seconds * 1000) / 1000;
const length = (ranges: TimeRange[]) => ranges.reduce((sum, range) => sum + (range.end - range.start), 0);

/** Reads silencedetect's log lines into ranges, closing a silence that runs to the end. */
export function parseSilenceDetect(log: string, duration: number): TimeRange[] {
  const silences: TimeRange[] = [];
  let openStart: number | null = null;
  for (const line of log.split("\n")) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) {
      openStart = Math.max(0, Number(start[1]));
      continue;
    }
    const end = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (end && openStart !== null) {
      silences.push({ start: openStart, end: Math.min(duration, Number(end[1])) });
      openStart = null;
    }
  }
  if (openStart !== null && openStart < duration) silences.push({ start: openStart, end: duration });
  return silences.filter((silence) => silence.end > silence.start);
}

/** Sorts ranges and merges any that overlap or touch. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end + EPSILON) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Removes every `holes` span from `ranges`. */
export function subtractRanges(ranges: TimeRange[], holes: TimeRange[]): TimeRange[] {
  const result: TimeRange[] = [];
  const sortedHoles = mergeRanges(holes);
  for (const range of mergeRanges(ranges)) {
    let cursor = range.start;
    for (const hole of sortedHoles) {
      if (hole.end <= cursor || hole.start >= range.end) continue;
      if (hole.start > cursor) result.push({ start: cursor, end: hole.start });
      cursor = Math.max(cursor, hole.end);
    }
    if (cursor < range.end) result.push({ start: cursor, end: range.end });
  }
  return result;
}

/** The parts of [0, duration] not covered by `cuts`. */
export function complement(cuts: TimeRange[], duration: number): TimeRange[] {
  return subtractRanges([{ start: 0, end: duration }], cuts);
}

export function planEdit(input: {
  duration: number;
  silences: TimeRange[];
  words: TranscriptWord[];
  settings?: Partial<EditSettings>;
}): EditPlan {
  const settings = { ...DEFAULT_EDIT_SETTINGS, ...input.settings };
  const { duration } = input;
  const untouched = (skippedReason: string | null): EditPlan => ({
    cuts: [],
    kept: [{ start: 0, end: round(duration) }],
    keptDuration: round(duration),
    skippedReason,
  });

  const speech = input.words.map((word) => ({
    start: word.start_us / 1e6 - settings.wordGuard,
    end: word.end_us / 1e6 + settings.wordGuard,
  }));
  const pauses = subtractRanges(input.silences, speech).filter(
    (pause) => pause.end - pause.start >= settings.minSilence - EPSILON,
  );

  let cuts = mergeRanges(
    pauses
      .map((pause) => ({
        // A pause at the very start or end is removed entirely on that side.
        start: pause.start <= EPSILON ? 0 : pause.start + settings.padding,
        end: pause.end >= duration - EPSILON ? duration : pause.end - settings.padding,
      }))
      .filter((cut) => cut.end - cut.start > 0.05),
  );

  // Fold slivers of kept noise between two cuts into the cuts.
  let kept = complement(cuts, duration);
  if (kept.length > 1) {
    const slivers = kept.filter((piece) => piece.end - piece.start < settings.minSegment);
    if (slivers.length && slivers.length < kept.length) {
      cuts = mergeRanges([...cuts, ...slivers]);
      kept = complement(cuts, duration);
    }
  }

  if (!cuts.length) return untouched(null);
  const keptDuration = length(kept);
  if (keptDuration < Math.max(1, duration * settings.minKeepRatio)) {
    return untouched("Mostly quiet video, so it was kept at full length instead of trimmed.");
  }

  const roundRange = (range: TimeRange) => ({ start: round(range.start), end: round(range.end) });
  return {
    cuts: cuts.map(roundRange),
    kept: kept.map(roundRange),
    keptDuration: round(keptDuration),
    skippedReason: null,
  };
}

/** Maps a time on the raw video onto the edited one; null if it was cut. */
export function remapTime(seconds: number, kept: TimeRange[]): number | null {
  let offset = 0;
  for (const piece of kept) {
    if (seconds < piece.start - EPSILON) return null;
    if (seconds <= piece.end + EPSILON) return offset + Math.min(Math.max(seconds - piece.start, 0), piece.end - piece.start);
    offset += piece.end - piece.start;
  }
  return null;
}

/** Re-times words onto the edited video, dropping any whose middle was cut. */
export function remapWords(words: TranscriptWord[], kept: TimeRange[]): TranscriptWord[] {
  const result: TranscriptWord[] = [];
  let offset = 0;
  let index = 0;
  const pieces = kept.map((piece) => {
    const mapped = { ...piece, offset };
    offset += piece.end - piece.start;
    return mapped;
  });
  for (const word of [...words].sort((a, b) => a.start_us - b.start_us)) {
    const start = word.start_us / 1e6;
    const end = word.end_us / 1e6;
    const middle = (start + end) / 2;
    while (index < pieces.length && pieces[index].end < middle) index += 1;
    const piece = pieces[index];
    if (!piece || middle < piece.start) continue;
    const clamp = (t: number) => piece.offset + Math.min(Math.max(t, piece.start), piece.end) - piece.start;
    result.push({ ...word, start_us: Math.round(clamp(start) * 1e6), end_us: Math.round(clamp(end) * 1e6) });
  }
  return result;
}
