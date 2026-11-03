// Small Talk game: a character speaks, you pick (or write) a reply, they react.
import { h, topBar, shuffle, sleep, confetti, iconBtn, toast } from './ui.js';
import { icon } from './icons.js';
import { avatarSvg, avatarBadge, setMood } from './avatar.js';
import { backdrop } from './backdrops.js';
import * as store from './store.js';
import * as tts from './tts.js';
import * as sfx from './sfx.js';
import { smalltalk } from './content/index.js';
import { celebrateBadges } from './rewards.js';

const CAT_LABEL = { work: 'Work', social: 'Social', dating: 'Dating', networking: 'Networking', neighbors: 'Neighbors' };
const REACT = {
  positive: { label: 'Positive Reaction', icon: 'check', moods: ['smile', 'laugh'] },
  neutral: { label: 'Neutral Reaction', icon: 'info', moods: ['neutral', 'think'] },
  negative: { label: 'Awkward Moment', icon: 'x', moods: ['annoyed', 'worried', 'surprised'] },
};

// ------------------------------------------------------------------ list
export function smalltalkListScreen(root) {
  const progress = store.get().smalltalk;
  root.append(h('div', { class: 'screen' },
    topBar('Small Talk', { back: '#/practice' }),
    h('main', { class: 'pad stack' },
      h('section', { class: 'hero-banner' },
        h('h2', { class: 'display' }, 'Starting with', h('br'), h('span', { class: 'accent' }, 'Small talk')),
        h('p', {}, 'Pick a situation, choose what to say, and see how it lands. Never run out of things to say.')),
      h('a', { class: 'sparks-link', href: '#/sparks' }, h('span', { html: icon('sparkles') }), h('span', { class: 'grow' }, h('b', {}, 'Conversation sparks'), h('small', {}, 'Openers and questions for any situation')), h('span', { html: icon('chevron') })),
      ...smalltalk.map((s) => {
        const p = progress[s.id];
        return h('a', { class: 'list-card', href: `#/smalltalk/${s.id}` },
          h('span', { html: avatarBadge(s.partner.avatar, 56) }),
          h('span', { class: 'grow' },
            h('b', {}, s.title),
            h('small', {}, `${s.partner.name} · ${s.partner.role}`),
            h('span', { class: 'row gap-s' },
              h('span', { class: 'pill lav' }, CAT_LABEL[s.category] || s.category),
              h('span', { class: 'level', 'aria-label': `Level ${s.level} of 3` }, ...[1, 2, 3].map((n) => h('i', { class: n <= s.level ? 'on' : '' }))))),
          p ? h('span', { class: 'best' }, `${Math.round(p.best * 100)}%`) : h('span', { html: icon('chevron') }));
      }))));
}

