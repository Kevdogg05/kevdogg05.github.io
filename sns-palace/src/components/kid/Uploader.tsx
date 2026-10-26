"use client";

import { CircleAlert, CloudUpload, PartyPopper, Rocket, Video, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ApiError, goToUnlock, uploadVideo } from "@/lib/api";
import { formatBytes } from "@/lib/format";

const ACCEPT = { "video/*": [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".3gp", ".avi"] };

type Phase =
  | { kind: "idle" }
  | { kind: "ready"; file: File; previewUrl: string }
  | { kind: "uploading"; file: File; previewUrl: string; progress: number; cancel: () => void }
  | { kind: "done"; title: string }
  | { kind: "error"; message: string; file: File | null };

interface UploaderProps {
  /** From the server; null until the feed has loaded. */
  limitBytes: number | null;
  onUploaded: () => void;
}

export function Uploader({ limitBytes, onUploaded }: UploaderProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [title, setTitle] = useState("");
  const [unplayablePreview, setUnplayablePreview] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // A local preview of the chosen clip, so kids can check they picked the right
  // one. Released once the uploader moves on.
  const previewUrl = phase.kind === "ready" || phase.kind === "uploading" ? phase.previewUrl : null;
  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (phase.kind === "ready") titleInput.current?.focus();
  }, [phase.kind]);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const problem = rejected[0]?.errors[0];
      if (problem) {
        const message =
          problem.code === "file-too-large"
            ? `That video is too big. The biggest is ${formatBytes(limitBytes)}.`
            : problem.code === "file-invalid-type"
              ? "That's not a video file. Try one from your camera!"
              : "Pick just one video at a time.";
        setPhase({ kind: "error", message, file: null });
        return;
      }
      if (accepted[0]) setPhase({ kind: "ready", file: accepted[0], previewUrl: URL.createObjectURL(accepted[0]) });
    },
    [limitBytes],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    maxFiles: 1,
    maxSize: limitBytes ?? undefined,
    noClick: true,
    noKeyboard: true,
    disabled: phase.kind === "uploading",
  });

  const send = (chosen: File, existingPreview?: string) => {
    const name = title.trim() || "My awesome video";
    const handle = uploadVideo(chosen, name, (progress) =>
      setPhase((current) => (current.kind === "uploading" ? { ...current, progress } : current)),
    );
    const preview = existingPreview ?? URL.createObjectURL(chosen);
    setPhase({ kind: "uploading", file: chosen, previewUrl: preview, progress: 0, cancel: handle.cancel });
    handle.done
      .then((video) => {
        setPhase({ kind: "done", title: video.title });
        setTitle("");
        onUploaded();
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) return goToUnlock("family");
        setPhase({
          kind: "error",
          message: error instanceof ApiError ? error.message : "The upload didn't work. Try again!",
          file: chosen,
        });
      });
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setTitle("");
  };

  return (
    <section
      aria-labelledby="upload-heading"
      {...getRootProps({
        className: `relative overflow-hidden rounded-[2rem] border-4 border-dashed p-5 transition-all duration-200 sm:p-8 ${
          isDragActive ? "scale-[1.01] border-fuchsia-500 bg-fuchsia-50" : "border-violet-300 bg-white/80 backdrop-blur"
        }`,
      })}
    >
      <input {...getInputProps()} aria-label="Choose a video file" />
      <h2 id="upload-heading" className="sr-only">
        Upload a video
      </h2>

      {phase.kind === "idle" ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-sky-300 to-violet-400 text-white shadow-lg motion-safe:animate-float">
            <CloudUpload aria-hidden className="size-12" />
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-violet-700 sm:text-4xl">
              {isDragActive ? "Let go to drop it!" : "Share your video!"}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-600">Drag it here, or tap the big button.</p>
          </div>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-8 py-4 font-display text-2xl font-semibold text-white shadow-[0_6px_0_#6d28d9] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-500 active:translate-y-1 active:shadow-none"
          >
            <Video aria-hidden className="size-7" />
            Choose a video
          </button>
        </div>
      ) : null}

      {phase.kind === "ready" || phase.kind === "uploading" ? (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
            {previewUrl && unplayablePreview === previewUrl ? (
              <div className="grid aspect-video place-items-center p-4 text-center font-bold text-white">
                <span>
                  <Video aria-hidden className="mx-auto mb-2 size-10 text-violet-300" />
                  This device can&apos;t show a preview, but it will still upload fine!
                </span>
              </div>
            ) : previewUrl ? (
              <video
                src={previewUrl}
                controls
                muted
                playsInline
                onError={() => setUnplayablePreview(previewUrl)}
                className="aspect-video w-full object-contain"
                aria-label="Your chosen video"
              />
            ) : (
              <div className="aspect-video" />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <p className="truncate text-sm font-semibold text-slate-500">
              {phase.file.name} · {formatBytes(phase.file.size)}
            </p>
            <div>
              <label htmlFor={titleId} className="mb-1 block font-display text-xl font-semibold text-violet-700">
                Name your video
              </label>
              <input
                ref={titleInput}
                id={titleId}
                value={title}
                maxLength={80}
                disabled={phase.kind === "uploading"}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && phase.kind === "ready" && send(phase.file, phase.previewUrl)}
                placeholder="Like: My Lego Rocket"
                className="w-full rounded-2xl border-4 border-violet-200 bg-white px-4 py-3 text-xl font-bold text-slate-800 outline-none placeholder:font-semibold placeholder:text-slate-400 focus:border-fuchsia-400 disabled:opacity-60"
              />
            </div>

            {phase.kind === "uploading" ? (
              <div>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(phase.progress * 100)}
                  className="h-7 overflow-hidden rounded-full bg-violet-100 ring-4 ring-violet-100"
                >
                  <div
                    className="rainbow-bar h-full rounded-full transition-[width] duration-300 motion-safe:animate-stripes"
                    style={{ width: `${Math.max(4, phase.progress * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-display text-xl font-semibold text-violet-700" aria-live="polite">
                    {phase.progress < 1 ? `Sending… ${Math.round(phase.progress * 100)}%` : "Almost done…"}
                  </p>
                  <button
                    type="button"
                    onClick={phase.cancel}
                    className="rounded-full px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-violet-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => send(phase.file, phase.previewUrl)}
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 px-8 py-4 font-display text-2xl font-semibold text-white shadow-[0_6px_0_#15803d] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-green-600 active:translate-y-1 active:shadow-none"
                >
                  <Rocket aria-hidden className="size-7" />
                  Send it!
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-full px-4 py-3 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-violet-500"
                >
                  <X aria-hidden className="size-5" /> Pick a different one
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {phase.kind === "done" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 text-white shadow-lg animate-pop">
            <PartyPopper aria-hidden className="size-10" />
          </div>
          <p className="font-display text-3xl font-semibold text-violet-700">Woohoo! It&apos;s on its way!</p>
          <p className="max-w-md text-lg font-semibold text-slate-600">
            &ldquo;{phase.title}&rdquo; is getting its magic edit. A grown-up will check it, then it shows up below.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-full bg-violet-600 px-6 py-3 font-display text-xl font-semibold text-white shadow-[0_5px_0_#4c1d95] transition hover:brightness-110 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-500 active:translate-y-1 active:shadow-none"
          >
            Share another one
          </button>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="alert">
          <CircleAlert aria-hidden className="size-14 text-rose-500" />
          <p className="font-display text-2xl font-semibold text-rose-600">{phase.message}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {phase.file ? (
              <button
                type="button"
                onClick={() => send(phase.file!)}
                className="rounded-full bg-violet-600 px-6 py-3 font-display text-xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (phase.file ? reset() : open())}
              className="rounded-full bg-white px-6 py-3 font-display text-xl font-semibold text-violet-700 ring-4 ring-violet-200 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
            >
              {phase.file ? "Start over" : "Pick a video"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
