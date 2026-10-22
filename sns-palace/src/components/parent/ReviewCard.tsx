"use client";

import {
  Captions,
  CircleCheck,
  CircleX,
  Clapperboard,
  EyeOff,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CutTimeline } from "@/components/parent/CutTimeline";
import { PipelineProgress } from "@/components/parent/PipelineProgress";
import { editSources, VideoPlayer } from "@/components/VideoPlayer";
import { api, ApiError, goToUnlock } from "@/lib/api";
import { formatBytes, formatRelative, formatSeconds } from "@/lib/format";
import type { ReviewVideo, VideoAction } from "@/lib/types";

interface ReviewCardProps {
  video: ReviewVideo;
  /** When the list was fetched, for relative times. */
  now: number;
  onChanged: () => void;
}

function StatusBadge({ video }: { video: ReviewVideo }) {
  const { status, pipeline } = video;
  const [label, style] =
    status === "approved"
      ? ["On the feed", "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"]
      : pipeline.status === "failed"
        ? ["Edit failed", "bg-rose-400/15 text-rose-300 ring-rose-400/30"]
        : pipeline.status === "ready"
          ? ["Ready to review", "bg-amber-300/15 text-amber-200 ring-amber-300/30"]
          : ["Editing", "bg-sky-400/15 text-sky-300 ring-sky-400/30"];
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${style}`}>{label}</span>;
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <dt className="text-xs font-semibold text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold text-white tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-slate-500">{hint}</dd> : null}
    </div>
  );
}

export function ReviewCard({ video, now, onChanged }: ReviewCardProps) {
  const [busy, setBusy] = useState<VideoAction["action"] | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(video.title);

  // The delete confirmation quietly expires if not used.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const { analysis, pipeline, media } = video;
  const ready = pipeline.status === "ready";
  const working = pipeline.status === "queued" || pipeline.status === "processing";

  async function act(action: VideoAction) {
    setBusy(action.action);
    setError(null);
    try {
      await api(`/api/videos/${video.id}`, { method: "PATCH", json: action });
      onChanged();
      if (action.action === "rename") setEditingTitle(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.needsUnlock) return goToUnlock("parent");
      setError(caught instanceof Error ? caught.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      await api(`/api/videos/${video.id}`, { method: "DELETE" });
      onChanged();
    } catch (caught) {
      if (caught instanceof ApiError && caught.needsUnlock) return goToUnlock("parent");
      setError(caught instanceof Error ? caught.message : "Couldn't delete it.");
      setBusy(null);
    }
  }

  const trimmedShare = analysis && analysis.raw_duration ? Math.round((analysis.removed_duration / analysis.raw_duration) * 100) : 0;
  const editMs = analysis ? Object.values(analysis.timings_ms).reduce((sum, ms) => sum + (ms ?? 0), 0) : 0;
  const button =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <article className="rounded-3xl bg-slate-900 p-4 ring-1 ring-white/10 sm:p-6" aria-labelledby={`title-${video.id}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void act({ action: "rename", title });
              }}
            >
              <label htmlFor={`rename-${video.id}`} className="sr-only">
                Video title
              </label>
              <input
                id={`rename-${video.id}`}
                value={title}
                maxLength={80}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-1.5 font-display text-xl text-white ring-1 ring-white/20 outline-none focus:ring-violet-400"
              />
              <button type="submit" disabled={busy === "rename" || !title.trim()} className={`${button} bg-violet-500 py-1.5 text-white hover:bg-violet-400`}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle(video.title);
                  setEditingTitle(false);
                }}
                className={`${button} py-1.5 text-slate-300 hover:bg-white/10`}
              >
                Cancel
              </button>
            </form>
          ) : (
            <h2 id={`title-${video.id}`} className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
              <span className="truncate">{video.title}</span>
              <button
                type="button"
                onClick={() => {
                  setTitle(video.title);
                  setEditingTitle(true);
                }}
                aria-label={`Rename ${video.title}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-violet-400"
              >
                <Pencil aria-hidden className="size-4" />
              </button>
            </h2>
          )}
          <p className="mt-1 truncate text-sm text-slate-400">
            Uploaded {formatRelative(video.createdAt, now)}
            {video.originalFilename ? ` · ${video.originalFilename}` : ""} · {formatBytes(video.sizeBytes)}
          </p>
        </div>
        <StatusBadge video={video} />
      </header>

      {working ? (
        <div className="mb-4">
          <PipelineProgress pipeline={pipeline} updatedAt={video.updatedAt} now={now} />
        </div>
      ) : null}

      {pipeline.status === "failed" ? (
        <div role="alert" className="mb-4 flex gap-3 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/30">
          <CircleX aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold">The automatic edit didn&apos;t work.</p>
            <p className="mt-1 break-words whitespace-pre-line text-rose-200/80">{pipeline.error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <figure>
          <figcaption className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2 text-slate-300">
              <Clapperboard aria-hidden className="size-4" /> Raw upload
            </span>
            {analysis ? <span className="text-slate-400 tabular-nums">{formatSeconds(analysis.raw_duration)}</span> : null}
          </figcaption>
          <VideoPlayer
            // The browser-safe preview once it exists; the original file until then.
            sources={[media.preview ? { src: media.preview, type: "video/mp4" } : { src: media.raw }]}
            poster={media.thumbnail}
            label={`Raw upload of ${video.title}`}
            accent="#94a3b8"
            className="rounded-2xl"
          />
        </figure>
        <figure>
          <figcaption className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2 text-violet-300">
              <WandSparkles aria-hidden className="size-4" /> Automated AI edit
            </span>
            {analysis ? <span className="text-violet-300 tabular-nums">{formatSeconds(analysis.edited_duration)}</span> : null}
          </figcaption>
          {media.edited ? (
            <VideoPlayer
              sources={editSources(media)}
              poster={media.thumbnail}
              label={`AI edit of ${video.title}`}
              accent="#a78bfa"
              className="rounded-2xl"
            />
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl bg-white/5 text-sm text-slate-500 ring-1 ring-white/10 ring-inset">
              {working ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle aria-hidden className="size-4 animate-spin" /> The edit appears here when it&apos;s done
                </span>
              ) : (
                "No edit yet"
              )}
            </div>
          )}
        </figure>
      </div>

      {analysis ? (
        <div className="mt-5 flex flex-col gap-4">
          <CutTimeline analysis={analysis} />

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Words spoken" value={analysis.word_count} hint={analysis.captions ? "captioned" : "no captions"} />
            <Stat label="Raw length" value={formatSeconds(analysis.raw_duration)} />
            <Stat label="Edited length" value={formatSeconds(analysis.edited_duration)} />
            <Stat label="Trimmed" value={`−${formatSeconds(analysis.removed_duration)}`} hint={`${trimmedShare}% shorter`} />
            <Stat label="Pauses cut" value={analysis.cuts.length} hint={`of ${analysis.silences_detected} found`} />
            <Stat
              label="File size"
              value={formatBytes(analysis.output.bytes)}
              hint={video.sizeBytes ? `from ${formatBytes(video.sizeBytes)}` : undefined}
            />
          </dl>
          <p className="text-xs text-slate-500">
            {analysis.source.width}×{analysis.source.height}
            {analysis.source.video_codec ? ` ${analysis.source.video_codec.toUpperCase()}` : ""} → {analysis.output.width}×
            {analysis.output.height} H.264
            {analysis.output.webm_bytes ? ` + VP9 WebM (${formatBytes(analysis.output.webm_bytes)})` : ""} · pauses over {analysis.settings.min_silence} s below {analysis.settings.noise_db} dB · edited in{" "}
            {formatSeconds(editMs / 1000)}
          </p>

          {analysis.warnings.length ? (
            <ul className="flex flex-col gap-1.5">
              {analysis.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 text-sm text-amber-200">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {warning}
                </li>
              ))}
            </ul>
          ) : null}

          {video.transcript?.text ? (
            <details className="group rounded-xl bg-white/5 px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-300 marker:content-none">
                <Captions aria-hidden className="size-4" /> Transcript ({video.transcript.wordCount} words, {video.transcript.engine})
              </summary>
              <p className="mt-2 leading-relaxed text-slate-300">{video.transcript.text}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        {video.status === "pending" ? (
          <button
            type="button"
            disabled={!ready || busy !== null}
            onClick={() => void act({ action: "approve" })}
            className={`${button} bg-emerald-500 text-emerald-950 hover:bg-emerald-400`}
          >
            {busy === "approve" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CircleCheck aria-hidden className="size-4" />}
            Approve for Feed
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act({ action: "unapprove" })}
            className={`${button} bg-white/10 text-white hover:bg-white/15`}
          >
            <EyeOff aria-hidden className="size-4" /> Remove from feed
          </button>
        )}
        <button
          type="button"
          disabled={working || busy !== null}
          onClick={() => void act({ action: "reprocess" })}
          className={`${button} text-slate-300 hover:bg-white/10`}
          title="Run the automatic edit again (it will need a fresh review)"
        >
          <RotateCcw aria-hidden className="size-4" /> Re-run edit
        </button>

        <span className="flex-1" />
        {confirmDelete ? (
          <span className="flex items-center gap-2" role="group" aria-label="Confirm delete">
            <span className="text-sm font-semibold text-rose-300">Delete for good?</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void remove()}
              className={`${button} bg-rose-500 text-white hover:bg-rose-400`}
            >
              {busy === "delete" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={`${button} text-slate-300 hover:bg-white/10`}>
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirmDelete(true)}
            className={`${button} text-rose-300 hover:bg-rose-500/15`}
          >
            <Trash2 aria-hidden className="size-4" /> Delete
          </button>
        )}
      </footer>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-300">
          {error}
        </p>
      ) : null}
    </article>
  );
}
