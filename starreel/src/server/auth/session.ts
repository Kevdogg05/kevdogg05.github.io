// Signed session cookies for the two household roles.
//
// A token is "v1.<role>.<expires>.<signature>", signed with HMAC-SHA256. The
// signing key is derived from SESSION_SECRET *and* the role's PIN, so changing
// a PIN (or the secret) instantly signs out every device holding that role.
// Pure functions with no Next.js imports: used by the proxy, route handlers
// and tests alike.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthConfig } from "@/server/config";

export type Role = "family" | "parent";

export const SESSION_COOKIES: Record<Role, string> = {
  family: "starreel_family",
  parent: "starreel_parent",
};

const VERSION = "v1";

function signingKey(config: AuthConfig, role: Role): Buffer {
  const pin = role === "parent" ? config.parentPin : config.familyPin;
  return createHmac("sha256", config.sessionSecret).update(`starreel:${role}:${pin}`).digest();
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function sessionLifetime(config: AuthConfig, role: Role): number {
  return role === "parent" ? config.parentSessionSeconds : config.familySessionSeconds;
}

export function createSessionToken(config: AuthConfig, role: Role, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + sessionLifetime(config, role);
  const payload = `${VERSION}.${role}.${expires}`;
  return `${payload}.${sign(signingKey(config, role), payload)}`;
}

/** Returns the expiry (ms since epoch) of a valid token for `role`, else null. */
export function verifySessionToken(
  config: AuthConfig,
  role: Role,
  token: string | undefined,
  now = Date.now(),
): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, tokenRole, expiresText, signature] = parts;
  if (version !== VERSION || tokenRole !== role || !/^\d{1,12}$/.test(expiresText)) return null;

  const expected = Buffer.from(sign(signingKey(config, role), `${version}.${tokenRole}.${expiresText}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const expiresAt = Number(expiresText) * 1000;
  return expiresAt > now ? expiresAt : null;
}

/** Constant-time PIN check: which role, if any, does this PIN unlock? */
export function roleForPin(config: AuthConfig, pin: string): Role | null {
  const matches = (expected: string) => {
    // Compare digests so timing does not depend on where the strings differ.
    const a = createHmac("sha256", config.sessionSecret).update(pin).digest();
    const b = createHmac("sha256", config.sessionSecret).update(expected).digest();
    return timingSafeEqual(a, b);
  };
  // Evaluate both, so a parent PIN takes as long to check as a family one.
  const parent = matches(config.parentPin);
  const family = matches(config.familyPin);
  return parent ? "parent" : family ? "family" : null;
}

/** Roles the request's cookies grant. A parent session also counts as family. */
export function rolesFromCookies(
  config: AuthConfig,
  readCookie: (name: string) => string | undefined,
  now = Date.now(),
): { family: boolean; parent: boolean; parentExpiresAt: number | null } {
  const parentExpiresAt = verifySessionToken(config, "parent", readCookie(SESSION_COOKIES.parent), now);
  const family = verifySessionToken(config, "family", readCookie(SESSION_COOKIES.family), now) !== null;
  return { family: family || parentExpiresAt !== null, parent: parentExpiresAt !== null, parentExpiresAt };
}
