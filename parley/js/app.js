// Parley: app shell, router and the top-level screens (welcome, home, learn, practice, profile).
import { h, medal, ring, gauge, toast, confirmSheet } from './ui.js';
import { icon } from './icons.js';
import * as store from './store.js';
import * as tts from './tts.js';
import { courses, lessons, allCards, prompts, smalltalk, scenarios } from './content/index.js';
import { avatarSvg } from './avatar.js';
import { backdrop } from './backdrops.js';
import { lessonScreen } from './lesson.js';
import { speechScreen, speechResultScreen, speechHistoryScreen } from './speech/analyzer.js';
import { smalltalkListScreen, smalltalkScreen } from './smalltalk.js';
import { scenariosListScreen, scenarioScreen } from './scenes.js';
import { cardsListScreen, cardsStudyScreen, sparksScreen } from './flashcards.js';
import { clearAudio } from './speech/db.js';

const GOALS = [
  ['work', 'Speak up at work', 'presence'],
  ['smalltalk', 'Small talk with anyone', 'conversation'],
  ['confidence', 'Feel more confident', 'confidence'],
  ['speaking', 'Speak more clearly', 'clarity'],
  ['leadership', 'Lead and influence', 'leadership'],
  ['dating', 'Dates and connection', 'connection'],
];
const DAILY = [[20, 'Casual', '5 min a day'], [40, 'Regular', '10 min a day'], [60, 'Serious', '15 min a day']];

// ------------------------------------------------------------------ helpers
const lessonDone = (id) => !!store.get().lessons[id];
const courseDone = (c) => c.lessons.filter((l) => lessonDone(l.id)).length;

function recommendedCourses() {
  const goals = store.get().profile.goals;
  const first = GOALS.filter(([k]) => goals.includes(k)).map(([, , c]) => c);
  return [...first, ...courses.map((c) => c.id).filter((id) => !first.includes(id))].map((id) => courses.find((c) => c.id === id));
}

function nextLesson() {
  const last = lessons.get(store.get().lastLesson);
  if (last) {
    const n = last.course.lessons.find((l) => !lessonDone(l.id));
    if (n) return lessons.get(n.id);
  }
  for (const c of recommendedCourses()) {
    const n = c.lessons.find((l) => !lessonDone(l.id));
    if (n) return lessons.get(n.id);
  }
  return null;
}

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

const dayIndex = () => Math.floor(Date.now() / 86400000);

