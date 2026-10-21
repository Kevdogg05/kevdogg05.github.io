// Stage 2 — Material integration: material analysis, machine recommendation,
// grouped setup sheets, auto-panel program and a stack-height chart.
import { MACHINES } from '../data/machines.js';
import { fmtMm, fmtSpi } from '../engine/units.js';
import { ROLE_LABEL } from '../engine/setup.js';
import { esc, mbadge } from './dom.js';

// Chart mark colours, validated for the dark surface (dataviz validator: band, CVD, contrast).
const MARK = { '315R': '#2d97c6', '2206RB': '#c4801c' };

export function renderSetup(el, app) {
  const plan = app.plan;
  const unit = plan.project.unit;
  const mat = plan.mat;
  const sewing = plan.steps.filter((s) => s.setup);
  const groups = groupSetups(sewing);

  el.innerHTML = `
    <h2 class="section-title"><span class="stage">2</span>Material integration &amp; machine setup</h2>
    <p class="section-lead">What the material does under the foot, which Consew should sew each step and exactly how to set it up. Setups are grouped so you change needles and thread as few times as possible.</p>

    ${plan.warnings.length ? `<div class="callout red"><strong>Warnings</strong><ul>${plan.warnings.map((w) => `<li>${w}</li>`).join('')}</ul></div>` : ''}

    <div class="grid-2">
      ${materialCard(mat, unit, 'Main fabric')}
      ${plan.lin ? materialCard(plan.lin, unit, 'Lining') : notionsCard(plan)}
    </div>

    <h3 style="margin-top:8px">Machine recommendation</h3>
    <div class="grid-2">${Object.values(MACHINES).map((m) => machineCard(m, plan)).join('')}</div>

    <div class="card">
      <h3>Setup sheets</h3>
      <p class="small muted" style="margin-top:-4px">One row per distinct machine setup. Sew all steps of a setup before changing the needle or thread where the order allows.</p>
      <div class="table-scroll"><table class="spec">
        <thead><tr><th>Setup</th><th>Machine</th><th>Needle</th><th>Thread (top / bobbin)</th><th>Stitch</th><th>Foot pressure</th><th>Alt. foot lift</th><th>Speed cap</th><th>Steps</th></tr></thead>
        <tbody>${groups
          .map(
            (g) => `<tr>
              <td><strong>${g.letter}</strong></td>
              <td>${mbadge(g.u.machine)}</td>
              <td class="mono">${esc(g.u.needle)}<br><span class="small muted">${esc(g.u.point)}</span></td>
              <td class="mono">Tex ${g.u.tex} (${g.u.threadV}) / Tex ${g.u.bobbinTex} (${g.u.bobbinV})<br><span class="small muted">${esc(g.u.fiber)}</span></td>
              <td class="mono">${fmtSpi(g.u.spi, unit)}</td>
              <td class="small">${esc(g.u.footPressure.split('.')[0])}</td>
              <td class="small">${g.u.altLift ? esc(g.u.altLift) : '<span class="muted">n/a — no walking foot</span>'}</td>
              <td class="mono">${g.u.speed} SPM</td>
              <td class="mono">${g.steps.map((s) => s.index + 1).join(', ')}</td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Tension baseline</h3>
        ${tensionBlock(plan, groups)}
      </div>
      <div class="card">
        <h3>2206RB-14-7DD-1 automatic panel</h3>
        ${panelBlock(groups)}
      </div>
    </div>

    <div class="card">
      <h3>Stack height by step</h3>
      <p class="small muted" style="margin-top:-4px">Compressed thickness under the foot at the thickest point of each sewing step, against each machine's practical working limit.</p>
      ${stackChart(sewing, unit)}
    </div>
  `;
  wireChart(el);
}

function groupSetups(steps) {
  const groups = [];
  for (const s of steps) {
    const u = s.setup;
    const key = `${u.machine}|${u.needleSystem}|${u.nm}|${u.tex}|${u.spi.toFixed(2)}`;
    let g = groups.find((q) => q.key === key);
    if (!g) {
      g = { key, u, steps: [], letter: String.fromCharCode(65 + groups.length) };
      groups.push(g);
    }
    g.steps.push(s);
  }
  return groups;
}

function materialCard(m, unit, title) {
  return `<div class="card">
    <h3>${esc(title)}: ${esc(m.name)}</h3>
    <table class="spec"><tbody>
      <tr><td class="k">Thickness · weight</td><td class="mono">${fmtMm(m.thicknessMm, unit)} · ${esc(m.weight)}</td></tr>
      <tr><td class="k">Stretch</td><td>${esc(m.stretch)}</td></tr>
      <tr><td class="k">Backing / faces</td><td>${esc(m.backing)}</td></tr>
      <tr><td class="k">Hand</td><td>${esc(m.hand)}</td></tr>
      <tr><td class="k">Needle point</td><td>${esc(m.point)}</td></tr>
      <tr><td class="k">Thread</td><td>${esc(m.fiber)} — Tex ${m.thread.construction} construction, Tex ${m.thread.topstitch} topstitch</td></tr>
      <tr><td class="k">Stitch length</td><td class="mono">${fmtSpi(m.spi.construction, unit)} construction</td></tr>
      <tr><td class="k">Cutting</td><td>${esc(m.cut)}</td></tr>
      <tr><td class="k">Holding</td><td>${esc(m.hold)}</td></tr>
      <tr><td class="k">Edges</td><td>${esc(m.edge)}</td></tr>
      <tr><td class="k">Pressing</td><td>${esc(m.press)}</td></tr>
    </tbody></table>
    ${m.tips.length ? `<div class="callout cyan" style="margin:12px 0 0">${m.tips.map((t) => esc(t)).join('<br>')}</div>` : ''}
  </div>`;
}

function notionsCard(plan) {
  return `<div class="card">
    <h3>Trims &amp; notions</h3>
    <table class="spec"><tbody>${plan.notions.map((n) => `<tr><td class="k">${esc(n.label)}</td><td class="mono">${esc(n.qty)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">No lining selected: inside seam allowances are bound or enclosed instead.</p>
  </div>`;
}

function machineCard(m, plan) {
  const steps = plan.steps.filter((s) => s.setup?.machine === m.id);
  const primary = plan.machinePlan.primary === m.id;
  // Why the other machine lost each of this machine's steps, and vice versa.
  const declined = plan.steps
    .filter((s) => s.setup && s.setup.machine !== m.id)
    .map((s) => ({ s, c: s.candidates.find((c) => c.id === m.id) }))
    .filter((x) => x.c && !x.c.ok);
  const why = [...new Set(declined.flatMap((x) => x.c.fails))].slice(0, 4);
  return `<div class="card machine-card m${m.id}${primary ? ' primary' : ''}">
    <div class="panel-heading"><h3>${esc(m.name)}</h3>${primary ? '<span class="chip">Primary for this project</span>' : ''}</div>
    <p class="small muted" style="margin:-4px 0 8px">${esc(m.tagline)}</p>
    <p style="margin:0 0 6px"><strong>${steps.length ? `Steps ${steps.map((s) => s.index + 1).join(', ')}` : 'Not needed for this project'}</strong>${steps.length ? ` — ${esc([...new Set(steps.map((s) => ROLE_LABEL[s.role].toLowerCase()))].join(', '))}` : ''}</p>
    ${steps.length ? `<ul class="small">${steps.slice(0, 6).map((s) => `<li>${esc(s.title)} <span class="muted">· ${fmtMm(s.setup.stackMm, plan.project.unit)}</span></li>`).join('')}</ul>` : ''}
    ${why.length ? `<h4>Why not the ${esc(m.name.replace('Consew ', ''))} for the rest</h4><ul class="small">${why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <h4>Spec</h4>
    <table class="spec small"><tbody>${m.specs.slice(1, 6).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

function tensionBlock(plan, groups) {
  const byMachine = {};
  for (const g of groups) (byMachine[g.u.machine] ||= g);
  return Object.values(byMachine)
    .map((g) => {
      const m = MACHINES[g.u.machine];
      return `<p style="margin:0 0 6px">${mbadge(m.id)} <strong>Bobbin first.</strong> ${esc(m.bobbin.tension)}</p>
        <p class="small" style="margin:0 0 12px">${esc(g.u.tension)}</p>`;
    })
    .join('') || '<p class="muted">No sewing steps.</p>';
}

function panelBlock(groups) {
  const gs = groups.filter((g) => g.u.program);
  if (!gs.length) return '<p class="muted">This project does not use the 2206RB.</p>';
  const rows = [
    ['startBT', 'Start backtack'],
    ['endBT', 'End backtack'],
    ['soft', 'Soft start'],
    ['needle', 'Needle stop'],
    ['trim', 'Thread trimmer'],
    ['lift', 'Auto foot lift'],
    ['speed', 'Max speed'],
  ];
  return `<div class="table-scroll"><table class="spec small" style="min-width:${gs.length > 2 ? 560 : 0}px">
    <thead><tr><th>Function</th>${gs.map((g) => `<th>Setup ${g.letter}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([k, label]) => `<tr><td class="k">${label}</td>${gs.map((g) => `<td>${esc(g.u.program[k])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">Panel layouts differ between control boxes; look for these functions by name or icon. Machine Training (stage 4) walks through the pedal and panel.</p>`;
}

function stackChart(steps, unit) {
  if (!steps.length) return '<p class="muted">No sewing steps.</p>';
  const lim315 = MACHINES['315R'].limits.practicalStackMm;
  const lim2206 = MACHINES['2206RB'].limits.practicalStackMm;
  const max = Math.max(lim2206 * 1.1, ...steps.map((s) => s.setup.stackMm * 1.1));
  const pct = (v) => `${((v / max) * 100).toFixed(2)}%`;
  const rows = steps
    .map((s) => {
      const u = s.setup;
      const label = `Step ${s.index + 1}, ${s.title}: ${fmtMm(u.stackMm, unit)} on the ${u.machineName}`;
      return `<div class="stack-row" tabindex="0" role="img" aria-label="${esc(label)}" data-tip-value="${esc(fmtMm(u.stackMm, unit))}" data-tip-label="${esc(`Step ${s.index + 1} · ${s.title}`)}" data-tip-sub="${esc(u.machineName)} · ${esc(ROLE_LABEL[s.role])}">
        <span class="mono muted">${s.index + 1}</span>
        <span class="bar">
          <i style="width:${pct(u.stackMm)};background:${MARK[u.machine]};border-radius:0 4px 4px 0"></i>
          <span class="lim" style="left:${pct(lim315)};border-color:${MARK['315R']}"></span>
          <span class="lim" style="left:${pct(lim2206)};border-color:${MARK['2206RB']}"></span>
        </span>
        <span class="mono">${u.stackMm.toFixed(1)} mm</span>
      </div>`;
    })
    .join('');
  return `<div class="stack-chart" id="stack-chart">${rows}</div>
    <div class="legend">
      <span><i style="border-top:10px solid ${MARK['315R']};width:12px;border-radius:2px"></i>Sewn on the 315R</span>
      <span><i style="border-top:10px solid ${MARK['2206RB']};width:12px;border-radius:2px"></i>Sewn on the 2206RB</span>
      <span><i style="border-top:2px dashed ${MARK['315R']}"></i>315R limit ${lim315} mm</span>
      <span><i style="border-top:2px dashed ${MARK['2206RB']}"></i>2206RB limit ${lim2206} mm</span>
    </div>
    <div class="chart-tip" id="chart-tip" hidden></div>`;
}

function wireChart(el) {
  const tip = el.querySelector('#chart-tip');
  const chart = el.querySelector('#stack-chart');
  if (!tip || !chart) return;
  const show = (row, x, y) => {
    tip.replaceChildren();
    const v = document.createElement('strong');
    v.textContent = row.dataset.tipValue;
    const l = document.createElement('div');
    l.textContent = row.dataset.tipLabel;
    const s = document.createElement('div');
    s.className = 'muted';
    s.textContent = row.dataset.tipSub;
    tip.append(v, l, s);
    tip.hidden = false;
    const box = el.getBoundingClientRect();
    tip.style.left = `${Math.min(x - box.left + 12, box.width - 240)}px`;
    tip.style.top = `${y - box.top + 12}px`;
  };
  chart.addEventListener('pointermove', (e) => {
    const row = e.target.closest('.stack-row');
    if (row) show(row, e.clientX, e.clientY);
    else tip.hidden = true;
  });
  chart.addEventListener('pointerleave', () => (tip.hidden = true));
  chart.addEventListener('focusin', (e) => {
    const row = e.target.closest('.stack-row');
    if (!row) return;
    const r = row.getBoundingClientRect();
    show(row, r.left + r.width / 2, r.bottom);
  });
  chart.addEventListener('focusout', () => (tip.hidden = true));
}


