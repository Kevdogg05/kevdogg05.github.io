// Speech analysis. Pure functions with no DOM, so they also run under Node for tests.
//
// analyze({ pcm, sr, transcript, reference }) takes mono PCM (Float32Array) and an
// optional transcript [{ text, start, end, confidence }] from speech recognition,
// and returns scores, a headline, timeline markers and waveform bars.
//
// What is measured, and how:
//   voice activity  frame loudness against an adaptive noise floor
//   pauses          silent gaps between stretches of speech
//   pace            words per minute from the transcript, or from syllable nuclei
//                   (loudness peaks in voiced speech) when there is no transcript
//   pitch variety   spread of the voice's pitch (YIN pitch tracker) in semitones
//   energy variety  spread of loudness across syllables
//   fillers         "um", "uh", filler "like", "you know"… in the transcript, plus
//                   sustained flat hesitation sounds found in the audio
//   clarity         word accuracy against the passage (read-aloud mode), else the
//                   recognizer's confidence, else syllable crispness (estimate)

const HOP = 0.01;   // 10 ms analysis frames

// ------------------------------------------------------------------ helpers
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Piecewise-linear lookup through [[x, y], …] (x ascending). */
export function curve(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

// ------------------------------------------------------------------ framing
export function frameLevels(pcm, sr) {
  const hop = Math.round(sr * HOP), win = Math.round(sr * 0.025);
  const n = Math.max(0, Math.floor((pcm.length - win) / hop) + 1);
  const db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    const o = f * hop;
    for (let i = 0; i < win; i++) { const v = pcm[o + i]; s += v * v; }
    db[f] = 10 * Math.log10(s / win + 1e-12);
  }
  return db;
}

/** Speech/non-speech per frame, plus contiguous regions [startFrame, endFrame). */
export function voiceActivity(db) {
  const n = db.length;
  const all = Array.from(db);
  const floor = pct(all, 0.1), peak = pct(all, 0.98);
  let thr = Math.max(floor + 9, peak - 32, -62);
  if (peak - floor < 14) thr = floor + (peak - floor) * 0.55;
  const sp = new Uint8Array(n);
  for (let i = 0; i < n; i++) sp[i] = db[i] > thr ? 1 : 0;
  // fill short gaps (< 180 ms) and drop short blips (< 70 ms)
  fillRuns(sp, 0, 18);
  fillRuns(sp, 1, 7);
  const regions = [];
  for (let i = 0; i < n;) {
    if (!sp[i]) { i++; continue; }
    let j = i;
    while (j < n && sp[j]) j++;
    regions.push([i, j]);
    i = j;
  }
  return { sp, regions, thr, floor, peak };
}
function fillRuns(arr, value, maxLen) {
  const n = arr.length;
  for (let i = 0; i < n;) {
    if (arr[i] !== value) { i++; continue; }
    let j = i;
    while (j < n && arr[j] === value) j++;
    const inner = i > 0 && j < n;
    if (inner && j - i < maxLen) for (let k = i; k < j; k++) arr[k] = value ? 0 : 1;
    if (value === 1 && j - i < maxLen) for (let k = i; k < j; k++) arr[k] = 0;
    i = j;
  }
}

