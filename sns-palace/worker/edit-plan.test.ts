import { describe, expect, it } from "vitest";
import type { TranscriptWord } from "@/lib/types";
import { complement, mergeRanges, parseSilenceDetect, planEdit, remapTime, remapWords, subtractRanges } from "./edit-plan";

const word = (text: string, start: number, end: number): TranscriptWord => ({
  text,
  start_us: Math.round(start * 1e6),
  end_us: Math.round(end * 1e6),
  probability: 0.9,
});

describe("parseSilenceDetect", () => {
  it("pairs starts with ends and closes a silence that runs to the end", () => {
    const log = [
      "[silencedetect @ 0x1] silence_start: -0.00133",
      "[silencedetect @ 0x1] silence_end: 2.50006 | silence_duration: 2.50139",
      "frame=  100 fps=0.0 q=-0.0 size=N/A",
      "[silencedetect @ 0x1] silence_start: 5.5",
      "[silencedetect @ 0x1] silence_end: 8.5 | silence_duration: 3",
      "[silencedetect @ 0x1] silence_start: 20",
    ].join("\n");
    expect(parseSilenceDetect(log, 22)).toEqual([
      { start: 0, end: 2.50006 },
      { start: 5.5, end: 8.5 },
      { start: 20, end: 22 },
    ]);
  });
});

describe("range helpers", () => {
  it("merges, subtracts and complements", () => {
    expect(mergeRanges([{ start: 5, end: 6 }, { start: 0, end: 2 }, { start: 1, end: 3 }])).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 6 },
    ]);
    expect(subtractRanges([{ start: 0, end: 10 }], [{ start: 2, end: 3 }, { start: 8, end: 12 }])).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 8 },
    ]);
    expect(complement([{ start: 0, end: 1 }, { start: 4, end: 5 }], 6)).toEqual([
      { start: 1, end: 4 },
      { start: 5, end: 6 },
    ]);
  });
});

describe("planEdit", () => {
  // 22 s clip: quiet 0-2.5, talk, quiet 5.5-8.5, talk, quiet 13.5-16, talk, quiet 20-22.
  const silences = [
    { start: 0, end: 2.5 },
    { start: 5.5, end: 8.5 },
    { start: 13.5, end: 16 },
    { start: 20, end: 22 },
  ];

  it("cuts long pauses, keeping padding next to speech and none at the edges", () => {
    const plan = planEdit({ duration: 22, silences, words: [] });
    expect(plan.cuts).toEqual([
      { start: 0, end: 2.25 },
      { start: 5.75, end: 8.25 },
      { start: 13.75, end: 15.75 },
      { start: 20.25, end: 22 },
    ]);
    expect(plan.kept).toEqual([
      { start: 2.25, end: 5.75 },
      { start: 8.25, end: 13.75 },
      { start: 15.75, end: 20.25 },
    ]);
    expect(plan.keptDuration).toBe(13.5);
    expect(plan.skippedReason).toBeNull();
  });

  it("leaves pauses shorter than the minimum alone", () => {
    const plan = planEdit({ duration: 10, silences: [{ start: 4, end: 5.4 }], words: [] });
    expect(plan.cuts).toEqual([]);
    expect(plan.kept).toEqual([{ start: 0, end: 10 }]);
  });

  it("never cuts through a word the transcript heard inside a 'silence'", () => {
    // A whispered word at 6.9-7.2 splits the 3 s pause into two 1.3 s halves,
    // both now shorter than 1.5 s, so nothing is cut there.
    const plan = planEdit({ duration: 22, silences, words: [word("psst", 6.9, 7.2)] });
    expect(plan.cuts.some((cut) => cut.start < 7.2 && cut.end > 6.9)).toBe(false);
    expect(plan.cuts).toHaveLength(3);
  });

  it("still cuts the long side of a pause that contains a word", () => {
    const plan = planEdit({ duration: 20, silences: [{ start: 2, end: 9 }], words: [word("um", 2.5, 2.8)] });
    // Quiet after the word: 2.9-9 → cut 3.15-8.75.
    expect(plan.cuts).toEqual([{ start: 3.15, end: 8.75 }]);
  });

  it("does not trim a mostly quiet video down to nothing", () => {
    const plan = planEdit({ duration: 30, silences: [{ start: 0, end: 29.5 }], words: [] });
    expect(plan.cuts).toEqual([]);
    expect(plan.skippedReason).toMatch(/Mostly quiet/);
  });

  it("is deterministic", () => {
    const words = [word("hi", 2.6, 3), word("there", 3.1, 3.5)];
    expect(planEdit({ duration: 22, silences, words })).toEqual(planEdit({ duration: 22, silences, words }));
  });
});

describe("remapping onto the edited timeline", () => {
  const kept = [
    { start: 2, end: 5 },
    { start: 8, end: 10 },
  ];

  it("shifts times past each cut", () => {
    expect(remapTime(2, kept)).toBe(0);
    expect(remapTime(4.5, kept)).toBe(2.5);
    expect(remapTime(9, kept)).toBe(4);
    expect(remapTime(6, kept)).toBeNull();
    expect(remapTime(1, kept)).toBeNull();
  });

  it("re-times words and drops the ones that were cut", () => {
    const words = [word("a", 2.5, 3), word("gone", 6, 6.5), word("b", 8.2, 8.6), word("edge", 4.9, 5.2)];
    expect(remapWords(words, kept)).toEqual([
      { ...words[0], start_us: 500_000, end_us: 1_000_000 },
      // Straddles the cut at 5 s: the middle (5.05) falls in the cut, so it is dropped...
      { ...words[2], start_us: 3_200_000, end_us: 3_600_000 },
    ]);
    // ...but one whose middle is kept is clamped to the piece it belongs to.
    expect(remapWords([word("edge", 4.8, 5.1)], kept)).toEqual([
      { ...word("edge", 4.8, 5.1), start_us: 2_800_000, end_us: 3_000_000 },
    ]);
  });
});
