// GET /api/videos             the kids' feed: approved videos only (family)
// GET /api/videos?scope=all   every video with pipeline details (parent)

import type { NextRequest } from "next/server";
import type { FeedResponse, ReviewResponse } from "@/lib/types";
import { requireRole } from "@/server/auth/guard";
import { getStorageConfig, getUploadConfig } from "@/server/config";
import { getRepository } from "@/server/db";
import { isOnFeed, toFeedVideo, toReviewVideo } from "@/server/dto";
import { HttpError, json, route } from "@/server/http";

export const GET = route(async (request: NextRequest) => {
  const scope = request.nextUrl.searchParams.get("scope") ?? "feed";

  if (scope === "all") {
    requireRole(request, "parent");
    const repo = await getRepository();
    const videos = await repo.list({ limit: 200 });
    const body: ReviewResponse = {
      videos: videos.map(toReviewVideo),
      system: { database: repo.driver, storage: getStorageConfig().driver },
    };
    return json(body);
  }
  if (scope !== "feed") throw new HttpError(400, "scope must be feed or all.");

  requireRole(request, "family");
  const repo = await getRepository();
  const [approved, waitingCount] = await Promise.all([repo.list({ status: "approved", limit: 100 }), repo.countPending()]);
  const body: FeedResponse = {
    videos: approved.filter(isOnFeed).map(toFeedVideo),
    waitingCount,
    uploadLimitBytes: getUploadConfig().maxBytes,
  };
  return json(body);
});
