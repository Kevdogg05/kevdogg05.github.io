#!/usr/bin/env node
// Tests the speech analysis on synthetic "speech": voiced syllables with a known
// rate, pitch contour and pauses, plus transcript-based checks.
// Usage: node parley/tools/test-analysis.mjs
import assert from 'node:assert/strict';
import { analyze, markFillers, tokenize, readingAccuracy, syllableCount, frameLevels, voiceActivity, pitchTrack, syllables } from '../js/speech/analysis.js';

const SR = 16000;
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

/**
 * plan: array of items: { syl: count, gap } speech run, or { pause: seconds } or { hum: seconds } (flat "uhh").
 * f0: (t) => Hz. Returns { pcm, syllables, pauses }.
 */
function synth(plan, f0 = () => 140, { amp = 0.3, noise = 0.001, sylDur = 0.17, sylGap = 0.08 } = {}) {
  const chunks = [];
  let t = 0, phase = 0, nSyl = 0;
  const push = (len, fn) => {
    const buf = new Float32Array(Math.round(len * SR));
    for (let i = 0; i < buf.length; i++) {
      const tt = t + i / SR;
      buf[i] = fn(i / buf.length, tt) + noise * rnd();
    }
    chunks.push(buf);
    t += len;
  };
  const voiced = (env, tt, a = amp) => {
    phase += (2 * Math.PI * f0(tt)) / SR;
    return a * env * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
  };
  push(0.4, () => 0);
  for (const item of plan) {
    if (item.pause) push(item.pause, () => 0);
    else if (item.hum) push(item.hum, (u, tt) => voiced(Math.min(1, u * 10, (1 - u) * 10), tt, amp * 0.6));
    else {
      for (let s = 0; s < item.syl; s++) {
        const loud = item.loud ? item.loud[s % item.loud.length] : 1;
        push(sylDur, (u, tt) => voiced(Math.sin(Math.PI * u) ** 1.5, tt, amp * loud));
        nSyl++;
        if (s < item.syl - 1) push(sylGap, () => 0);
      }
    }
  }
  push(0.4, () => 0);
  const pcm = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  return { pcm, nSyl, duration: t };
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.log(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

// ------------------------------------------------------------------ building blocks
test('syllable counter', () => {
  assert.equal(syllableCount('cat'), 1);
  assert.equal(syllableCount('conversation'), 4);
  assert.equal(syllableCount('make'), 1);
  assert.equal(syllableCount('table'), 2);
  assert.equal(syllableCount('wanted'), 2);
});

test('filler words are flagged in context', () => {
  const marked = markFillers(tokenize('So um I was like totally lost, you know, and I like pizza but I mean it was kind of fun'));
  const labels = marked.filter((w) => w.filler > 0).map((w) => w.label);
  assert.deepEqual(labels, ['um', 'like', 'you know', 'I mean', 'kind of']);
  // "do you know" is a real question, "I like pizza" is a real verb
  assert.equal(markFillers(tokenize('do you know the way')).filter((w) => w.filler > 0).length, 0);
});

test('reading accuracy against a passage', () => {
  const ref = 'The quick brown fox jumps over the lazy dog near the river bank';
  assert.equal(readingAccuracy(ref, ref).accuracy, 1);
  const r = readingAccuracy(ref, 'the quick brown fox jumps over the lazy dog');
  assert.equal(r.accuracy, 1);
  assert.ok(r.coverage > 0.6 && r.coverage < 0.8, `coverage ${r.coverage}`);
  assert.ok(readingAccuracy(ref, 'the quick brown box jumps over a lazy log near the river bank').accuracy < 0.85);
});

// ------------------------------------------------------------------ signal processing
test('voice activity finds pauses', () => {
  const { pcm } = synth([{ syl: 6 }, { pause: 0.8 }, { syl: 6 }, { pause: 1.2 }, { syl: 4 }]);
  const db = frameLevels(pcm, SR);
  const vad = voiceActivity(db);
  assert.equal(vad.regions.length, 3, `regions: ${vad.regions.length}`);
});

test('pitch tracker recovers a steady pitch', () => {
  const { pcm } = synth([{ syl: 10 }], () => 180);
  const db = frameLevels(pcm, SR);
  const vad = voiceActivity(db);
  const p = Array.from(pitchTrack(pcm, SR, vad.sp)).filter((v) => v > 0);
  const med = p.sort((a, b) => a - b)[p.length >> 1];
  assert.ok(Math.abs(med - 180) < 6, `median pitch ${med}`);
});

test('syllable nuclei count is close to the truth', () => {
  const { pcm, nSyl } = synth([{ syl: 12 }, { pause: 0.6 }, { syl: 15 }, { pause: 0.6 }, { syl: 10 }]);
  const db = frameLevels(pcm, SR);
  const vad = voiceActivity(db);
  const pitch = pitchTrack(pcm, SR, vad.sp);
  const peaks = syllables(db, vad.sp, pitch, vad.thr);
  assert.ok(Math.abs(peaks.length - nSyl) <= nSyl * 0.15, `found ${peaks.length} of ${nSyl}`);
});

// ------------------------------------------------------------------ whole analysis
const lively = (t) => 150 * 2 ** ((4.5 * Math.sin(t * 1.3)) / 12);   // pitch SD ≈ 3.2 semitones

test('steady, expressive speech scores well', () => {
  // ~3.9 syllables/s while speaking, with short pauses → about 150 wpm overall
  const plan = [];
  for (let i = 0; i < 8; i++) plan.push({ syl: 11, loud: [1, 0.6, 0.8, 0.45, 1, 0.7] }, { pause: 0.55 });
  const { pcm } = synth(plan, lively, { sylDur: 0.16, sylGap: 0.06 });
  const r = analyze({ pcm, sr: SR });
  assert.ok(r.ok, 'analysis ok');
  assert.ok(r.wpm > 125 && r.wpm < 185, `wpm ${r.wpm}`);
  assert.ok(r.metrics.pitch.score >= 70, `pitch score ${r.metrics.pitch.score}`);
  assert.ok(r.metrics.pauses.score >= 70, `pause score ${r.metrics.pauses.score}`);
  assert.ok(r.score >= 65, `overall ${r.score} (${r.headline})`);
  assert.ok(r.bars.length === 120);
});

test('rushed monotone speech is flagged', () => {
  const plan = [{ syl: 60 }, { pause: 0.3 }, { syl: 50 }];
  const { pcm } = synth(plan, () => 130, { sylDur: 0.1, sylGap: 0.035 });
  const r = analyze({ pcm, sr: SR });
  assert.ok(r.ok);
  assert.ok(r.wpm > 190, `wpm ${r.wpm}`);
  assert.ok(r.metrics.pace.score < 40, `pace score ${r.metrics.pace.score}`);
  assert.ok(r.metrics.pitch.score < 30, `pitch score ${r.metrics.pitch.score}`);
  assert.match(r.headline, /rushed|monotone|breathless/);
});

test('long silences and hesitation sounds are marked', () => {
  const plan = [{ syl: 10 }, { hum: 0.7 }, { pause: 3.2 }, { syl: 10 }, { pause: 0.6 }, { syl: 9 }];
  const { pcm } = synth(plan, lively);
  const r = analyze({ pcm, sr: SR });
  assert.ok(r.ok);
  const titles = r.markers.map((m) => m.title).join(' | ');
  assert.ok(r.markers.some((m) => m.kind === 'fix' && /silence/.test(m.title)), `markers: ${titles}`);
  assert.ok(r.markers.some((m) => /Filler/.test(m.title)), `markers: ${titles}`);
  assert.ok(r.metrics.fillers.score < 100);
});

test('transcript drives pace, fillers and read-aloud clarity', () => {
  const plan = [];
  for (let i = 0; i < 6; i++) plan.push({ syl: 12 }, { pause: 0.5 });
  const { pcm } = synth(plan, lively, { sylDur: 0.16, sylGap: 0.06 });
  const text = 'so um the morning market opens early and like everyone brings fresh bread bright flowers and the best gossip in town you know it really is the heart of the neighborhood on a sunny day';
  const r = analyze({ pcm, sr: SR, transcript: [{ text, start: 0.4, end: 9, confidence: 0.9 }] });
  assert.ok(r.ok);
  assert.ok(r.metrics.fillers.score < 90, `filler score ${r.metrics.fillers.score}`);
  assert.equal(r.transcript.filter((w) => w.f).length, 3);
  const read = analyze({ pcm, sr: SR, transcript: [{ text: 'the morning market opens early and everyone brings fresh bread', start: 0.4, end: 5, confidence: 0.9 }], reference: 'The morning market opens early, and everyone brings fresh bread, bright flowers and gossip.' });
  assert.ok(read.metrics.clarity.score >= 95, `clarity ${read.metrics.clarity.score}`);
});

test('silence is rejected, transcript-only still works', () => {
  const silent = new Float32Array(SR * 4).map(() => 0.0005 * rnd());
  assert.equal(analyze({ pcm: silent, sr: SR }).ok, false);
  const r = analyze({ pcm: silent, sr: SR, transcript: [{ text: 'hello there I am talking about my weekend and the hike we took', start: 0.2, end: 4, confidence: 0.92 }] });
  assert.ok(r.ok && r.metrics.pace && !r.metrics.pitch, 'transcript-only result');
});

console.log(`\n${passed} passed${process.exitCode ? ', some failed' : ''}.`);
