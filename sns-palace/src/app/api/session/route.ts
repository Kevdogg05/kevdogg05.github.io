// PIN unlock. POST checks a PIN and sets the session cookie(s); GET reports
// the current session; DELETE locks the parent room (or signs out entirely).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { SessionState } from "@/lib/types";
import { sessionRoles } from "@/server/auth/guard";
import { pinLimiter } from "@/server/auth/rate-limit";
import { createSessionToken, roleForPin, SESSION_COOKIES, sessionLifetime, type Role } from "@/server/auth/session";
import { getAuthConfig } from "@/server/config";
import { assertSameOrigin, clientKey, HttpError, json, readJson, route } from "@/server/http";

const unlockSchema = z.object({
  pin: z.string().regex(/^\d{1,12}$/),
  mode: z.enum(["family", "parent"]).default("family"),
});

function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (forwarded ?? request.nextUrl.protocol.replace(":", "")) === "https";
}

function setSession(response: NextResponse, request: NextRequest, role: Role) {
  const config = getAuthConfig();
  response.cookies.set(SESSION_COOKIES[role], createSessionToken(config, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: sessionLifetime(config, role),
  });
}

export const GET = route(async (request: NextRequest) => {
  const roles = sessionRoles(request);
  const state: SessionState = {
    family: roles.family,
    parent: roles.parent,
    parentExpiresAt: roles.parentExpiresAt ? new Date(roles.parentExpiresAt).toISOString() : null,
  };
  return json(state);
});

export const POST = route(async (request: NextRequest) => {
  assertSameOrigin(request);
  const config = getAuthConfig();
  const client = clientKey(request);

  const wait = pinLimiter.retryAfter(client);
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    throw new HttpError(429, `Too many tries. Wait ${seconds} seconds and try again.`, {
      "Retry-After": String(seconds),
    });
  }

  const parsed = unlockSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Type a PIN with numbers only.");
  const { pin, mode } = parsed.data;

  // Least privilege: the kids' PIN pad only ever grants family access, even
  // if a grown-up types the parent PIN into it.
  const role = roleForPin(config, pin);
  const granted: Role | null = mode === "parent" ? (role === "parent" ? "parent" : null) : role && "family";
  if (!granted) {
    pinLimiter.recordFailure(client);
    throw new HttpError(401, mode === "parent" ? "That isn't the grown-up PIN." : "Oops, that PIN didn't work.");
  }

  pinLimiter.recordSuccess(client);
  const response = NextResponse.json({ ok: true, role: granted }, { headers: { "Cache-Control": "private, no-store" } });
  setSession(response, request, "family");
  if (granted === "parent") setSession(response, request, "parent");
  return response;
});

export const DELETE = route(async (request: NextRequest) => {
  assertSameOrigin(request);
  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "parent";
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.delete(SESSION_COOKIES.parent);
  if (scope === "all") response.cookies.delete(SESSION_COOKIES.family);
  return response;
});
