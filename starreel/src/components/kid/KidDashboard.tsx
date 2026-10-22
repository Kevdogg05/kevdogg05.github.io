"use client";

import { Hourglass, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Uploader } from "@/components/kid/Uploader";
import { VideoCard } from "@/components/kid/VideoCard";
import { usePolling } from "@/hooks/usePolling";
import { api, goToUnlock } from "@/lib/api";
import type { FeedResponse } from "@/lib/types";

export function KidDashboard() {
  // New approvals show up on their own: check every 20 s, and whenever the tab returns.
  const feed = usePolling(async () => ({ ...(await api<FeedResponse>("/api/videos")), fetchedAt: Date.now() }), () => 20_000);

  useEffect(() => {
    if (feed.error?.needsUnlock) goToUnlock("family");
  }, [feed.error]);

  const videos = feed.data?.videos ?? [];
  const waiting = feed.data?.waitingCount ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <Uploader limitBytes={feed.data?.uploadLimitBytes ?? null} onUploaded={() => void feed.refresh()} />

      {waiting > 0 ? (
        <p className="flex items-center justify-center gap-3 rounded-2xl bg-amber-100/90 px-5 py-3 text-center text-lg font-bold text-amber-900 ring-4 ring-amber-200">
          <Hourglass aria-hidden className="size-6 shrink-0 motion-safe:animate-pulse" />
          {waiting === 1 ? "1 video is" : `${waiting} videos are`} getting ready for a grown-up to check.
        </p>
      ) : null}

      <section aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="mb-5 flex items-center gap-3 font-display text-3xl font-semibold text-violet-800 sm:text-4xl">
          <Sparkles aria-hidden className="size-8 text-amber-400" />
          Our videos
        </h2>

        {feed.error && !feed.error.needsUnlock ? (
          <p role="alert" className="rounded-2xl bg-rose-100 px-5 py-4 text-lg font-bold text-rose-700">
            {feed.error.message}
          </p>
        ) : null}

        {feed.loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading videos">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/3.3] animate-pulse rounded-[1.75rem] bg-white/70" />
            ))}
          </div>
        ) : videos.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video, index) => (
              <VideoCard key={video.id} video={video} index={index} now={feed.data!.fetchedAt} />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] bg-white/70 px-6 py-12 text-center ring-4 ring-white">
            <p className="font-display text-2xl font-semibold text-violet-700">No videos yet!</p>
            <p className="mt-2 text-lg font-semibold text-slate-600">Make one and be the first star of the show.</p>
          </div>
        )}
      </section>
    </div>
  );
}