// ------------------------------------------------------------------ play
export function smalltalkScreen(root, { id }) {
  const sc = smalltalk.find((s) => s.id === id);
  if (!sc) { location.hash = '#/smalltalk'; return; }
  let alive = true, turn = 0, rapport = 50;
  const results = [];
  const voice = sc.partner.avatar.voice;

  const av = avatarSvg(sc.partner.avatar, { mood: 'smile', cls: 'stage-av', title: sc.partner.name });
  const stage = h('section', { class: 'chat-stage', html: backdrop(sc.scene) + av },
    h('div', { class: 'chat-name' }, h('b', {}, sc.partner.name), h('small', {}, sc.partner.role)));
  const avEl = stage.querySelector('.stage-av');
  const meter = h('div', { class: 'rapport', title: 'Rapport', 'aria-label': 'Rapport' }, h('span', { html: icon('heart') }), h('div', { class: 'rapport-bar' }, h('i')));
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const dock = h('div', { class: 'chat-dock' });
  const muteBtn = iconBtn(store.get().settings.voice ? 'volume' : 'mute', 'Voice on or off', () => {
    store.update((s) => { s.settings.voice = !s.settings.voice; });
    muteBtn.innerHTML = icon(store.get().settings.voice ? 'volume' : 'mute');
    if (!store.get().settings.voice) tts.cancel();
  });
  const screen = h('div', { class: 'screen chat' },
    topBar(sc.title, { back: '#/smalltalk', right: muteBtn }),
    stage,
    h('div', { class: 'chat-goal' }, h('span', { html: icon('target') }), h('span', { class: 'chat-goal-text', title: sc.goal }, sc.goal), meter),
    log, dock);
  root.append(screen);
  updateMeter();

  function updateMeter() { meter.querySelector('i').style.width = `${rapport}%`; meter.querySelector('i').className = rapport >= 60 ? 'good' : rapport >= 40 ? 'ok' : 'bad'; }

  async function partnerSays(text, mood = 'smile') {
    const typing = h('div', { class: 'msg them typing' }, h('span'), h('span'), h('span'));
    log.append(typing);
    scrollDown();
    await sleep(500 + Math.min(900, text.length * 12));
    if (!alive) return;
    typing.replaceWith(h('div', { class: 'msg them' }, h('small', {}, sc.partner.name.toUpperCase()), h('p', {}, text)));
    scrollDown();
    setMood(avEl, mood);
    if (store.get().settings.voice && tts.supported) {
      avEl.classList.add('talking');
      await tts.speak(text, { kind: voice });
      avEl.classList.remove('talking');
    } else {
      avEl.classList.add('talking');
      await sleep(Math.min(2400, 300 + text.split(/\s+/).length * 140));
      avEl.classList.remove('talking');
    }
  }

  function scrollDown() { requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); }

  async function playTurn() {
    if (!alive) return;
    const t = sc.turns[turn];
    dock.replaceChildren(h('p', { class: 'muted center small' }, `${sc.partner.name} is talking…`));
    await partnerSays(t.say, turn === 0 ? 'smile' : avEl.dataset.mood);
    if (!alive) return;
    playTurnOptions(t);
  }

  async function choose(o, custom = null) {
    tts.cancel();
    screen.classList.remove('choosing');
    avEl.classList.remove('talking');
    const r = REACT[o.rating];
    results.push(o.rating);
    rapport = Math.max(0, Math.min(100, rapport + (o.rating === 'positive' ? 12 : o.rating === 'neutral' ? 2 : -14)));
    updateMeter();
    o.rating === 'positive' ? sfx.good() : o.rating === 'negative' ? sfx.bad() : sfx.tap();
    log.append(
      h('div', { class: `react ${o.rating}` }, h('span', { html: icon(r.icon) }), r.label),
      h('div', { class: `msg you ${o.rating}` }, h('small', {}, 'YOU'), h('p', {}, custom ? custom.text : o.text)),
      h('div', { class: 'coach' }, h('span', { html: icon('sparkles') }), h('div', {}, custom ? custom.tips.map((tip) => h('p', {}, tip)) : h('p', {}, o.feedback))));
    scrollDown();
    dock.replaceChildren();
    setMood(avEl, r.moods[Math.floor(Math.random() * r.moods.length)]);
    await sleep(700);
    await partnerSays(o.reply, avEl.dataset.mood);
    if (!alive) return;
    turn++;
    const last = turn >= sc.turns.length;
    dock.replaceChildren(h('button', { type: 'button', class: 'btn primary wide', onclick: last ? finish : playTurn }, last ? 'See how it went' : 'Continue'));
  }

  function ownWords(t) {
    const area = h('textarea', { class: 'own-input', rows: 3, placeholder: 'Type what you’d say…', maxlength: 400 });
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null;
    const micBtn = Recognition ? h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Speak your reply', onclick: () => {
      if (rec) { rec.stop(); return; }
      rec = new Recognition();
      rec.lang = 'en-US'; rec.interimResults = true;
      const before = area.value;
      micBtn.classList.add('live');
      rec.onresult = (e) => { area.value = (before + ' ' + [...e.results].map((x) => x[0].transcript).join(' ')).trim(); };
      rec.onend = () => { rec = null; micBtn.classList.remove('live'); };
      rec.onerror = () => toast('Couldn’t hear that. Try typing instead.');
      rec.start();
    }, html: icon('mic') }) : null;
    screen.classList.add('choosing');
    dock.replaceChildren(
      h('p', { class: 'dock-label' }, 'Your own words'),
      area,
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { rec?.stop(); playTurnOptions(t); } }, 'Back'),
        micBtn,
        h('button', { type: 'button', class: 'btn primary grow', onclick: () => {
          const text = area.value.trim();
          if (!text) { area.focus(); return; }
          rec?.stop();
          const ev = evaluateReply(text, t.say);
          const reply = GENERIC[ev.rating][Math.floor(Math.random() * GENERIC[ev.rating].length)];
          choose({ rating: ev.rating, reply }, { text, tips: ev.tips });
        } }, h('span', { html: icon('send') }), ' Send')));
    area.focus();
  }

  function playTurnOptions(t) {
    screen.classList.add('choosing');
    scrollDown();
    const opts = shuffle(t.options);
    dock.replaceChildren(
      h('p', { class: 'dock-label' }, 'What do you say?'),
      ...opts.map((o) => h('button', { type: 'button', class: 'reply-opt', onclick: () => choose(o) }, o.text)),
      h('button', { type: 'button', class: 'link-btn', onclick: () => ownWords(t) }, h('span', { html: icon('edit') }), ' Say it my way'));
  }

  async function finish() {
    const pts = results.reduce((a, r) => a + (r === 'positive' ? 2 : r === 'neutral' ? 1 : 0), 0);
    const pct = pts / (results.length * 2);
    const positives = results.filter((r) => r === 'positive').length;
    const xp = 10 + positives * 5 + results.filter((r) => r === 'neutral').length * 2;
    store.update((s) => {
      const prev = s.smalltalk[sc.id];
      s.smalltalk[sc.id] = { best: Math.max(prev?.best || 0, pct), plays: (prev?.plays || 0) + 1, at: Date.now() };
      store.addXp(xp);
      store.award('icebreaker');
      if (positives === results.length) store.award('charmer');
    });
    if (pct >= 0.75) { sfx.win(); confetti(); }
    const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
    setMood(avEl, pct >= 0.6 ? 'laugh' : 'neutral');
    dock.replaceChildren(h('section', { class: 'chat-summary' },
      h('div', { class: 'stars', 'aria-label': `${stars} of 3 stars` }, ...[1, 2, 3].map((n) => h('span', { class: n <= stars ? 'on' : '', html: icon('star') }))),
      h('h3', {}, pct >= 0.9 ? 'Great conversation!' : pct >= 0.6 ? 'Nice chat!' : 'Good practice'),
      h('p', { class: 'muted' }, `${positives} of ${results.length} replies landed well · +${xp} XP`),
      h('p', { class: 'takeaway-line' }, sc.takeaway),
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn ghost grow', onclick: () => { root.replaceChildren(); cleanup(); smalltalkScreen(root, { id }); } }, 'Play again'),
        h('a', { class: 'btn primary grow', href: '#/smalltalk' }, 'More chats'))));
    await celebrateBadges();
  }

  function cleanup() { alive = false; tts.cancel(); }
  playTurn();
  return cleanup;
}

