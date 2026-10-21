import { BookOpen, RefreshCw, ScanFace } from "lucide-react";
import type { BackendState } from "@/hooks/useBackend";
import { apiBase } from "@/lib/api";

interface HeaderProps {
  backend: BackendState;
  onRetry: () => void;
}

export function Header({ backend, onRetry }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
            <ScanFace className="size-4.5 text-white" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            OpenAvatar<span className="text-violet-400">Studio</span>
          </span>
          <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400 sm:inline">
            Self-hosted
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <BackendStatus backend={backend} onRetry={onRetry} />
          {backend.status === "online" && (
            <a
              href={`${apiBase()}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 md:flex"
            >
              <BookOpen className="size-3.5" aria-hidden />
              API docs
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function BackendStatus({ backend, onRetry }: HeaderProps) {
  if (backend.status === "connecting") {
    return <StatusPill tone="amber" label="Connecting to backend…" />;
  }
  if (backend.status === "offline") {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={backend.error}
        className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-medium text-red-300 transition hover:bg-red-500/20"
      >
        <span className="size-1.5 rounded-full bg-red-400" />
        Backend offline
        <RefreshCw className="size-3" aria-hidden />
      </button>
    );
  }
  const { tts, lipsync } = backend.health;
  return (
    <div className="flex items-center gap-2">
      <StatusPill tone="green" label="Backend online" />
      <span className="hidden items-center gap-1.5 lg:flex">
        <EngineChip label="Voice" component={tts} />
        <EngineChip label="Lip-sync" component={lipsync} />
      </span>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: "green" | "amber"; label: string }) {
  const styles =
    tone === "green"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : "border-amber-500/25 bg-amber-500/10 text-amber-300";
  const dot = tone === "green" ? "bg-emerald-400" : "bg-amber-400 animate-pulse";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${styles}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function EngineChip({
  label,
  component,
}: {
  label: string;
  component: { name: string; ready: boolean; detail: string };
}) {
  return (
    <span
      title={component.detail}
      className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
        component.ready
          ? "border-white/10 bg-white/[0.03] text-zinc-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      }`}
    >
      {label}: {component.name}
      {!component.ready && " (not ready)"}
    </span>
  );
}
