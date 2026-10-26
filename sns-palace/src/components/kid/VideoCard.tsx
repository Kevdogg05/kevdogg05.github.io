import { Clock } from "lucide-react";
import { editSources, VideoPlayer } from "@/components/VideoPlayer";
import { formatDuration, formatRelative } from "@/lib/format";
import type { FeedVideo } from "@/lib/types";

// Each card takes the next colour, so the feed looks like a box of crayons.
const ACCENTS = [
  { ring: "ring-fuchsia-300", chip: "bg-fuchsia-100 text-fuchsia-700", scrub: "#ff5fd2" },
  { ring: "ring-sky-300", chip: "bg-sky-100 text-sky-700", scrub: "#2ee6ff" },
  { ring: "ring-amber-300", chip: "bg-amber-100 text-amber-800", scrub: "#ffd60a" },
  { ring: "ring-lime-300", chip: "bg-lime-100 text-lime-800", scrub: "#7cff4f" },
  { ring: "ring-violet-300", chip: "bg-violet-100 text-violet-700", scrub: "#b69cff" },
];

export function VideoCard({ video, index, now }: { video: FeedVideo; index: number; now: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <article
      className={`group/card rounded-[1.75rem] bg-white p-3 shadow-lg ring-4 ${accent.ring} transition duration-200 motion-safe:hover:-translate-y-1.5 motion-safe:hover:rotate-[-0.6deg] hover:shadow-2xl`}
    >
      {video.media.edited ? (
        <VideoPlayer
          sources={editSources(video.media)}
          poster={video.media.thumbnail}
          label={video.title}
          accent={accent.scrub}
          preload="none"
          className="rounded-2xl"
        />
      ) : null}
      <div className="px-2 pt-3 pb-1">
        <h3 className="font-display text-xl leading-tight font-semibold text-slate-800">{video.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-sm font-bold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${accent.chip}`}>
            <Clock aria-hidden className="size-3.5" />
            <span className="sr-only">Length</span>
            {formatDuration(video.duration)}
          </span>
          <span className="text-slate-500">{formatRelative(video.approvedAt ?? video.createdAt, now)}</span>
        </div>
      </div>
    </article>
  );
}