// ------------------------------------------------------------------ welcome / onboarding
function welcomeScreen(root) {
  let slide = 0;
  const picked = new Set(store.get().profile.goals);
  let daily = store.get().profile.dailyGoal || 40;

  const slides = [
    {
      title: ['Learn. Test.', 'Improve.'],
      body: '36 bite-sized lessons with quizzes and flashcards on presence, small talk, confidence, clear speaking, leadership and dating.',
      art: () => h('div', { class: 'ob-art quiz-art' },
        h('div', { class: 'mini-card' }, h('span', { class: 'pill lav' }, 'True or False'), h('p', {}, 'A pause can sound more confident than “um”.'), h('div', { class: 'tf-row' }, h('span', { class: 'choice right' }, 'True'), h('span', { class: 'choice' }, 'False'))),
        h('div', { class: 'mini-card dark' }, h('span', { class: 'pill' }, 'Fill in the Blank'), h('p', {}, 'Ask an ', h('span', { class: 'slot filled right' }, 'open'), ' question to keep it flowing.')),
        h('span', { class: 'sticker big' }, 'open'),
        h('div', { class: 'ob-medal', html: medal('diamond', 'blue', 96) })),
    },
    {
      title: ['Practice real-life', 'Scenarios'],
      body: 'Watch a moment play out, then choose how it continues. Every choice leads somewhere different.',
      art: () => {
        const sc = scenarios[0];
        return h('div', { class: 'ob-art scene-art', html: `<div class="ob-scene">${backdrop(sc.scene)}${avatarSvg(sc.cast.A.avatar, { mood: 'think', cls: 'th-a' })}${avatarSvg(sc.cast.B.avatar, { mood: 'smile', cls: 'th-b' })}<span class="th-play">${icon('play')}</span></div>` },
          h('div', { class: 'ob-choices' }, h('small', {}, 'Choose how to continue'), h('span', {}, sc.nodes[sc.start].choices?.[0]?.label || 'Ask a follow-up question'), h('span', {}, sc.nodes[sc.start].choices?.[1]?.label || 'Read before you lead')));
      },
    },
    {
      title: ['Analyze & improve', 'How you speak'],
      body: 'Record yourself and get a speech score: pace, pauses, filler words, volume and pitch, with moments to replay.',
      art: () => h('div', { class: 'ob-art speech-art' },
        h('div', { class: 'score-card mini' }, h('p', { class: 'score-eyebrow' }, 'Your speech score'), h('div', { html: gauge(75, { size: 170 }) }), h('p', { class: 'score-headline' }, 'Focused but rushed')),
        h('div', { class: 'ob-wave', html: Array.from({ length: 28 }, (_, i) => `<i style="height:${20 + Math.abs(Math.sin(i * 1.7)) * 70}%"${i === 9 ? ' class="r"' : i === 19 ? ' class="o"' : ''}></i>`).join('') })),
    },
    {
      title: ['Starting with', 'Small talk'],
      body: 'Chat with characters in everyday situations. See how each reply lands, and why.',
      art: () => {
        const s = smalltalk[0];
        return h('div', { class: 'ob-art chat-art' },
          h('div', { class: 'ob-person', html: avatarSvg(s.partner.avatar, { mood: 'laugh' }) }),
          h('div', { class: 'bubble' }, 'Never run out of things to say!'),
          h('div', { class: 'react positive' }, h('span', { html: icon('check') }), 'Positive Reaction'),
          h('div', { class: 'msg you positive' }, h('small', {}, 'YOU'), h('p', {}, s.turns[0].options.find((o) => o.rating === 'positive').text)));
      },
    },
  ];

  const wrap = h('div', { class: 'screen welcome' });
  root.append(wrap);

  function render() {
    if (slide < slides.length) {
      const s = slides[slide];
      wrap.replaceChildren(
        h('div', { class: 'ob-top' },
          h('span', { class: 'brand', html: '<svg width="30" height="30"><use href="#logo"/></svg><b>Parley</b>' }),
          h('button', { type: 'button', class: 'link-btn light', onclick: () => { slide = slides.length; render(); } }, 'Skip')),
        h('h1', { class: 'display center' }, s.title[0], h('br'), h('span', { class: 'accent' }, s.title[1])),
        s.art(),
        h('p', { class: 'ob-body' }, s.body),
        h('div', { class: 'dots' }, ...slides.map((_, i) => h('i', { class: i === slide ? 'on' : '' })), h('i', {})),
        h('button', { type: 'button', class: 'btn primary wide big', onclick: () => { slide++; render(); } }, slide === 0 ? 'Get started' : 'Next'));
    } else {
      const name = h('input', { class: 'input', type: 'text', placeholder: 'Your first name (optional)', value: store.get().profile.name, maxlength: 30, autocomplete: 'given-name' });
      const goalWrap = h('div', { class: 'goal-grid' });
      const drawGoals = () => goalWrap.replaceChildren(...GOALS.map(([k, label]) =>
        h('button', { type: 'button', class: `goal ${picked.has(k) ? 'on' : ''}`, 'aria-pressed': String(picked.has(k)), onclick: () => { picked.has(k) ? picked.delete(k) : picked.add(k); drawGoals(); } },
          h('span', { html: icon(picked.has(k) ? 'check' : 'sparkles') }), label)));
      drawGoals();
      const dailyWrap = h('div', { class: 'daily-row' });
      const drawDaily = () => dailyWrap.replaceChildren(...DAILY.map(([xp, label, sub]) =>
        h('button', { type: 'button', class: `daily ${daily === xp ? 'on' : ''}`, 'aria-pressed': String(daily === xp), onclick: () => { daily = xp; drawDaily(); } }, h('b', {}, label), h('small', {}, sub))));
      drawDaily();
      wrap.replaceChildren(
        h('div', { class: 'ob-top' }, h('button', { type: 'button', class: 'icon-btn light', 'aria-label': 'Back', html: icon('back'), onclick: () => { slide = slides.length - 1; render(); } }), h('span')),
        h('h1', { class: 'display center small' }, 'Make it', h('br'), h('span', { class: 'accent' }, 'Yours')),
        h('section', { class: 'setup-card' },
          h('label', { class: 'field' }, h('span', {}, 'What should we call you?'), name),
          h('div', { class: 'field' }, h('span', {}, 'What do you want to work on?'), goalWrap),
          h('div', { class: 'field' }, h('span', {}, 'Daily goal'), dailyWrap)),
        h('button', { type: 'button', class: 'btn primary wide big', onclick: () => {
          store.update((s) => {
            s.profile.name = name.value.trim();
            s.profile.goals = [...picked];
            s.profile.dailyGoal = daily;
            s.profile.onboarded = true;
          });
          location.hash = '#/home';
        } }, 'Let’s go'));
    }
  }
  render();
}

