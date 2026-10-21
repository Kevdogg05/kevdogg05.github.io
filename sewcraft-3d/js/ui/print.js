// Printable shop packet: blueprint, cut list, setup sheet and the step script.
import { patternSheet } from './blueprint.js';
import { seamType } from '../data/seams.js';
import { fmtLen, fmtSpi, fmtMm } from '../engine/units.js';
import { esc } from './dom.js';

export function renderPrint(el, plan, snapshots) {
  const unit = plan.project.unit;
  el.innerHTML = `
    <h1>SewCraft 3D — ${esc(plan.template.name)}</h1>
    <p>${esc(plan.summary)} Main fabric: ${esc(plan.mat.name)}${plan.lin ? `; lining: ${esc(plan.lin.name)}` : ''}.</p>
    ${plan.warnings.length ? `<p><strong>Warnings:</strong> ${plan.warnings.join(' ')}</p>` : ''}
    <h2>1 · Blueprint</h2>
    <div class="sheet">${patternSheet(plan, { print: true })}</div>
    <table><thead><tr><th>Panel</th><th>Qty</th><th>Finished</th><th>Cut</th><th>Fabric</th></tr></thead><tbody>
      ${plan.panels.map((p) => `<tr><td>${p.id} ${esc(p.name)}</td><td>${p.qty}</td><td>${esc(p.finishedSize)}</td><td>${esc(p.cutSize)}</td><td>${esc(p.material?.name || '')}</td></tr>`).join('')}
    </tbody></table>
    <h2>Seams</h2>
    <table><thead><tr><th>Seam</th><th>Type</th><th>Length</th><th>Stitch</th><th>Thread</th><th>Machine</th></tr></thead><tbody>
      ${plan.seams.map((s) => `<tr><td>${s.id} ${esc(s.name)}</td><td>${esc(seamType(s.type).name)}</td><td>${s.count > 1 ? `${s.count} × ` : ''}${fmtLen(s.length, unit)}</td><td>${s.setup ? fmtSpi(s.setup.spi, unit) : '—'}</td><td>${s.setup ? `Tex ${s.setup.tex}` : '—'}</td><td>${s.setup ? esc(s.setup.machineName) : '—'}</td></tr>`).join('')}
    </tbody></table>
    ${snapshots ? `<h2>Finished model</h2><div>${['front', 'side', 'iso'].map((v) => (snapshots[v] ? `<img src="${snapshots[v]}" alt="${v} view">` : '')).join(' ')}</div>` : ''}
    <h2>Notions &amp; yardage</h2>
    <ul>
      ${plan.yardage.map((y) => `<li>${esc(y.material.name)}: ${esc(y.text)}</li>`).join('')}
      ${plan.notions.map((n) => `<li>${esc(n.label)} — ${esc(n.qty)}</li>`).join('')}
      ${plan.thread.map((t) => `<li>Thread Tex ${t.tex} (${t.v}) ≈ ${t.yards} yd</li>`).join('')}
    </ul>
    <h2>2 · Machine setup</h2>
    <table><thead><tr><th>Step</th><th>Machine</th><th>Needle</th><th>Thread</th><th>Stitch</th><th>Stack</th><th>Speed</th></tr></thead><tbody>
      ${plan.steps.filter((s) => s.setup).map((s) => `<tr><td>${s.index + 1}</td><td>${esc(s.setup.machineName)}</td><td>${esc(s.setup.needle)}</td><td>Tex ${s.setup.tex} / ${s.setup.bobbinTex}</td><td>${fmtSpi(s.setup.spi, unit)}</td><td>${fmtMm(s.setup.stackMm, unit)}</td><td>${s.setup.speed} SPM</td></tr>`).join('')}
    </tbody></table>
    <h2>3 · Assembly</h2>
    ${plan.steps
      .map(
        (s, i) => `<div class="step"><strong>Step ${i + 1} — ${esc(s.title)}</strong>
        <p><em>Visual frame:</em> ${s.text.frame}</p>
        <p><em>Action:</em> ${s.text.action}</p>
        <p><em>Sewing execution:</em> ${s.text.exec}</p></div>`
      )
      .join('')}
  `;
}
