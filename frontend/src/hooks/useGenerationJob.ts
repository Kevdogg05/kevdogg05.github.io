"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Job } from "@/lib/api";

const POLL_MS = 600;
const MAX_BACKOFF_STEPS = 5;

function isFinished(job: Job | null): boolean {
  return job?.status === "completed" || job?.status === "failed";
}

/**
 * Holds the current generation job and polls GET /api/jobs/{id} until it
 * completes or fails. Call `track` with the job returned by POST /api/generate.
 */
export function useGenerationJob() {
  const [job, setJob] = useState<Job | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const track = useCallback((next: Job) => {
    setJob(next);
    setConnectionError(null);
  }, []);

  const jobId = job?.job_id;
  const finished = isFinished(job);

  useEffect(() => {
    if (!jobId || finished) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    const poll = async () => {
      try {
        const next = await api.job(jobId);
        if (cancelled) return;
        failures = 0;
        setConnectionError(null);
        setJob(next);
        if (isFinished(next)) return;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // Jobs live in backend memory, so a backend restart forgets them.
          setJob((current) =>
            current && {
              ...current,
              status: "failed",
              message: "Generation failed",
              error: "The backend no longer knows this job (was it restarted?). Please generate again.",
            },
          );
          return;
        }
        failures += 1;
        setConnectionError(err instanceof Error ? err.message : String(err));
      }
      timer = setTimeout(poll, POLL_MS * Math.min(failures + 1, MAX_BACKOFF_STEPS));
    };

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, finished]);

  return { job, connectionError, track };
}