// ------------------------------------------------------------------ pitch (YIN)
/** Pitch in Hz per 10 ms frame (0 when unvoiced). Only frames with speech are analysed. */
export function pitchTrack(pcm, sr, sp) {
  // downsample to ~8 kHz
  const factor = Math.max(1, Math.round(sr / 8000));
  const rate = sr / factor;
  const m = Math.floor(pcm.length / factor);
  const x = new Float32Array(m);
  for (let i = 0; i < m; i++) { let s = 0; for (let k = 0; k < factor; k++) s += pcm[i * factor + k]; x[i] = s / factor; }
  const W = Math.round(rate * 0.04), tmin = Math.floor(rate / 420), tmax = Math.ceil(rate / 70);
  const n = sp.length;
  const out = new Float32Array(n);
  const d = new Float32Array(tmax + 2);
  for (let f = 0; f < n; f += 2) {          // every 20 ms
    if (!sp[f]) continue;
    const start = Math.round(f * HOP * rate);
    if (start + W + tmax >= m) break;
    d[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tmax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = x[start + j] - x[start + j + tau]; s += v * v; }
      run += s;
      d[tau] = run > 0 ? (s * tau) / run : 1;
    }
    let tau = -1;
    for (let t = tmin; t <= tmax; t++) {
      if (d[t] < 0.15) { while (t + 1 <= tmax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) {
      let best = tmin;
      for (let t = tmin; t <= tmax; t++) if (d[t] < d[best]) best = t;
      if (d[best] < 0.3) tau = best;
    }
    if (tau > 0) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b;
      const shift = (a - 2 * b + c) !== 0 ? 0.5 * (a - c) / (a - 2 * b + c) : 0;
      const hz = rate / (tau + clamp(shift, -0.5, 0.5));
      out[f] = hz;
      if (f + 1 < n) out[f + 1] = hz;
    }
  }
  return cleanPitch(out);
}

function cleanPitch(p) {
  const voiced = Array.from(p).filter((v) => v > 0);
  if (voiced.length < 5) return p;
  const med = median(voiced);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) {
    if (!p[i]) continue;
    const st = 12 * Math.log2(p[i] / med);
    if (Math.abs(st) > 9) continue;                     // octave errors and outliers
    // local median of 5 voiced neighbours
    const win = [];
    for (let k = i - 4; k <= i + 4; k++) if (k >= 0 && k < p.length && p[k] > 0) win.push(p[k]);
    const lm = median(win);
    out[i] = Math.abs(12 * Math.log2(p[i] / lm)) > 4 ? lm : p[i];
  }
  return out;
}

// ------------------------------------------------------------------ syllables
/** Syllable nuclei: prominent loudness peaks in voiced speech. Returns frames plus dip depths. */
export function syllables(db, sp, pitch, thr) {
  const n = db.length, sm = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < n) { s += db[k]; c++; } sm[i] = s / c; }
  const voicedShare = pitch.reduce((a, v, i) => a + (v > 0 && sp[i] ? 1 : 0), 0) / Math.max(1, sp.reduce((a, v) => a + v, 0));
  const needVoice = voicedShare > 0.25;
  const isVoiced = (i) => { for (let k = i - 3; k <= i + 3; k++) if (pitch[k] > 0) return true; return false; };
  const peaks = [];   // { f, db, dip }
  let valley = Infinity;  // lowest level since the last kept peak
  for (let i = 1; i < n - 1; i++) {
    valley = Math.min(valley, sm[i]);
    if (!sp[i]) continue;
    if (!(sm[i] >= sm[i - 1] && sm[i] > sm[i + 1])) continue;    // local maximum
    if (sm[i] < thr + 2) continue;
    if (needVoice && !isVoiced(i)) continue;
    const last = peaks[peaks.length - 1];
    const dip = (last ? Math.min(last.db, sm[i]) : sm[i]) - valley;
    if (!last || (dip >= 2 && i - last.f >= 8)) {
      peaks.push({ f: i, db: sm[i], dip: Math.min(dip, 20) });
      valley = sm[i];
    } else if (sm[i] > last.db) {                                // same syllable: keep the higher peak
      last.f = i; last.db = sm[i]; valley = sm[i];
    }
  }
  return peaks;
}

// ------------------------------------------------------------------ transcript
const STOP = new Set('a an the and or but so to of in on at for with is are was were be been it its it’s this that i you we they he she my your our their me us them do did does have has had not no yes just very really what how why when where who'.split(' '));
const LIKE_BEFORE = new Set(['was', 'is', 'are', 'were', "it's", 'it’s', 'and', 'but', 'so', 'just', "i'm", 'i’m', "he's", "she's", "they're", "we're", 'like', 'um', 'uh']);

