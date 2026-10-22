"use client";

import { useRef, useState } from "react";
import { AnimationPanel } from "./AnimationPanel";
import { AvatarUploader } from "./AvatarUploader";
import { ControlBar } from "./ControlBar";
import { EngineInfo } from "./EngineInfo";
import { Header } from "./Header";
import { PipelineSteps } from "./PipelineSteps";
import { PreviewPlayer } from "./PreviewPlayer";
import { ScriptEditor } from "./ScriptEditor";
import { VideoLibrary } from "./VideoLibrary";
import { VoiceSelector } from "./VoiceSelector";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useBackend } from "@/hooks/useBackend";
import { useLibrary } from "@/hooks/useLibrary";
import { api, type Job } from "@/lib/api";
import { estimateSpeechSeconds } from "@/lib/format";

export function Studio() {
  const { state: backend, retry } = useBackend();
  const avatar = useAvatarUpload();
  const { library, error: libraryError, refresh } = useLibrary();
  const previewRef = useRef<HTMLElement>(null);

  const [script, setScript] = useState("");
  const [voiceChoice, setVoiceChoice] = useState<string | null>(null);
  const [engineChoice, setEngineChoice] = useState<string | null>(null);
  const [headMotion, setHeadMotion] = useState(true);
  const [enhance, setEnhance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const online = backend.status === "online";
  const voices = online ? backend.voices.voices : [];
  // Default to the first voice until the user picks one.
  const voiceId =
    voiceChoice && voices.some((v) => v.id === voiceChoice) ? voiceChoice : (voices[0]?.id ?? "");
  const health = online ? backend.health : null;
  // The backend's default engine until the user picks one.
  const engineId = engineChoice ?? health?.lipsync.name ?? "";
  const engine = health?.engines.find((e) => e.name === engineId);
  const engineLabels = Object.fromEntries((health?.engines ?? []).map((e) => [e.name, e.label]));

  // The video shown in the preview: picked in the library, or the latest submitted.
  const job = library?.jobs.find((j) => j.job_id === selectedJobId) ?? null;

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
                : !engine?.ready
                  ? `${engine?.label ?? "The animation engine"} isn't installed: ${engine?.detail ?? ""}`
                  : enhance && !health?.enhancer.ready
                    ? "Face enhancement isn't installed yet."
                    : null;
  const canGenerate = !submitting && blocker === null;

  const generate = async () => {
    if (!canGenerate || avatar.state.status !== "ready") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await api.generate({
        script,
        voice_id: voiceId,
        avatar_id: avatar.state.uploaded.avatar_id,
        engine: engineId,
        enhance,
        head_motion: headMotion && Boolean(engine?.supports_head_motion),
      });
      setSelectedJobId(created.job_id);
      refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      refresh();
    }
  };

  const selectJob = (selected: Job) => {
    setSelectedJobId(selected.job_id);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const cancelJob = (target: Job) => runAction(() => api.cancelJob(target.job_id).then(() => undefined));
  const retryJob = (target: Job) =>
    runAction(async () => {
      const created = await api.retryJob(target.job_id);
      setSelectedJobId(created.job_id);
    });
  const deleteJob = (target: Job) => {
    if (!window.confirm("Delete this video and its files? This can't be undone.")) return;
    void runAction(async () => {
      await api.deleteJob(target.job_id);
      if (target.job_id === selectedJobId) setSelectedJobId(null);
    });
  };

  const previewUrl = avatar.state.status === "empty" ? null : avatar.state.previewUrl;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header backend={backend} onRetry={retry} />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {/* Its own grid, so the sticky preview stops before the library below. */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-6">
          <aside className="flex flex-col gap-4" aria-label="Video settings">
            <ScriptEditor value={script} onChange={setScript} onSubmitShortcut={generate} />
            <VoiceSelector
              voices={voices}
              provider={online ? backend.voices.provider : null}
              value={voiceId}
              onChange={setVoiceChoice}
              loading={backend.status === "connecting"}
              error={online ? backend.voicesError : null}
            />
            <AvatarUploader state={avatar.state} onSelect={avatar.select} onClear={avatar.clear} />
            <AnimationPanel
              health={health}
              engineId={engineId}
              onEngineChange={setEngineChoice}
              headMotion={headMotion}
              onHeadMotionChange={setHeadMotion}
              enhance={enhance}
              onEnhanceChange={setEnhance}
              videoSeconds={estimateSpeechSeconds(script)}
            />
          </aside>

          <section ref={previewRef} className="flex min-w-0 scroll-mt-20 flex-col gap-4 lg:sticky lg:top-20" aria-label="Preview">
            <PreviewPlayer
              job={job}
              avatarPreviewUrl={previewUrl}
              connectionError={job ? libraryError : null}
              onRetry={retryJob}
            />
            <PipelineSteps
              job={job}
              enhance={job ? job.enhance : enhance && Boolean(health?.enhancer.ready)}
              animator={(job ? health?.engines.find((e) => e.name === job.engine) : engine)?.label}
            />
            <EngineInfo backend={backend} />
          </section>
        </div>

        <section className="min-w-0" aria-label="Video library">
          <VideoLibrary
            library={library}
            error={libraryError}
            actionError={actionError}
            selectedJobId={selectedJobId}
            engineLabels={engineLabels}
            onSelect={selectJob}
            onCancel={cancelJob}
            onRetry={retryJob}
            onDelete={deleteJob}
          />
        </section>
      </main>

      <ControlBar
        job={job}
        submitting={submitting}
        queued={library?.active ?? 0}
        canGenerate={canGenerate}
        blocker={blocker}
        submitError={submitError}
        onGenerate={generate}
        onCancel={cancelJob}
      />
    </div>
  );
}
