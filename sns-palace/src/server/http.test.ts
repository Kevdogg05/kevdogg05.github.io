import { describe, expect, it } from "vitest";
import { assertSameOrigin, HttpError } from "@/server/http";
import { parseRange } from "@/server/range";

describe("parseRange", () => {
  it("parses open, closed and suffix ranges", () => {
    expect(parseRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });

  it("ignores missing or unsupported headers", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("bytes=0-1,5-9", 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
    expect(parseRange("bytes=-", 1000)).toBeNull();
  });

  it("flags ranges outside the file", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=500-400", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
  });
});

describe("assertSameOrigin", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/videos/x", { method: "PATCH", headers });

  it("allows same-origin and Origin-less requests", () => {
    expect(() => assertSameOrigin(request({ host: "localhost:3000", origin: "http://localhost:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(request({ host: "localhost:3000" }))).not.toThrow();
  });

  it("blocks cross-site requests", () => {
    expect(() => assertSameOrigin(request({ host: "localhost:3000", origin: "https://evil.example" }))).toThrow(HttpError);
    expect(() => assertSameOrigin(request({ host: "localhost:3000", origin: "null" }))).toThrow(HttpError);
  });
});