export function tokenize(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}'’\s-]/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Flags filler words. Returns [{ w, filler: weight 0 | 0.5 | 1, label }]. */
export function markFillers(words) {
  const out = words.map((w) => ({ w, filler: 0, label: '' }));
  for (let i = 0; i < out.length; i++) {
    const w = out[i].w, prev = out[i - 1]?.w, next = out[i + 1]?.w;
    if (/^(u+m+|u+h+|e+r+m*|a+h+|h+m+|m+|uhm)$/.test(w)) { out[i].filler = 1; out[i].label = w; }
    else if (w === 'like' && (i === 0 || LIKE_BEFORE.has(prev))) { out[i].filler = 1; out[i].label = 'like'; }
    else if (w === 'you' && next === 'know' && prev !== 'do' && prev !== 'did' && prev !== 'if' && !/^(what|that|how|where|why|who|if|the|about)$/.test(out[i + 2]?.w || '')) {
      out[i].filler = 1; out[i].label = 'you know'; out[i + 1].filler = -1; i++;
    } else if (w === 'i' && next === 'mean' && (i === 0 || /^(and|but|so|like|um|uh|yeah|well|no)$/.test(prev || '')) && !/^(that|is|what|to|by)$/.test(out[i + 2]?.w || '')) {
      out[i].filler = 1; out[i].label = 'I mean'; out[i + 1].filler = -1; i++;
    } else if (/^(basically|literally|actually)$/.test(w)) { out[i].filler = 0.5; out[i].label = w; }
    else if ((w === 'kind' || w === 'sort') && next === 'of') { out[i].filler = 0.5; out[i].label = `${w} of`; out[i + 1].filler = -1; i++; }
  }
  return out;
}

export function syllableCount(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  if (w.length <= 3) return 1;
  let groups = (w.match(/[aeiouy]+/g) || []).length;
  if (/[^l]e$/.test(w) && groups > 1) groups--;
  if (/(es|ed)$/.test(w) && !/(ted|ded|ses|zes|ces|ges)$/.test(w) && groups > 1) groups--;
  return Math.max(1, groups);
}

/** Word-level edit distance of hyp against the best-matching prefix of ref. */
export function readingAccuracy(refText, hypText) {
  const ref = tokenize(refText), hyp = tokenize(hypText);
  if (!ref.length || !hyp.length) return { accuracy: 0, coverage: 0 };
  const R = ref.length, H = hyp.length;
  let prev = new Array(R + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= H; i++) {
    const cur = [i];
    for (let j = 1; j <= R; j++) {
      const same = ref[j - 1].replace(/’/g, "'") === hyp[i - 1].replace(/’/g, "'");
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (same ? 0 : 1));
    }
    prev = cur;
  }
  let best = Infinity, bestJ = R;
  for (let j = Math.max(1, Math.floor(H * 0.5)); j <= R; j++) if (prev[j] < best || (prev[j] === best && j > bestJ)) { best = prev[j]; bestJ = j; }
  return { accuracy: clamp(1 - best / Math.max(bestJ, H), 0, 1), coverage: bestJ / R };
}

// ------------------------------------------------------------------ main
const WEIGHTS = { pace: 0.24, fillers: 0.2, pauses: 0.14, energy: 0.12, pitch: 0.15, clarity: 0.15 };

