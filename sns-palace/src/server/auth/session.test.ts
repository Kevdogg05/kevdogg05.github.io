import { describe, expect, it } from "vitest";
import type { AuthConfig } from "@/server/config";
import {
  createSessionToken,
  roleForPin,
  rolesFromCookies,
  SESSION_COOKIES,
  verifySessionToken,
} from "@/server/auth/session";

const config: AuthConfig = {
  familyPin: "1234",
  parentPin: "987654",
  sessionSecret: "x".repeat(48),
  familySessionSeconds: 30 * 86_400,
  parentSessionSeconds: 30 * 60,
};

const NOW = Date.UTC(2026, 9, 22, 12);

describe("session tokens", () => {
  it("round-trips and reports the expiry", () => {
    const token = createSessionToken(config, "parent", NOW);
    expect(verifySessionToken(config, "parent", token, NOW)).toBe(NOW + 30 * 60 * 1000);
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken(config, "parent", NOW);
    expect(verifySessionToken(config, "parent", token, NOW + 31 * 60 * 1000)).toBeNull();
  });

  it("does not let a family token act as a parent token", () => {
    const token = createSessionToken(config, "family", NOW);
    expect(verifySessionToken(config, "parent", token, NOW)).toBeNull();
    const relabelled = token.replace(".family.", ".parent.");
    expect(verifySessionToken(config, "parent", relabelled, NOW)).toBeNull();
  });

  it("rejects tampered expiry, signatures and garbage", () => {
    const token = createSessionToken(config, "family", NOW);
    const [version, role, expires, signature] = token.split(".");
    expect(verifySessionToken(config, "family", [version, role, Number(expires) + 1, signature].join("."), NOW)).toBeNull();
    expect(verifySessionToken(config, "family", `${token.slice(0, -2)}AA`, NOW)).toBeNull();
    expect(verifySessionToken(config, "family", "nonsense", NOW)).toBeNull();
    expect(verifySessionToken(config, "family", undefined, NOW)).toBeNull();
  });

  it("signs everyone out when a PIN or the secret changes", () => {
    const family = createSessionToken(config, "family", NOW);
    expect(verifySessionToken({ ...config, familyPin: "4321" }, "family", family, NOW)).toBeNull();
    expect(verifySessionToken({ ...config, sessionSecret: "y".repeat(48) }, "family", family, NOW)).toBeNull();
    // Changing the parent PIN leaves kids signed in.
    expect(verifySessionToken({ ...config, parentPin: "111111" }, "family", family, NOW)).not.toBeNull();
  });
});

describe("roleForPin", () => {
  it("maps each PIN to its role", () => {
    expect(roleForPin(config, "1234")).toBe("family");
    expect(roleForPin(config, "987654")).toBe("parent");
    expect(roleForPin(config, "0000")).toBeNull();
    expect(roleForPin(config, "")).toBeNull();
  });
});

describe("rolesFromCookies", () => {
  it("treats a parent session as a family session too", () => {
    const cookies: Record<string, string> = {
      [SESSION_COOKIES.parent]: createSessionToken(config, "parent", NOW),
    };
    expect(rolesFromCookies(config, (name) => cookies[name], NOW)).toEqual({
      family: true,
      parent: true,
      parentExpiresAt: NOW + 30 * 60 * 1000,
    });
  });

  it("grants nothing without cookies", () => {
    expect(rolesFromCookies(config, () => undefined, NOW)).toEqual({
      family: false,
      parent: false,
      parentExpiresAt: null,
    });
  });
});
