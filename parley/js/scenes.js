// Interactive video scenarios: two animated characters act out a scene with voices
// and captions; at decision points you choose how to continue (autoplays in 10 s).
import { h, topBar, fmtTime, sheet, confetti } from './ui.js';
import { icon } from './icons.js';
import { avatarSvg, setMood } from './avatar.js';
import { backdrop } from './backdrops.js';
import * as store from './store.js';
import * as tts from './tts.js';
import * as sfx from './sfx.js';
import { ask } from './quiz.js';
import { scenarios } from './content/index.js';
import { celebrateBadges } from './rewards.js';

const SPEEDS = [0.75, 1, 1.25, 1.5];
const OUTCOME = { good: { label: 'Strong outcome', cls: 'good', xp: 25 }, mixed: { label: 'Mixed outcome', cls: 'ok', xp: 15 }, poor: { label: 'Missed connection', cls: 'bad', xp: 10 } };
const endingsOf = (sc) => Object.entries(sc.nodes).filter(([, n]) => n.end).map(([id]) => id);
const words = (s) => s.split(/\s+/).length;

function thumb(sc, cls = '') {
  return `<span class="scene-thumb ${cls}">${backdrop(sc.scene)}${avatarSvg(sc.cast.A.avatar, { mood: 'smile', cls: 'th-a' })}${avatarSvg(sc.cast.B.avatar, { mood: 'neutral', cls: 'th-b' })}<span class="th-play">${icon('play')}</span></span>`;
}

// ------------------------------------------------------------------ list
export function scenariosListScreen(root) {
  const prog = store.get().scenarios;
  root.append(h('div', { class: 'screen' },
    topBar('Scenarios', { back: '#/practice' }),
    h('main', { class: 'pad stack' },
      h('section', { class: 'hero-banner' },
        h('h2', { class: 'display' }, 'Practice real-life', h('br'), h('span', { class: 'accent' }, 'Scenarios')),
        h('p', {}, 'Watch a moment play out, then choose how it continues. Find every ending.')),
      ...scenarios.map((sc) => {
        const p = prog[sc.id];
        const ends = endingsOf(sc);
        return h('a', { class: 'scene-card', href: `#/scenario/${sc.id}` },
          h('span', { html: thumb(sc) }),
          h('span', { class: 'scene-card-body' },
            h('span', { class: 'pill lav' }, sc.skill),
            h('b', {}, sc.title),
            h('small', {}, sc.summary),
            h('span', { class: 'scene-progress' }, `${p?.endings?.length || 0}/${ends.length} endings found`, p?.best ? h('span', { class: `outcome-dot ${OUTCOME[p.best].cls}` }) : null)));
      }))));
}

