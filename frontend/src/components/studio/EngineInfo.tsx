import { Cpu } from "lucide-react";
import { Panel } from "./Panel";
import type { BackendState } from "@/hooks/useBackend";
import type { ComponentStatus } from "@/lib/api";

export function EngineInfo({ backend }: { backend: BackendState }) {
  if (backend.status !== "online") {
    return (
      <Panel icon={Cpu} title="Render engines">
        <p className="text-xs leading-relaxed text-zinc-500">
          {backend.status === "connecting" ? (
            "Checking the backend…"
          ) : (
            <>
              The API is not reachable. Start it with{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-zinc-300">./dev.sh</code> or{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-zinc-300">
                uvicorn main:app --reload
              </code>{" "}
              in <code className="font-mono text-zinc-300">backend/</code>.
            </>
          )}
        </p>
      </Panel>
    );
  }
  const { tts, lipsync, ffmpeg, version } = backend.health;
  return (
    <Panel
      icon={Cpu}
      title="Render engines"
      aside={<span className="font-mono text-[11px] text-zinc-500">API v{version}</span>}
    >
      <dl className="grid gap-2 text-xs sm:grid-cols-3">
        <EngineRow label="Voice" component={tts} />
        <EngineRow label="Lip-sync" component={lipsync} />
        <EngineRow label="Encoder" component={ffmpeg} />
      </dl>
    </Panel>
  );
}

function EngineRow({ label, component }: { label: string; component: ComponentStatus }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-zinc-950/50 px-3 py-2.5">
      <dt className="flex items-center justify-between gap-2 text-zinc-500">
        {label}
        <span
          className={`size-1.5 rounded-full ${component.ready ? "bg-emerald-400" : "bg-amber-400"}`}
          title={component.ready ? "Ready" : "Not ready"}
        />
      </dt>
      <dd className="mt-0.5 font-mono text-[13px] text-zinc-100">{component.name}</dd>
      <dd className="mt-0.5 truncate text-zinc-500" title={component.detail}>
        {component.detail}
      </dd>
    </div>
  );
}
