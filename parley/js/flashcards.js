// Flashcards with simple spaced repetition, plus the Conversation Sparks deck.
import { h, topBar, shuffle, confetti, toast } from './ui.js';
import { icon } from './icons.js';
import * as store from './store.js';
import * as tts from './tts.js';
import * as sfx from './sfx.js';
import { courses, allCards, prompts } from './content/index.js';
import { celebrateBadges } from './rewards.js';

const INTERVALS = [0, 1, 3, 7, 14, 30];   // days per Leitner box

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return store.dayKey(d); }

function dueCards() {
  const s = store.get(), today = store.dayKey();
  return allCards.filter((c) => s.lessons[c.lessonId] && (!s.cards[c.id] || s.cards[c.id].due <= today));
}

// ------------------------------------------------------------------ decks
export function cardsListScreen(root) {
  const s = store.get();
  const due = dueCards();
  root.append(h('div', { class: 'screen' },
    topBar('Flashcards', { back: '#/practice' }),
    h('main', { class: 'pad stack' },
      h('a', { class: `deck-card due ${due.length ? '' : 'empty'}`, href: due.length ? '#/cards/due' : '#/learn' },
        h('span', { class: 'deck-icon', html: icon('cards') }),
        h('span', { class: 'grow' }, h('b', {}, 'Review due'),
          h('small', {}, due.length ? `${due.length} card${due.length === 1 ? '' : 's'} ready from lessons you’ve finished` : 'Finish a lesson to unlock its cards for review')),
        due.length ? h('span', { class: 'count' }, String(due.length)) : h('span', { html: icon('chevron') })),
      h('h2', { class: 'section-title' }, 'Decks by course'),
      ...courses.map((c) => {
        const cards = allCards.filter((x) => x.courseId === c.id);
        const known = cards.filter((x) => (s.cards[x.id]?.box || 0) >= 2).length;
        return h('a', { class: 'deck-card', href: `#/cards/${c.id}`, style: { '--c1': c.color, '--c2': c.color2 } },
          h('span', { class: 'deck-icon tinted', html: icon(c.icon) }),
          h('span', { class: 'grow' }, h('b', {}, c.title), h('small', {}, `${cards.length} cards · ${known} known`),
            h('span', { class: 'meter thin' }, h('span', { class: 'good', style: { width: `${(known / cards.length) * 100}%` } }))),
          h('span', { html: icon('chevron') }));
      }))));
}

// ------------------------------------------------------------------ study
export function cardsStudyScreen(root, { deck }) {
  let queue = deck === 'due' ? shuffle(dueCards()).slice(0, 20) : shuffle(allCards.filter((c) => c.courseId === deck)).slice(0, 20);
  if (!queue.length) { location.hash = '#/cards'; return; }
  const title = deck === 'due' ? 'Review due' : courses.find((c) => c.id === deck)?.title || 'Flashcards';
  const total = queue.length;
  let done = 0, knewIt = 0, flipped = false;
  const retried = new Set();

  const progress = h('div', { class: 'meter on-dark' }, h('span', { class: 'good' }));
  const counter = h('span', { class: 'muted small' });
  const stageEl = h('div', { class: 'card-stage' });
  const actions = h('div', { class: 'row gap card-actions' });
  const screen = h('div', { class: 'screen cards' },
    topBar(title, { back: '#/cards' }),
    h('main', { class: 'pad stack' }, h('div', { class: 'row between gap' }, progress, counter), stageEl, actions));
  root.append(screen);

  function render() {
    const c = queue[0];
    flipped = false;
    progress.firstChild.style.width = `${(done / total) * 100}%`;
    counter.textContent = `${done}/${total}`;
    const lesson = courses.find((x) => x.id === c.courseId)?.lessons.find((l) => l.id === c.lessonId);
    const card = h('button', { type: 'button', class: 'flash', 'aria-label': 'Flip card' },
      h('span', { class: 'flash-inner' },
        h('span', { class: 'flash-face front' }, h('small', {}, lesson?.title || ''), h('b', {}, c.front), h('em', {}, 'Tap to flip')),
        h('span', { class: 'flash-face back' }, h('small', {}, 'Answer'), h('span', {}, c.back))));
    card.addEventListener('click', flip);
    swipe(card);
    stageEl.replaceChildren(card);
    actions.replaceChildren(h('button', { type: 'button', class: 'btn primary wide', onclick: flip }, 'Show answer'));
  }

  function flip() {
    const card = stageEl.querySelector('.flash');
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    sfx.tap();
    if (flipped) actions.replaceChildren(
      h('button', { type: 'button', class: 'btn danger-soft grow', onclick: () => grade(false) }, h('span', { html: icon('refresh') }), ' Again'),
      h('button', { type: 'button', class: 'btn success grow', onclick: () => grade(true) }, h('span', { html: icon('check') }), ' Got it'));
  }

  function swipe(el) {
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (flipped && Math.abs(dx) > 70) grade(dx > 0);
    });
  }

  function grade(ok) {
    const c = queue.shift();
    const card = stageEl.querySelector('.flash');
    card.classList.add(ok ? 'out-right' : 'out-left');
    store.update((s) => {
      const box = ok ? Math.min(INTERVALS.length - 1, (s.cards[c.id]?.box || 0) + 1) : 0;
      s.cards[c.id] = { box, due: addDays(INTERVALS[box]) };
      s.cardsReviewed = (s.cardsReviewed || 0) + 1;
      if (s.cardsReviewed >= 25) store.award('memory');
    });
    if (ok) { knewIt++; done++; sfx.good(); }
    else if (!retried.has(c.id)) { retried.add(c.id); queue.push(c); sfx.bad(); }
    else { done++; sfx.bad(); }
    setTimeout(() => (queue.length ? render() : finish()), 260);
  }

  async function finish() {
    const xp = Math.min(20, total);
    store.update(() => store.addXp(xp));
    confetti(60);
    stageEl.replaceChildren(h('section', { class: 'results' },
      h('div', { class: 'deck-icon huge', html: icon('cards') }),
      h('h2', {}, 'Deck complete'),
      h('p', { class: 'muted' }, `You knew ${knewIt} of ${total} on the first try · +${xp} XP`)));
    actions.replaceChildren(
      h('a', { class: 'btn ghost grow', href: '#/cards' }, 'All decks'),
      h('button', { type: 'button', class: 'btn primary grow', onclick: () => { root.replaceChildren(); cardsStudyScreen(root, { deck }); } }, 'Study again'));
    progress.firstChild.style.width = '100%';
    counter.textContent = `${total}/${total}`;
    await celebrateBadges();
  }

  render();
}