// ------------------------------------------------------------------ player
export function scenarioScreen(root, { id }) {
  const sc = scenarios.find((s) => s.id === id);
  if (!sc) { location.hash = '#/scenarios'; return; }
  let alive = true;
  let path = [sc.start];
  let timeline = [];          // { node, who, line, mood, start, dur }
  let cur = 0, clock = 0, playing = false, speechDone = true, spoke = false, waitingChoice = false, ended = false;
  let raf = 0, last = 0, hideTimer = 0, countdown = 0, beatToken = 0;
  const speed = () => store.get().settings.rate || 1;
  const voiceOn = () => store.get().settings.voice && tts.supported;

  // ---------- stage
  const avA = avatarSvg(sc.cast.A.avatar, { mood: 'neutral', cls: 'actor-a', title: sc.cast.A.name });
  const avB = avatarSvg(sc.cast.B.avatar, { mood: 'neutral', cls: 'actor-b', title: sc.cast.B.name });
  const cam = h('div', { class: 'cam', html: backdrop(sc.scene) + avA + avB });
  const elA = cam.querySelector('.actor-a'), elB = cam.querySelector('.actor-b');
  const caption = h('div', { class: 'caption' });
  const bigBtn = h('button', { type: 'button', class: 'v-btn big', 'aria-label': 'Play', html: icon('play'), onclick: (e) => { e.stopPropagation(); toggle(); } });
  const center = h('div', { class: 'v-center' },
    h('button', { type: 'button', class: 'v-btn', 'aria-label': 'Back 15 seconds', html: icon('back15'), onclick: (e) => { e.stopPropagation(); seek(clock - 15); } }),
    bigBtn,
    h('button', { type: 'button', class: 'v-btn', 'aria-label': 'Forward 15 seconds', html: icon('fwd15'), onclick: (e) => { e.stopPropagation(); seek(clock + 15); } }));
  const bar = h('div', { class: 'v-bar' }, h('i'));
  const time = h('span', { class: 'v-time' });
  const speedBtn = h('button', { type: 'button', class: 'v-mini', 'aria-label': 'Playback speed', onclick: (e) => { e.stopPropagation(); cycleSpeed(); } }, h('span', { html: icon('gauge') }), h('small', {}, `${speed()}x`));
  const fsBtn = h('button', { type: 'button', class: 'v-mini', 'aria-label': 'Fullscreen', html: icon('expand'), onclick: (e) => { e.stopPropagation(); fullscreen(); } });
  const voiceBtn = h('button', { type: 'button', class: 'v-mini', 'aria-label': 'Voices on or off', html: icon(store.get().settings.voice ? 'volume' : 'mute'), onclick: (e) => { e.stopPropagation(); toggleVoice(); } });
  const bottom = h('div', { class: 'v-bottom' },
    h('div', { class: 'row between' }, h('span'), time),
    bar,
    h('div', { class: 'row between' }, speedBtn, h('span', { class: 'row gap-s' }, voiceBtn, fsBtn)));
  const overlay = h('div', { class: 'v-overlay' });
  const titleEl = h('div', { class: 'v-title' }, h('span', { class: 'pill glass' }, sc.skill), h('b', {}, sc.title));
  const stage = h('section', { class: 'video controls-on' }, cam, titleEl, center, caption, overlay, bottom);
  stage.addEventListener('click', () => showControls());
  bar.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = bar.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * totalDuration());
  });

  const screen = h('div', { class: 'screen scenario' },
    topBar(sc.title, { back: '#/scenarios' }),
    stage,
    h('div', { class: 'scene-info pad' },
      h('p', { class: 'muted' }, sc.summary),
      h('div', { class: 'cast' },
        ...['A', 'B'].map((k) => h('span', { class: 'cast-chip' }, h('span', { class: 'av-badge', style: { width: '36px', height: '36px' }, html: avatarSvg(sc.cast[k].avatar, { mood: 'smile' }) }), sc.cast[k].name)))));
  root.append(screen);

  // ---------- timeline
  function rebuild() {
    timeline = [];
    let t = 0;
    for (const nid of path) {
      for (const b of sc.nodes[nid].beats) {
        const dur = (words(b.line) / 2.6 + 0.6) / speed();
        timeline.push({ node: nid, ...b, start: t, dur });
        t += dur;
      }
    }
  }
  function projected() {
    let t = 0, nid = path[path.length - 1];
    const seen = new Set(path);
    for (;;) {
      const n = sc.nodes[nid];
      const nx = n.next || n.choices?.[0]?.next;
      if (!nx || seen.has(nx)) break;
      seen.add(nx);
      nid = nx;
      t += sc.nodes[nid].beats.reduce((a, b) => a + (words(b.line) / 2.6 + 0.6) / speed(), 0);
    }
    return t;
  }
  const pathEnd = () => (timeline.length ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].dur : 0);
  const totalDuration = () => pathEnd() + projected();

  // ---------- playback
  function startBeat(i, at = null) {
    cur = i;
    const b = timeline[i];
    clock = at ?? b.start;
    const token = ++beatToken;
    caption.replaceChildren(
      h('small', {}, b.who === 'N' ? 'Narrator' : sc.cast[b.who].name),
      h('p', { class: b.who === 'N' ? 'narr' : '' }, b.line));
    caption.classList.add('show');
    cam.dataset.focus = b.who;
    elA.classList.toggle('talking', b.who === 'A');
    elB.classList.toggle('talking', b.who === 'B');
    if (b.who !== 'N') setMood(b.who === 'A' ? elA : elB, b.mood || 'neutral');
    tts.cancel();
    spoke = false;
    if (voiceOn() && playing) {
      speechDone = false;
      const kind = b.who === 'N' ? 'n' : sc.cast[b.who].avatar.voice;
      tts.speak(b.line, { kind, rate: speed() }).then((res) => {
        if (token !== beatToken) return;
        speechDone = true;
        spoke = res.ok;
        if (res.ok) { elA.classList.remove('talking'); elB.classList.remove('talking'); }
      });
    } else speechDone = true;
  }

  function loop(ts) {
    if (!alive) return;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    if (playing && timeline.length) {
      const b = timeline[cur];
      const end = b.start + b.dur;
      clock += dt;
      if (voiceOn() && !speechDone) clock = Math.min(clock, end - 0.05);      // wait for the voice
      else if (voiceOn() && spoke) clock = Math.max(clock, end - 0.3);       // voice finished early: move on
      else if (clock > end - 0.35) { elA.classList.remove('talking'); elB.classList.remove('talking'); }   // timed captions
      if (clock >= end) {
        if (cur + 1 < timeline.length) startBeat(cur + 1);
        else nodeDone();
      }
    }
    paintTime();
    raf = requestAnimationFrame(loop);
  }

  function paintTime() {
    const total = totalDuration();
    time.innerHTML = `<b>${fmtTime(clock)}</b> / ${fmtTime(total)}`;
    bar.firstChild.style.width = `${total ? Math.min(100, (clock / total) * 100) : 0}%`;
  }

  function play() {
    if (ended || waitingChoice) return;
    if (!timeline.length) rebuild();
    playing = true;
    bigBtn.innerHTML = icon('pause');
    bigBtn.setAttribute('aria-label', 'Pause');
    startBeat(cur, clock > timeline[cur].start ? timeline[cur].start : null);
    showControls();
  }
  function pause() {
    playing = false;
    tts.cancel();
    elA.classList.remove('talking'); elB.classList.remove('talking');
    bigBtn.innerHTML = icon('play');
    bigBtn.setAttribute('aria-label', 'Play');
    stage.classList.add('controls-on');
    clearTimeout(hideTimer);
  }
  function toggle() { playing ? pause() : play(); }

  function seek(t) {
    if (waitingChoice || ended) return;
    if (t >= pathEnd() - 0.05) {
      // can't skip past a decision: jump straight to it (or to the ending)
      tts.cancel();
      cur = timeline.length - 1;
      nodeDone();
      showControls();
      return;
    }
    const target = Math.max(0, t);
    const i = Math.max(0, timeline.findIndex((b) => target >= b.start && target < b.start + b.dur));
    clock = timeline[i].start;
    if (playing) startBeat(i); else { cur = i; startBeat(i); }
    showControls();
  }

  function cycleSpeed() {
    const s = SPEEDS[(SPEEDS.indexOf(speed()) + 1) % SPEEDS.length] || 1;
    const frac = timeline.length ? (clock - timeline[cur].start) / timeline[cur].dur : 0;
    store.update((st) => { st.settings.rate = s; });
    speedBtn.querySelector('small').textContent = `${s}x`;
    rebuild();
    if (timeline.length) {
      clock = timeline[cur].start + frac * timeline[cur].dur;
      if (playing) startBeat(cur);
    }
  }

  function toggleVoice() {
    store.update((s) => { s.settings.voice = !s.settings.voice; });
    voiceBtn.innerHTML = icon(store.get().settings.voice ? 'volume' : 'mute');
    if (!store.get().settings.voice) { tts.cancel(); speechDone = true; } else if (playing) startBeat(cur);
  }

  function fullscreen() {
    const el = stage;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => stage.classList.toggle('pseudo-fs'));
    else stage.classList.toggle('pseudo-fs');
  }
  const onFs = () => { fsBtn.innerHTML = icon(document.fullscreenElement ? 'shrink' : 'expand'); };
  document.addEventListener('fullscreenchange', onFs);

  function showControls() {
    stage.classList.add('controls-on');
    clearTimeout(hideTimer);
    if (playing) hideTimer = setTimeout(() => stage.classList.remove('controls-on'), 2800);
  }

  // ---------- branching
  function nodeDone() {
    const node = sc.nodes[path[path.length - 1]];
    clock = pathEnd();
    if (node.next) {
      path.push(node.next);
      rebuild();
      startBeat(cur + 1);
    } else if (node.choices) {
      showChoices(node.choices);
    } else {
      showEnding(path[path.length - 1], node.end);
    }
  }

  function showChoices(choices) {
    waitingChoice = true;
    playing = false;
    tts.cancel();
    elA.classList.remove('talking'); elB.classList.remove('talking');
    stage.classList.add('controls-on', 'choosing');
    bigBtn.innerHTML = icon('play');
    const auto = store.get().settings.autoplay;
    let left = 10;
    const sub = h('small', {}, auto ? `Autoplays in ${left}s` : 'Pick one to continue');
    overlay.replaceChildren(h('div', { class: 'choices' },
      h('b', {}, 'Choose how to continue'), sub,
      ...choices.map((c, i) => h('button', { type: 'button', class: 'choice-card', onclick: (e) => { e.stopPropagation(); pick(c); } },
        h('span', { html: thumb(sc, i % 2 ? 'flip' : '') }), h('span', {}, c.label)))));
    overlay.classList.add('show');
    if (voiceOn()) tts.speak('Choose how to continue.', { kind: 'n' });
    clearInterval(countdown);
    if (auto) countdown = setInterval(() => {
      left--;
      sub.textContent = `Autoplays in ${left}s`;
      if (left <= 0) pick(choices[0]);
    }, 1000);
  }

  function pick(c) {
    clearInterval(countdown);
    sfx.tap();
    tts.cancel();
    overlay.classList.remove('show');
    stage.classList.remove('choosing');
    waitingChoice = false;
    path.push(c.next);
    const startIdx = timeline.length;
    rebuild();
    playing = true;
    bigBtn.innerHTML = icon('pause');
    startBeat(startIdx);
    showControls();
  }

  function showEnding(nodeId, end) {
    ended = true;
    playing = false;
    bigBtn.innerHTML = icon('play');
    bigBtn.setAttribute('aria-label', 'Play');
    stage.classList.add('ended');
    elA.classList.remove('talking'); elB.classList.remove('talking');
    const o = OUTCOME[end.outcome];
    const all = endingsOf(sc);
    const prev = store.get().scenarios[sc.id];
    const found = new Set([...(prev?.endings || []), nodeId]);
    const rank = { poor: 0, mixed: 1, good: 2 };
    store.update((s) => {
      s.scenarios[sc.id] = { endings: [...found], best: !prev?.best || rank[end.outcome] > rank[prev.best] ? end.outcome : prev.best, at: Date.now() };
      store.addXp(o.xp);
      if (end.outcome === 'good') {
        store.award('scene-stealer');
        if (scenarios.every((x) => s.scenarios[x.id]?.best === 'good')) store.award('directors-cut');
      }
    });
    if (end.outcome === 'good') { sfx.win(); confetti(); } else sfx.tap();
    stage.classList.add('controls-on');
    overlay.replaceChildren(h('div', { class: 'ending' },
      h('span', { class: `outcome ${o.cls}` }, o.label),
      h('h3', {}, end.title),
      h('p', {}, end.takeaway),
      h('small', {}, `${found.size}/${all.length} endings found · +${o.xp} XP`),
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn glass grow', onclick: (e) => { e.stopPropagation(); restart(); } }, h('span', { html: icon('refresh') }), ' Another path'),
        h('button', { type: 'button', class: 'btn primary grow', onclick: (e) => { e.stopPropagation(); quiz(); } }, 'Quick question'))));
    overlay.classList.add('show');
    celebrateBadges();
  }

  function quiz() {
    const host = h('div', { class: 'quiz-host' });
    const s = sheet([h('p', { class: 'eyebrow' }, `${sc.skill} · check your read`), host], { cls: 'tall' });
    ask(host, { type: 'mcq', ...sc.quiz }).then((r) => {
      if (r.correct) store.update(() => store.addXp(5));
      s.close();
    });
  }

  function restart() {
    overlay.classList.remove('show');
    stage.classList.remove('ended');
    path = [sc.start];
    ended = false;
    cur = 0; clock = 0;
    rebuild();
    play();
  }

  rebuild();
  startBeat(0);
  caption.classList.remove('show');
  overlay.replaceChildren(h('button', { type: 'button', class: 'start-cover', onclick: (e) => { e.stopPropagation(); overlay.classList.remove('show'); overlay.replaceChildren(); play(); } },
    h('span', { class: 'v-btn big', html: icon('play') }), h('b', {}, 'Watch the scene'), h('small', {}, tts.supported ? 'Sound on for voices · captions included' : 'Captions included')));
  overlay.classList.add('show');
  raf = requestAnimationFrame(loop);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    clearInterval(countdown);
    clearTimeout(hideTimer);
    tts.cancel();
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen?.();
  };
}

