"use client";

import { CircleCheck, ImageUp, LoaderCircle, TriangleAlert, UserRound, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Panel } from "./Panel";
import { MAX_AVATAR_BYTES, type AvatarState } from "@/hooks/useAvatarUpload";
import { formatBytes } from "@/lib/format";

interface AvatarUploaderProps {
  state: AvatarState;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function AvatarUploader({ state, onSelect, onClear, disabled }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const browse = () => inputRef.current?.click();

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) onSelect(file);
  };

  const dragProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  };

  const previewUrl = state.status === "empty" ? null : state.previewUrl;
  const file = state.status === "empty" ? null : state.file;

  return (
    <Panel
      icon={UserRound}
      title="Avatar"
      aside={
        previewUrl && (
          <button
            type="button"
            onClick={browse}
            disabled={disabled}
            className="text-xs font-medium text-violet-300 transition hover:text-violet-200 disabled:opacity-50"
          >
            Replace
          </button>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {previewUrl ? (
        <div
          {...dragProps}
          className={`relative overflow-hidden rounded-xl border bg-zinc-950 ${
            dragging ? "border-violet-500 ring-4 ring-violet-500/15" : "border-white/[0.08]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={previewUrl} alt="Avatar preview" className="aspect-[4/3] w-full object-contain" />

          {state.status === "uploading" && (
            <div className="absolute inset-0 grid place-items-center bg-zinc-950/60 backdrop-blur-[2px]">
              <span className="flex items-center gap-2 text-sm text-zinc-200">
                <LoaderCircle className="size-4 animate-spin text-violet-400" aria-hidden />
                Uploading…
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2.5 text-xs">
            <span className="truncate text-zinc-300">
              {file?.name}
              {file && <span className="text-zinc-500"> · {formatBytes(file.size)}</span>}
            </span>
            {state.status === "ready" && (
              <span className="flex shrink-0 items-center gap-1 font-medium text-emerald-300">
                <CircleCheck className="size-3.5" aria-hidden />
                Uploaded
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label="Remove avatar"
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-zinc-300 backdrop-blur transition hover:bg-black/80 hover:text-white disabled:opacity-50"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          {...dragProps}
          onClick={browse}
          disabled={disabled}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-9 text-center transition disabled:opacity-60 ${
            dragging
              ? "border-violet-500 bg-violet-500/10"
              : "border-white/10 bg-zinc-950/40 hover:border-violet-500/50 hover:bg-violet-500/[0.04]"
          }`}
        >
          <span className="grid size-11 place-items-center rounded-full bg-violet-500/10 text-violet-300">
            <ImageUp className="size-5" aria-hidden />
          </span>
          <span className="text-sm text-zinc-200">
            Drag &amp; drop a portrait, or <span className="font-medium text-violet-300">browse</span>
          </span>
          <span className="text-xs text-zinc-500">
            PNG or JPG · up to {formatBytes(MAX_AVATAR_BYTES)} · a clear, front-facing face works best
          </span>
        </button>
      )}

      {state.status === "error" && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-300">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </Panel>
  );
}
