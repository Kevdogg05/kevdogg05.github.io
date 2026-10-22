"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Health, type VoicesResponse } from "@/lib/api";

export type BackendState =
  | { status: "connecting" }
  | { status: "online"; health: Health; voices: VoicesResponse; voicesError: string | null }
  | { status: "offline"; error: string };

/** Loads backend health and the voice list; `retry` re-runs both. */
export function useBackend() {
  const [state, setState] = useState<BackendState>({ status: "connecting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api.health();
        let voices: VoicesResponse = { provider: health.tts.name, voices: [] };
        let voicesError: string | null = null;
        try {
          voices = await api.voices();
        } catch (err) {
          voicesError = err instanceof ApiError ? err.message : String(err);
        }
        if (!cancelled) setState({ status: "online", health, voices, voicesError });
      } catch (err) {
        if (!cancelled) {
          setState({ status: "offline", error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "connecting" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
