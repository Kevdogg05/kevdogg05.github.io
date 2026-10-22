import {
  Ban,
  Download,
  Film,
  Library,
  LoaderCircle,
  RotateCcw,
  Trash,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Panel } from "./Panel";
import { isActive, mediaUrl, type Job, type JobList } from "@/lib/api";
import { formatBytes, formatDuration, formatRelative } from "@/lib/format";

interface VideoLibraryProps {
  library: JobList | null;
  error: string | null;
  actionError: string | null;
  selectedJobId: string | null;
  engineLabels: Record<string, string>;
  onSelect: (job: Job) => void;
  onCancel: (job: Job) => void;
  onRetry: (job: Job) => void;
  onDelete: (job: Job) => void;
}

export function VideoLibrary({
  library,
  error,
  actionError,
  selectedJobId,
  engineLabels,
  onSelect,
  onCancel,
  onRetry,
  onDelete,
}: VideoLibraryProps) {
  const count = library?.total ?? 0;
  return (
    <Panel
      icon={Library}
      title="Your videos"
      aside={
        library && (
          <span className="text-xs text-zinc-500">
            {count} {count === 1 ? "video" : "videos"} · {formatBytes(library.storage_bytes)}
            {library.active > 0 && <span className="text-violet-300"> · {library.active} in progress</span>}
          </span>
        )
      }
    >
      {(actionError || (error && !library)) && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-red-300">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {actionError ?? error}
        </p>
      )}

      {!library ? (
        <p className="text-xs text-zinc-500">{error ? "The library is unavailable." : "Loading…"}</p>
      ) : library.jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Film className="size-6 text-zinc-600" aria-hidden />
          <p className="text-sm text-zinc-400">Videos you generate will appear here.</p>
          <p className="text-xs text-zinc-600">They are kept across restarts, and you can queue several at once.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {library.jobs.map((job) => (
            <VideoCard
              key={job.job_id}
              job={job}
              now={library.server_time}
              engineLabel={engineLabels[job.engine] ?? job.engine}
              selected={job.job_id === selectedJobId}
              onSelect={() => onSelect(job)}
              actions={
                <>
                  {job.status === "completed" && job.video_url && (
                    <IconLink href={mediaUrl(job.video_url)} label="Download MP4">
                      <Download className="size-3.5" aria-hidden />
                    </IconLink>
                  )}
                  {isActive(job) ? (
                    <IconButton label="Cancel" onClick={() => onCancel(job)}>
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  ) : (
                    <>
                      <IconButton label="Render again" onClick={() => onRetry(job)}>
                        <RotateCcw className="size-3.5" aria-hidden />
                      </IconButton>
                      <IconButton label="Delete" onClick={() => onDelete(job)} danger>
                        <Trash className="size-3.5" aria-hidden />
                      </IconButton>
                    </>
                  )}
                </>
              }
            />
          ))}
        </ul>
      )}
      {library && library.total > library.jobs.length && (
        <p className="mt-3 text-xs text-zinc-600">Showing the {library.jobs.length} most recent videos.</p>
      )}
    </Panel>
  );
}

function VideoCard({
  job,
  now,
  engineLabel,
  selected,
  onSelect,
  actions,
}: {
  job: Job;
  now: string;
  engineLabel: string;
  selected: boolean;
  onSelect: () => void;
  actions: ReactNode;
}) {
  const thumbnail = job.poster_url ?? job.avatar_url;
  return (
    <li
      className={`group flex flex-col overflow-hidden rounded-xl border bg-zinc-950/50 transition ${
        selected ? "border-violet-500/70 ring-2 ring-violet-500/20" : "border-white/[0.06] hover:border-white/20"
      }`}
    >
      <button type="button" onClick={onSelect} className="text-left" aria-label={`Show video: ${job.script}`}>
        <div className="relative aspect-video overflow-hidden bg-black">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the backend
            <img
              src={mediaUrl(thumbnail)}
              alt=""
              loading="lazy"
              className={`size-full ${job.poster_url ? "object-cover" : "object-contain opacity-40"}`}
            />
          ) : (
            <Film className="absolute inset-0 m-auto size-6 text-zinc-700" aria-hidden />
          )}
          <span className="absolute top-1.5 left-1.5">
            <StatusBadge job={job} />
          </span>
          {job.status === "completed" && job.duration_seconds != null && (
            <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-200">
              {formatDuration(job.duration_seconds)}
            </span>
          )}
          {job.status === "running" && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <span className="block h-full bg-violet-500 transition-[width] duration-700" style={{ width: `${job.progress}%` }} />
            </span>
          )}
        </div>
        <div className="px-2.5 pt-2">
          <p className="line-clamp-2 text-xs leading-snug text-zinc-200">{job.script}</p>
        </div>
      </button>
      <div className="mt-auto flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-2">
        <span className="min-w-0 truncate text-[11px] text-zinc-500">
          {engineLabel}
          {job.enhance && " · enhanced"} · {formatRelative(job.created_at, now)}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover:opacity-100">{actions}</span>
      </div>
    </li>
  );
}

function StatusBadge({ job }: { job: Job }) {
  const base = "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium backdrop-blur";
  switch (job.status) {
    case "queued":
      return (
        <span className={`${base} bg-black/70 text-zinc-200`}>
          Queued{job.queue_position ? ` · #${job.queue_position}` : ""}
        </span>
      );
    case "running":
      return (
        <span className={`${base} bg-violet-600/80 text-white`}>
          <LoaderCircle className="size-3 animate-spin" aria-hidden />
          {job.progress}%
        </span>
      );
    case "failed":
      return (
        <span className={`${base} bg-red-600/80 text-white`}>
          <TriangleAlert className="size-3" aria-hidden />
          Failed
        </span>
      );
    case "cancelled":
      return (
        <span className={`${base} bg-zinc-700/80 text-zinc-200`}>
          <Ban className="size-3" aria-hidden />
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

const ICON_BUTTON =
  "grid size-6 place-items-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100";

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`${ICON_BUTTON} ${danger ? "hover:!bg-red-500/15 hover:!text-red-300" : ""}`}
    >
      {children}
    </button>
  );
}

function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a href={href} download target="_blank" rel="noreferrer" title={label} aria-label={label} className={ICON_BUTTON}>
      {children}
    </a>
  );
}
