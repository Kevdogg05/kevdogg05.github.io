// GET /api/media/:id/:variant streams a video or thumbnail to a signed-in
// household device, with byte ranges for seeking. Kids can only fetch the
// edited video (MP4 or WebM) and thumbnail of approved videos; parents can
// fetch anything.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { MEDIA_VARIANTS, type MediaVariant } from "@/lib/types";
import { requireRole } from "@/server/auth/guard";
import { getRepository } from "@/server/db";
import { isOnFeed, keyForVariant } from "@/server/dto";
import { HttpError, route } from "@/server/http";
import { getStorage } from "@/server/storage";

const KID_VARIANTS: readonly MediaVariant[] = ["edited", "webm", "thumbnail"];

const serve = route(async (request: NextRequest, context: RouteContext<"/api/media/[id]/[variant]">) => {
  const roles = requireRole(request, "family");
  const { id, variant } = await context.params;
  if (!z.uuid().safeParse(id).success || !(MEDIA_VARIANTS as readonly string[]).includes(variant)) {
    throw new HttpError(404, "Not found.");
  }
  const mediaVariant = variant as MediaVariant;

  const video = await (await getRepository()).get(id);
  if (!video) throw new HttpError(404, "Not found.");
  if (!roles.parent && (!isOnFeed(video) || !KID_VARIANTS.includes(mediaVariant))) {
    throw new HttpError(404, "Not found.");
  }
  const key = keyForVariant(video, mediaVariant);
  if (!key) throw new HttpError(404, "Not ready yet.");

  return (await getStorage()).serve(key, mediaVariant, request);
});

export const GET = serve;
export const HEAD = serve;
