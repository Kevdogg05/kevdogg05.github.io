// Turns a project (template + dimensions + material) into a full build plan:
// pattern pieces with cut lines, a seam schedule, per-step machine setups,
// yardage, thread estimate and warnings.
import { getMaterial, TRIMS, threadInfo } from '../data/materials.js';
import { MACHINES } from '../data/machines.js';
import { TEMPLATES } from '../templates/index.js';
import { chooseMachine, ROLE_LABEL } from './setup.js';
import { offsetPolygon, bbox, circle, signedArea } from './geom2d.js';
import { nest, yardsToBuy, sqFtToBuy } from './nest.js';
import { fmtLen, fmtSize, fmtMm, fmtSpi, fmtYards } from './units.js';

export function defaultProject(templateId = 'tote') {
  const tpl = TEMPLATES[templateId];
  const dims = {};
  for (const d of tpl.dims) dims[d.key] = d.default;
  const options = {};
  for (const o of tpl.options || []) options[o.key] = o.default;
  return {
    template: tpl.id,
    dims,
    options,
    material: tpl.defaults.material,
    lining: tpl.defaults.lining ?? 'none',
    unit: 'in',
    colors: {},
  };
}

/** Clamp dimensions and fill in anything missing. */
export function normalizeProject(p) {
  const tpl = TEMPLATES[p.template] || TEMPLATES.tote;
  const base = defaultProject(tpl.id);
  const dims = { ...base.dims };
  for (const d of tpl.dims) {
    const v = Number(p.dims?.[d.key]);
    if (Number.isFinite(v)) dims[d.key] = Math.min(d.max, Math.max(d.min, d.count ? Math.round(v) : v));
  }
  const options = { ...base.options };
  for (const o of tpl.options || []) {
    if (p.options && o.key in p.options) {
      const v = p.options[o.key];
      if (o.type === 'toggle') options[o.key] = Boolean(v);
      else if (o.type === 'select' && o.choices.some((c) => c.value === v)) options[o.key] = v;
    }
  }
  return {
    template: tpl.id,
    dims,
    options,
    material: getMaterial(p.material).id === p.material ? p.material : base.material,
    lining: p.lining === 'none' || getMaterial(p.lining).id === p.lining ? p.lining || 'none' : base.lining,
    unit: p.unit === 'cm' ? 'cm' : 'in',
    colors: { ...(p.colors || {}) },
  };
}

export function seamAllowances(mat) {
  if (mat.group === 'Leather') return { seam: 0.375, hem: 0.5, topstitch: 0.25 };
  if (mat.weightClass === 'light') return { seam: 0.375, hem: 0.5, topstitch: 0.125 };
  return { seam: 0.5, hem: 0.5, topstitch: 0.125 };
}

export function buildPlan(rawProject) {
  const project = normalizeProject(rawProject);
  const tpl = TEMPLATES[project.template];
  const mat = getMaterial(project.material);
  const lin = tpl.usesLining && project.lining !== 'none' ? getMaterial(project.lining) : null;
  const unit = project.unit;
  const ctx = {
    d: project.dims,
    o: project.options,
    mat,
    lin,
    unit,
    sa: seamAllowances(mat),
    saLin: lin ? seamAllowances(lin) : null,
    L: (x) => fmtLen(x, unit),
    S: (w, h) => fmtSize(w, h, unit),
    MM: (mm) => fmtMm(mm, unit),
    T: TRIMS,
  };

  const built = tpl.plan(ctx);
  const warnings = [...(built.warnings || [])];

  // Pattern pieces: cut outline = finished outline + allowance.
  for (const p of built.panels) {
    if (p.circleR) {
      p.outline = circle(p.circleR, 64);
      p.cut = circle(p.circleR + (p.sa ?? ctx.sa.seam), 64);
    } else {
      if (signedArea(p.outline) < 0) p.outline.reverse();
      p.cut = offsetPolygon(p.outline, p.saEdges || (p.sa ?? ctx.sa.seam));
    }
    p.bb = bbox(p.outline);
    p.cutBB = bbox(p.cut);
    p.material = p.fabric === 'lining' ? lin : mat;
    p.cutSize = fmtSize(p.cutBB.w, p.cutBB.h, unit);
    p.finishedSize = p.circleR ? `Ø ${fmtLen(p.circleR * 2, unit)}` : fmtSize(p.bb.w, p.bb.h, unit);
  }

  // Steps: machine choice and setup for every sewing step.
  let prev = null;
  built.steps.forEach((s, i) => {
    s.index = i;
    s.layers = s.layers || [];
    if (s.role) {
      const choice = chooseMachine(s, ctx);
      s.machineId = choice.machineId;
      s.setup = choice.setup;
      s.candidates = choice.candidates;
      s.walkWhy = choice.walkWhy;
      if (choice.warning) {
        s.warning = choice.warning;
        warnings.push(`Step ${i + 1} (${s.title}): ${choice.warning}`);
      }
      s.changeover = prev ? changeoverNote(prev, s.setup) : null;
      prev = s.setup;
    }
  });
  for (const s of built.steps) {
    const sctx = { ...ctx, s, M: s.setup ? MACHINES[s.setup.machine] : null, u: s.setup };
    s.text = {
      frame: s.frame(sctx),
      action: s.action(sctx),
      exec: s.exec ? s.exec(sctx) : '',
    };
    if (s.setup) s.text.settings = settingsLine(s.setup, unit);
  }

  // Seam schedule: pull the setup from the step that sews each seam.
  for (const seam of built.seams) {
    const step = built.steps.find((s) => (s.seams || []).includes(seam.id));
    seam.step = step ? step.index + 1 : null;
    seam.setup = step?.setup || null;
    seam.roleLabel = ROLE_LABEL[seam.role] || seam.role;
  }

  const yardage = computeYardage(built.panels, mat, lin, unit);
  const thread = threadEstimate(built.seams);
  const machinePlan = summarizeMachines(built.steps);

  if (built.needsTurning && mat.turnable === 'no') {
    warnings.push(`${mat.name} is too stiff to turn right side out. Build this as an exposed-edge construction instead: assemble wrong sides together, stitch ³⁄₁₆″ from the edge, then bevel, dye and burnish the edges.`);
  } else if (built.needsTurning && mat.turnable === 'stiff') {
    warnings.push(`${mat.name} turns, but only with effort: leave the turning opening generous, clip corners close, and warm the goods (heat gun on low for vinyl) before turning.`);
  }
  if (mat.id === 'fleece' && tpl.structural) {
    warnings.push('Fleece is stretchy and lofty — interface panels or back them with a woven before using it for a structural bag.');
  }
  if (lin && lin.thicknessMm > mat.thicknessMm * 1.2) {
    warnings.push(`The lining (${lin.name}) is heavier than the shell. Linings are normally the lighter fabric — consider 210D pack cloth or cotton.`);
  }

  return {
    project,
    template: tpl,
    ctx,
    mat,
    lin,
    panels: built.panels,
    notions: built.notions || [],
    seams: built.seams,
    steps: built.steps,
    views: built.views,
    summary: built.summary,
    geom: built.geom,
    yardage,
    thread,
    machinePlan,
    warnings,
  };
}