export function analyze({ pcm, sr = 16000, transcript = [], reference = null } = {}) {
  const duration = pcm ? pcm.length / sr : 0;
  const notes = [];
  const segs = (transcript || []).filter((s) => s && s.text && s.text.trim());
  const fullText = segs.map((s) => s.text.trim()).join(' ');
  const words = markFillers(tokenize(fullText));
  const realWords = words.filter((w) => w.filler !== -1);

  // ---------- audio features
  let db = new Float32Array(0), vad = { sp: new Uint8Array(0), regions: [], thr: 0, floor: -90, peak: -90 }, pitch = new Float32Array(0), peaks = [];
  if (pcm && pcm.length > sr * 0.5) {
    db = frameLevels(pcm, sr);
    vad = voiceActivity(db);
    pitch = pitchTrack(pcm, sr, vad.sp);
    peaks = syllables(db, vad.sp, pitch, vad.thr);
  }
  const regions = vad.regions;
  const speechFrames = regions.reduce((a, [s, e]) => a + e - s, 0);
  const speechTime = speechFrames * HOP;
  const audioOk = speechTime >= 2.5 && vad.peak - vad.floor >= 10;
  const transcriptOnly = !audioOk && realWords.length >= 5;

  if (!audioOk && !transcriptOnly) {
    return { ok: false, duration, reason: speechTime < 2.5 ? 'short' : 'quiet', bars: bars(pcm) };
  }
  if (transcriptOnly) notes.push('The microphone signal was too weak to measure tone and pauses, so this score uses the transcript only.');

  const spanStart = audioOk ? regions[0][0] * HOP : segs[0]?.start ?? 0;
  const spanEnd = audioOk ? regions[regions.length - 1][1] * HOP : segs[segs.length - 1]?.end ?? duration;
  const span = Math.max(1, spanEnd - spanStart);
  const minutes = span / 60;

  // ---------- word timings: spread transcript words over detected syllables
  const timed = [];
  if (realWords.length) {
    if (audioOk && peaks.length >= 3) {
      const sylls = realWords.map((w) => syllableCount(w.w));
      const totalS = sylls.reduce((a, b) => a + b, 0);
      let acc = 0;
      realWords.forEach((w, i) => {
        const idx = Math.min(peaks.length - 1, Math.floor((acc / totalS) * peaks.length));
        timed.push({ ...w, t: peaks[idx].f * HOP });
        acc += sylls[i];
      });
    } else {
      // distribute within recognizer segments
      for (const s of segs) {
        const ws = markFillers(tokenize(s.text)).filter((w) => w.filler !== -1);
        const a = s.start ?? spanStart, b = Math.max(a + 0.3, s.end ?? a + ws.length * 0.4);
        ws.forEach((w, i) => timed.push({ ...w, t: a + ((b - a) * i) / Math.max(1, ws.length) }));
      }
    }
  }

  // ---------- pace
  const audioWords = peaks.length / 1.4;
  let wpm, wpmSource;
  const tw = realWords.length;
  if (tw >= 8 && audioOk) {
    const ratio = tw / Math.max(1, audioWords);
    if (ratio >= 0.6 && ratio <= 1.6) { wpm = tw / minutes; wpmSource = 'transcript'; }
    else { wpm = (tw + audioWords) / 2 / minutes; wpmSource = 'blend'; }
  } else if (tw >= 5 && !audioOk) { wpm = tw / minutes; wpmSource = 'transcript'; }
  else { wpm = audioWords / minutes; wpmSource = 'audio'; }
  wpm = Math.round(wpm);
  const paceScore = curve(wpm, [[70, 0], [100, 45], [115, 75], [125, 93], [130, 100], [160, 100], [170, 88], [185, 60], [200, 35], [230, 0]]);
  const paceWord = wpm > 180 ? 'rushed' : wpm > 160 ? 'a little fast' : wpm >= 130 ? 'steady' : wpm >= 115 ? 'a little slow' : 'slow';

  // ---------- pauses
  const gaps = [];
  for (let i = 1; i < regions.length; i++) gaps.push({ start: regions[i - 1][1] * HOP, end: regions[i][0] * HOP, len: (regions[i][0] - regions[i - 1][1]) * HOP });
  const pauses = gaps.filter((g) => g.len >= 0.25);
  const pauseTime = pauses.reduce((a, g) => a + g.len, 0);
  const pauseRatio = pauseTime / span;
  const longPauses = pauses.filter((g) => g.len >= 2.5);
  let pauseScore = null;
  if (audioOk) {
    pauseScore = curve(pauseRatio, [[0.02, 40], [0.06, 70], [0.1, 95], [0.12, 100], [0.26, 100], [0.33, 80], [0.42, 55], [0.55, 25]]);
    pauseScore = Math.max(0, pauseScore - Math.min(40, longPauses.length * 10));
  }

  // ---------- pitch variety
  const voicedHz = [];
  for (let i = 0; i < pitch.length; i += 2) if (pitch[i] > 0 && vad.sp[i]) voicedHz.push(pitch[i]);
  let pitchSt = null, pitchScore = null, medHz = 0;
  if (audioOk && voicedHz.length >= 20) {
    medHz = median(voicedHz);
    pitchSt = std(voicedHz.map((hz) => 12 * Math.log2(hz / medHz)));
    pitchScore = curve(pitchSt, [[0.8, 10], [1.5, 35], [2, 60], [2.5, 78], [3, 90], [3.5, 100], [7, 100], [10, 75]]);
  }

  // ---------- energy
  let energyScore = null, energySd = null, quiet = false, speechLevel = null;
  if (audioOk && peaks.length >= 4) {
    energySd = std(peaks.map((p) => p.db));
    speechLevel = median(peaks.map((p) => p.db));
    energyScore = curve(energySd, [[1.5, 15], [2.5, 40], [3.5, 65], [4.5, 85], [5.5, 100], [10, 100], [14, 80]]);
    if (speechLevel < -42) { quiet = true; energyScore = Math.max(0, energyScore - curve(speechLevel, [[-55, 30], [-42, 0]])); }
  }

  // ---------- fillers and hesitations
  const fillerWords = timed.filter((w) => w.filler > 0);
  const hesitations = audioOk ? findHesitations(db, vad, pitch) : [];
  // don't double count a transcript "um" near an audio hesitation
  const umTimes = fillerWords.filter((w) => /^(u+m+|u+h+|e+r+m*|a+h+|uhm|h+m+|m+)$/.test(w.w)).map((w) => w.t);
  const extraHes = hesitations.filter((h) => !umTimes.some((t) => Math.abs(t - h.t) < 0.8));
  const fillerCount = fillerWords.reduce((a, w) => a + w.filler, 0) + extraHes.length;
  const fillersPerMin = fillerCount / minutes;
  const fillerScore = curve(fillersPerMin, [[0, 100], [1, 95], [2, 85], [4, 65], [6, 45], [9, 20], [12, 5]]);

  // ---------- clarity
  let clarityScore = null, clarityBasis = '', readStats = null;
  if (reference && tw >= 3) {
    readStats = readingAccuracy(reference, fullText);
    clarityScore = curve(readStats.accuracy, [[0.4, 10], [0.6, 40], [0.75, 65], [0.85, 82], [0.92, 95], [0.96, 100]]);
    clarityBasis = 'reading';
    if (readStats.coverage < 0.6) notes.push(`You read about ${Math.round(readStats.coverage * 100)}% of the passage. Clarity is scored on the part you read.`);
  } else {
    const conf = segs.map((s) => s.confidence).filter((c) => c > 0.05);
    if (conf.length && tw >= 5) {
      clarityScore = curve(mean(conf), [[0.5, 30], [0.7, 60], [0.8, 76], [0.88, 90], [0.94, 100]]);
      clarityBasis = 'recognizer';
    } else if (audioOk && peaks.length >= 4) {
      const crisp = median(peaks.map((p) => p.dip));
      const snr = vad.peak - vad.floor;
      clarityScore = curve(crisp, [[2, 35], [4, 58], [6, 76], [8, 90], [10, 100]]) - curve(snr, [[10, 25], [20, 0]]);
      clarityScore = clamp(clarityScore, 0, 90);          // an estimate never claims a perfect score
      clarityBasis = 'estimate';
    }
  }

  // ---------- metrics
  const metrics = {
    pace: { label: 'Pace', score: paceScore, value: `${wpm} wpm`, detail: `${wpm} words per minute, ${paceWord}. Aim for 130 to 160 in conversation.${wpmSource === 'audio' ? ' (Estimated from syllables.)' : ''}` },
    fillers: {
      label: 'Filler words', score: fillerScore, value: `${Math.round(fillerCount)}`,
      detail: fillerCount < 0.5 ? 'No fillers or hesitation sounds found. Clean!' : `${Math.round(fillerCount)} found (${fillersPerMin.toFixed(1)} per minute)${fillerSummary(fillerWords, extraHes)}. Swap them for a silent pause.`,
    },
    pauses: pauseScore === null ? null : {
      label: 'Pauses', score: pauseScore, value: `${Math.round(pauseRatio * 100)}%`,
      detail: `${pauses.length} pauses, ${Math.round(pauseRatio * 100)}% of your time. ${pauseRatio < 0.06 ? 'Very few: add short pauses between ideas so people can keep up.' : longPauses.length ? `${longPauses.length} lasted over two and a half seconds; keep pauses short and deliberate.` : pauseRatio > 0.33 ? 'Lots of silence; try to keep momentum between sentences.' : 'Nicely placed breathing room.'}`,
    },
    pitch: pitchScore === null ? null : {
      label: 'Pitch variety', score: pitchScore, value: `${pitchSt.toFixed(1)} st`,
      detail: `Your pitch moved about ${pitchSt.toFixed(1)} semitones around ${Math.round(medHz)} Hz. ${pitchSt < 2 ? 'That reads as flat; lift the key word in each sentence.' : pitchSt > 7 ? 'Very animated; make sure it lands on the words that matter.' : 'Expressive and easy to follow.'}`,
    },
    energy: energyScore === null ? null : {
      label: 'Volume & energy', score: energyScore, value: `${energySd.toFixed(1)} dB`,
      detail: `${quiet ? 'You were quiet overall; move closer or project a little more. ' : ''}${energySd < 3 ? 'Your volume stayed very even; punch key words a little.' : energySd > 10 ? 'Big swings in volume; keep sentence endings strong.' : 'Good emphasis and energy.'}`,
    },
    clarity: clarityScore === null ? null : {
      label: 'Clarity', score: clarityScore, value: clarityBasis === 'reading' ? `${Math.round(readStats.accuracy * 100)}%` : '',
      detail: clarityBasis === 'reading' ? `${Math.round(readStats.accuracy * 100)}% of words were recognized as written.` :
        clarityBasis === 'recognizer' ? 'Based on how confidently your words were recognized.' : 'Estimated from how crisp your syllables were (turn on transcription for a better measure).',
    },
  };
  for (const k of Object.keys(metrics)) { if (!metrics[k]) delete metrics[k]; else metrics[k].score = Math.round(metrics[k].score); }

  let wsum = 0, ssum = 0;
  for (const [k, m] of Object.entries(metrics)) { wsum += WEIGHTS[k]; ssum += WEIGHTS[k] * m.score; }
  const score = Math.round(ssum / wsum);

  const headline = makeHeadline(metrics, { wpm, pauseRatio, longPauses, quiet }, score);

  // ---------- timeline markers
  const markers = buildMarkers({ audioOk, peaks, pitch, db, vad, regions, pauses, longPauses, timed, fillerWords, extraHes, wpm, spanStart });

  return {
    ok: true, duration, span, speechTime, wpm, wpmSource, score, headline, metrics, markers, notes,
    transcript: timed.map((w) => ({ w: w.w, t: Math.round(w.t * 100) / 100, f: w.filler > 0 ? 1 : 0 })),
    text: fullText,
    bars: bars(pcm),
  };
}