// ------------------------------------------------------------------ conversation sparks
const CONTEXTS = [['anywhere', 'Anywhere'], ['work', 'Work'], ['party', 'Party'], ['date', 'Date']];

export function sparksScreen(root) {
  let ctx = 'anywhere';
  let deck = [], i = 0;
  const shuffleDeck = () => { deck = shuffle(prompts.sparks.filter((s) => s.context === ctx)); i = 0; };
  shuffleDeck();
  const text = h('p', { class: 'spark-text' });
  const count = h('small', { class: 'muted' });
  const chips = h('div', { class: 'chip-scroll' });
  const card = h('section', { class: 'spark-card' }, h('span', { class: 'spark-icon', html: icon('sparkles') }), text, count);

  function render() {
    chips.replaceChildren(...CONTEXTS.map(([k, label]) => h('button', { type: 'button', class: `filter ${ctx === k ? 'on' : ''}`, onclick: () => { ctx = k; shuffleDeck(); render(); } }, label)));
    text.textContent = deck[i]?.text || '';
    count.textContent = `${i + 1} of ${deck.length}`;
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }

  root.append(h('div', { class: 'screen' },
    topBar('Conversation sparks', { back: '#/smalltalk' }),
    h('main', { class: 'pad stack' },
      chips,
      card,
      h('div', { class: 'row gap' },
        tts.supported ? h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Hear it', onclick: () => tts.speak(deck[i].text) }, h('span', { html: icon('volume') })) : null,
        h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Copy', onclick: () => navigator.clipboard?.writeText(deck[i].text).then(() => toast('Copied')) }, 'Copy'),
        h('button', { type: 'button', class: 'btn primary grow', onclick: () => { i = (i + 1) % deck.length; sfx.tap(); render(); } }, 'Next spark')),
      h('section', { class: 'card tip-card' },
        h('h3', {}, 'Stuck? Think FORD'),
        h('p', { class: 'muted' }, 'Most people enjoy talking about four things. Pick one and ask an open question.'),
        h('div', { class: 'ford' },
          ...[['F', 'Family', 'Where did you grow up?'], ['O', 'Occupation', 'What keeps you busy these days?'], ['R', 'Recreation', 'What do you do to unwind?'], ['D', 'Dreams', 'What are you looking forward to?']].map(([l, w, q]) =>
            h('div', {}, h('b', {}, l), h('span', {}, h('strong', {}, w), h('small', {}, q)))))),
      h('a', { class: 'btn ghost wide', href: '#/smalltalk' }, 'Practice in the Small Talk game'))));
  render();
}
