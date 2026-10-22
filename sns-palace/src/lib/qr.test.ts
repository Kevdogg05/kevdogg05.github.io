import { encode } from "uqr";
import { describe, expect, it } from "vitest";
import { qrShape } from "@/lib/qr";

/** Paints a path of "M x y h n v1 h-n z" rectangles back onto a grid. */
function paint(path: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(run); i++) grid[Number(y)][Number(x) + i] = true;
  }
  return grid;
}

describe("qrShape", () => {
  const url = "https://kevdogg05.github.io/sns-palace/";

  it("draws exactly the dark modules of the code, quiet zone included", () => {
    const { size, path } = qrShape(url);
    const expected = encode(url, { ecc: "M", border: 4 });
    expect(size).toBe(expected.size);
    expect(size).toBe(29 + 8);
    expect(paint(path, size)).toEqual(expected.data);
  });

  it("merges horizontal runs into one rectangle each", () => {
    const { path } = qrShape(url);
    const rectangles = path.match(/M/g)!.length;
    const darkModules = encode(url, { ecc: "M", border: 4 }).data.flat().filter(Boolean).length;
    expect(rectangles).toBeLessThan(darkModules);
  });

  it("works for a household address on the local network", () => {
    const { size, path } = qrShape("http://192.168.1.20:3000/");
    expect(paint(path, size)).toEqual(encode("http://192.168.1.20:3000/", { ecc: "M", border: 4 }).data);
  });
});
