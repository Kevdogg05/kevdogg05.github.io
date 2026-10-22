import { NextRequest } from "next/server";
// The docs call this unstable_doesProxyMatch; Next 16.4 still exports the old name.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIES } from "@/server/auth/session";
import type { AuthConfig } from "@/server/config";
import { config, proxy } from "@/proxy";

const auth: AuthConfig = {
  familyPin: "1234",
  parentPin: "987654",
  sessionSecret: "s".repeat(40),
  familySessionSeconds: 86_400,
  parentSessionSeconds: 1_800,
};

beforeAll(() => {
  process.env.FAMILY_PIN = auth.familyPin;
  process.env.PARENT_PIN = auth.parentPin;
  process.env.SESSION_SECRET = auth.sessionSecret;
});

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

function request(path: string, cookies: Partial<Record<"family" | "parent", string>> = {}) {
  const cookie = Object.entries(cookies)
    .map(([role, token]) => `${SESSION_COOKIES[role as "family" | "parent"]}=${token}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
}

describe("proxy matcher", () => {
  it("guards pages and API routes", () => {
    for (const url of ["/", "/parent", "/unlock", "/api/videos", "/api/videos/abc", "/api/media/x/edited", "/api/session"]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it("skips build assets and the self-authenticating upload route", () => {
    for (const url of ["/_next/static/chunks/app.js", "/favicon.ico", "/icon.svg", "/robots.txt", "/api/upload"]) {
      expect(matches(url), url).toBe(false);
    }
    // Only the exact upload route is excluded.
    expect(matches("/api/uploads")).toBe(true);
  });
});

describe("proxy", () => {
  it("sends strangers to the PIN pad, remembering where they were going", () => {
    const response = proxy(request("/?tab=new"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/unlock");
    expect(location.searchParams.get("next")).toBe("/?tab=new");
  });

  it("answers API calls without a session with 401 JSON", async () => {
    const response = proxy(request("/api/videos"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Enter the family PIN first." });
  });

  it("lets family through, but not into the parent room", () => {
    const family = createSessionToken(auth, "family");
    expect(proxy(request("/", { family })).headers.get("x-middleware-next")).toBe("1");

    const parentPage = proxy(request("/parent", { family }));
    const location = new URL(parentPage.headers.get("location")!);
    expect(location.searchParams.get("mode")).toBe("parent");
    // Parent-only API actions are enforced by each route handler (requireRole).
    expect(proxy(request("/api/videos?scope=all", { family })).headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a parent session into everything", () => {
    const parent = createSessionToken(auth, "parent");
    expect(proxy(request("/parent", { parent })).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/", { parent })).headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects forged cookies", () => {
    expect(proxy(request("/", { family: "v1.family.9999999999.forged" })).status).toBe(307);
  });
});