// ------------------------------------------------------------------ home
function homeScreen(root) {
  const s = store.get();
  const streak = store.currentStreak();
  const today = store.todayXp();
  const goal = s.profile.dailyGoal || 40;
  const lv = store.levelInfo();
  const next = nextLesson();
  const due = allCards.filter((c) => s.lessons[c.lessonId] && (!s.cards[c.id] || s.cards[c.id].due <= store.dayKey())).length;
  const lastSpeech = s.speech[0];
  const recentLesson = lessons.get(s.lastLesson);
  const challengeLesson = recentLesson || [...lessons.values()][dayIndex() % lessons.size];
  const sparksAny = prompts.sparks;
  const spark = sparksAny[dayIndex() % sparksAny.length];

  root.append(h('div', { class: 'screen home' },
    h('header', { class: 'home-head' },
      h('div', {},
        h('p', { class: 'eyebrow light' }, greeting()),
        h('h1', {}, s.profile.name ? `${s.profile.name}` : 'Welcome back')),
      h('div', { class: 'chips' },
        h('span', { class: `chip-stat ${streak ? 'flame' : ''}`, title: 'Day streak' }, h('span', { html: icon('flame') }), String(streak)),
        h('a', { class: 'chip-stat', href: '#/profile', title: 'Level' }, h('span', { html: icon('bolt') }), `Lv ${lv.level}`))),
    h('main', { class: 'pad stack' },
      h('section', { class: 'goal-card' },
        h('div', { class: 'goal-ring', html: ring(today / goal, { size: 76, stroke: 8, color: today >= goal ? '#7ed957' : '#5ef0ff' }) }, h('span', {}, today >= goal ? '✓' : `${Math.min(99, Math.round((today / goal) * 100))}%`)),
        h('div', { class: 'grow' },
          h('b', {}, today >= goal ? 'Daily goal reached!' : 'Daily goal'),
          h('small', {}, `${today} / ${goal} XP today`),
          h('div', { class: 'week' }, ...store.week().map((d) => h('span', { class: `${d.xp >= goal ? 'full' : d.xp ? 'some' : ''} ${d.today ? 'today' : ''}`, title: `${d.key}: ${d.xp} XP` }, h('i'), d.label))))),
      next ? h('a', { class: 'continue-card', href: `#/lesson/${next.id}`, style: { '--c1': next.course.color, '--c2': next.course.color2 } },
        h('div', { class: 'continue-medal', html: medal(next.course.icon, next.course.tone, 76) }),
        h('div', { class: 'grow' },
          h('p', { class: 'eyebrow light' }, s.lastLesson ? 'Continue learning' : 'Start here'),
          h('b', {}, next.title),
          h('small', {}, `${next.course.title} · Lesson ${next.index + 1} · ${next.minutes} min`)),
        h('span', { class: 'go', html: icon('play') })) : h('a', { class: 'continue-card done', href: '#/learn' }, h('b', {}, 'You finished every lesson!'), h('small', {}, 'Revisit any lesson, or keep practicing below.')),
      h('h2', { class: 'section-title light' }, 'Practice'),
      h('div', { class: 'tool-grid' },
        tool('#/speech', 'mic', 'Speech Analyzer', lastSpeech ? `Last score ${lastSpeech.score}` : 'Score how you speak', 'teal'),
        tool('#/smalltalk', 'chat', 'Small Talk', `${smalltalk.length} situations`, 'purple'),
        tool('#/scenarios', 'film', 'Scenarios', 'Branching video scenes', 'blue'),
        tool('#/cards', 'cards', 'Flashcards', due ? `${due} due for review` : 'Spaced review', 'gold')),
      h('section', { class: 'card challenge' },
        h('p', { class: 'eyebrow' }, h('span', { html: icon('target') }), ' Today’s challenge'),
        h('p', {}, challengeLesson.tryIt),
        h('a', { class: 'link', href: `#/lesson/${challengeLesson.id}` }, `From “${challengeLesson.title}”`)),
      h('a', { class: 'card spark-mini', href: '#/sparks' },
        h('span', { class: 'spark-icon', html: icon('sparkles') }),
        h('span', { class: 'grow' }, h('small', {}, 'Conversation spark of the day'), h('b', {}, spark.text)),
        h('span', { html: icon('chevron') })))));
}

