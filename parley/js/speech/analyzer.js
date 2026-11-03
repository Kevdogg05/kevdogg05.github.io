// Speech Analyzer screens: record → analyze → results, plus history.
import { h, topBar, iconBtn, gauge, ring, toast, fmtShort, fmtDate, shuffle, esc, scoreTone, confirmSheet } from '../ui.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as sfx from '../sfx.js';
import { prompts } from '../content/index.js';
import { analyze } from './analysis.js';
import { startRecording, encodeWav, canRecord, canTranscribe } from './recorder.js';
import { putAudio, getAudio, deleteAudio } from './db.js';
import { celebrateBadges } from '../rewards.js';

const MAX_SECONDS = 180;
const CATS = [['all', 'All'], ['intro', 'Intros'], ['story', 'Stories'], ['work', 'Work'], ['opinion', 'Opinions'], ['explain', 'Explain'], ['toast', 'Toasts']];

const CAT_NAME = { intro: 'Intro', story: 'Story', work: 'Work', opinion: 'Opinion', explain: 'Explain', toast: 'Toast' };

const historyBtn = () => iconBtn('history', 'History', () => { location.hash = '#/speech/history'; });

// ------------------------------------------------------------------ main screen
export function speechScreen(root, { mode: initialMode, pid } = {}) {
  let mode = initialMode === 'read' ? 'read' : 'talk';
  let cat = 'all';
  let deck = shuffle(prompts.prompts);
  let prompt = (pid && [...prompts.prompts, ...prompts.passages].find((p) => p.id === pid)) || deck[0];
  if (prompt.kind) mode = 'read';
  let passage = prompt.kind ? prompt : prompts.passages[0];
  if (prompt.kind) prompt = deck[0];
  let rec = null, alive = true, timer = 0;

  const screen = h('div', { class: 'screen speech' });
  root.append(screen);

  function render() {
    const tabs = h('div', { class: 'seg-tabs', role: 'tablist' },
      ...[['talk', 'Free talk'], ['read', 'Read aloud']].map(([k, label]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === k), onclick: () => { mode = k; render(); } }, label)));

    let card;
    if (mode === 'talk') {
      const chips = h('div', { class: 'chip-scroll' }, ...CATS.map(([k, label]) =>
        h('button', { type: 'button', class: `filter ${cat === k ? 'on' : ''}`, onclick: () => { cat = k; deck = shuffle(prompts.prompts.filter((p) => k === 'all' || p.category === k)); prompt = deck[0]; render(); } }, label)));
      card = h('section', { class: 'prompt-card' },
        chips,
        h('div', { class: 'row between' },
          h('span', { class: 'pill lav' }, `${CAT_NAME[prompt.category] || prompt.category} · ${prompt.seconds} sec`),
          iconBtn('shuffle', 'Another prompt', () => { const i = deck.indexOf(prompt); prompt = deck[(i + 1) % deck.length]; render(); })),
        h('p', { class: 'prompt-text' }, prompt.text),
        h('ul', { class: 'tips' }, ...prompt.tips.map((t) => h('li', {}, t))));
    } else {
      const list = prompts.passages;
      card = h('section', { class: 'prompt-card' },
        h('div', { class: 'chip-scroll' }, ...list.map((p) => h('button', { type: 'button', class: `filter ${passage.id === p.id ? 'on' : ''}`, onclick: () => { passage = p; render(); } }, p.title))),
        h('span', { class: 'pill lav' }, passage.kind === 'twister' ? 'Tongue twister' : 'Passage'),
        h('p', { class: `passage-text ${passage.kind}` }, passage.text),
        h('p', { class: 'muted small' }, canTranscribe ? 'Read it out loud at a natural pace. Clarity is scored on how many words come through as written.' : 'Your browser can’t transcribe speech, so clarity will be estimated from the audio.'));
    }

    screen.replaceChildren(
      topBar('Speech Analyzer', { back: '#/practice', right: historyBtn() }),
      h('main', { class: 'pad stack' },
        tabs,
        card,
        h('div', { class: 'record-zone' },
          h('button', { type: 'button', class: 'rec-btn', 'aria-label': 'Start recording', html: icon('mic'), onclick: begin }),
          h('p', { class: 'muted center' }, canRecord ? 'Tap to start. Speak as if someone is listening.' : 'This browser can’t use the microphone. Open Parley in Chrome, Safari, Edge or Firefox over https.')),
        settingsRow(),
        h('p', { class: 'privacy' }, h('span', { html: icon('lock') }), ' Recordings and scores stay on this device.')));
  }

  function settingsRow() {
    if (!canTranscribe) return null;
    const on = store.get().settings.transcribe;
    return h('label', { class: 'switch-row' },
      h('span', {}, h('b', {}, 'Transcribe as I speak'), h('small', {}, 'Counts words and filler words. Uses your browser’s speech recognition, which may send audio to your browser’s provider.')),
      h('input', { type: 'checkbox', role: 'switch', checked: on, onchange: (e) => store.update((s) => { s.settings.transcribe = e.target.checked; }) }));
  }

  async function begin() {
    if (!canRecord) { toast('Microphone not available in this browser', 'bad'); return; }
    const target = mode === 'talk' ? prompt.seconds : Math.max(15, Math.round(passage.text.split(/\s+/).length / 2.4) + 3);
    const levels = [];
    const canvas = h('canvas', { class: 'live-wave', width: 640, height: 140 });
    const live = h('p', { class: 'live-text' });
    const clock = h('div', { class: 'rec-clock' });
    const stopBtn = h('button', { type: 'button', class: 'rec-btn stop', 'aria-label': 'Stop and analyze', html: icon('stop'), onclick: finish });
    screen.replaceChildren(
      topBar('Recording', { onBack: cancel }),
      h('main', { class: 'pad stack recording' },
        h('section', { class: 'prompt-card slim' }, h('p', { class: mode === 'talk' ? 'prompt-text small' : `passage-text ${passage.kind}` }, mode === 'talk' ? prompt.text : passage.text)),
        clock,
        canvas,
        live,
        h('div', { class: 'record-zone' }, stopBtn, h('p', { class: 'muted center' }, 'Tap to stop and see your results'))));
    try {
      rec = await startRecording({
        transcribe: canTranscribe && store.get().settings.transcribe,
        onLevel: (v) => levels.push(v),
        onTranscript: ({ final, interim }) => { live.innerHTML = `${esc(final)} <span class="interim">${esc(interim)}</span>`; live.scrollTop = live.scrollHeight; },
      });
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      toast(denied ? 'Microphone permission was blocked. Allow it in your browser’s site settings.' : 'Couldn’t start the microphone.', 'bad');
      render();
      return;
    }
    sfx.tap();
    const ctx2d = canvas.getContext('2d');
    const draw = () => {
      if (!alive || !rec) return;
      const t = rec.elapsed();
      const pctDone = Math.min(1, t / target);
      clock.innerHTML = `${ring(pctDone, { size: 92, stroke: 7, color: t >= target ? '#7ed957' : '#5ef0ff', track: 'rgba(255,255,255,.18)' })}<span>${fmtShort(t)}</span><small>${t >= target ? 'Target reached' : `Target ${fmtShort(target)}`}</small>`;
      const W = canvas.width, H = canvas.height, n = 64, bw = W / n;
      ctx2d.clearRect(0, 0, W, H);
      const recent = levels.slice(-n);
      recent.forEach((v, i) => {
        const bh = Math.max(4, v * H * 0.95);
        ctx2d.fillStyle = 'rgba(255,255,255,.9)';
        ctx2d.beginPath();
        ctx2d.roundRect?.(i * bw + bw * 0.25, (H - bh) / 2, bw * 0.5, bh, bw * 0.25) ?? ctx2d.rect(i * bw + bw * 0.25, (H - bh) / 2, bw * 0.5, bh);
        ctx2d.fill();
      });
      if (t >= MAX_SECONDS) { finish(); return; }
      timer = requestAnimationFrame(draw);
    };
    draw();
  }

  function cancel() {
    cancelAnimationFrame(timer);
    rec?.cancel();
    rec = null;
    render();
  }

  async function finish() {
    if (!rec) return;
    cancelAnimationFrame(timer);
    const r = rec;
    rec = null;
    screen.replaceChildren(h('div', { class: 'analyzing' }, h('div', { class: 'spinner' }), h('p', {}, 'Analyzing your speech…')));
    const raw = await r.stop();
    await new Promise((res) => setTimeout(res, 50));
    const result = analyze({ pcm: raw.pcm, sr: raw.sr, transcript: raw.transcript, reference: mode === 'read' ? passage.text : null });
    if (!alive) return;
    if (!result.ok) {
      screen.replaceChildren(
        topBar('Speech Analyzer', { back: '#/practice' }),
        h('main', { class: 'pad stack center' },
          h('div', { class: 'empty-art', html: icon('mic') }),
          h('h2', {}, result.reason === 'short' ? 'We didn’t hear enough speech' : 'That was very quiet'),
          h('p', { class: 'muted' }, result.reason === 'short' ? 'Speak for at least ten seconds so there’s enough to analyze.' : 'Move closer to the microphone or speak up a little, then try again.'),
          raw.recognitionError === 'audio-capture' ? h('p', { class: 'muted small' }, 'Tip: on some phones, live transcription takes over the microphone. Turn off “Transcribe as I speak” and try again.') : null,
          h('button', { type: 'button', class: 'btn primary', onclick: render }, 'Try again')));
      return;
    }
    const id = `${Date.now()}`;
    const summary = {
      id, at: Date.now(), mode,
      promptId: mode === 'talk' ? prompt.id : passage.id,
      promptText: mode === 'talk' ? prompt.text : passage.title,
      score: result.score, headline: result.headline, wpm: result.wpm, duration: Math.round(raw.duration),
      metrics: result.metrics, markers: result.markers, bars: result.bars, transcript: result.transcript, notes: result.notes,
      transcribed: raw.transcribed, recognitionError: raw.recognitionError,
    };
    if (raw.transcribed && !result.transcript.length && raw.recognitionError) summary.notes.push(`Live transcription didn’t work (${raw.recognitionError}), so pace was estimated from the audio and filler words were found by sound only.`);
    await putAudio(id, encodeWav(raw.pcm, raw.sr));
    store.update((s) => {
      s.speech.unshift(summary);
      s.speech = s.speech.slice(0, 30);
      store.addXp(15 + (result.score >= 80 ? 5 : 0));
      store.award('first-recording');
      if (result.score >= 80) store.award('score-80');
    });
    location.hash = `#/speech/result/${id}`;
  }

  render();
  return () => { alive = false; cancelAnimationFrame(timer); rec?.cancel(); };
}