function fillerSummary(fillerWords, hes) {
  const counts = {};
  fillerWords.forEach((w) => { counts[w.label] = (counts[w.label] || 0) + 1; });
  if (hes.length) counts['hesitation sounds'] = hes.length;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `“${k}” ×${v}`);
  return top.length ? `: ${top.join(', ')}` : '';
}

/** Sustained, flat-pitched, even-volume voiced sounds next to a pause: "uhhh", "ummm", "sooo". */
function findHesitations(db, vad, pitch) {
  const out = [], L = 35;   // at least 350 ms
  const flat = (i) => {
    if (i + L > pitch.length) return false;
    for (let k = i; k < i + L; k++) if (!(pitch[k] > 0)) return false;
    const hz = Array.from(pitch.slice(i, i + L));
    const m = median(hz);
    if (std(hz.map((v) => 12 * Math.log2(v / m))) > 0.9) return false;
    return std(Array.from(db.slice(i, i + L))) < 2.5;
  };
  for (const [s, e] of vad.regions) {
    if (e - s < L) continue;
    for (const [a, b] of [[s, Math.min(e, s + 80)], [Math.max(s, e - 80), e]]) {
      for (let i = a; i + L <= b; i += 3) {
        if (!flat(i)) continue;
        let j = i;
        while (j + 3 + L <= e && flat(j + 3)) j += 3;
        const t = i * HOP;
        if (!out.some((o) => Math.abs(o.t - t) < 1)) out.push({ t, len: (j + L - i) * HOP });
        break;
      }
    }
  }
  return out;
}