const GENERIC = {
  positive: ['Ha, I like that.', 'Oh, good question!', 'That’s a fun way to put it.', 'Oh nice, tell me more about that later.'],
  neutral: ['Mm, yeah.', 'Right, sure.', 'Okay, yeah.'],
  negative: ['Oh… okay.', 'Huh. Alright.', 'Hmm.'],
};

const STOP = new Set('a an the and or but so to of in on at for with is are was were be been it its this that i you we they he she my your our their me us them do did does have has had not no yes just very really what how why when where who im i’m it’s its your youre you’re oh well yeah'.split(' '));

/** Heuristic coaching for a free-text reply. Returns { rating, tips }. */
export function evaluateReply(text, partnerLine) {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}'’?\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const tips = [];
  let score = 0;
  const n = words.length;
  const isQuestion = /\?/.test(text) || /^(what|how|why|where|when|who|which|do|did|does|are|is|was|have|has|would|could|can|any)\b/i.test(text.trim());
  const open = /\b(what|how|why|tell me|what’s|what's)\b/i.test(text);
  const theirs = new Set(partnerLine.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
  const echoed = words.filter((w) => theirs.has(w.replace(/[?']/g, '')));
  const selfWords = words.filter((w) => /^(i|i’m|im|i'm|me|my|mine|i’ve|i've)$/.test(w)).length;
  const warm = /\b(congrats|congratulations|nice|love|great|awesome|cool|fun|amazing|glad|happy|interesting|exciting|impressive|thanks|thank you|sounds good|wow)\b/i.test(text);
  const cold = /\b(hate|boring|ugh|whatever|stupid|worst|terrible|don’t care|don't care|who cares|lame|annoying|shut up)\b/i.test(text);

  if (n <= 2) { score -= 2; tips.push('Very short answers can stall a conversation. Add a detail or a question.'); }
  else if (n > 55) { score -= 1; tips.push('That’s a lot at once. Keep replies shorter so they get a turn.'); }
  else score += 1;
  if (isQuestion) { score += open ? 2 : 1; tips.push(open ? 'Nice open question: it invites a real answer.' : 'Good to ask a question. Open ones (what, how) usually go further than yes or no.'); }
  else tips.push('Try ending with a question to hand the conversation back.');
  if (echoed.length) { score += 1; tips.push(`You picked up on what they said (“${echoed[0].replace(/[?']/g, '')}”). That shows you were listening.`); }
  if (selfWords > 0 && isQuestion) { score += 1; tips.push('Sharing a little about yourself and then asking back is a great balance.'); }
  else if (selfWords >= 4 && !isQuestion) { score -= 1; tips.push('This one is mostly about you. Bring them back in.'); }
  if (warm) { score += 1; tips.push('Warm words help people relax.'); }
  if (cold) { score -= 2; tips.push('Negative or dismissive words can put people on guard, especially early on.'); }
  const rating = score >= 3 ? 'positive' : score >= 1 ? 'neutral' : 'negative';
  return { rating, tips: tips.slice(0, 3) };
}