function tool(href, ic, title, sub, tone) {
  return h('a', { class: `tool ${tone}`, href }, h('span', { class: 'tool-icon', html: icon(ic) }), h('b', {}, title), h('small', {}, sub));
}

// ------------------------------------------------------------------ learn
function learnScreen(root) {
  const total = lessons.size;
  const done = [...lessons.keys()].filter(lessonDone).length;
  root.append(h('div', { class: 'screen learn' },
    h('header', { class: 'page-hero' },
      h('h1', { class: 'display' }, 'Learn. Test.', h('br'), h('span', { class: 'accent' }, 'Improve.')),
      h('p', {}, `${done} of ${total} lessons complete`),
      h('div', { class: 'meter on-dark' }, h('span', { class: 'good', style: { width: `${(done / total) * 100}%` } }))),
    h('main', { class: 'pad stack' },
      ...recommendedCourses().map((c) => {
        const n = courseDone(c);
        return h('a', { class: 'course-card', href: `#/course/${c.id}`, style: { '--c1': c.color, '--c2': c.color2 } },
          h('div', { class: 'course-medal', html: medal(c.icon, c.tone, 70) }),
          h('div', { class: 'grow' },
            h('b', {}, c.title),
            h('small', {}, c.subtitle),
            h('div', { class: 'row gap-s' }, h('div', { class: 'meter thin grow' }, h('span', { class: 'good', style: { width: `${(n / c.lessons.length) * 100}%` } })), h('small', { class: 'nowrap' }, `${n}/${c.lessons.length}`))),
          h('span', { html: icon('chevron') }));
      }))));
}

