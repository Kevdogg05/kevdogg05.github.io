import { FileText } from "lucide-react";
import { Panel } from "./Panel";
import { countWords, estimateSpeechSeconds, formatDuration } from "@/lib/format";

export const MAX_SCRIPT_CHARS = 5000;

const SAMPLE_SCRIPT =
  "Hi there! I'm your new AI presenter, generated entirely on your own hardware with OpenAvatarStudio. " +
  "Type any script, pick a voice, upload a portrait, and I'll turn it into a talking video in minutes.";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmitShortcut: () => void;
  disabled?: boolean;
}

export function ScriptEditor({ value, onChange, onSubmitShortcut, disabled }: ScriptEditorProps) {
  const words = countWords(value);
  const nearLimit = value.length > MAX_SCRIPT_CHARS * 0.9;

  return (
    <Panel
      icon={FileText}
      title="Script"
      aside={
        !value && (
          <button
            type="button"
            onClick={() => onChange(SAMPLE_SCRIPT)}
            className="text-xs font-medium text-violet-300 transition hover:text-violet-200"
          >
            Use sample
          </button>
        )
      }
    >
      <label htmlFor="script" className="sr-only">
        Video script
      </label>
      <textarea
        id="script"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmitShortcut();
          }
        }}
        disabled={disabled}
        maxLength={MAX_SCRIPT_CHARS}
        rows={9}
        placeholder="Write what your avatar should say…"
        className="block w-full resize-y rounded-xl border border-white/[0.08] bg-zinc-950/70 px-3.5 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {words} {words === 1 ? "word" : "words"} · ~{formatDuration(estimateSpeechSeconds(value))} spoken
        </span>
        <span className={nearLimit ? "text-amber-400" : undefined}>
          {value.length.toLocaleString()} / {MAX_SCRIPT_CHARS.toLocaleString()}
        </span>
      </div>
    </Panel>
  );
}
