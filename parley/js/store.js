// Progress, XP, streaks, badges and settings, saved in localStorage on this device.
const KEY = 'parley.v1';

const DEFAULTS = () => ({
  profile: { name: '', goals: [], dailyGoal: 40, onboarded: false, createdAt: Date.now() },
  settings: { voice: true, sound: true, rate: 1, theme: 'auto', autoplay: true, transcribe: true, voiceName: '' },
  xp: 0,
  streak: { count: 0, best: 0, last: '' },
  activity: {},          // 'YYYY-MM-DD' → xp earned that day
  lessons: {},           // lessonId → { best, correct, total, at }
  smalltalk: {},         // id → { best, plays, at }
  scenarios: {},         // id → { endings: [nodeId], best: 'good'|'mixed'|'poor', at }
  speech: [],            // newest first: result summaries
  cards: {},             // cardId → { box, due }
  cardsReviewed: 0,
  badges: {},            // badgeId → timestamp
  lastLesson: '',
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return DEFAULTS();
    const d = DEFAULTS();
    return { ...d, ...raw, profile: { ...d.profile, ...raw.profile }, settings: { ...d.settings, ...raw.settings }, streak: { ...d.streak, ...raw.streak } };
  } catch {
    return DEFAULTS();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  listeners.forEach((fn) => fn(state));
}

export const get = () => state;
export function update(fn) { fn(state); save(); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetAll() {
  state = DEFAULTS();
  save();
}

// ------------------------------------------------------------------ days and streaks
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) {
  const pa = new Date(a + 'T12:00:00'), pb = new Date(b + 'T12:00:00');
  return Math.round((pb - pa) / 86400000);
}

/** Current streak, counting today only if there was activity (yesterday keeps it alive). */
export function currentStreak() {
  const { last, count } = state.streak;
  if (!last) return 0;
  const gap = daysBetween(last, dayKey());
  return gap <= 1 ? count : 0;
}

export const todayXp = () => state.activity[dayKey()] || 0;

// ------------------------------------------------------------------ levels
const LEVEL_NAMES = ['Listener', 'Conversationalist', 'Connector', 'Storyteller', 'Presence', 'Influencer', 'Orator', 'Luminary'];
export function levelInfo(xp = state.xp) {
  let level = 1;
  while (xp >= 60 * level * (level + 1)) level++;          // level 2 at 120 XP, 3 at 360, 4 at 720 …
  const floor = level === 1 ? 0 : 60 * (level - 1) * level;
  const next = 60 * level * (level + 1);
  return { level, name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], floor, next, pct: (xp - floor) / (next - floor) };
}

// ------------------------------------------------------------------ XP and badges
export const BADGES = [
  { id: 'first-lesson', name: 'First Step', desc: 'Finish your first lesson', icon: 'sparkles', tone: 'blue' },
  { id: 'perfect-quiz', name: 'Sharp Mind', desc: 'Ace every question in a lesson quiz', icon: 'diamond', tone: 'blue' },
  { id: 'course-complete', name: 'Course Champion', desc: 'Finish every lesson in a course', icon: 'trophy', tone: 'gold' },
  { id: 'streak-3', name: 'On a Roll', desc: 'Practice three days in a row', icon: 'flame', tone: 'rose' },
  { id: 'streak-7', name: 'Week Strong', desc: 'Practice seven days in a row', icon: 'flame', tone: 'gold' },
  { id: 'first-recording', name: 'Mic Check', desc: 'Analyze your first recording', icon: 'mic', tone: 'teal' },
  { id: 'score-80', name: 'Smooth Voice', desc: 'Score 80 or more in the Speech Analyzer', icon: 'wave', tone: 'teal' },
  { id: 'icebreaker', name: 'Ice Breaker', desc: 'Finish a small talk chat', icon: 'chat', tone: 'purple' },
  { id: 'charmer', name: 'Charmer', desc: 'Get only positive reactions in a chat', icon: 'heart', tone: 'rose' },
  { id: 'scene-stealer', name: 'Scene Stealer', desc: 'Reach a strong ending in a scenario', icon: 'film', tone: 'purple' },
  { id: 'directors-cut', name: 'Director’s Cut', desc: 'Reach a strong ending in every scenario', icon: 'star', tone: 'gold' },
  { id: 'memory', name: 'Memory Master', desc: 'Review 25 flashcards', icon: 'cards', tone: 'blue' },
  { id: 'xp-500', name: 'Rising Star', desc: 'Earn 500 XP', icon: 'bolt', tone: 'gold' },
];

let pendingBadges = [];
export function takeNewBadges() { const b = pendingBadges; pendingBadges = []; return b; }

export function award(id) {
  if (state.badges[id]) return false;
  state.badges[id] = Date.now();
  const b = BADGES.find((x) => x.id === id);
  if (b) pendingBadges.push(b);
  return true;
}

/** Add XP, count today's activity and extend the streak. */
export function addXp(n) {
  const today = dayKey();
  state.xp += n;
  state.activity[today] = (state.activity[today] || 0) + n;
  const { last } = state.streak;
  if (last !== today) {
    const gap = last ? daysBetween(last, today) : 99;
    state.streak.count = gap === 1 ? state.streak.count + 1 : 1;
    state.streak.last = today;
    state.streak.best = Math.max(state.streak.best, state.streak.count);
  }
  if (state.streak.count >= 3) award('streak-3');
  if (state.streak.count >= 7) award('streak-7');
  if (state.xp >= 500) award('xp-500');
  // keep 120 days of activity
  const keys = Object.keys(state.activity).sort();
  while (keys.length > 120) delete state.activity[keys.shift()];
}

/** Last 7 days of XP, oldest first. */
export function week() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: d.toLocaleDateString([], { weekday: 'narrow' }), xp: state.activity[dayKey(d)] || 0, today: i === 0 });
  }
  return out;
}
