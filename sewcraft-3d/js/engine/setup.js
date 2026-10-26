// Machine selection and per-step machine setup.
import { MACHINES } from '../data/machines.js';
import { TRIMS, threadInfo, needleLabel } from '../data/materials.js';
import { spiToMm } from './units.js';

const THREAD_KEY = {
  construction: 'construction',
  topstitch: 'topstitch',
  edgestitch: 'topstitch',
  bartack: 'bartack',
  hem: 'construction',
  baste: 'construction',
  binding: 'construction',
  welt: 'construction',
  zipper: 'construction',
  french: 'construction',
};

const SPI_KEY = {
  construction: 'construction',
  topstitch: 'topstitch',
  edgestitch: 'topstitch',
  hem: 'hem',
  binding: 'construction',
  welt: 'construction',
  zipper: 'topstitch',
  french: 'construction',
};

const NEEDLES = [75, 80, 90, 100, 110, 120, 125, 130, 140, 160, 180, 200];

export const ROLE_LABEL = {
  construction: 'Structural seam',
  topstitch: 'Topstitch',
  edgestitch: 'Edge-stitch',
  bartack: 'Box-X bartack',
  hem: 'Hem',
  baste: 'Machine baste',
  binding: 'Binding',
  welt: 'Welt',
  zipper: 'Zipper',
  french: 'French seam',
};

/** Compressed stack height in mm for a step's layer list. */
export function stackHeight(layers, ctx) {
  let mm = 0;
  for (const { f, n } of layers) {
    const m = layerMaterial(f, ctx);
    if (m) mm += n * m.thicknessMm * (m.compress ?? 1);
  }
  return mm;
}

function layerMaterial(f, ctx) {
  if (f === 'main') return ctx.mat;
  if (f === 'lining') return ctx.lin || ctx.mat;
  return TRIMS[f] || null;
}

/** Which properties of a step make a walking foot necessary. */
function walkingReasons(step, ctx, mat, fabricLayers) {
  const why = [];
  // Light slippery goods are what the 315R's needle feed is for; heavy slick goods need the walking foot.
  if (mat.feedRisk === 'high' && fabricLayers >= 2 && mat.weightClass !== 'light') why.push(`${mat.name} shifts between layers`);
  if (mat.id === 'vinyl' && fabricLayers >= 2) why.push('vinyl faces grip each other');
  if (mat.group === 'Leather' && fabricLayers >= 2) why.push('leather layers must feed together');
  if (step.layers.some((l) => l.f === 'weltCord')) why.push('welt-cord sandwich');
  if (step.layers.some((l) => l.f.startsWith('webbing')) && step.role !== 'baste') why.push('climbing webbing edges');
  if (step.role === 'zipper' && mat.weightClass !== 'light') why.push('heavy goods either side of a zipper');
  return [...new Set(why)];
}

function nearestNeedle(nm) {
  return NEEDLES.reduce((a, b) => (Math.abs(b - nm) < Math.abs(a - nm) ? b : a));
}

/**
 * Evaluate both machines for a step and pick one.
 * Returns { machineId, setup, candidates[], warning }.
 */
export function chooseMachine(step, ctx) {
  const mat = step.fabric === 'lining' && ctx.lin ? ctx.lin : ctx.mat;
  const role = step.role;
  const wantTex = mat.thread[THREAD_KEY[role] || 'construction'];
  let wantSpi;
  if (role === 'baste') wantSpi = 4;
  else if (role === 'bartack') wantSpi = mat.group === 'Leather' ? mat.spi.construction : Math.max(mat.spi.construction, 7);
  else wantSpi = mat.spi[SPI_KEY[role] || 'construction'];

  const stackMm = stackHeight(step.layers, ctx);
  const fabricLayers = step.layers.filter((l) => l.f === 'main' || l.f === 'lining').reduce((a, l) => a + l.n, 0);
  const walkWhy = walkingReasons(step, ctx, mat, fabricLayers);

  const candidates = Object.values(MACHINES).map((m) => evaluate(m, { step, mat, role, wantTex, wantSpi, stackMm, walkWhy, ctx }));
  const ok = candidates.filter((c) => c.ok).sort((a, b) => b.score - a.score);
  let pick = ok[0];
  let warning = null;
  if (!pick) {
    // Nothing fits cleanly: fall back to the least-bad option and say so.
    pick = candidates.slice().sort((a, b) => a.fails.length - b.fails.length || b.score - a.score)[0];
    warning = `Beyond the comfortable range of both machines: ${pick.fails.join('; ')}.`;
  }
  return { machineId: pick.id, setup: pick.setup, candidates, warning, walkWhy };
}