function settingsLine(u, unit) {
  return [
    u.machineName,
    u.needle,
    `Tex ${u.tex} (${u.threadV}) top / Tex ${u.bobbinTex} bobbin`,
    fmtSpi(u.spi, unit),
    `stack ${fmtMm(u.stackMm, unit)}`,
  ].join(' · ');
}

function changeoverNote(a, b) {
  const changes = [];
  if (a.machine !== b.machine) changes.push(`move to the ${b.machineName}`);
  else {
    if (a.nm !== b.nm || a.needleSystem !== b.needleSystem) changes.push(`needle → Nm ${b.nm}`);
    if (a.tex !== b.tex) changes.push(`thread → Tex ${b.tex}`);
    if (Math.abs(a.spi - b.spi) > 0.05) changes.push(`stitch length → ${b.spi} SPI`);
  }
  return changes.length ? changes.join(', ') : null;
}

function computeYardage(panels, mat, lin, unit) {
  const out = [];
  const groups = [
    ['main', mat],
    ['lining', lin],
  ];
  for (const [fabric, m] of groups) {
    if (!m) continue;
    const ps = panels.filter((p) => p.fabric === fabric);
    if (!ps.length) continue;
    if (!m.widthIn) {
      const area = ps.reduce((a, p) => a + Math.abs(signedArea(p.cut)) * p.qty, 0);
      const sqft = sqFtToBuy(area);
      out.push({ fabric, material: m, leather: true, sqft, text: `${Math.ceil(sqft * 2) / 2} sq ft of hide (incl. 30 % for shape and flaws)` });
      continue;
    }
    const layout = nest(
      ps.map((p) => ({ id: p.id, label: p.id, w: p.cutBB.w, h: p.cutBB.h, qty: p.qty, rotatable: p.rotatable !== false })),
      m.widthIn
    );
    const yards = yardsToBuy(layout.length);
    out.push({ fabric, material: m, layout, yards, text: `${fmtYards(yards, unit)} of ${m.widthIn}″-wide goods (incl. 10 % allowance)` });
  }
  return out;
}

/** Lockstitch uses roughly 2 × (1 + SPI × thickness) inches of thread per inch of seam. */
function threadEstimate(seams) {
  const byTex = new Map();
  for (const s of seams) {
    if (!s.setup || !s.length) continue;
    const t = s.setup.stackMm / 25.4;
    const perInch = 2 * (1 + s.setup.spi * t) * 1.15;
    const inches = s.length * (s.count || 1) * perInch;
    const key = s.setup.tex;
    byTex.set(key, (byTex.get(key) || 0) + inches);
  }
  return [...byTex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tex, inches]) => ({ tex, v: threadInfo(tex).v, yards: Math.ceil(inches / 36) }));
}

function summarizeMachines(steps) {
  const counts = {};
  for (const s of steps) {
    if (!s.setup) continue;
    (counts[s.setup.machine] ||= []).push(s.index + 1);
  }
  const ids = Object.keys(counts).sort((a, b) => counts[b].length - counts[a].length);
  return { counts, primary: ids[0] || null, ids };
}