function courseScreen(root, { id }) {
  const c = courses.find((x) => x.id === id);
  if (!c) { location.hash = '#/learn'; return; }
  const s = store.get();
  const firstOpen = c.lessons.find((l) => !lessonDone(l.id));
  const mins = c.lessons.reduce((a, l) => a + l.minutes, 0);
  root.append(h('div', { class: 'screen course' },
    h('header', { class: 'course-hero', style: { '--c1': c.color, '--c2': c.color2 } },
      h('a', { class: 'icon-btn light', href: '#/learn', 'aria-label': 'All courses', html: icon('back') }),
      h('div', { class: 'course-hero-medal', html: medal(c.icon, c.tone, 104) }),
      h('h1', {}, c.title),
      h('p', {}, c.subtitle),
      h('p', { class: 'meta' }, `${c.lessons.length} lessons · about ${mins} min · ${courseDone(c)} done`)),
    h('main', { class: 'pad' },
      h('ol', { class: 'path' }, ...c.lessons.map((l, i) => {
        const p = s.lessons[l.id];
        const isNext = firstOpen && firstOpen.id === l.id;
        return h('li', { class: `path-item ${p ? 'done' : ''} ${isNext ? 'next' : ''}` },
          h('a', { href: `#/lesson/${l.id}` },
            h('span', { class: 'path-node', html: p ? icon('check') : String(i + 1) }),
            h('span', { class: 'grow' },
              h('small', {}, `Lesson ${i + 1} · ${l.minutes} min`),
              h('b', {}, l.title),
              p ? h('small', { class: 'best' }, `Best quiz: ${Math.round(p.best * 100)}%`) : h('small', { class: 'muted' }, l.intro)),
            isNext ? h('span', { class: 'pill start' }, 'Start') : null));
      })),
      h('a', { class: 'btn ghost wide', href: `#/cards/${c.id}` }, h('span', { html: icon('cards') }), ' Study this course’s flashcards'))));
}

// ------------------------------------------------------------------ practice
function practiceScreen(root) {
  const s = store.get();
  const best = s.speech.length ? Math.max(...s.speech.map((x) => x.score)) : null;
  const endings = scenarios.reduce((a, sc) => a + (s.scenarios[sc.id]?.endings?.length || 0), 0);
  const allEndings = scenarios.reduce((a, sc) => a + Object.values(sc.nodes).filter((n) => n.end).length, 0);
  root.append(h('div', { class: 'screen practice' },
    h('header', { class: 'page-hero' },
      h('h1', { class: 'display' }, 'Practice', h('br'), h('span', { class: 'accent' }, 'Out loud')),
      h('p', {}, 'Build the skill, not just the knowledge.')),
    h('main', { class: 'pad stack' },
      big('#/speech', 'mic', 'Speech Analyzer', 'Analyze and improve how you speak: pace, pauses, filler words, volume and pitch.', best !== null ? `Best ${best}/100` : 'New', 'teal'),
      big('#/smalltalk', 'chat', 'Small Talk', 'Everyday conversations. Pick a reply and see how it lands, or say it your way.', `${Object.keys(s.smalltalk).length}/${smalltalk.length} played`, 'purple'),
      big('#/scenarios', 'film', 'Scenarios', 'Branching video scenes: choose how each moment continues.', `${endings}/${allEndings} endings`, 'blue'),
      big('#/cards', 'cards', 'Flashcards', 'Lock in what you learned with spaced review.', `${allCards.length} cards`, 'gold'),
      big('#/speech?mode=read', 'book', 'Read Aloud', 'Passages and tongue twisters scored for clarity.', `${prompts.passages.length} texts`, 'rose'),
      big('#/sparks', 'sparks', 'Conversation Sparks', 'Openers and questions for work, parties, dates and anywhere.', `${prompts.sparks.length} sparks`, 'teal'))));
}

function big(href, ic, title, body, meta, tone) {
  return h('a', { class: `practice-card ${tone}`, href },
    h('span', { class: 'tool-icon', html: icon(ic === 'sparks' ? 'sparkles' : ic) }),
    h('span', { class: 'grow' }, h('b', {}, title), h('small', {}, body)),
    h('span', { class: 'practice-meta' }, meta));
}

// ------------------------------------------------------------------ profile
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

