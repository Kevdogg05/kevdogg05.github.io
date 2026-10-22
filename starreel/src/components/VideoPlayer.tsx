"use client";

import Image from "next/image";
import { LoaderCircle, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from "react";
import { formatDuration } from "@/lib/format";

// Starting one player pauses every other one on the page.
const PLAY_EVENT = "starreel:play";

export interface VideoSource {
  src: string;
  /** MIME type, so the browser can skip formats it can't play without downloading them. */
  type?: string;
}

/**
 * The H.264 MP4 first (hardware-decoded nearly everywhere), then the VP9 WebM
 * for browsers built without H.264. Exact codecs let a browser skip a format
 * it can't decode without downloading any of it.
 */
export function editSources(media: { webm: string | null; edited: string | null }): VideoSource[] {
  return [
    ...(media.edited ? [{ src: media.edited, type: 'video/mp4; codecs="avc1.640028, mp4a.40.2"' }] : []),
    ...(media.webm ? [{ src: media.webm, type: 'video/webm; codecs="vp9, opus"' }] : []),
  ];
}

interface VideoPlayerProps {
  /** Tried in order; the browser plays the first it supports. */
  sources: VideoSource[];
  poster?: string | null;
  /** Accessible name, e.g. the video's title. */
  label: string;
  /** Scrubber colour. */
  accent?: string;
  /** "none" keeps a grid of videos from downloading anything until played. */
  preload?: "none" | "metadata";
  className?: string;
}

export function VideoPlayer(props: VideoPlayerProps) {
  // New files (say, after a re-edit) get a fresh player: no stale error or progress.
  return <Player key={props.sources.map((source) => source.src).join(" ")} {...props} />;
}

function Player({ sources, poster, label, accent = "#ffd60a", preload = "metadata", className = "" }: VideoPlayerProps) {
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const pauseIfOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) video.current?.pause();
    };
    const onFullscreen = () => setFullscreen(document.fullscreenElement === wrapper.current);
    window.addEventListener(PLAY_EVENT, pauseIfOther);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener(PLAY_EVENT, pauseIfOther);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [id]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setPlaying(false));
    else v.pause();
  };

  const onError = (event: SyntheticEvent<HTMLVideoElement>) => {
    // <source> errors reach this handler too. A browser skipping a format it
    // can't play is fine; only the video itself or the last source failing is.
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || (target.tagName === "SOURCE" && !target.nextElementSibling)) setFailed(true);
  };

  const toggleMute = () => {
    if (video.current) video.current.muted = !video.current.muted;
  };

  const seek = (seconds: number) => {
    const v = video.current;
    if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(Math.max(seconds, 0), v.duration);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    if (wrapper.current?.requestFullscreen) return wrapper.current.requestFullscreen();
    // iPhone Safari only allows fullscreen on the video element itself.
    (video.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const onSlider = (event.target as HTMLElement).tagName === "INPUT";
    const onButton = (event.target as HTMLElement).tagName === "BUTTON";
    switch (event.key) {
      case " ":
      case "k":
        if (onButton && event.key === " ") return; // let the button handle its own press
        event.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        if (onSlider) return;
        event.preventDefault();
        seek(time + (event.key === "ArrowLeft" ? -5 : 5));
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        void toggleFullscreen();
        break;
    }
  };

  const progress = duration ? (time / duration) * 100 : 0;
  const controlsVisible = started && (!playing || buffering);
  const button =
    "grid size-10 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-white";

  return (
    <div
      ref={wrapper}
      role="group"
      aria-label={`Video player: ${label}`}
      onKeyDown={onKeyDown}
      className={`group relative isolate aspect-video overflow-hidden bg-slate-900 ${className}`}
    >
      {poster ? (
        <Image src={poster} alt="" aria-hidden fill unoptimized sizes="50vw" className="-z-10 scale-125 object-cover opacity-60 blur-2xl" />
      ) : null}

      <video
        ref={video}
        poster={poster ?? undefined}
        preload={preload}
        playsInline
        className="h-full w-full object-contain"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={onError}
      >
        {sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-900/80 p-4 text-center text-sm font-semibold text-white">
          This video can&apos;t play right now.
        </div>
      ) : null}

      {!playing && !failed ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Play ${label}`}
          className="absolute inset-0 m-auto grid size-18 place-items-center rounded-full bg-white/95 text-violet-600 shadow-xl ring-4 ring-white/40 transition hover:scale-110 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 motion-safe:group-hover:animate-pulse"
        >
          <Play aria-hidden className="ml-1 size-9 fill-current" />
        </button>
      ) : null}

      {buffering && playing ? (
        <LoaderCircle aria-label="Loading" className="absolute inset-0 m-auto size-12 animate-spin text-white drop-shadow" />
      ) : null}

      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pt-8 pb-1.5 transition-opacity duration-200 ${
          failed
            ? "hidden"
            : controlsVisible
              ? "opacity-100"
              : started
                ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                : "pointer-events-none opacity-0"
        }`}
      >
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={button}>
          {playing ? <Pause aria-hidden className="size-5 fill-current" /> : <Play aria-hidden className="size-5 fill-current" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
          className="scrubber mx-1 min-w-0 flex-1"
          style={{ "--progress": `${progress}%`, "--scrub-fill": accent } as CSSProperties}
        />
        <span className="shrink-0 px-1 text-xs font-bold text-white tabular-nums">
          {formatDuration(time)} / {formatDuration(duration)}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className={button}
        >
          {muted ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit full screen" : "Full screen"} className={button}>
          {fullscreen ? <Minimize aria-hidden className="size-5" /> : <Maximize aria-hidden className="size-5" />}
        </button>
      </div>
    </div>
  );
}