const STRENGTH = { pace: 'Steady', fillers: 'Focused', pauses: 'Composed', energy: 'Energetic', pitch: 'Expressive', clarity: 'Clear' };

function makeHeadline(metrics, ctx, score) {
  const entries = Object.entries(metrics).sort((a, b) => b[1].score - a[1].score);
  const strengths = entries.filter(([, m]) => m.score >= 75);
  const weakest = [...entries].reverse().find(([, m]) => m.score < 60);
  const weakWord = (k) => {
    if (k === 'pace') return ctx.wpm > 160 ? 'rushed' : 'slow';
    if (k === 'fillers') return 'hesitant';
    if (k === 'pauses') return ctx.pauseRatio < 0.06 ? 'breathless' : 'halting';
    if (k === 'energy') return ctx.quiet ? 'quiet' : 'low-energy';
    if (k === 'pitch') return 'monotone';
    return 'hard to follow';
  };
  if (strengths.length && weakest) return `${STRENGTH[strengths[0][0]]} but ${weakWord(weakest[0])}`;
  if (strengths.length >= 2) return score >= 88 ? `${STRENGTH[strengths[0][0]]} and ${STRENGTH[strengths[1][0]].toLowerCase()}` : `${STRENGTH[strengths[0][0]]} and ${STRENGTH[strengths[1][0]].toLowerCase()}`;
  if (strengths.length) return `${STRENGTH[strengths[0][0]]}, keep building`;
  if (weakest) return `Getting there, a bit ${weakWord(weakest[0])}`;
  return 'Solid and steady';
}

