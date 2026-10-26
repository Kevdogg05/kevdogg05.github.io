"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type UploadedAvatar } from "@/lib/api";
import { formatBytes } from "@/lib/format";

export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export type AvatarState =
  | { status: "empty" }
  | { status: "uploading"; file: File; previewUrl: string }
  | { status: "ready"; file: File; previewUrl: string; uploaded: UploadedAvatar }
  | { status: "error"; file: File | null; previewUrl: string | null; error: string };

function validate(file: File): string | null {
  const byExtension = /\.(png|jpe?g)$/i.test(file.name);
  if (!ACCEPTED_TYPES.includes(file.type) && !byExtension) {
    return "Please choose a PNG or JPG image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `That image is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_AVATAR_BYTES)}.`;
  }
  return null;
}

/** Validates, previews and uploads an avatar image as soon as it is chosen. */
export function useAvatarUpload() {
  const [state, setState] = useState<AvatarState>({ status: "empty" });
  // Guards against a slow earlier upload overwriting a newer selection.
  const latestUpload = useRef(0);

  const previewUrl = state.status === "empty" ? null : state.previewUrl;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const select = useCallback(async (file: File) => {
    const uploadId = ++latestUpload.current;
    const problem = validate(file);
    if (problem) {
      setState({ status: "error", file: null, previewUrl: null, error: problem });
      return;
    }
    const url = URL.createObjectURL(file);
    setState({ status: "uploading", file, previewUrl: url });
    try {
      const uploaded = await api.uploadAvatar(file);
      if (uploadId === latestUpload.current) {
        setState({ status: "ready", file, previewUrl: url, uploaded });
      }
    } catch (err) {
      if (uploadId === latestUpload.current) {
        const error = err instanceof Error ? err.message : String(err);
        setState({ status: "error", file, previewUrl: url, error });
      }
    }
  }, []);

  const clear = useCallback(() => {
    latestUpload.current += 1;
    setState({ status: "empty" });
  }, []);

  return { state, select, clear };
}
