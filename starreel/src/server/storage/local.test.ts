import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalMediaStorage } from "@/server/storage/local";

let root: string;
let storage: LocalMediaStorage;
const bytes = Buffer.from("0123456789abcdefghij");

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "starreel-storage-"));
  storage = new LocalMediaStorage(root);
});

afterEach(() => rm(root, { recursive: true, force: true }));

const options = { kind: "edited" as const, name: "clip-1", ext: "mp4", contentType: "video/mp4" };

describe("LocalMediaStorage", () => {
  it("streams uploads to disk and reports their size", async () => {
    const asset = await storage.putStream(Readable.from([bytes.subarray(0, 7), bytes.subarray(7)]), options);
    expect(asset).toEqual({ key: "edited/clip-1.mp4", url: "local:edited/clip-1.mp4", bytes: 20 });
    expect(await readFile(path.join(root, asset.key))).toEqual(bytes);
  });

  it("leaves no partial file behind when the source fails", async () => {
    const failing = new Readable({
      read() {
        this.destroy(new Error("client went away"));
      },
    });
    await expect(storage.putStream(failing, options)).rejects.toThrow("client went away");
    await expect(readFile(path.join(root, "edited/clip-1.mp4.part"))).rejects.toThrow();
  });

  it("serves whole files and byte ranges", async () => {
    const asset = await storage.putStream(Readable.from([bytes]), options);

    const whole = await storage.serve(asset.key, "edited", new Request("http://x/"));
    expect(whole.status).toBe(200);
    expect(whole.headers.get("content-type")).toBe("video/mp4");
    expect(whole.headers.get("accept-ranges")).toBe("bytes");
    expect(await whole.text()).toBe(bytes.toString());

    const part = await storage.serve(asset.key, "edited", new Request("http://x/", { headers: { range: "bytes=5-9" } }));
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 5-9/20");
    expect(part.headers.get("content-length")).toBe("5");
    expect(await part.text()).toBe("56789");

    const outside = await storage.serve(asset.key, "edited", new Request("http://x/", { headers: { range: "bytes=50-" } }));
    expect(outside.status).toBe(416);

    const cached = await storage.serve(
      asset.key,
      "edited",
      new Request("http://x/", { headers: { "if-none-match": whole.headers.get("etag")! } }),
    );
    expect(cached.status).toBe(304);
  });

  it("copies files in and out, and deletes idempotently", async () => {
    const source = path.join(root, "source.jpg");
    await writeFile(source, bytes);
    const asset = await storage.putFile(source, { kind: "thumbnail", name: "t", ext: "jpg", contentType: "image/jpeg" });
    const copy = path.join(root, "copy.jpg");
    await storage.download(asset.key, "thumbnail", copy);
    expect(await readFile(copy)).toEqual(bytes);

    await storage.delete(asset.key);
    await storage.delete(asset.key);
    expect((await storage.serve(asset.key, "thumbnail", new Request("http://x/"))).status).toBe(404);
  });

  it("rejects keys that could escape the media folder", async () => {
    await expect(storage.serve("../../etc/passwd", "raw", new Request("http://x/"))).rejects.toThrow(/Invalid storage key/);
    await expect(storage.download("raw/../../secret", "raw", "/tmp/x")).rejects.toThrow(/Invalid storage key/);
  });
});
