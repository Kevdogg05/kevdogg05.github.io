// Small HTTP toolkit shared by the route handlers (Next.js only; the worker
// never imports this).

import { unstable_rethrow } from "next/navigation";
import { ConfigError } from "@/server/config";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(NO_STORE)) if (!headers.has(key)) headers.set(key, value);
  return Response.json(body, { ...init, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status, headers: error.headers });
  }
  if (error instanceof ConfigError) {
    console.error(error.message);
    return json({ error: "StarReel is not configured yet. Check the server logs." }, { status: 500 });
  }
  console.error(error);
  return json({ error: "Something went wrong on the server." }, { status: 500 });
}

/** Wraps a route handler so thrown HttpErrors become JSON responses. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Next.js signals redirects and prerender bail-outs by throwing; let those through.
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

/**
 * CSRF guard for state-changing requests. Session cookies are SameSite=Lax,
 * and this rejects any cross-site Origin as a second line of defence.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Same-origin fetches from older browsers, and curl.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request blocked.");
  }
  if (!host || originHost !== host) throw new HttpError(403, "Cross-site request blocked.");
}

/** Best-effort client identifier for rate limiting (forgeable; see rate-limit.ts). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "Request body is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}
