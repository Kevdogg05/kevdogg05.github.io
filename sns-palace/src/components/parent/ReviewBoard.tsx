"use client";

import { Database, HardDrive, House, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddDeviceButton } from "@/components/parent/AddDeviceButton";
import { ReviewCard } from "@/components/parent/ReviewCard";
import { usePolling } from "@/hooks/usePolling";
import { api, goToUnlock } from "@/lib/api";
import type { ReviewResponse, SessionState } from "@/lib/types";

type Tab = "review" | "live";

interface Board extends ReviewResponse {
  session: SessionState;
  fetchedAt: number;
}

async function loadBoard(): Promise<Board> {
  const [list, session] = await Promise.all([api<ReviewResponse>("/api/videos?scope=all"), api<SessionState>("/api/session")]);
  return { ...list, session, fetchedAt: Date.now() };
}

export function ReviewBoard() {
  // Poll quickly while something is being edited, gently otherwise.
  const board = usePolling(loadBoard, (data) =>
    data?.videos.some((v) => v.pipeline.status === "queued" || v.pipeline.status === "processing") ? 2500 : 15_000,
  );
  const [tab, setTab] = useState<Tab>("review");

  useEffect(() => {
    if (board.error?.needsUnlock) goToUnlock("parent");
  }, [board.error]);

  const videos = board.data?.videos ?? [];
  const lists: Record<Tab, typeof videos> = {
    review: videos.filter((video) => video.status === "pending"),
    live: videos.filter((video) => video.status === "approved"),
  };
  const shown = lists[tab];
  const readyCount = lists.review.filter((video) => video.pipeline.status === "ready").length;
  const locksAt = board.data?.session.parentExpiresAt
    ? new Date(board.data.session.parentExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  async function lock() {
    await api("/api/session", { method: "DELETE" }).catch(() => {});
    // A full load (not a client navigation) drops every cached copy of this
    // page, and replace() keeps Back from returning to it.
    window.location.replace("/");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
            <ShieldCheck aria-hidden className="size-7" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold text-white">Parent review</h1>
            <p className="text-sm text-slate-400">
              Nothing reaches the kids&apos; feed until you approve it.
              {locksAt ? ` Locks again at ${locksAt}.` : ""}
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Parent tools">
          <AddDeviceButton />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-violet-400"
          >
            <House aria-hidden className="size-4" /> Kids&apos; feed
          </Link>
          <button
            type="button"
            onClick={() => void lock()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-violet-400"
          >
            <Lock aria-hidden className="size-4" /> Lock
          </button>
        </nav>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Videos" className="inline-flex rounded-2xl bg-slate-900 p-1 ring-1 ring-white/10">
          {(
            [
              ["review", "To review", lists.review.length],
              ["live", "On the feed", lists.live.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-violet-400 ${
                tab === key ? "bg-violet-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === key ? "bg-white/20" : "bg-white/10"}`}>{count}</span>
            </button>
          ))}
        </div>
        {board.data ? (
          <p className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Database aria-hidden className="size-3.5" /> {board.data.system.database}
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive aria-hidden className="size-3.5" /> {board.data.system.storage}
            </span>
          </p>
        ) : null}
      </div>

      {tab === "review" && readyCount > 0 ? (
        <p className="mb-4 text-sm text-amber-200">
          {readyCount} edit{readyCount === 1 ? " is" : "s are"} ready for your OK.
        </p>
      ) : null}

      {board.error && !board.error.needsUnlock ? (
        <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-rose-200 ring-1 ring-rose-400/30">
          {board.error.message}
        </p>
      ) : null}

      <div role="tabpanel" aria-label={tab === "review" ? "To review" : "On the feed"} className="flex flex-col gap-6">
        {board.loading ? (
          [0, 1].map((i) => <div key={i} className="h-96 animate-pulse rounded-3xl bg-slate-900" />)
        ) : shown.length ? (
          shown.map((video) => (
            <ReviewCard key={video.id} video={video} now={board.data!.fetchedAt} onChanged={() => void board.refresh()} />
          ))
        ) : (
          <div className="rounded-3xl bg-slate-900 px-6 py-16 text-center ring-1 ring-white/10">
            <p className="font-display text-xl text-white">{tab === "review" ? "All caught up!" : "The feed is empty."}</p>
            <p className="mt-1 text-sm text-slate-400">
              {tab === "review" ? "New uploads appear here as soon as they arrive." : "Approved videos show up here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