function profileScreen(root) {
  const s = store.get();
  const lv = store.levelInfo();
  const doneLessons = Object.keys(s.lessons).length;
  const best = s.speech.length ? Math.max(...s.speech.map((x) => x.score)) : '–';
  const weekData = store.week();
  const maxXp = Math.max(s.profile.dailyGoal, ...weekData.map((d) => d.xp));

  const toggle = (key, label, sub) => h('label', { class: 'switch-row' },
    h('span', {}, h('b', {}, label), sub ? h('small', {}, sub) : null),
    h('input', { type: 'checkbox', role: 'switch', checked: !!s.settings[key], onchange: (e) => store.update((st) => { st.settings[key] = e.target.checked; }) }));

  const voices = tts.listVoices();
  const voiceSelect = h('select', { class: 'input', onchange: (e) => store.update((st) => { st.settings.voiceName = e.target.value; }) },
    h('option', { value: '' }, 'Automatic'),
    ...voices.map((v) => h('option', { value: v.name, selected: v.name === s.settings.voiceName }, `${v.name} (${v.lang})`)));

  const themeSeg = h('div', { class: 'seg-tabs small' }, ...[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(s.settings.theme === k), onclick: () => { store.update((st) => { st.settings.theme = k; }); applyTheme(); rerender(); } }, label)));

  const nameInput = h('input', { class: 'input', type: 'text', value: s.profile.name, placeholder: 'Your name', maxlength: 30, onchange: (e) => store.update((st) => { st.profile.name = e.target.value.trim(); }) });

  root.append(h('div', { class: 'screen profile' },
    h('header', { class: 'profile-head' },
      h('div', { class: 'profile-avatar' }, (s.profile.name || 'P').slice(0, 1).toUpperCase()),
      h('h1', {}, s.profile.name || 'Your profile'),
      h('p', {}, `Level ${lv.level} · ${lv.name}`),
      h('div', { class: 'meter on-dark' }, h('span', { class: 'good', style: { width: `${Math.round(lv.pct * 100)}%` } })),
      h('small', {}, `${s.xp} XP · ${lv.next - s.xp} XP to level ${lv.level + 1}`)),
    h('main', { class: 'pad stack' },
      h('section', { class: 'card stats-grid' },
        stat(icon('flame'), store.currentStreak(), 'day streak'),
        stat(icon('trophy'), s.streak.best, 'best streak'),
        stat(icon('book'), `${doneLessons}/${lessons.size}`, 'lessons'),
        stat(icon('mic'), best, 'best speech score')),
      h('section', { class: 'card' },
        h('h3', {}, 'This week'),
        h('div', { class: 'week-chart' }, ...weekData.map((d) => h('div', { class: `wc ${d.today ? 'today' : ''}` },
          h('span', { class: 'wc-bar' }, h('i', { style: { height: `${(d.xp / maxXp) * 100}%` }, class: d.xp >= s.profile.dailyGoal ? 'full' : '' })),
          h('small', {}, d.label))))),
      h('section', { class: 'card' },
        h('h3', {}, `Badges · ${Object.keys(s.badges).length}/${store.BADGES.length}`),
        h('div', { class: 'badge-grid' }, ...store.BADGES.map((b) => {
          const got = s.badges[b.id];
          return h('div', { class: `badge ${got ? 'got' : 'locked'}`, title: b.desc },
            h('div', { html: medal(got ? b.icon : 'lock', got ? b.tone : 'gray', 64) }),
            h('b', {}, b.name), h('small', {}, b.desc));
        }))),
      h('section', { class: 'card settings' },
        h('h3', {}, 'Settings'),
        h('label', { class: 'field' }, h('span', {}, 'Name'), nameInput),
        h('div', { class: 'field' }, h('span', {}, 'Daily goal'),
          h('div', { class: 'seg-tabs small' }, ...DAILY.map(([xp, label]) => h('button', { type: 'button', 'aria-pressed': String(s.profile.dailyGoal === xp), onclick: () => { store.update((st) => { st.profile.dailyGoal = xp; }); rerender(); } }, `${label} · ${xp} XP`)))),
        h('div', { class: 'field' }, h('span', {}, 'Theme'), themeSeg),
        toggle('voice', 'Voices', 'Read lessons and play characters aloud'),
        toggle('sound', 'Sound effects'),
        toggle('autoplay', 'Autoplay scenario choices', 'Continue with the first choice after 10 seconds'),
        tts.supported && voices.length ? h('label', { class: 'field' }, h('span', {}, 'Narrator voice'), voiceSelect) : null,
        installEvent ? h('button', { type: 'button', class: 'btn ghost wide', onclick: async () => { installEvent.prompt(); await installEvent.userChoice; installEvent = null; rerender(); } }, h('span', { html: icon('download') }), ' Install Parley on this device') : null,
        h('button', { type: 'button', class: 'btn danger-soft wide', onclick: async () => {
          if (!(await confirmSheet({ title: 'Reset all progress?', body: 'This clears your XP, streak, lessons, badges and recordings on this device. It can’t be undone.', ok: 'Reset everything', danger: true }))) return;
          await clearAudio();
          store.resetAll();
          toast('Progress reset');
          location.hash = '#/welcome';
        } }, 'Reset progress')),
      h('p', { class: 'privacy' }, h('span', { html: icon('lock') }), ' Everything stays on this device: no account, no tracking. Live transcription uses your browser’s speech service when switched on.'))));

  function rerender() { root.replaceChildren(); profileScreen(root); }
}

