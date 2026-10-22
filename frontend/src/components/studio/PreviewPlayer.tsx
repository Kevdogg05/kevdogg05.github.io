import { Ban, Clapperboard, Download, LoaderCircle, RotateCcw, TriangleAlert, Video } from "lucide-react";
import { Panel } from "./Panel";
import { mediaUrl, type Job } from "@/lib/api";
import { formatDuration } from "@/lib/format";

interface PreviewPlayerProps {
  job: Job | null;
  avatarPreviewUrl: string | null;
  connectionError: string | null;
  onRetry: (job: Job) => void;
}

export function PreviewPlayer({ job, avatarPreviewUrl, connectionError, onRetry }: PreviewPlayerProps) {
  const videoUrl = job?.status === "completed" && job.video_url ? mediaUrl(job.video_url) : null;
  // A library video shows its own avatar; a fresh draft shows the one being uploaded.
  const backdropUrl = job?.avatar_url ? mediaUrl(job.avatar_url) : avatarPreviewUrl;

  return (
    <Panel
      icon={Video}
      title="Preview"
      aside={
        videoUrl ? (
          <a
            href={videoUrl}
            download={`openavatar-${job?.job_id.slice(0, 8)}.mp4`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
          >
            <Download className="size-3.5" aria-hidden />
            Download MP4
          </a>
        ) : (
          <span className="text-xs text-zinc-500">1280 × 720 · MP4</span>
        )
      }
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black">
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 size-full bg-black object-contain"
          />
        ) : (
          <>
            {backdropUrl && <AvatarBackdrop url={backdropUrl} dimmed={Boolean(job)} />}
            <div className="absolute inset-0 grid place-items-center p-6">
              {job?.status === "queued" ? (
                <Queued job={job} />
              ) : job?.status === "running" ? (
                <Processing job={job} connectionError={connectionError} />
              ) : job?.status === "failed" || job?.status === "cancelled" ? (
                <Stopped job={job} onRetry={() => onRetry(job)} />
              ) : backdropUrl ? (
                <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-zinc-300 backdrop-blur">
                  Avatar preview · ready to generate
                </span>
              ) : (
                <Empty />
              )}
            </div>
          </>
        )}
      </div>

      {job?.status === "completed" && job.duration_seconds != null && (
        <p className="mt-2 text-xs text-zinc-500">
          Rendered {formatDuration(job.duration_seconds)} of video · job{" "}
          <span className="font-mono">{job.job_id.slice(0, 8)}</span>
        </p>
      )}
    </Panel>
  );
}

/** Mirrors the placeholder render: blurred cover backdrop with the avatar centred. */
function AvatarBackdrop({ url, dimmed }: { url: string; dimmed: boolean }) {
  return (
    <div className={`absolute inset-0 transition-opacity ${dimmed ? "opacity-30" : "opacity-100"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={url} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-75" />
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={url} alt="" className="absolute inset-0 size-full object-contain" />
    </div>
  );
}

function Processing({ job, connectionError }: { job: Job; connectionError: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 rounded-full border-4 border-white/10" />
        <LoaderCircle className="absolute inset-0 size-20 animate-spin text-violet-400" strokeWidth={1.25} aria-hidden />
        <span className="text-lg font-semibold tabular-nums text-white">{job.progress}%</span>
      </div>
      <p className="text-sm font-medium text-zinc-100">{job.message}</p>
      {connectionError && (
        <p className="max-w-sm text-xs text-amber-300">Reconnecting… {connectionError}</p>
      )}
    </div>
  );
}

function Queued({ job }: { job: Job }) {
  const ahead = Math.max(0, (job.queue_position ?? 1) - 1);
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-black/50 p-5 text-center backdrop-blur" role="status">
      <LoaderCircle className="size-8 text-zinc-400" strokeWidth={1.5} aria-hidden />
      <p className="text-sm font-semibold text-white">Waiting in the queue</p>
      <p className="text-xs text-zinc-300">
        {ahead === 0 ? "Starts as soon as the current video finishes." : `${ahead} ${ahead === 1 ? "video" : "videos"} ahead of this one.`}
      </p>
    </div>
  );
}

function Stopped({ job, onRetry }: { job: Job; onRetry: () => void }) {
  const cancelled = job.status === "cancelled";
  return (
    <div className="flex max-w-md flex-col items-center gap-2 rounded-xl bg-black/50 p-5 text-center backdrop-blur">
      {cancelled ? (
        <Ban className="size-8 text-zinc-400" aria-hidden />
      ) : (
        <TriangleAlert className="size-8 text-red-400" aria-hidden />
      )}
      <p className="text-sm font-semibold text-white">{cancelled ? "Cancelled" : "Generation failed"}</p>
      {!cancelled && <p className="text-xs leading-relaxed text-red-200/90">{job.error ?? "Unknown error"}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/10"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Render again
      </button>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-white/[0.04] text-zinc-500">
        <Clapperboard className="size-7" aria-hidden />
      </span>
      <p className="text-sm font-medium text-zinc-300">Your video will appear here</p>
      <p className="text-xs leading-relaxed text-zinc-500">
        Write a script, pick a voice and upload an avatar, then hit Generate.
      </p>
    </div>
  );
}
