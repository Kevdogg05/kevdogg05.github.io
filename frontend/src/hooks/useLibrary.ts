"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type JobList } from "@/lib/api";

const ACTIVE_POLL_MS = 1000;
const IDLE_POLL_MS = 10_000;
const ERROR_RETRY_MS = 3000;

/**
 * The video library (GET /api/jobs), refreshed every second while anything is
 * queued or rendering and every 10 s otherwise. `refresh` reloads right away.
 */
export function useLibrary() {
  const [library, setLibrary] = useState<JobList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await api.jobs();
        if (cancelled) return;
        setLibrary(next);
        setError(null);
        timer = setTimeout(load, next.active > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        timer = setTimeout(load, ERROR_RETRY_MS);
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { library, error, refresh };
}