function stat(ic, value, label) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-ic', html: ic }), h('b', {}, String(value)), h('span', {}, label));
}

// ------------------------------------------------------------------ router
const ROUTES = [
  [/^welcome$/, welcomeScreen, { tabs: false }],
  [/^home$/, homeScreen, { tab: 'home' }],
  [/^learn$/, learnScreen, { tab: 'learn' }],
  [/^course\/([\w-]+)$/, courseScreen, { tab: 'learn', keys: ['id'] }],
  [/^lesson\/([\w-]+)$/, lessonScreen, { tabs: false, keys: ['id'] }],
  [/^practice$/, practiceScreen, { tab: 'practice' }],
  [/^speech$/, speechScreen, { tabs: false }],
  [/^speech\/history$/, speechHistoryScreen, { tabs: false }],
  [/^speech\/result\/(\w+)$/, speechResultScreen, { tabs: false, keys: ['id'] }],
  [/^smalltalk$/, smalltalkListScreen, { tab: 'practice' }],
  [/^smalltalk\/([\w-]+)$/, smalltalkScreen, { tabs: false, keys: ['id'] }],
  [/^scenarios$/, scenariosListScreen, { tab: 'practice' }],
  [/^scenario\/([\w-]+)$/, scenarioScreen, { tabs: false, keys: ['id'] }],
  [/^cards$/, cardsListScreen, { tab: 'practice' }],
  [/^cards\/([\w-]+)$/, cardsStudyScreen, { tabs: false, keys: ['deck'] }],
  [/^sparks$/, sparksScreen, { tab: 'practice' }],
  [/^profile$/, profileScreen, { tab: 'profile' }],
];

const TABS = [['home', 'home', 'Home'], ['learn', 'book', 'Learn'], ['practice', 'target', 'Practice'], ['profile', 'user', 'Profile']];
const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
let cleanup = null;
let navCount = 0;

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  if (!store.get().profile.onboarded && path !== 'welcome') { location.replace('#/welcome'); return; }
  if (!path) { location.replace('#/home'); return; }
  const match = ROUTES.find(([re]) => re.test(path));
  if (!match) { location.replace('#/home'); return; }
  const [re, screen, opts] = match;
  const m = path.match(re);
  const params = Object.fromEntries(new URLSearchParams(query));
  (opts.keys || []).forEach((k, i) => { params[k] = m[i + 1]; });

  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  tts.cancel();
  document.querySelectorAll('.sheet-wrap').forEach((s) => s.remove());
  app.replaceChildren();
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  const showTabs = opts.tabs !== false;
  tabs.hidden = !showTabs;
  document.body.classList.toggle('has-tabs', showTabs);
  if (showTabs) {
    tabs.replaceChildren(...TABS.map(([k, ic, label]) => h('a', { href: `#/${k}`, class: opts.tab === k ? 'on' : '', 'aria-current': opts.tab === k ? 'page' : null }, h('span', { html: icon(ic) }), label)));
  }
  const ret = screen(app, params);
  if (typeof ret === 'function') cleanup = ret;
  if (navCount++ > 0) sessionStorage.setItem('parley.nav', '1');
}

function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

applyTheme();
sessionStorage.removeItem('parley.nav');
window.addEventListener('hashchange', route);
route();
