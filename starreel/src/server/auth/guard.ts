// Authorization for route handlers. Every handler calls this itself, so data is
// protected even if a request somehow skips the proxy (or, like /api/upload,
// is deliberately excluded from it).

import type { NextRequest } from "next/server";
import { getAuthConfig } from "@/server/config";
import { HttpError } from "@/server/http";
import { rolesFromCookies, type Role } from "@/server/auth/session";

export function sessionRoles(request: NextRequest) {
  return rolesFromCookies(getAuthConfig(), (name) => request.cookies.get(name)?.value);
}

export function requireRole(request: NextRequest, role: Role) {
  const roles = sessionRoles(request);
  if (!roles.family) throw new HttpError(401, "Enter the family PIN first.");
  if (role === "parent" && !roles.parent) throw new HttpError(403, "A grown-up needs to unlock this.");
  return roles;
}
