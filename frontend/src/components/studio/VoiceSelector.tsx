import { AudioLines, ChevronDown } from "lucide-react";
import { Panel } from "./Panel";
import type { Voice } from "@/lib/api";

interface VoiceSelectorProps {
  voices: Voice[];
  provider: string | null;
  value: string;
  onChange: (voiceId: string) => void;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
}

export function VoiceSelector({
  voices,
  provider,
  value,
  onChange,
  loading,
  error,
  disabled,
}: VoiceSelectorProps) {
  const selected = voices.find((v) => v.id === value);

  return (
    <Panel
      icon={AudioLines}
      title="Voice"
      aside={
        provider && (
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
            {provider}
          </span>
        )
      }
    >
      <label htmlFor="voice" className="sr-only">
        Voice
      </label>
      <div className="relative">
        <select
          id="voice"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading || voices.length === 0}
          className="block w-full appearance-none rounded-xl border border-white/[0.08] bg-zinc-950/70 py-2.5 pr-10 pl-3.5 text-sm text-zinc-100 outline-none transition focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
        >
          {loading && <option value="">Loading voices…</option>}
          {!loading && voices.length === 0 && <option value="">No voices available</option>}
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
              {voice.description ? ` — ${voice.description}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      ) : (
        selected && <p className="mt-2 text-xs text-zinc-500">{selected.description}</p>
      )}
    </Panel>
  );
}
