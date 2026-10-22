import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const root = path.resolve(__dirname, "../..");

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): string {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("web app manifest", () => {
  const app = manifest();

  it("opens as a standalone app from the home screen", () => {
    expect(app).toMatchObject({ name: "SnS Palace", short_name: "SnS Palace", start_url: "/", display: "standalone" });
  });

  it("lists icons that exist at the sizes it claims, in both purposes", () => {
    for (const icon of app.icons ?? []) {
      expect(pngSize(path.join(root, "public", icon.src)), icon.src).toBe(icon.sizes);
    }
    const purposes = new Set((app.icons ?? []).map((icon) => icon.purpose));
    expect(purposes).toEqual(new Set(["any", "maskable"]));
    // Chrome needs at least a 192 px and a 512 px icon to offer installation.
    expect((app.icons ?? []).map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("has an Apple home-screen icon of the size iOS uses", () => {
    expect(pngSize(path.join(root, "src/app/apple-icon.png"))).toBe("180x180");
  });
});
