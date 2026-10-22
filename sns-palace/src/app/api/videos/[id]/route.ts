// GET    /api/videos/:id   one video (family: feed videos only; parent: any)
// PATCH  /api/videos/:id   parent actions: approve, unapprove, reprocess, rename
// DELETE /api/videos/:id   parent: delete the video and every stored file

import type { NextRequest } from "next/server";
import { z } from "zod";
import { MEDIA_VARIANTS, type VideoRecord } from "@/lib/types";
import { requireRole } from "@/server/auth/guard";
import { getRepository } from "@/server/db";
import type { VideoPatch } from "@/server/db/repository";
import { isOnFeed, keyForVariant, toFeedVideo, toReviewVideo } from "@/server/dto";
import { assertSameOrigin, HttpError, json, readJson, route } from "@/server/http";
import { getStorage } from "@/server/storage";
import { cleanTitle } from "@/server/upload";

type Context = RouteContext<"/api/videos/[id]">;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("unapprove") }),
  z.object({ action: z.literal("reprocess") }),
  z.object({ action: z.literal("rename"), title: z.string().trim().min(1).max(200) }),
]);

async function findVideo(context: Context): Promise<VideoRecord> {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Video not found.");
  const video = await (await getRepository()).get(id);
  if (!video) throw new HttpError(404, "Video not found.");
  return video;
}

export const GET = route(async (request: NextRequest, context: Context) => {
  const roles = requireRole(request, "family");
  const video = await findVideo(context);
  if (roles.parent) return json({ video: toReviewVideo(video) });
  if (!isOnFeed(video)) throw new HttpError(404, "Video not found.");
  return json({ video: toFeedVideo(video) });
});

export const PATCH = route(async (request: NextRequest, context: Context) => {
  requireRole(request, "parent");
  assertSameOrigin(request);
  const parsed = actionSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Unknown action.");
  const video = await findVideo(context);
  const repo = await getRepository();
  const body = parsed.data;

  let patch: VideoPatch;
  let condition: Parameters<typeof repo.update>[2] = {};
  switch (body.action) {
    case "approve":
      if (video.pipeline_status !== "ready" || !video.edited_key) {
        throw new HttpError(409, "The edit isn't finished yet.");
      }
      patch = { status: "approved", approved_at: new Date().toISOString() };
      condition = { pipelineStatusIn: ["ready"] };
      break;
    case "unapprove":
      patch = { status: "pending", approved_at: null };
      break;
    case "reprocess":
      // Back to the queue; it needs a fresh review once the new edit is done.
      // The previous edit stays playable until the worker replaces it.
      patch = {
        status: "pending",
        approved_at: null,
        pipeline_status: "queued",
        pipeline_stage: null,
        pipeline_error: null,
        attempts: 0,
        locked_by: null,
        locked_at: null,
      };
      condition = { pipelineStatusIn: ["ready", "failed"] };
      break;
    case "rename":
      patch = { title: cleanTitle(body.title) };
      break;
  }

  const updated = await repo.update(video.id, patch, condition);
  if (!updated) throw new HttpError(409, "The video changed meanwhile. Refresh and try again.");
  return json({ video: toReviewVideo(updated) });
});

export const DELETE = route(async (request: NextRequest, context: Context) => {
  requireRole(request, "parent");
  assertSameOrigin(request);
  const video = await findVideo(context);
  const [repo, storage] = await Promise.all([getRepository(), getStorage()]);

  // Files first: if any delete fails the row stays, so the parent can retry
  // and nothing is left behind unseen. (A worker still editing this video
  // notices the row is gone and removes whatever it uploads.)
  const results = await Promise.allSettled(
    MEDIA_VARIANTS.flatMap((variant) => {
      const key = keyForVariant(video, variant);
      return key ? [storage.delete(key, variant)] : [];
    }),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    for (const failure of failed) console.error("Delete failed", (failure as PromiseRejectedResult).reason);
    throw new HttpError(502, "Some files couldn't be deleted from storage. Try again.");
  }

  await repo.delete(video.id);
  return json({ ok: true });
});
