"use client";

import { useEffect, useState } from "react";
import { AvatarUploader } from "./AvatarUploader";
import { ControlBar } from "./ControlBar";
import { EngineInfo } from "./EngineInfo";
import { Header } from "./Header";
import { PipelineSteps } from "./PipelineSteps";
import { PreviewPlayer } from "./PreviewPlayer";
import { ScriptEditor } from "./ScriptEditor";
import { VoiceSelector } from "./VoiceSelector";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useBackend } from "@/hooks/useBackend";
import { useGenerationJob } from "@/hooks/useGenerationJob";
import { api } from "@/lib/api";

export function Studio() {
  const { state: backend, retry } = useBackend();
  const avatar = useAvatarUpload();
  const { job, connectionError, track } = useGenerationJob();

  const [script, setScript] = useState("");
  const [voiceChoice, setVoiceChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const online = backend.status === "online";
  const voices = online ? backend.voices.voices : [];
  // Default to the first voice until the user picks one.
  const voiceId =
    voiceChoice && voices.some((v) => v.id === voiceChoice) ? voiceChoice : (voices[0]?.id ?? "");

  const running = job?.status === "queued" || job?.status === "running";
  const busy = submitting || running;

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [busy]);

  const elapsedSeconds =
    job && !running
      ? (Date.parse(job.updated_at) - Date.parse(job.created_at)) / 1000
      : startedAt != null
        ? Math.max(0, (now - startedAt) / 1000)
        : null;

  const blocker =
    backend.status === "connecting"
      ? "Connecting to the backend…"
      : backend.status === "offline"
        ? "The backend is offline: start it, then click “Backend offline” to reconnect."
        : !script.trim()
          ? "Add a script to get started."
          : !voiceId
            ? "Choose a voice."
            : avatar.state.status === "uploading"
              ? "Waiting for the avatar upload to finish…"
              : avatar.state.status !== "ready"
                ? "Upload an avatar image."
                : null;
  const canGenerate = !busy && blocker === null;

  const generate = async () => {
    if (!canGenerate || avatar.state.status !== "ready") return;
    const start = Date.now();
    setSubmitting(true);
    setSubmitError(null);
    setStartedAt(start);
    setNow(start);
    try {
      track(
        await api.generate({
          script,
          voice_id: voiceId,
          avatar_id: avatar.state.uploaded.avatar_id,
        }),
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setStartedAt(null);
    } finally {
      setSubmitting(false);
    }
  };

  const previewUrl = avatar.state.status === "empty" ? null : avatar.state.previewUrl;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header backend={backend} onRetry={retry} />

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 p-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-6 lg:p-6">
        <aside className="flex flex-col gap-4" aria-label="Video settings">
          <ScriptEditor value={script} onChange={setScript} onSubmitShortcut={generate} disabled={busy} />
          <VoiceSelector
            voices={voices}
            provider={online ? backend.voices.provider : null}
            value={voiceId}
            onChange={setVoiceChoice}
            loading={backend.status === "connecting"}
            error={online ? backend.voicesError : null}
            disabled={busy}
          />
          <AvatarUploader
            state={avatar.state}
            onSelect={avatar.select}
            onClear={avatar.clear}
            disabled={busy}
          />
        </aside>

        <section className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20" aria-label="Preview">
          <PreviewPlayer job={job} avatarPreviewUrl={previewUrl} connectionError={connectionError} />
          <PipelineSteps job={job} />
          <EngineInfo backend={backend} />
        </section>
      </main>

      <ControlBar
        job={job}
        busy={busy}
        canGenerate={canGenerate}
        blocker={blocker}
        submitError={submitError}
        elapsedSeconds={elapsedSeconds}
        onGenerate={generate}
      />
    </div>
  );
}