function buildMarkers({ audioOk, peaks, pitch, db, vad, pauses, longPauses, timed, fillerWords, extraHes, wpm, spanStart }) {
  const good = [], fix = [], watch = [];
  const tOf = (f) => f * HOP;

  // speaking-rate windows from word times (or syllables)
  const events = timed.length >= 8 ? timed.map((w) => ({ t: w.t, words: 1 })) : peaks.map((p) => ({ t: tOf(p.f), words: 1 / 1.4 }));
  const WIN = 4;
  if (events.length >= 6) {
    let worst = null, steadyStart = null;
    const end = events[events.length - 1].t;
    for (let t0 = events[0].t; t0 + WIN <= end + 0.01; t0 += 0.5) {
      const inWin = events.filter((e) => e.t >= t0 && e.t < t0 + WIN).reduce((a, e) => a + e.words, 0);
      const rate = (inWin / WIN) * 60;
      if (!worst || rate > worst.rate) worst = { t: t0, rate };
      if (steadyStart === null && t0 - events[0].t < 1) steadyStart = rate;
    }
    if (worst && worst.rate > Math.max(178, wpm * 1.15)) {
      fix.push({ t: worst.t, t2: worst.t + WIN, kind: 'fix', title: 'This stretch got fast', body: `About ${Math.round(worst.rate)} words per minute here, fast enough that detail can slip past. Slow down and let the key words land.`, weight: worst.rate });
    }
    if (steadyStart !== null && steadyStart >= 115 && steadyStart <= 168) {
      good.push({ t: events[0].t, kind: 'good', title: 'Your opening sets a followable speed', body: 'The first few seconds were at a comfortable pace. Carry that rhythm through the whole answer.', weight: 1 });
    }
  }

  // long silences
  longPauses.forEach((g) => fix.push({ t: g.start, t2: g.end, kind: 'fix', title: `${g.len.toFixed(1)}-second silence`, body: 'A long gap can read as losing your place. Bridge with a short recap like “So the main point is…” and keep going.', weight: g.len * 20 }));

  // a well-placed pause
  if (audioOk) {
    const strong = pauses.filter((g) => g.len >= 0.5 && g.len <= 1.6 && g.start - spanStart > 3).sort((a, b) => Math.abs(a.len - 0.9) - Math.abs(b.len - 0.9))[0];
    if (strong) good.push({ t: strong.start, t2: strong.end, kind: 'good', title: 'Strong pause', body: `A clean ${strong.len.toFixed(1)}-second pause gives listeners time to absorb your point. Use more like this.`, weight: 2 });
  }

  // fillers and hesitations
  const fl = [...fillerWords.map((w) => ({ t: w.t, label: `“${w.label}”` })), ...extraHes.map((h) => ({ t: h.t, label: 'a hesitation sound' }))].sort((a, b) => a.t - b.t);
  if (fl.length) {
    const first = fl[0];
    watch.push({ t: first.t, kind: 'watch', title: `Filler: ${first.label}`, body: fl.length > 1 ? `This is the first of ${fl.length}. When you feel one coming, close your mouth and pause instead.` : 'When you feel a filler coming, close your mouth and pause instead. Silence sounds more confident.', weight: 10 + fl.length });
  }

  if (audioOk) {
    // flat stretch / lively stretch (5 s windows of pitch)
    const n = pitch.length, W = 500;
    let flat = null, lively = null;
    for (let s = 0; s + W <= n; s += 100) {
      const hz = [];
      for (let i = s; i < s + W; i += 2) if (pitch[i] > 0 && vad.sp[i]) hz.push(pitch[i]);
      if (hz.length < 60) continue;
      const m = median(hz);
      const sd = std(hz.map((v) => 12 * Math.log2(v / m)));
      if (!flat || sd < flat.sd) flat = { t: s * HOP, sd };
      if (!lively || sd > lively.sd) lively = { t: s * HOP, sd };
    }
    if (flat && flat.sd < 1.4) watch.push({ t: flat.t, t2: flat.t + 5, kind: 'watch', title: 'Flat stretch', body: 'Your pitch stayed level here, which can sound rehearsed or tired. Lift the most important word in each sentence.', weight: 8 });
    if (lively && lively.sd >= 3 && (!flat || lively.t !== flat.t)) good.push({ t: lively.t, t2: lively.t + 5, kind: 'good', title: 'Lively delivery', body: 'Your voice moved naturally here. This is the energy to bring to the whole answer.', weight: 3 });

    // trailing off: a 1.5 s stretch of speech much quieter than usual
    const level = median(peaks.map((p) => p.db));
    for (let i = 0; i < peaks.length - 3; i++) {
      const grp = peaks.slice(i, i + 4);
      if (tOf(grp[3].f - grp[0].f) < 2.5 && grp.every((p) => p.db < level - 7)) {
        watch.push({ t: tOf(grp[0].f), kind: 'watch', title: 'Volume dipped', body: 'You trailed off here. Keep your energy up through the end of the sentence; endings carry the point.', weight: 6 });
        break;
      }
    }
  }

  const pick = (list, k) => list.sort((a, b) => b.weight - a.weight).slice(0, k);
  let chosen = [...pick(fix, 2), ...pick(watch, 2), ...pick(good, 2)];
  chosen = chosen.sort((a, b) => a.t - b.t).slice(0, 5);
  // keep markers at least 1 s apart
  chosen = chosen.filter((m, i, arr) => i === 0 || m.t - arr[i - 1].t >= 1 || m.kind !== arr[i - 1].kind);
  return chosen.map((m, i) => ({ n: i + 1, t: Math.max(0, Math.round(m.t * 10) / 10), t2: m.t2 ? Math.round(m.t2 * 10) / 10 : null, kind: m.kind, tag: m.kind === 'good' ? 'Nice' : m.kind === 'fix' ? 'Try This' : 'Watch', title: m.title, body: m.body }));
}

/** Waveform bars (0..1) for drawing. */
export function bars(pcm, count = 120) {
  if (!pcm || !pcm.length) return [];
  const step = Math.max(1, Math.floor(pcm.length / count));
  const out = [];
  for (let b = 0; b < count; b++) {
    let s = 0;
    const o = b * step;
    for (let i = 0; i < step && o + i < pcm.length; i++) s += pcm[o + i] * pcm[o + i];
    out.push(Math.sqrt(s / step));
  }
  const top = pct(out, 0.97) || 1;
  return out.map((v) => Math.round(clamp(Math.sqrt(v / top), 0, 1) * 100) / 100);
}
