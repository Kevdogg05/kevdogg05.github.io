"use client";

import { Delete, KeyRound, LoaderCircle, Lock, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

const MAX_DIGITS = 12;

/** Only same-site paths, so ?next= can't bounce anyone to another website. */
function safeNext(value: string | null, fallback: string): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

export function PinPad() {
  const params = useSearchParams();
  const parent = params.get("mode") === "parent";
  const next = safeNext(params.get("next"), parent ? "/parent" : "/");

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0); // set when a lockout starts

  const locked = waitUntil !== null && waitUntil > now;

  useEffect(() => {
    if (waitUntil === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= waitUntil) {
        setWaitUntil(null);
        setError(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const press = useCallback((digit: string) => {
    setError(null);
    setPin((current) => (current.length < MAX_DIGITS ? current + digit : current));
  }, []);
  const back = useCallback(() => setPin((current) => current.slice(0, -1)), []);

  const submit = useCallback(async () => {
    if (!pin || busy || locked) return;
    setBusy(true);
    try {
      await api("/api/session", { method: "POST", json: { pin, mode: parent ? "parent" : "family" } });
      window.location.replace(next);
    } catch (caught) {
      setPin("");
      setShake((n) => n + 1);
      const message = caught instanceof ApiError ? caught.message : "Something went wrong. Try again.";
      setError(message);
      const seconds = /Wait (\d+) seconds/.exec(message)?.[1];
      if (caught instanceof ApiError && caught.status === 429 && seconds) {
        setNow(Date.now());
        setWaitUntil(Date.now() + Number(seconds) * 1000);
      }
      setBusy(false);
    }
  }, [busy, locked, next, parent, pin]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") back();
      else if (event.key === "Enter") void submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, press, submit]);

  const secondsLeft = locked ? Math.ceil((waitUntil - now) / 1000) : 0;
  const theme = parent
    ? {
        page: "bg-slate-950 text-slate-100",
        card: "bg-slate-900 ring-1 ring-white/10",
        key: "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-600 focus-visible:outline-violet-400",
        go: "bg-violet-500 text-white hover:bg-violet-400",
        dot: "bg-violet-400",
        empty: "bg-slate-700",
      }
    : {
        page: "kid-sky text-slate-800",
        card: "bg-white/85 shadow-2xl shadow-violet-300/40 ring-4 ring-white backdrop-blur",
        key: "bg-gradient-to-b from-sky-100 to-sky-200 text-sky-900 shadow-[0_4px_0_#7dd3fc] hover:from-sky-50 active:translate-y-1 active:shadow-none focus-visible:outline-violet-500",
        go: "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-[0_5px_0_#6d28d9] hover:brightness-110 active:translate-y-1 active:shadow-none",
        dot: "bg-fuchsia-500",
        empty: "bg-slate-200",
      };

  return (
    <main className={`grid min-h-screen place-items-center p-4 ${theme.page}`}>
      <div className={`w-full max-w-sm rounded-[2rem] p-6 sm:p-8 ${theme.card}`}>
        <div className="mb-6 text-center">
          {parent ? (
            <>
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                <Lock aria-hidden className="size-7" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Grown-ups only</h1>
              <p className="mt-1 text-sm text-slate-400">Enter the parent PIN to review videos.</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-2 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-lg motion-safe:animate-float">
                <Star aria-hidden className="size-11 fill-yellow-300 text-yellow-300" />
              </div>
              <h1 className="font-display text-4xl font-bold text-violet-700">SnS Palace</h1>
              <p className="mt-1 font-semibold text-slate-600">Type the secret family number!</p>
            </>
          )}
        </div>

        <div key={shake} className={`mb-2 flex h-6 items-center justify-center gap-2 ${shake ? "animate-shake" : ""}`} aria-hidden>
          {pin.length === 0
            ? [0, 1, 2, 3].map((i) => <span key={i} className={`size-4 rounded-full ${theme.empty}`} />)
            : pin.split("").map((_, i) => <span key={i} className={`size-4 rounded-full animate-pop ${theme.dot}`} />)}
        </div>
        <p role="status" aria-live="polite" className={`mb-4 min-h-6 text-center text-sm font-bold ${parent ? "text-rose-300" : "text-rose-600"}`}>
          {locked ? `Too many tries. Wait ${secondsLeft} seconds.` : (error ?? <span className="sr-only">{pin.length} digits entered</span>)}
        </p>

        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Number pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={locked || busy}
              onClick={() => press(digit)}
              className={`h-16 rounded-2xl font-display text-3xl font-semibold transition focus-visible:outline-4 focus-visible:outline-offset-2 disabled:opacity-40 ${theme.key}`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={back}
            disabled={locked || busy || !pin}
            aria-label="Delete last digit"
            className={`grid h-16 place-items-center rounded-2xl transition focus-visible:outline-4 focus-visible:outline-offset-2 disabled:opacity-40 ${theme.key}`}
          >
            <Delete aria-hidden className="size-7" />
          </button>
          <button
            type="button"
            disabled={locked || busy}
            onClick={() => press("0")}
            className={`h-16 rounded-2xl font-display text-3xl font-semibold transition focus-visible:outline-4 focus-visible:outline-offset-2 disabled:opacity-40 ${theme.key}`}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={locked || busy || !pin}
            aria-label="Unlock"
            className={`grid h-16 place-items-center rounded-2xl font-display text-xl font-bold transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-40 ${theme.go}`}
          >
            {busy ? <LoaderCircle aria-hidden className="size-7 animate-spin" /> : parent ? <KeyRound aria-hidden className="size-7" /> : "Go!"}
          </button>
        </div>

        {parent ? (
          <p className="mt-6 text-center text-sm">
            <Link href="/" className="font-semibold text-slate-400 underline-offset-4 hover:text-white hover:underline">
              Back to the kids&apos; videos
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
