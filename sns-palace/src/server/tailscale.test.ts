import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { interpretStatus, readStatus } from "@/server/tailscale";

describe("interpretStatus", () => {
  const running = {
    BackendState: "Running",
    Self: { DNSName: "sns-palace.tail1234.ts.net." },
    CertDomains: ["sns-palace.tail1234.ts.net"],
  };

  it("gives the https address once Tailscale is signed in with HTTPS on", () => {
    expect(interpretStatus(running)).toEqual({ state: "ready", url: "https://sns-palace.tail1234.ts.net/" });
  });

  it("says when HTTPS certificates are turned off for the tailnet", () => {
    expect(interpretStatus({ ...running, CertDomains: null })).toEqual({
      state: "https-off",
      name: "sns-palace.tail1234.ts.net",
    });
  });

  it("passes on the sign-in link while Tailscale waits for a login", () => {
    // As tailscaled reports it before anyone signs in (copied from a real container).
    const waiting = { BackendState: "NeedsLogin", AuthURL: "", Self: { DNSName: "" }, CertDomains: null };
    expect(interpretStatus(waiting)).toEqual({ state: "not-connected", loginUrl: null });
    expect(interpretStatus({ ...waiting, AuthURL: "https://login.tailscale.com/a/abc123" })).toEqual({
      state: "not-connected",
      loginUrl: "https://login.tailscale.com/a/abc123",
    });
    expect(interpretStatus({ BackendState: "Starting" })).toMatchObject({ state: "not-connected" });
  });

  it("is off when there is nothing to ask", () => {
    expect(interpretStatus(null)).toEqual({ state: "off" });
  });
});

describe("readStatus", () => {
  const cleanup: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const step of cleanup.splice(0).reverse()) await step();
  });

  async function fakeTailscaled(handler: Parameters<typeof createServer>[1]): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "sns-palace-ts-"));
    cleanup.push(() => rm(dir, { recursive: true, force: true }));
    const socket = path.join(dir, "tailscaled.sock");
    const server: Server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(socket, resolve));
    cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    return socket;
  }

  it("reads the status JSON from the LocalAPI socket", async () => {
    const socket = await fakeTailscaled((req, res) => {
      expect(req.url).toBe("/localapi/v0/status");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ BackendState: "Running", Self: { DNSName: "a.b.ts.net." } }));
    });
    expect(await readStatus(socket)).toEqual({ BackendState: "Running", Self: { DNSName: "a.b.ts.net." } });
  });

  it("returns null for errors, bad JSON, a missing socket and a hung server", async () => {
    const failing = await fakeTailscaled((_req, res) => {
      res.statusCode = 403;
      res.end("denied");
    });
    expect(await readStatus(failing)).toBeNull();

    const garbled = await fakeTailscaled((_req, res) => res.end("{not json"));
    expect(await readStatus(garbled)).toBeNull();

    expect(await readStatus(path.join(tmpdir(), "no-such-tailscaled.sock"))).toBeNull();

    const hung = await fakeTailscaled(() => {});
    expect(await readStatus(hung, 100)).toBeNull();
  });
});
