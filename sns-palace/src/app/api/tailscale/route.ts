// GET /api/tailscale   this device's Tailscale address and state (parent), for
// the "Add a device" QR code. See src/server/tailscale.ts.

import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guard";
import { json, route } from "@/server/http";
import { tailscaleStatus } from "@/server/tailscale";

export const GET = route(async (request: NextRequest) => {
  requireRole(request, "parent");
  return json(await tailscaleStatus());
});
