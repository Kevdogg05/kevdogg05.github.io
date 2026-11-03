// Microphone capture: raw PCM for analysis, live levels for the waveform, and an
// optional live transcript from the browser's speech recognition.
export const TARGET_SR = 16000;

const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canTranscribe = !!Recognition;
export const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * Start recording. Returns { stop(): Promise<result>, cancel() }.
 * onLevel(0..1) is called ~30×/s; onTranscript({ final, interim }) as words arrive.
 */
export async function startRecording({ transcribe = true, onLevel, onTranscript } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);

  const chunks = [];
  let node = null, workletUrl = null;
  const mute = ctx.createGain();
  mute.gain.value = 0;
  try {
    workletUrl = new URL('./capture-worklet.js', import.meta.url).href;
    await ctx.audioWorklet.addModule(workletUrl);
    node = new AudioWorkletNode(ctx, 'parley-capture');
    node.port.onmessage = (e) => chunks.push(e.data);
  } catch {
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  }
  src.connect(node);
  node.connect(mute).connect(ctx.destination);

  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;

  // live level meter
  const td = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(td);
    let s = 0;
    for (let i = 0; i < td.length; i++) { const v = (td[i] - 128) / 128; s += v * v; }
    onLevel?.(Math.min(1, Math.sqrt(s / td.length) * 4));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // live transcript
  const segments = [];
  let recognition = null, recogError = '', listening = false, active = true;
  const firstSeen = new Map();
  let session = 0;
  if (transcribe && Recognition) {
    const begin = () => {
      try {
        recognition = new Recognition();
        recognition.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        const my = ++session;
        recognition.onresult = (e) => {
          const now = elapsed();
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i], key = `${my}:${i}`, text = r[0].transcript.trim();
            if (!firstSeen.has(key)) firstSeen.set(key, Math.max(0, now - 0.6 - text.split(/\s+/).length / 3));
            if (r.isFinal) {
              if (!text) continue;
              const seg = { text, start: firstSeen.get(key), end: Math.max(firstSeen.get(key) + 0.3, now - 0.4), confidence: r[0].confidence || 0 };
              // Some Android builds repeat the whole utterance in each final result.
              const last = segments[segments.length - 1];
              const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
              if (last && last.session === my && norm(text).startsWith(norm(last.text))) Object.assign(last, seg, { start: last.start });
              else segments.push({ ...seg, session: my });
            } else interim += text + ' ';
          }
          onTranscript?.({ final: segments.map((s) => s.text).join(' '), interim: interim.trim() });
        };
        recognition.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') recogError = e.error; };
        recognition.onend = () => { listening = false; if (active && !['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(recogError)) setTimeout(() => active && begin(), 150); };
        recognition.start();
        listening = true;
      } catch (err) {
        recogError = err.message || 'unavailable';
      }
    };
    begin();
  }

  const cleanup = () => {
    active = false;
    cancelAnimationFrame(raf);
    try { recognition?.abort(); } catch { /* already stopped */ }
    stream.getTracks().forEach((t) => t.stop());
    try { node.disconnect(); src.disconnect(); } catch { /* ignore */ }
    ctx.close?.();
  };

  return {
    elapsed,
    cancel: cleanup,
    async stop() {
      const duration = elapsed();
      // let the recognizer deliver its last words
      if (recognition && listening) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1500);
          recognition.onend = () => { clearTimeout(timer); resolve(); };
          try { recognition.stop(); } catch { resolve(); }
        });
      }
      if (node.port) node.port.postMessage('flush');
      await new Promise((r) => setTimeout(r, 120));
      const sr = ctx.sampleRate;
      cleanup();
      const pcm = resample(concat(chunks), sr, TARGET_SR);
      return { pcm, sr: TARGET_SR, duration, transcript: segments.map(({ session: _s, ...s }) => s), recognitionError: recogError, transcribed: !!recognition };
    },
  };
}

function concat(chunks) {
  const out = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Box-filter + linear-interpolation resampler (good enough for speech analysis). */
export function resample(x, from, to) {
  if (from === to) return x;
  const ratio = from / to;
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  const half = Math.max(0, Math.floor(ratio / 2));
  for (let i = 0; i < n; i++) {
    const c = i * ratio, k = Math.floor(c);
    let s = 0, cnt = 0;
    for (let j = k - half; j <= k + half; j++) if (j >= 0 && j < x.length) { s += x[j]; cnt++; }
    out[i] = cnt ? s / cnt : 0;
  }
  return out;
}

/** 16-bit mono WAV blob. */
export function encodeWav(pcm, sr) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  // normalise quiet recordings for playback
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const gain = peak > 0 && peak < 0.5 ? Math.min(6, 0.8 / peak) : 1;
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i] * gain)) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}
