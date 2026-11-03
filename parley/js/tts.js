// Text-to-speech through the browser's speechSynthesis. Lines are spoken one at a
// time; each speak() resolves when the line ends or is cancelled.
import * as store from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
export const supported = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';

let voices = [];
function loadVoices() {
  if (!supported) return;
  voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
}
if (supported) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export function listVoices() { loadVoices(); return voices; }

const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|serena|allison|ava|aria|jenny|libby|sonia|michelle|emma|olivia|natasha|joanna|salli|kimberly|kendra|ivy|amy|google us english$/i;
const MALE = /\bmale\b|daniel|alex\b|fred|david|mark|george|guy|ryan|davis|christopher|eric|brian|andrew|thomas|oliver|arthur|matthew|joey|justin|russell|rishi|google uk english male/i;

function pickVoice(kind) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;
  const chosen = store.get().settings.voiceName;
  const isF = (v) => FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/ig, ''));
  const isM = (v) => MALE.test(v.name.replace(/female/ig, ''));
  const local = (list) => list.sort((a, b) => (b.localService - a.localService) || (/^en-US/i.test(b.lang) - /^en-US/i.test(a.lang)));
  if (kind === 'n') {
    const named = voices.find((v) => v.name === chosen);
    if (named) return named;
    return local(voices.filter((v) => /^en-US/i.test(v.lang)))[0] || voices[0];
  }
  const pool = voices.filter(kind === 'f' ? isF : isM);
  return local(pool)[0] || null;
}

let current = null;

/**
 * Speak a line. kind: 'n' narrator, 'm' male, 'f' female.
 * Resolves { ok } when done; ok is false if it was cancelled or failed.
 */
export function speak(text, { kind = 'n', rate = null, onstart } = {}) {
  return new Promise((resolve) => {
    if (!supported || !text) { resolve({ ok: false }); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(kind);
    if (v) u.voice = v;
    u.lang = v?.lang || 'en-US';
    u.rate = rate ?? store.get().settings.rate ?? 1;
    // When no gendered voice is available, shift pitch so speakers sound different.
    u.pitch = kind === 'm' ? (v && MALE.test(v.name) ? 1 : 0.82) : kind === 'f' ? (v && FEMALE.test(v.name) ? 1.05 : 1.22) : 1;
    let settled = false;
    const done = (ok) => { if (settled) return; settled = true; if (current === u) current = null; clearInterval(keepAlive); resolve({ ok }); };
    u.onstart = () => onstart?.();
    u.onend = () => done(true);
    u.onerror = () => done(false);
    u._cancel = () => done(false);
    // Chrome desktop stops long utterances after ~15 s unless nudged.
    const keepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10000);
    current = u;
    synth.speak(u);
    // Safety net: some engines never fire onend.
    const words = text.split(/\s+/).length;
    setTimeout(() => done(true), (words / 2 / u.rate) * 1000 + 6000);
  });
}

export function cancel() {
  if (!supported) return;
  const u = current;
  current = null;
  synth.cancel();
  u?._cancel?.();
}

export const speaking = () => supported && synth.speaking;
