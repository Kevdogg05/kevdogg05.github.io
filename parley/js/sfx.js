// Tiny synthesized sound effects (no audio files).
import * as store from './store.js';

let ctx;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', gain = 0.12 } = {}) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

const on = () => store.get().settings.sound !== false;

export function good() { if (!on()) return; tone(660, 0, 0.14); tone(990, 0.09, 0.22); }
export function bad() { if (!on()) return; tone(220, 0, 0.22, { type: 'triangle', gain: 0.1 }); navigator.vibrate?.(40); }
export function tap() { if (!on()) return; tone(520, 0, 0.06, { gain: 0.05 }); }
export function win() { if (!on()) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.3, { gain: 0.1 })); }
