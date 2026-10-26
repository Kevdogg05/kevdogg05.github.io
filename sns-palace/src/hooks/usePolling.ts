"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface PollingState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads data, then reloads it every `interval(data)` milliseconds while the
 * tab is visible, and right away when the tab comes back into view.
 */
export function usePolling<T>(load: () => Promise<T>, interval: (data: T | null) => number): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const intervalRef = useRef(interval);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    loadRef.current = load;
    intervalRef.current = interval;
  });

  const refresh = useCallback(async () => {
    try {
      const next = await loadRef.current();
      dataRef.current = next;
      setData(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Couldn't reach SnS Palace. Is the server running?"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (!stopped) timer = setTimeout(tick, intervalRef.current(dataRef.current));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { data, error, loading, refresh };
}
