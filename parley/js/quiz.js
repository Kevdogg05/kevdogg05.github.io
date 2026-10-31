// Quiz questions: true/false, fill in the blank, match pairs, multiple choice.
// ask(host, question) renders it and resolves { correct } after the player taps Continue.
import { h, shuffle, sleep } from './ui.js';
import { icon } from './icons.js';
import * as sfx from './sfx.js';

const LABELS = { tf: 'True or False', blank: 'Fill in the Blank', match: 'Match Pairs', mcq: 'Choose the Best Answer' };

export function ask(host, q) {
  host.replaceChildren();
  return new Promise((resolve) => {
    const finish = async (correct, correctText, title) => {
      correct ? sfx.good() : sfx.bad();
      await feedback(host, correct, q.explain, correctText, title);
      resolve({ correct });
    };
    if (q.type === 'tf') tf(host, q, finish);
    else if (q.type === 'blank') blank(host, q, finish);
    else if (q.type === 'match') match(host, q, finish);
    else mcq(host, q, finish);
  });
}

function card(q, ...children) {
  return h('section', { class: `q-card q-${q.type}` }, h('span', { class: 'pill lav' }, LABELS[q.type]), ...children);
}

function feedback(host, ok, explain, correctText, title) {
  return new Promise((resolve) => {
    const btn = h('button', { type: 'button', class: `btn ${ok ? 'success' : 'primary'} wide` }, 'Continue');
    const panel = h('div', { class: `q-feedback ${ok ? 'good' : 'bad'}`, role: 'status' },
      h('div', { class: 'q-feedback-head' },
        h('span', { class: 'q-feedback-icon', html: icon(ok ? 'check' : 'x') }),
        h('strong', {}, title || (ok ? pickPraise() : 'Not quite'))),
      !ok && correctText ? h('p', { class: 'q-correct' }, 'Answer: ', h('b', {}, correctText)) : null,
      explain ? h('p', {}, explain) : null,
      btn);
    host.append(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    btn.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
    btn.addEventListener('click', () => resolve(), { once: true });
  });
}

const PRAISE = ['Nice!', 'Spot on!', 'Exactly!', 'You got it!', 'Great call!'];
const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

function lockAll(el) { el.querySelectorAll('button.choice, button.chip').forEach((b) => { b.disabled = true; }); }

// ------------------------------------------------------------------ true / false
function tf(host, q, finish) {
  const row = h('div', { class: 'tf-row' });
  [true, false].forEach((val) => {
    row.append(h('button', {
      type: 'button', class: 'choice', onclick: (e) => {
        lockAll(host);
        const ok = val === q.answer;
        e.currentTarget.classList.add(ok ? 'right' : 'wrong');
        if (!ok) row.children[q.answer ? 0 : 1].classList.add('right');
        finish(ok, q.answer ? 'True' : 'False');
      },
    }, val ? 'True' : 'False'));
  });
  host.append(card(q, h('p', { class: 'q-text' }, q.statement), row));
}

// ------------------------------------------------------------------ fill in the blank
function blank(host, q, finish) {
  const gap = h('span', { class: 'slot', 'aria-label': 'blank' });
  const chips = h('div', { class: 'chip-row' });
  shuffle(q.options).forEach((opt) => {
    chips.append(h('button', {
      type: 'button', class: 'chip', onclick: async (e) => {
        lockAll(host);
        const chip = e.currentTarget;
        await fly(chip, gap);
        const ok = opt === q.answer;
        gap.textContent = opt;
        gap.classList.add('filled', ok ? 'right' : 'wrong');
        chip.classList.add('used');
        if (ok) gap.append(h('span', { class: 'sticker' }, opt));
        finish(ok, q.answer);
      },
    }, opt));
  });
  const sentence = h('p', { class: 'q-text' }, q.before.trimEnd(), ' ', gap, q.after ? (/^[.,;:!?’”)]/.test(q.after) ? '' : ' ') : '', q.after || '');
  const c = card(q, sentence, chips);
  c.classList.add('dark');
  host.append(c);
}

async function fly(from, to) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const ghost = from.cloneNode(true);
  Object.assign(ghost.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 50, transition: 'transform .35s cubic-bezier(.3,.7,.3,1)', pointerEvents: 'none' });
  document.body.append(ghost);
  from.style.visibility = 'hidden';
  await new Promise((r) => requestAnimationFrame(r));
  ghost.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px)`;
  await sleep(360);
  ghost.remove();
}

// ------------------------------------------------------------------ match pairs
function match(host, q, finish) {
  let mistakes = 0, matched = 0, sel = null;
  const grid = h('div', { class: 'match-grid' });
  const left = h('div', { class: 'match-col' }), right = h('div', { class: 'match-col' });
  const make = (text, side, key) => h('button', { type: 'button', class: 'choice tile', dataset: { side, key }, onclick: (e) => pickTile(e.currentTarget) }, text);
  shuffle(q.pairs.map((p, i) => [p[0], i])).forEach(([t, i]) => left.append(make(t, 'l', i)));
  shuffle(q.pairs.map((p, i) => [p[1], i])).forEach(([t, i]) => right.append(make(t, 'r', i)));
  grid.append(left, right);

  function pickTile(btn) {
    if (btn.classList.contains('right')) return;
    if (!sel || sel.dataset.side === btn.dataset.side) {
      sel?.classList.remove('selected');
      sel = btn === sel ? null : btn;
      sel?.classList.add('selected');
      sfx.tap();
      return;
    }
    const a = sel, b = btn;
    sel = null;
    a.classList.remove('selected');
    if (a.dataset.key === b.dataset.key) {
      a.classList.add('right'); b.classList.add('right'); a.disabled = b.disabled = true;
      matched++;
      sfx.good();
      if (matched === q.pairs.length) {
        const ok = mistakes === 0;
        finish(ok, '', ok ? '' : `All matched, with ${mistakes} ${mistakes === 1 ? 'slip' : 'slips'}`);
      }
    } else {
      mistakes++;
      sfx.bad();
      [a, b].forEach((x) => { x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 450); });
    }
  }
  host.append(card(q, h('p', { class: 'q-text' }, q.prompt), grid));
}

// ------------------------------------------------------------------ multiple choice
function mcq(host, q, finish) {
  const list = h('div', { class: 'mcq-list' });
  const order = shuffle(q.options.map((t, i) => ({ t, i })));
  order.forEach(({ t, i }) => {
    list.append(h('button', {
      type: 'button', class: 'choice', dataset: { i }, onclick: (e) => {
        lockAll(host);
        const ok = i === q.answer;
        e.currentTarget.classList.add(ok ? 'right' : 'wrong');
        list.querySelector(`[data-i="${q.answer}"]`).classList.add('right');
        finish(ok, q.options[q.answer]);
      },
    }, t));
  });
  host.append(card(q, h('p', { class: 'q-text' }, q.question), list));
}

