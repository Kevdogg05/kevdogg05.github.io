// Stage 1 — Blueprint: scaled pattern pieces, seam architecture, cutting
// layout and the finished-model views.
import { seamType } from '../data/seams.js';
import { fmtLen, fmtSpi, fmtNum } from '../engine/units.js';
import { esc, mbadge } from './dom.js';

const COL = {
  cut: '#7fd3f5',
  seam: '#ffb547',
  fold: '#39b7e6',
  notch: '#ff5d52',
  mark: '#b493ff',
  text: '#e8f1fa',
  dim: '#93abc3',
  fill: 'rgba(57,183,230,0.07)',
};

export function renderBlueprint(el, app, snapshots) {
  const plan = app.plan;
  const unit = plan.project.unit;
  el.innerHTML = `
    <h2 class="section-title"><span class="stage">1</span>Blueprint &amp; component breakdown</h2>
    <p class="section-lead">${esc(plan.template.name)} — ${esc(plan.summary)} Pattern pieces are drawn to one common scale: solid line = cut line, dashed amber = stitch line, cyan dash-dot = fold or crease, red triangles = notches (register marks), violet boxes = placement marks.</p>

    <div class="sheet" id="pattern-sheet">${patternSheet(plan)}</div>
    <div class="legend">
      <span><i style="border-color:${COL.cut}"></i>Cut line</span>
      <span><i style="border-color:${COL.seam};border-top-style:dashed"></i>Stitch line</span>
      <span><i style="border-color:${COL.fold};border-top-style:dotted"></i>Fold / crease</span>
      <span><i style="border-color:${COL.mark};border-top-style:dashed"></i>Placement</span>
      <span>▲ Notch</span>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Panel breakdown</h3>
      <div class="table-scroll"><table class="spec">
        <thead><tr><th>Panel</th><th>Cut</th><th>Finished</th><th>Cut size (with allowance)</th><th>Fabric · grain</th><th>Contour &amp; shading</th></tr></thead>
        <tbody>${plan.panels
          .map(
            (p) => `<tr>
              <td><strong>${p.id}</strong> ${esc(p.name)}</td>
              <td>${p.qty}</td>
              <td class="mono">${esc(p.finishedSize)}</td>
              <td class="mono">${esc(p.cutSize)}</td>
              <td>${esc(p.material?.name || '')}<br><span class="muted small">grain ${p.grain === 'h' ? 'across' : 'along'} the length</span></td>
              <td class="small">${esc(p.contour || '')}</td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </div>

    <div class="card">
      <h3>Seam architecture</h3>
      <p class="small muted" style="margin-top:-4px">Each seam with its cross-section, allowance, stitch length, thread and machine. Orange and blue are the two panels, grey is trim, red dashes are the stitches.</p>
      <div class="table-scroll"><table class="spec">
        <thead><tr><th>Seam</th><th>Type</th><th>Section</th><th>Length</th><th>Stitch</th><th>Thread</th><th>Machine</th><th>Step</th></tr></thead>
        <tbody>${plan.seams
          .map((s) => {
            const t = seamType(s.type);
            const u = s.setup;
            return `<tr>
              <td><strong>${s.id}</strong> ${esc(s.name)}</td>
              <td><strong>${esc(t.name)}</strong><br><span class="small muted">${esc(t.desc)}</span></td>
              <td><span class="seam-x">${t.svg()}</span></td>
              <td class="mono">${s.count > 1 ? `${s.count} × ` : ''}${fmtLen(s.length, unit)}</td>
              <td class="mono">${u ? fmtSpi(u.spi, unit) : '—'}</td>
              <td class="mono">${u ? `Tex ${u.tex} / ${u.threadV}` : '—'}</td>
              <td>${mbadge(u?.machine)}</td>
              <td class="mono">${s.step ?? '—'}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
      <p class="small muted">Seam allowance on this material: <span class="mono">${fmtLen(plan.ctx.sa.seam, unit)}</span> unless a panel says otherwise. Thread is sized to the material: heavier for topstitching and bartacks, lighter for linings.</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Cutting layout &amp; yardage</h3>
        ${plan.yardage.map((y) => yardageBlock(y, plan)).join('') || '<p class="muted">No fabric pieces.</p>'}
      </div>
      <div class="card">
        <h3>Notions &amp; thread</h3>
        <table class="spec"><tbody>
          ${plan.notions.map((n) => `<tr><td class="k">${esc(n.label)}</td><td><span class="mono">${esc(n.qty)}</span><br><span class="small muted">${esc(n.note || '')}</span></td></tr>`).join('')}
          ${plan.thread.map((t) => `<tr><td class="k">Thread Tex ${t.tex} (${t.v})</td><td><span class="mono">≈ ${t.yards} yd</span><br><span class="small muted">needle + bobbin, incl. 15 % waste — ${esc(plan.mat.fiber)}</span></td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>

    <div class="card">
      <h3>3D model — full representation</h3>
      <div class="views3d">
        ${['front', 'side', 'iso']
          .map(
            (v) => `<figure class="view3d" style="margin:0">
              ${snapshots?.[v] ? `<img src="${snapshots[v]}" alt="${v} view of the finished ${esc(plan.template.name)}">` : '<div style="aspect-ratio:16/11;display:grid;place-items:center" class="muted small">3D view unavailable</div>'}
              <h4>${v === 'iso' ? 'Isometric' : v[0].toUpperCase() + v.slice(1)}</h4>
              <p>${plan.views[v]}</p>
            </figure>`
          )
          .join('')}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */

export function patternSheet(plan, { print = false } = {}) {
  const unit = plan.project.unit;
  const panels = plan.panels;
  const sheetW = 1000;
  const pad = 26;
  const maxW = Math.max(...panels.map((p) => p.cutBB.w));
  const maxH = Math.max(...panels.map((p) => p.cutBB.h));
  const scale = Math.min((sheetW - pad * 4) / maxW, 520 / maxH, 26);

  // Flow layout: left to right, wrap.
  let x = pad;
  let y = pad;
  let rowH = 0;
  const placed = [];
  for (const p of panels) {
    const w = p.cutBB.w * scale + 70;
    const h = p.cutBB.h * scale + 92;
    if (x + w > sheetW - pad && x > pad) {
      x = pad;
      y += rowH + 18;
      rowH = 0;
    }
    placed.push({ p, x: x + 44, y: y + 52 });
    x += w + 18;
    rowH = Math.max(rowH, h);
  }
  const sheetH = y + rowH + pad;
  const bg = print ? '#ffffff' : '#0d2238';
  const textCol = print ? '#111' : COL.text;

  const body = placed.map(({ p, x: ox, y: oy }) => drawPanel(p, ox, oy, scale, unit, textCol, print)).join('');
  // Scale bar: 6 inches (or 10 cm).
  const barIn = unit === 'cm' ? 10 / 2.54 : 6;
  const bar = `<g transform="translate(${pad},${sheetH - 12})">
    <line x1="0" y1="0" x2="${barIn * scale}" y2="0" stroke="${COL.dim}" stroke-width="2"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="${COL.dim}" stroke-width="2"/>
    <line x1="${barIn * scale}" y1="-5" x2="${barIn * scale}" y2="5" stroke="${COL.dim}" stroke-width="2"/>
    <text x="${barIn * scale + 8}" y="4" font-size="12" fill="${COL.dim}">${unit === 'cm' ? '10 cm' : '6″'} scale</text>
  </g>`;
  return `<svg viewBox="0 0 ${sheetW} ${sheetH + 6}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui, sans-serif" role="img" aria-label="Pattern pieces for the ${esc(plan.template.name)}">
    <defs>
      <pattern id="bp-grid" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><path d="M ${scale} 0 L 0 0 0 ${scale}" fill="none" stroke="${print ? '#e6eef5' : 'rgba(57,183,230,0.12)'}" stroke-width="1"/></pattern>
      <linearGradient id="bp-crease" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${COL.fold}" stop-opacity="0"/>
        <stop offset=".5" stop-color="${COL.fold}" stop-opacity=".35"/>
        <stop offset="1" stop-color="${COL.fold}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bp-creaseV" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${COL.fold}" stop-opacity="0"/>
        <stop offset=".5" stop-color="${COL.fold}" stop-opacity=".35"/>
        <stop offset="1" stop-color="${COL.fold}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="bp-dome" cx=".42" cy=".38" r=".7">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>
        <stop offset=".7" stop-color="${COL.fold}" stop-opacity=".06"/>
        <stop offset="1" stop-color="#000" stop-opacity=".25"/>
      </radialGradient>
      <marker id="bp-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COL.dim}"/></marker>
    </defs>
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect width="100%" height="100%" fill="url(#bp-grid)"/>
    ${body}
    ${bar}
  </svg>`;
}

function drawPanel(p, ox, oy, s, unit, textCol, print) {
  const bb = p.cutBB;
  // Pattern coords have y up; flip into SVG space.
  const X = (x) => ox + (x - bb.minX) * s;
  const Y = (y) => oy + (bb.maxY - y) * s;
  const path = (pts) => `M${pts.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join('L')}Z`;
  const clipId = `clip-${p.id}`;
  const out = [];
  out.push(`<clipPath id="${clipId}"><path d="${path(p.cut)}"/></clipPath>`);
  out.push(`<path d="${path(p.cut)}" fill="${print ? '#f5f9fc' : COL.fill}" stroke="${print ? '#1d4e6e' : COL.cut}" stroke-width="2"/>`);
  // Shading: creases as soft bands, circles as domes, curves as gradients.
  const shade = [];
  if (p.circleR) shade.push(`<path d="${path(p.outline)}" fill="url(#bp-dome)"/>`);
  for (const sh of p.shade || []) {
    if (sh.type === 'crease') shade.push(`<rect x="${ox}" y="${Y(sh.y) - 0.45 * s}" width="${bb.w * s}" height="${0.9 * s}" fill="url(#bp-crease)"/>`);
    if (sh.type === 'creaseV') shade.push(`<rect x="${X(sh.x) - 0.45 * s}" y="${oy}" width="${0.9 * s}" height="${bb.h * s}" fill="url(#bp-creaseV)"/>`);
    if (sh.type === 'curve') shade.push(`<path d="${path(sh.pts)}" fill="url(#bp-dome)"/>`);
  }
  out.push(`<g clip-path="url(#${clipId})">${shade.join('')}</g>`);
  // Stitch line.
  out.push(`<path d="${path(p.outline)}" fill="none" stroke="${COL.seam}" stroke-width="1.4" stroke-dasharray="6 4"/>`);
  // Folds.
  for (const f of p.folds || []) {
    const [a, b2] = f.pts;
    out.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b2[0])}" y2="${Y(b2[1])}" stroke="${COL.fold}" stroke-width="${f.minor ? 1 : 1.6}" stroke-dasharray="${f.minor ? '2 4' : '10 4 2 4'}" opacity="${f.minor ? 0.7 : 1}"/>`);
    if (f.label && !f.minor) {
      out.push(`<text x="${(X(a[0]) + X(b2[0])) / 2}" y="${(Y(a[1]) + Y(b2[1])) / 2 - 4}" font-size="10.5" fill="${COL.fold}" text-anchor="middle">${esc(f.label)}</text>`);
    }
  }
  // Placement marks.
  for (const m of p.marks || []) {
    out.push(`<rect x="${X(m.x)}" y="${Y(m.y + m.h)}" width="${m.w * s}" height="${m.h * s}" fill="none" stroke="${COL.mark}" stroke-width="1.3" stroke-dasharray="4 3"/>`);
    if (m.label) out.push(`<text x="${X(m.x) + 3}" y="${Y(m.y + m.h) - 4}" font-size="10" fill="${COL.mark}">${esc(m.label)}</text>`);
  }
  // Notches: a small triangle cut into the allowance from the cut edge.
  for (const n of p.notches || []) {
    const sa = Math.max(n.sa ?? 0.5, 0.15);
    const ex = n.x + n.nx * sa;
    const ey = n.y + n.ny * sa;
    const depth = Math.min(sa * 0.7, 0.35);
    const tx = ex - n.nx * depth;
    const ty = ey - n.ny * depth;
    const wx = -n.ny * 0.16;
    const wy = n.nx * 0.16;
    out.push(`<path d="M${X(ex + wx)} ${Y(ey + wy)}L${X(tx)} ${Y(ty)}L${X(ex - wx)} ${Y(ey - wy)}Z" fill="${COL.notch}"/>`);
    if (n.label) out.push(`<text x="${X(ex + n.nx * 0.35)}" y="${Y(ey + n.ny * 0.35) + 4}" font-size="10" fill="${COL.notch}" text-anchor="middle">${esc(n.label)}</text>`);
  }
  // Grain arrow.
  const gx = X(bb.minX + bb.w * 0.16);
  const gy0 = Y(bb.minY + bb.h * 0.22);
  const gy1 = Y(bb.minY + bb.h * 0.62);
  if (p.grain === 'h') {
    const gyy = Y(bb.minY + bb.h * 0.2);
    out.push(`<line x1="${X(bb.minX + bb.w * 0.3)}" y1="${gyy}" x2="${X(bb.minX + bb.w * 0.7)}" y2="${gyy}" stroke="${COL.dim}" stroke-width="1.4" marker-start="url(#bp-arrow)" marker-end="url(#bp-arrow)"/>`);
  } else {
    out.push(`<line x1="${gx}" y1="${gy0}" x2="${gx}" y2="${gy1}" stroke="${COL.dim}" stroke-width="1.4" marker-start="url(#bp-arrow)" marker-end="url(#bp-arrow)"/>`);
  }
  // Label block.
  const cx = ox + (bb.w * s) / 2;
  const cy = oy + (bb.h * s) / 2;
  const big = Math.max(18, Math.min(46, Math.min(bb.w, bb.h) * s * 0.32));
  out.push(`<text x="${cx}" y="${cy + big * 0.32}" font-size="${big}" font-weight="700" fill="${textCol}" text-anchor="middle" opacity=".9">${esc(p.id)}</text>`);
  out.push(`<text x="${ox}" y="${oy - 30}" font-size="13" font-weight="600" fill="${textCol}">${esc(p.id)} · ${esc(p.name)}</text>`);
  out.push(`<text x="${ox}" y="${oy - 15}" font-size="11" fill="${COL.dim}">Cut ${p.qty} · ${esc(p.material?.name || '')}</text>`);
  // Dimension lines (cut size).
  const yy = oy + bb.h * s + 18;
  out.push(`<line x1="${ox}" y1="${yy}" x2="${ox + bb.w * s}" y2="${yy}" stroke="${COL.dim}" stroke-width="1" marker-start="url(#bp-arrow)" marker-end="url(#bp-arrow)"/>`);
  out.push(`<text x="${cx}" y="${yy + 15}" font-size="11.5" fill="${COL.dim}" text-anchor="middle">${fmtLen(bb.w, unit)}</text>`);
  const xx = ox - 18;
  out.push(`<line x1="${xx}" y1="${oy}" x2="${xx}" y2="${oy + bb.h * s}" stroke="${COL.dim}" stroke-width="1" marker-start="url(#bp-arrow)" marker-end="url(#bp-arrow)"/>`);
  out.push(`<text x="${xx - 6}" y="${cy}" font-size="11.5" fill="${COL.dim}" text-anchor="middle" transform="rotate(-90 ${xx - 6} ${cy})">${fmtLen(bb.h, unit)}</text>`);
  return `<g>${out.join('')}</g>`;
}

function yardageBlock(y, plan) {
  const unit = plan.project.unit;
  if (y.leather || !y.layout) {
    return `<p><strong>${esc(y.material.name)}</strong><br><span class="mono">${esc(y.text)}</span></p>
      <p class="small muted">Leather is bought by the hide. Lay pieces along the backbone, keep load-bearing parts out of the belly, and avoid scars.</p>`;
  }
  const L = y.layout;
  const s = Math.min(300 / L.rollWidth, 3.2);
  const w = L.rollWidth * s;
  const h = Math.max(40, L.length * s);
  const rects = L.placed
    .map(
      (r) => `<g><rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="${r.oversize ? 'rgba(255,93,82,.25)' : 'rgba(57,183,230,.18)'}" stroke="#7fd3f5" stroke-width="1"/>
      <text x="${r.x * s + (r.w * s) / 2}" y="${r.y * s + (r.h * s) / 2 + 4}" font-size="11" text-anchor="middle" fill="#e8f1fa">${esc(r.label)}${r.qty > 1 ? r.n : ''}</text></g>`
    )
    .join('');
  return `<p style="margin:0 0 8px"><strong>${esc(y.material.name)}</strong> — <span class="mono">${esc(y.text)}</span></p>
    <div style="overflow-x:auto"><svg viewBox="-4 -4 ${w + 8} ${h + 8}" style="width:${Math.min(360, w + 8)}px;max-width:100%;display:block" role="img" aria-label="Cutting layout">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#0b1724" stroke="#3aa7d6" stroke-dasharray="4 3"/>
      ${rects}
    </svg></div>
    <p class="small muted" style="margin:6px 0 12px">${fmtLen(L.rollWidth, unit)} wide · ${fmtLen(L.length, unit)} used (${fmtNum(L.length / 36)} yd before allowance)</p>
    ${L.placed.some((r) => r.oversize) ? '<p class="small" style="color:#ff8f87">Red pieces are wider than the roll — piece them with a seam or turn them if the grain allows.</p>' : ''}`;
}