// ------------------------------------------------------------------ results
export function speechResultScreen(root, { id }) {
  const r = store.get().speech.find((x) => x.id === id);
  if (!r) { location.hash = '#/speech/history'; return; }
  let audio = null, url = null, raf = 0, alive = true;
  const total = r.duration || 1;

  const playBtn = h('button', { type: 'button', class: 'wave-play', 'aria-label': 'Play recording', html: icon('play'), disabled: true });
  const progress = h('div', { class: 'wave-progress' });
  const tNow = h('span', {}, '0:00'), tLeft = h('span', {}, `-${fmtShort(total)}`);
  const svgBars = waveSvg(r.bars, r.markers, total);
  const waveBox = h('div', { class: 'wave-box', html: svgBars }, progress);
  // keep numbered markers from overlapping (the coloured bar still shows the exact spot)
  let lastLeft = -100;
  const lefts = r.markers.map((m) => { lastLeft = Math.max((m.t / total) * 100, lastLeft + 10); return lastLeft; });
  const shiftBack = Math.max(0, lefts[lefts.length - 1] - 96);
  const markersRow = h('div', { class: 'wave-markers' }, ...r.markers.map((m, i) =>
    h('button', { type: 'button', class: `marker ${m.kind}`, style: { left: `${Math.max(2, lefts[i] - shiftBack)}%` }, 'aria-label': `Moment ${m.n}: ${m.title}`, onclick: () => document.getElementById(`mk-${m.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, String(m.n))));

  waveBox.addEventListener('click', (e) => {
    if (!audio) return;
    const rect = waveBox.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * total, true);
  });

  function seek(t, play = false) {
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(total, t));
    if (play) audio.play();
    paint();
  }
  function paint() {
    if (!audio) return;
    const t = audio.currentTime;
    progress.style.width = `${(t / total) * 100}%`;
    tNow.textContent = fmtShort(t);
    tLeft.textContent = `-${fmtShort(total - t)}`;
    playBtn.innerHTML = icon(audio.paused ? 'play' : 'pause');
    if (!audio.paused && alive) raf = requestAnimationFrame(paint);
  }

  getAudio(id).then((blob) => {
    if (!blob || !alive) { playBtn.title = 'Recording not available'; return; }
    url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.addEventListener('play', paint);
    audio.addEventListener('pause', paint);
    audio.addEventListener('ended', paint);
    playBtn.disabled = false;
    playBtn.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
    screen.querySelectorAll('.listen-at').forEach((b) => { b.disabled = false; });
  });

  const metrics = Object.entries(r.metrics);
  const screen = h('div', { class: 'screen speech' },
    topBar('Speech Analyzer', { back: '#/speech', right: historyBtn() }),
    h('main', { class: 'pad stack' },
      h('section', { class: 'score-card' },
        h('p', { class: 'score-eyebrow' }, 'Your speech score'),
        h('div', { html: gauge(r.score) }),
        h('p', { class: 'score-headline' }, r.headline),
        h('p', { class: 'score-meta' }, `${r.mode === 'read' ? 'Read aloud' : 'Free talk'} · ${fmtShort(r.duration)} · ${r.wpm} words per minute`)),
      ...r.notes.map((n) => h('p', { class: 'note' }, h('span', { html: icon('info') }), ' ', n)),
      h('section', { class: 'card metrics' }, ...metrics.map(([k, m]) => metricRow(k, m))),
      h('section', { class: 'wave-card' },
        h('div', { class: 'wave-head' }, h('b', {}, 'Key moments'), h('small', {}, 'Tap a number or the waveform')),
        markersRow,
        h('div', { class: 'wave-row' }, playBtn, waveBox),
        h('div', { class: 'wave-times' }, tNow, tLeft)),
      ...r.markers.map((m) => h('section', { class: `moment ${m.kind}`, id: `mk-${m.n}` },
        h('div', { class: 'row between' },
          h('span', { class: `moment-tag ${m.kind}` }, h('i', {}, String(m.n)), m.tag),
          h('button', { type: 'button', class: 'listen-at', disabled: true, onclick: () => { seek(Math.max(0, m.t - 0.5), true); document.querySelector('.wave-card').scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, h('span', { html: icon('play') }), ` Listen at ${fmtShort(m.t)}`)),
        h('h3', {}, m.title),
        h('p', { class: 'muted' }, m.body))),
      r.markers.length ? null : h('p', { class: 'muted center' }, 'No standout moments this time: an even, steady take.'),
      r.transcript.length ? h('section', { class: 'card transcript' },
        h('h3', {}, 'Transcript'),
        h('p', {}, ...r.transcript.map((w) => h('button', { type: 'button', class: `word ${w.f ? 'filler' : ''}`, onclick: () => seek(w.t - 0.3, true) }, w.w)))) : null,
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn ghost grow', onclick: () => { location.hash = `#/speech?pid=${r.promptId}`; } }, h('span', { html: icon('refresh') }), ' Same prompt'),
        h('button', { type: 'button', class: 'btn primary grow', onclick: () => { location.hash = '#/speech'; } }, 'New recording'))));
  root.append(screen);
  // stagger the reveal
  screen.querySelectorAll('.metric').forEach((el, i) => setTimeout(() => el.classList.add('in'), 120 + i * 90));
  celebrateBadges();
  return () => { alive = false; cancelAnimationFrame(raf); audio?.pause(); if (url) URL.revokeObjectURL(url); };
}

function metricRow(key, m) {
  const tone = scoreTone(m.score);
  const el = h('button', { type: 'button', class: 'metric', 'aria-expanded': 'false' },
    h('div', { class: 'row between' },
      h('span', { class: 'metric-label' }, m.label),
      h('span', { class: `metric-score ${tone}` }, h('b', {}, String(m.score)), '/100')),
    h('div', { class: 'meter' }, h('span', { class: tone, style: { width: `${m.score}%` } })),
    h('p', { class: 'metric-detail' }, m.detail));
  el.addEventListener('click', () => el.setAttribute('aria-expanded', String(el.getAttribute('aria-expanded') !== 'true')));
  return el;
}

function waveSvg(barsList, markers, total) {
  const n = barsList.length || 1, W = 600, H = 120, bw = W / n;
  const marks = new Map();
  markers.forEach((m) => marks.set(Math.min(n - 1, Math.floor((m.t / total) * n)), m.kind));
  const rects = barsList.map((v, i) => {
    const bh = Math.max(6, v * H * 0.9);
    const k = marks.get(i);
    const fill = k === 'fix' ? '#ff3b3b' : k === 'watch' ? '#ff8a1e' : k === 'good' ? '#1f7a12' : '#fff';
    const wide = k ? bw * 0.7 : bw * 0.45;
    return `<rect x="${(i * bw + (bw - wide) / 2).toFixed(1)}" y="${((H - bh) / 2).toFixed(1)}" width="${wide.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(wide / 2).toFixed(1)}" fill="${fill}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}

// ------------------------------------------------------------------ history
export function speechHistoryScreen(root) {
  const list = store.get().speech;
  const screen = h('div', { class: 'screen speech' }, topBar('Your recordings', { back: '#/speech' }));
  const main = h('main', { class: 'pad stack' });
  screen.append(main);
  root.append(screen);
  if (!list.length) {
    main.append(h('div', { class: 'empty' }, h('div', { class: 'empty-art', html: icon('mic') }), h('h2', {}, 'No recordings yet'), h('p', { class: 'muted' }, 'Record a short answer to get your first speech score.'), h('a', { class: 'btn primary', href: '#/speech' }, 'Start recording')));
    return;
  }
  const recent = list.slice(0, 15).reverse();
  const best = Math.max(...list.map((x) => x.score));
  const avg = Math.round(list.slice(0, 5).reduce((a, x) => a + x.score, 0) / Math.min(5, list.length));
  main.append(
    h('section', { class: 'card trend' },
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('b', {}, String(best)), h('span', {}, 'best score')),
        h('div', { class: 'stat' }, h('b', {}, String(avg)), h('span', {}, 'recent average')),
        h('div', { class: 'stat' }, h('b', {}, String(list.length)), h('span', {}, 'recordings'))),
      recent.length > 1 ? h('div', { class: 'trend-chart', html: trendSvg(recent.map((x) => x.score)) }) : null),
    ...list.map((x) => h('div', { class: 'history-row' },
      h('a', { class: 'history-main', href: `#/speech/result/${x.id}` },
        h('span', { class: `score-dot ${scoreTone(x.score)}` }, String(x.score)),
        h('span', { class: 'grow' }, h('b', {}, x.headline), h('small', {}, `${x.promptText} · ${fmtDate(x.at)}`)),
        h('span', { html: icon('chevron') })),
      iconBtn('trash', 'Delete recording', async () => {
        if (!(await confirmSheet({ title: 'Delete this recording?', body: 'Its score and audio will be removed from this device.', ok: 'Delete', danger: true }))) return;
        await deleteAudio(x.id);
        store.update((s) => { s.speech = s.speech.filter((y) => y.id !== x.id); });
        root.replaceChildren();
        speechHistoryScreen(root);
      }, 'subtle'))));
}

function trendSvg(scores) {
  const W = 300, H = 90, n = scores.length;
  const pts = scores.map((s, i) => [10 + (i * (W - 20)) / Math.max(1, n - 1), H - 10 - (s / 100) * (H - 20)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score trend: ${scores.join(', ')}">
    <path d="M10 ${H - 10 - 0.75 * (H - 20)}H${W - 10}" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="4 4"/>
    <path d="${d}" fill="none" stroke="#3aa0ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#3aa0ff"/>`).join('')}
  </svg>`;
}

