// HTTP byte ranges, for seeking in videos. Pure; shared by the web app and worker.

export interface ByteRange {
  start: number;
  end: number; // inclusive
}

/**
 * Parses a single-range "Range: bytes=..." header against a file size.
 * Returns null for a missing or unsupported header (serve the whole file),
 * or "unsatisfiable" when the range lies outside the file (respond 416).
 */
export function parseRange(header: string | null, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;

  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
