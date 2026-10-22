// The household gate. Every page and API route sits behind the family PIN;
// /parent also needs the parent PIN. Route handlers re-check the session
// themselves, so this is the first lock, not the only one.

import { NextResponse, type NextRequest } from "next/server";
import { rolesFromCookies } from "@/server/auth/session";
import { ConfigError, getAuthConfig } from "@/server/config";

const PUBLIC_PATHS = new Set(["/unlock", "/api/session"]);

const NOT_CONFIGURED = `<!doctype html><meta charset="utf-8"><title>SnS Palace setup</title>
<body style="font:18px/1.5 system-ui;max-width:36rem;margin:15vh auto;padding:0 1rem">
<h1>SnS Palace isn't set up yet</h1>
<p>Set <code>FAMILY_PIN</code>, <code>PARENT_PIN</code> and <code>SESSION_SECRET</code> in
<code>.env.local</code> (see <code>.env.local.example</code>), then restart the server.
The server log lists exactly what is missing.</p></body>`;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  let roles;
  try {
    roles = rolesFromCookies(getAuthConfig(), (name) => request.cookies.get(name)?.value);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(error.message);
    // Fail closed: nothing is served until the household has PINs.
    return new NextResponse(NOT_CONFIGURED, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const needsParent = pathname === "/parent" || pathname.startsWith("/parent/");
  if (roles.family && (!needsParent || roles.parent)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: roles.family ? "A grown-up needs to unlock this." : "Enter the family PIN first." },
      { status: roles.family ? 403 : 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const unlock = request.nextUrl.clone();
  unlock.pathname = "/unlock";
  unlock.search = "";
  unlock.searchParams.set("next", `${pathname}${search}`);
  if (needsParent) unlock.searchParams.set("mode", "parent");
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: [
    // Everything except build assets, icons, the app manifest and the upload
    // route. Browsers fetch the manifest and home-screen icons without cookies,
    // so gating them would break "Add to Home Screen" (they hold nothing
    // private). Uploads are excluded because Next.js buffers (and truncates
    // past 10 MB) any request body that passes through a proxy; /api/upload
    // authenticates itself.
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|icons/|manifest\\.webmanifest|robots\\.txt|api/upload$).*)",
  ],
};
