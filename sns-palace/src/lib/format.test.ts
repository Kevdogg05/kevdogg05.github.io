import { describe, expect, it } from "vitest";
import { formatWait } from "@/lib/format";

describe("formatWait", () => {
  it("counts seconds, then minutes, then hours", () => {
    expect(formatWait(45)).toBe("45 seconds");
    expect(formatWait(119)).toBe("119 seconds");
    expect(formatWait(900)).toBe("15 minutes");
    expect(formatWait(61 * 60)).toBe("61 minutes");
    expect(formatWait(5 * 3600 - 30)).toBe("5 hours");
    expect(formatWait(24 * 3600)).toBe("24 hours");
  });
});