function evaluate(m, a) {
  const L = m.limits;
  const fails = [];
  const notes = [];
  let score = 100;
  let tex = a.wantTex;

  if (tex > L.texMax) fails.push(`Tex ${tex} thread is above its Tex ${L.texMax} limit`);
  if (tex < L.texMin) {
    notes.push(`Thread raised to Tex ${L.texMin}, the lightest that forms a clean lock on this hook`);
    tex = L.texMin;
    score -= 12;
  }

  let spi = a.wantSpi;
  if (a.role === 'baste') {
    spi = Math.max(4, L.minSpi);
  } else if (spi < L.minSpi) {
    if ((L.minSpi - spi) / spi <= 0.1) {
      notes.push(`Runs at its longest stitch (${L.minSpi} SPI) — close to the ${spi} SPI target`);
      spi = L.minSpi;
      score -= 5;
    } else {
      fails.push(`${spi} SPI needs a ${spiToMm(spi).toFixed(1)} mm stitch; its maximum is ${L.maxStitchMm} mm`);
    }
  }
  if (!L.walking && spi >= 10) score += 5;
  if (L.walking && spi >= 10) {
    notes.push('Fine stitch length with a heavy needle — expect larger holes than on the 315R');
    score -= 10;
  }

  if (a.stackMm > L.practicalStackMm) fails.push(`${a.stackMm.toFixed(1)} mm stack exceeds its ~${L.practicalStackMm} mm working limit`);
  else if (a.stackMm > L.practicalStackMm * 0.8) {
    notes.push('Near its thickness limit — slow down at crossings');
    score -= 8;
  }

  if (a.walkWhy.length && !L.walking) {
    fails.push(`needs a walking foot (${a.walkWhy.join(', ')})`);
  }
  if (a.walkWhy.length && L.walking) score += 15;
  if (!a.walkWhy.length && !L.walking && tex <= 45) score += 15;
  if (a.step.prefer === m.id) score += 10;

  // Needle: thread decides the size, the stack nudges it up.
  const t = threadInfo(tex);
  let nm = a.stackMm > 3 || a.mat.group === 'Leather' ? t.nm[1] : t.nm[0];
  nm = nearestNeedle(Math.min(Math.max(nm, L.nmMin), L.nmMax));
  if (t.nm[0] > L.nmMax) fails.push(`Tex ${tex} needs at least Nm ${t.nm[0]}; this machine stops at Nm ${L.nmMax}`);

  const leather = a.mat.group === 'Leather';
  const system = m.id === '2206RB' ? (a.mat.needleSystem === '135x16' ? '135x16' : '135x17') : leather ? 'DBx1 LR' : 'DBx1 (16x257)';
  const bobbinTex = tex >= 135 ? 90 : tex;

  const speed = suggestSpeed(m, a.role, a.stackMm, a.step);
  const setup = {
    machine: m.id,
    machineName: m.name,
    tex,
    threadV: t.v,
    fiber: a.mat.fiber,
    bobbinTex,
    bobbinV: threadInfo(bobbinTex).v,
    nm,
    needle: `${system} · ${needleLabel(nm)}`,
    needleSystem: system,
    point: a.mat.point,
    spi,
    stitchMm: spiToMm(spi),
    stackMm: a.stackMm,
    footPressure: a.mat.footPressure,
    altLift: L.walking ? altLift(a.stackMm, a.step) : null,
    speed,
    tension: tensionText(m, a.mat, a.step, tex),
    program: m.id === '2206RB' ? program(a, speed) : null,
    notes,
  };
  return { id: m.id, ok: fails.length === 0, fails, notes, score, setup };
}

function suggestSpeed(m, role, stack, step) {
  let spm = m.id === '315R' ? 2500 : 2000;
  if (stack > 2) spm = m.id === '315R' ? 1800 : 1600;
  if (stack > 4) spm = 1200;
  if (stack > 7) spm = 800;
  if (role === 'welt' || role === 'zipper' || role === 'binding' || step.curve) spm = Math.min(spm, 1200);
  if (step.curve || step.pivot) spm = Math.min(spm, 1000);
  if (role === 'bartack') spm = Math.min(spm, 800);
  return spm;
}

function altLift(stack, step) {
  if (step.layers.some((l) => l.f === 'weltCord') || stack > 6) return 'High — about 5–6 mm, to clear the tallest step';
  if (stack > 3) return 'Medium — about 4 mm';
  return 'Low — about 2–3 mm';
}

function tensionText(m, mat, step, tex) {
  const layers = step.layers.reduce((a, l) => a + l.n, 0);
  const base = `Set the bobbin first (drop test), then balance the needle tension on a ${layers}-layer test strip of the same goods until the lock sits in the middle of the stack.`;
  const heavy = tex >= 90 ? ' Heavy thread: open the top tension a half-turn before the first test, then tighten in quarter-turns.' : '';
  return `${base}${heavy} ${mat.tension}`;
}

function program(a, speed) {
  const leather = a.mat.group === 'Leather';
  let bt = '3 / 3 stitches';
  if (leather) bt = 'Off — hand-wheel back 3 stitches into the same holes';
  else if (a.mat.id === 'vinyl' || a.mat.id === 'xpac') bt = '2 / 2 stitches (fewer holes in a row)';
  if (a.role === 'bartack') bt = 'Off — the box-X locks itself';
  if (a.role === 'baste') bt = 'Off';
  return {
    startBT: bt,
    endBT: bt,
    soft: a.wantTex >= 90 || a.stackMm >= 4 ? 'On — first 2–3 stitches slow' : 'Optional',
    needle: a.step.pivot || a.step.curve || a.role === 'bartack' ? 'Down — for pivots' : 'Up',
    trim: a.role === 'baste' ? 'Off — leave tails to pull the baste out' : a.step.pivot ? 'On — heel back only after the last pivot' : 'On',
    lift: 'On — half-heel lifts the feet',
    speed: `${speed} SPM cap`,
  };
}
