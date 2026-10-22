import { describe, expect, it } from "vitest";
import type { TranscriptWord } from "@/lib/types";
import { assColour, assTime, buildAss, groupCaptionLines, maxCharsFor } from "./captions";

const word = (text: string, start: number, end: number): TranscriptWord => ({
  text,
  start_us: Math.round(start * 1e6),
  end_us: Math.round(end * 1e6),
  probability: null,
});

describe("ASS helpers", () => {
  it("formats colours as &HAABBGGRR and times as H:MM:SS.cc", () => {
    expect(assColour("#FFD60A")).toBe("&H000AD6FF");
    expect(assColour("#000000", 0x80)).toBe("&H80000000");
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(61.237)).toBe("0:01:01.24");
    expect(assTime(3723.5)).toBe("1:02:03.50");
  });

  it("fits fewer characters on a portrait video", () => {
    expect(maxCharsFor({ width: 720, height: 1280 })).toBeLessThan(maxCharsFor({ width: 1280, height: 720 }));
  });
});

describe("groupCaptionLines", () => {
  const words = [
    word(" Hi", 0.5, 0.7),
    word(" everyone!", 0.75, 1.2),
    word(" Today", 1.3, 1.6),
    word(" I", 1.65, 1.7),
    word(" am", 1.75, 1.9),
    word(" building", 1.95, 2.4),
    word(" a", 2.45, 2.5),
    word(" rocket.", 2.55, 3.0),
    word(" Bye", 6.0, 6.3),
  ];

  it("breaks at sentence ends, long gaps and line length, and trims whitespace", () => {
    const lines = groupCaptionLines(words, { maxChars: 18 });
    expect(lines.map((line) => line.words.map((w) => w.text).join(" "))).toEqual([
      "Hi everyone!",
      "Today I am",
      "building a rocket.",
      "Bye",
    ]);
  });

  it("lingers after a line without overlapping the next one", () => {
    const lines = groupCaptionLines(words, { maxChars: 18 });
    for (let i = 0; i < lines.length - 1; i++) expect(lines[i].end).toBeLessThanOrEqual(lines[i + 1].start);
    expect(lines.at(-1)!.end).toBeCloseTo(6.9);
  });

  it("drops empty words", () => {
    expect(groupCaptionLines([word("  ", 0, 1)], { maxChars: 20 })).toEqual([]);
  });
});

describe("buildAss", () => {
  const lines = groupCaptionLines([word("Hi", 0.5, 0.8), word("there", 0.9, 1.3), word("{\\pos(0,0)}hax", 2.5, 3)], {
    maxChars: 20,
  });
  const ass = buildAss(lines, { width: 720, height: 1280, fontName: "Fredoka" });

  it("sizes the script to the video and uses the bundled font", () => {
    expect(ass).toContain("PlayResX: 720");
    expect(ass).toContain("PlayResY: 1280");
    expect(ass).toMatch(/^Style: Kid,Fredoka,68,/m);
  });

  it("emits one event per word, highlighting the word being spoken", () => {
    const dialogue = ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
    expect(dialogue).toHaveLength(3);
    expect(dialogue[0]).toBe(
      "Dialogue: 0,0:00:00.50,0:00:00.90,Kid,,0,0,0,,{\\fad(80,0)}{\\c&H000AD6FF&\\fscx114\\fscy114}Hi{\\c&H00FFFFFF&\\fscx100\\fscy100} there",
    );
    expect(dialogue[1]).toContain("Hi {\\c&H000AD6FF&");
    // The next line takes the next colour in the palette.
    expect(dialogue[2]).toContain("\\c&H00FFE62E&");
  });

  it("neutralises override tags hidden in transcript text", () => {
    expect(ass).not.toContain("\\pos(0,0)");
    expect(ass).toContain("pos(0,0)hax");
  });
});
