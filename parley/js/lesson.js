// Lesson player: reading steps (or listening to them), then a 4-question quiz.
import { h, sheet, richText, plainText, confirmSheet, medal, confetti, iconBtn } from './ui.js';
import { icon } from './icons.js';
import * as store from './store.js';
import * as tts from './tts.js';
import * as sfx from './sfx.js';
import { ask } from './quiz.js';
import { lessons } from './content/index.js';
import { celebrateBadges } from './rewards.js';

const RATES = [0.75, 1, 1.25, 1.5];

export function lessonScreen(root, { id }) {
  const lesson = lessons.get(id);
  if (!lesson) { location.hash = '#/learn'; return; }
  const course = lesson.course;
  let alive = true;
  let mode = 'read';        // 'read' | 'listen'
  let shown = 0;            // steps revealed
  let reading = -1;         // step being spoken
  let playing = false;
  let restart = false;
  let phase = 'intro';
  const segTotal = lesson.steps.length + lesson.quiz.length;
  let segDone = 0;

  // ---------- layout
  const segs = h('div', { class: 'segs', 'aria-hidden': 'true' }, Array.from({ length: segTotal }, () => h('span')));
  const toggle = h('div', { class: 'mode-toggle', role: 'group', 'aria-label': 'Lesson mode' },
    h('button', { type: 'button', 'aria-label': 'Read', 'aria-pressed': 'true', html: icon('lines'), onclick: () => setMode('read') }),
    h('button', { type: 'button', 'aria-label': 'Listen', 'aria-pressed': 'false', html: icon('headphones'), onclick: () => setMode('listen') }));
  if (!tts.supported) toggle.hidden = true;
  const head = h('header', { class: 'lesson-head', style: { '--c1': course.color, '--c2': course.color2 } },
    h('div', { class: 'row' },
      iconBtn('close', 'Leave lesson', leave, 'light'),
      h('div', { class: 'lesson-head-title' }, lesson.title),
      toggle),
    segs);
  const body = h('main', { class: 'lesson-body' });
  const dock = h('div', { class: 'lesson-dock' });
  const screen = h('div', { class: 'screen lesson' }, head, body, dock);
  root.append(screen);

  function setSegs(n) {
    segDone = Math.max(segDone, n);
    [...segs.children].forEach((s, i) => s.classList.toggle('on', i < segDone));
  }

  async function leave() {
    if (phase === 'done' || phase === 'intro') { location.hash = `#/course/${course.id}`; return; }
    stopAudio();
    if (await confirmSheet({ title: 'Leave this lesson?', body: 'Your progress in this lesson won’t be saved.', ok: 'Leave', cancel: 'Keep going' })) {
      location.hash = `#/course/${course.id}`;
    }
  }

  // ---------- intro
  function intro() {
    body.replaceChildren(
      h('section', { class: 'lesson-intro', style: { '--c1': course.color, '--c2': course.color2 } },
        h('div', { class: 'lesson-intro-medal', html: medal(course.icon, course.tone, 92) }),
        h('p', { class: 'eyebrow' }, `${course.title} · Lesson ${lesson.index + 1}`),
        h('h2', {}, lesson.title),
        h('p', { class: 'lead' }, lesson.intro),
        h('p', { class: 'meta' }, h('span', { html: icon('clock') }), ` ${lesson.minutes} min · ${lesson.steps.length} steps · ${lesson.quiz.length} questions`)));
    dock.replaceChildren(
      tts.supported ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { setMode('listen'); start(); } }, h('span', { html: icon('headphones') }), ' Listen') : null,
      h('button', { type: 'button', class: 'btn primary grow', onclick: start }, 'Start lesson'));
  }

  // ---------- reading
  const stepsWrap = h('section', { class: 'steps-card' });
  function start() {
    phase = 'read';
    body.replaceChildren(stepsWrap);
    reveal();
    if (mode === 'listen') play();
  }

  function stepEl(i) {
    const s = lesson.steps[i];
    const el = h('article', { class: 'step', dataset: { i } },
      h('span', { class: 'pill lav' }, `Step ${i + 1}`),
      h('p', { html: richText(s.text, lesson.glossary) }));
    el.querySelectorAll('.term').forEach((b) => b.addEventListener('click', () => define(b.dataset.term)));
    return el;
  }

  function reveal() {
    if (shown >= lesson.steps.length) return;
    const el = stepEl(shown);
    stepsWrap.append(el);
    shown++;
    setSegs(shown);
    requestAnimationFrame(() => el.classList.add('in'));
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (shown === lesson.steps.length) afterSteps();
    renderDock();
  }

  function afterSteps() {
    const wrap = h('div', { class: 'after-steps' },
      h('section', { class: 'takeaway' }, h('p', { class: 'eyebrow' }, 'Key takeaway'), h('p', {}, lesson.takeaway)),
      h('section', { class: 'tryit' }, h('p', { class: 'eyebrow' }, h('span', { html: icon('target') }), ' Try it today'), h('p', {}, lesson.tryIt)));
    stepsWrap.after(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
  }

  function renderDock() {
    if (phase !== 'read') return;
    const allShown = shown >= lesson.steps.length;
    dock.classList.toggle('listen', mode === 'listen');
    if (mode === 'listen') {
      const rateBtn = h('button', { type: 'button', class: 'player-btn rate', 'aria-label': 'Playback speed', onclick: cycleRate }, `${store.get().settings.rate}x`);
      dock.replaceChildren(
        h('div', { class: 'player' },
          h('button', { type: 'button', class: 'player-btn', 'aria-label': 'Previous step', html: icon('rewind'), onclick: () => jump(-1) }),
          h('button', { type: 'button', class: 'player-btn big', 'aria-label': playing ? 'Pause' : 'Play', html: icon(playing ? 'pause' : 'play'), onclick: () => (playing ? pause() : play()) }),
          h('button', { type: 'button', class: 'player-btn', 'aria-label': 'Next step', html: icon('forward'), onclick: () => jump(1) }),
          rateBtn),
        allShown ? h('button', { type: 'button', class: 'btn primary', onclick: quiz }, 'Quiz') : null);
    } else {
      dock.replaceChildren(allShown
        ? h('button', { type: 'button', class: 'btn primary grow', onclick: quiz }, 'Take the quiz')
        : h('button', { type: 'button', class: 'btn primary grow', onclick: () => { sfx.tap(); reveal(); } }, 'Continue'));
    }
  }

  function setMode(m) {
    mode = m;
    toggle.children[0].setAttribute('aria-pressed', String(m === 'read'));
    toggle.children[1].setAttribute('aria-pressed', String(m === 'listen'));
    if (m === 'read') stopAudio();
    else if (phase === 'read') play();
    renderDock();
  }

  function highlight(i) {
    stepsWrap.querySelectorAll('.step').forEach((el) => el.classList.toggle('reading', Number(el.dataset.i) === i));
    stepsWrap.querySelector(`.step[data-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function play() {
    if (phase !== 'read') return;
    playing = true;
    renderDock();
    if (reading < 0) reading = 0;
    while (alive && playing && phase === 'read') {
      while (shown <= reading && shown < lesson.steps.length) reveal();
      highlight(reading);
      const me = reading;
      await tts.speak(plainText(lesson.steps[reading].text));
      if (!alive || !playing) break;
      if (reading !== me) continue;                       // jumped to another step
      if (restart) { restart = false; continue; }         // speed changed: replay this step
      if (reading >= lesson.steps.length - 1) {
        await tts.speak('Key takeaway. ' + lesson.takeaway);
        playing = false;
        highlight(-1);
        reading = -1;
        break;
      }
      reading++;
    }
    renderDock();
  }
  function pause() { playing = false; tts.cancel(); renderDock(); }
  function stopAudio() { playing = false; tts.cancel(); highlight(-1); }
  function jump(d) {
    const next = Math.max(0, Math.min(lesson.steps.length - 1, (reading < 0 ? shown - 1 : reading) + d));
    reading = next;
    tts.cancel();
    if (!playing) play();
  }
  function cycleRate() {
    const cur = store.get().settings.rate;
    const next = RATES[(RATES.indexOf(cur) + 1) % RATES.length] || 1;
    store.update((s) => { s.settings.rate = next; });
    if (playing) { restart = true; tts.cancel(); }
    renderDock();
  }

  function define(term) {
    const key = Object.keys(lesson.glossary).find((k) => k.toLowerCase() === term.toLowerCase());
    const def = lesson.glossary[key];
    const s = sheet([
      h('p', { class: 'eyebrow' }, 'Glossary'),
      h('h3', { class: 'sheet-title cap' }, key),
      h('p', { class: 'lead' }, def),
      h('div', { class: 'row gap' },
        tts.supported ? h('button', { type: 'button', class: 'btn ghost grow', onclick: () => tts.speak(`${key}. ${def}`) }, h('span', { html: icon('volume') }), ' Hear it') : null,
        h('button', { type: 'button', class: 'btn primary grow', onclick: () => s.close() }, 'Got it')),
    ]);
  }

  // ---------- quiz
  async function quiz() {
    stopAudio();
    phase = 'quiz';
    dock.classList.remove('listen');
    dock.replaceChildren();
    let correct = 0;
    for (let i = 0; i < lesson.quiz.length; i++) {
      if (!alive) return;
      const host = h('div', { class: 'quiz-host' });
      body.replaceChildren(h('p', { class: 'quiz-count' }, `Question ${i + 1} of ${lesson.quiz.length}`), host);
      body.scrollTop = 0;
      const r = await ask(host, lesson.quiz[i]);
      if (r.correct) correct++;
      setSegs(lesson.steps.length + i + 1);
    }
    if (alive) finish(correct);
  }

  // ---------- results
  async function finish(correct) {
    phase = 'done';
    const total = lesson.quiz.length;
    const prev = store.get().lessons[lesson.id];
    const first = !prev;
    const xp = (first ? 20 : 5) + correct * 5 + (correct === total ? 10 : 0);
    store.update((s) => {
      s.lessons[lesson.id] = { best: Math.max(prev?.best || 0, correct / total), correct, total, at: Date.now() };
      s.lastLesson = lesson.id;
      store.addXp(xp);
      store.award('first-lesson');
      if (correct === total) store.award('perfect-quiz');
      if (course.lessons.every((l) => s.lessons[l.id])) store.award('course-complete');
    });
    sfx.win();
    confetti();
    const next = course.lessons[lesson.index + 1];
    body.replaceChildren(
      h('section', { class: 'results' },
        h('div', { class: 'results-medal', html: medal(correct === total ? 'diamond' : course.icon, correct === total ? 'gold' : course.tone, 128) }),
        h('h2', {}, correct === total ? 'Perfect lesson!' : 'Lesson complete!'),
        h('p', { class: 'muted' }, lesson.title),
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('b', {}, `${correct}/${total}`), h('span', {}, 'correct')),
          h('div', { class: 'stat' }, h('b', {}, `+${xp}`), h('span', {}, 'XP')),
          h('div', { class: 'stat' }, h('b', { html: icon('flame') }), h('span', {}, `${store.currentStreak()} day streak`))),
        h('section', { class: 'tryit' }, h('p', { class: 'eyebrow' }, h('span', { html: icon('target') }), ' Today’s challenge'), h('p', {}, lesson.tryIt))));
    dock.replaceChildren(
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { location.hash = `#/course/${course.id}`; } }, 'Course'),
      next
        ? h('button', { type: 'button', class: 'btn primary grow', onclick: () => { location.hash = `#/lesson/${next.id}`; } }, 'Next lesson')
        : h('button', { type: 'button', class: 'btn primary grow', onclick: () => { location.hash = '#/learn'; } }, 'All courses'));
    await celebrateBadges();
  }

  intro();
  return () => { alive = false; stopAudio(); };
}
