// Project setup panel: template, dimensions, options, materials, colours,
// reference photo and the "plan at a glance" summary.
import { TEMPLATE_LIST, TEMPLATES } from '../templates/index.js';
import { MATERIALS, MATERIAL_GROUPS, getMaterial } from '../data/materials.js';
import { MACHINES } from '../data/machines.js';
import { fmtLen, fmtMm, inchesFromInput, inputFromInches } from '../engine/units.js';
import { $, $$, esc, mbadge } from './dom.js';

const LINING_IDS = ['packcloth210', 'cotton', 'cordura500', 'xpac', 'fleece'];

export function renderProjectPanel(el, app) {
  const { project } = app;
  const tpl = TEMPLATES[project.template];
  const unit = project.unit;
  const mat = getMaterial(project.material);

  el.innerHTML = `
    <div class="panel-heading"><h3>Choose a project</h3><span class="muted small">${TEMPLATE_LIST.length} templates</span></div>
    <div class="tpl-grid" role="group" aria-label="Project templates">
      ${TEMPLATE_LIST.map((t) => `<button type="button" class="tpl" data-tpl="${t.id}" aria-pressed="${t.id === project.template}">${t.icon}<strong>${esc(t.name)}</strong><small>${esc(t.category)}</small></button>`).join('')}
    </div>
    <p class="small muted" style="margin-top:-6px">${esc(tpl.blurb)}</p>

    <div class="card">
      <h3>Finished dimensions</h3>
      ${tpl.dims.map((d) => rangeField(d, project.dims[d.key], unit)).join('')}
      ${(tpl.options || []).map((o) => optionField(o, project.options[o.key])).join('')}
    </div>

    <div class="card">
      <h3>Material</h3>
      <div class="field">
        <label for="f-mat">Main fabric</label>
        <select id="f-mat">${materialOptions(project.material)}</select>
      </div>
      <dl class="mat-facts" id="mat-facts">${matFacts(mat, unit)}</dl>
      ${tpl.usesLining ? `
      <div class="field" style="margin-top:12px">
        <label for="f-lining">Lining</label>
        <select id="f-lining">
          <option value="none"${project.lining === 'none' ? ' selected' : ''}>No lining (bind the inside seams)</option>
          ${LINING_IDS.map((id) => `<option value="${id}"${project.lining === id ? ' selected' : ''}>${esc(getMaterial(id).name)}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="color-row" style="margin-top:12px">
        <label>Fabric<input type="color" id="c-main" value="${project.colors.main || mat.look.face}"></label>
        <label>Webbing / trim<input type="color" id="c-accent" value="${project.colors.accent || '#1f2226'}"></label>
        <label>Thread<input type="color" id="c-thread" value="${project.colors.thread || '#f2c14e'}"></label>
      </div>
    </div>

    <div class="card">
      <h3>Reference photo <span class="muted small">optional</span></h3>
      <label class="photo-drop" id="photo-drop">
        ${app.photo ? `<img src="${app.photo}" alt="Your reference photo">` : '<span>📷 Add a sketch or photo of the project or the fabric</span>'}
        <input type="file" accept="image/*" id="f-photo" aria-label="Add a reference photo">
      </label>
      <p class="small muted" style="margin:8px 0 0">The builder shows it here for reference. To have it analysed — size, material, construction — open <a href="#ai" data-goto="ai">Ask SewCraft AI</a>; the photo is attached there automatically.</p>
    </div>

    <div class="card" id="glance-card">${glance(app)}</div>
  `;

  // Template picker.
  $$('.tpl', el).forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.tpl !== project.template) app.setTemplate(btn.dataset.tpl);
    })
  );

  // Dimensions: slider and number box stay in sync.
  for (const d of tpl.dims) {
    const range = $(`#r-${d.key}`, el);
    const num = $(`#n-${d.key}`, el);
    const val = $(`#v-${d.key}`, el);
    const read = (input) => (d.count ? Math.round(Number(input.value)) : inchesFromInput(input.value, unit));
    const show = (x) => (d.count ? x : inputFromInches(x, unit));
    const commit = (x, from) => {
      if (!Number.isFinite(x)) return;
      x = Math.min(d.max, Math.max(d.min, x));
      if (from !== range) range.value = show(x);
      if (from !== num) num.value = show(x);
      val.textContent = d.count ? String(x) : fmtLen(x, unit);
      app.update({ dims: { ...app.project.dims, [d.key]: x } });
    };
    range.addEventListener('input', () => commit(read(range), range));
    num.addEventListener('change', () => commit(read(num), num));
  }
  for (const o of tpl.options || []) {
    const input = $(`#o-${o.key}`, el);
    input.addEventListener('change', () => {
      const value = o.type === 'toggle' ? input.checked : input.value;
      app.update({ options: { ...app.project.options, [o.key]: value } });
    });
  }

  $('#f-mat', el).addEventListener('change', (e) => {
    const m = getMaterial(e.target.value);
    $('#mat-facts', el).innerHTML = matFacts(m, unit);
    const colors = { ...app.project.colors };
    delete colors.main;
    $('#c-main', el).value = m.look.face;
    app.update({ material: m.id, colors });
  });
  $('#f-lining', el)?.addEventListener('change', (e) => app.update({ lining: e.target.value }));
  for (const [id, key] of [['c-main', 'main'], ['c-accent', 'accent'], ['c-thread', 'thread']]) {
    $(`#${id}`, el).addEventListener('input', (e) => app.update({ colors: { ...app.project.colors, [key]: e.target.value } }, { soft: true }));
  }
  $('#f-photo', el).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    app.setPhoto(await downscale(file, 1568));
    $('#photo-drop', el).querySelector('span, img')?.remove();
    const img = document.createElement('img');
    img.src = app.photo;
    img.alt = 'Your reference photo';
    $('#photo-drop', el).prepend(img);
  });
  wireGotos(el, app);
}

/** Re-render only the summary card (cheap; keeps sliders focused). */
export function refreshGlance(el, app) {
  const card = $('#glance-card', el);
  if (card) {
    card.innerHTML = glance(app);
    wireGotos(card, app);
  }
}

function wireGotos(root, app) {
  $$('[data-goto]', root).forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      app.switchTab(a.dataset.goto);
    })
  );
}

function rangeField(d, value, unit) {
  if (d.count) {
    return `
    <div class="field">
      <label for="r-${d.key}">${esc(d.label)} <span class="val" id="v-${d.key}">${value}</span></label>
      <div class="range-row">
        <input type="range" id="r-${d.key}" min="${d.min}" max="${d.max}" step="1" value="${value}">
        <input type="number" id="n-${d.key}" min="${d.min}" max="${d.max}" step="1" value="${value}" aria-label="${esc(d.label)}">
      </div>
    </div>`;
  }
  const mn = inputFromInches(d.min, unit);
  const mx = inputFromInches(d.max, unit);
  const st = unit === 'cm' ? 0.5 : d.step;
  const v = inputFromInches(value, unit);
  return `
    <div class="field">
      <label for="r-${d.key}">${esc(d.label)} <span class="val" id="v-${d.key}">${fmtLen(value, unit)}</span></label>
      <div class="range-row">
        <input type="range" id="r-${d.key}" min="${mn}" max="${mx}" step="${st}" value="${v}">
        <input type="number" id="n-${d.key}" min="${mn}" max="${mx}" step="${st}" value="${v}" aria-label="${esc(d.label)} in ${unit}">
      </div>
    </div>`;
}

function optionField(o, value) {
  if (o.type === 'toggle') {
    return `<label class="toggle"><span>${esc(o.label)}</span><input type="checkbox" id="o-${o.key}"${value ? ' checked' : ''}></label>`;
  }
  return `
    <div class="field">
      <label for="o-${o.key}">${esc(o.label)}</label>
      <select id="o-${o.key}">${o.choices.map((c) => `<option value="${esc(c.value)}"${c.value === value ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
    </div>`;
}

function materialOptions(selected) {
  return MATERIAL_GROUPS.map(
    (g) =>
      `<optgroup label="${esc(g)}">${MATERIALS.filter((m) => m.group === g)
        .map((m) => `<option value="${m.id}"${m.id === selected ? ' selected' : ''}>${esc(m.name)}</option>`)
        .join('')}</optgroup>`
  ).join('');
}

function matFacts(m, unit) {
  return `
    <dt>Thickness</dt><dd class="mono">${fmtMm(m.thicknessMm, unit)}</dd>
    <dt>Weight</dt><dd>${esc(m.weight)}</dd>
    <dt>Stretch</dt><dd>${esc(m.stretch)}</dd>
    <dt>Backing</dt><dd>${esc(m.backing)}</dd>`;
}

function glance(app) {
  const plan = app.plan;
  if (!plan) return '';
  const sewing = plan.steps.filter((s) => s.setup);
  const byM = plan.machinePlan.counts;
  const yard = plan.yardage.map((y) => `<div><b>${y.fabric === 'main' ? 'Main fabric' : 'Lining'}</b><span>${esc(y.text.split(' (')[0])}</span></div>`).join('');
  const thread = plan.thread.map((t) => `Tex ${t.tex} ×${t.yards} yd`).join(', ');
  const warn = plan.warnings.length
    ? `<div class="callout red"><strong>Check before you cut</strong><ul>${plan.warnings.map((w) => `<li>${w}</li>`).join('')}</ul></div>`
    : '';
  return `
    <h3>Plan at a glance</h3>
    <p class="small muted" style="margin:0">${esc(plan.summary)}</p>
    <div class="glance">
      <div><b>Steps</b><span>${plan.steps.length} (${sewing.length} sewn)</span></div>
      <div><b>Pattern pieces</b><span>${plan.panels.length}</span></div>
      ${Object.keys(MACHINES)
        .map((id) => `<div><b>${MACHINES[id].name.replace('Consew ', '')}</b><span>${byM[id] ? `${byM[id].length} step${byM[id].length > 1 ? 's' : ''}` : '—'}</span></div>`)
        .join('')}
      ${yard}
      <div style="grid-column:1/-1"><b>Thread (est.)</b><span>${esc(thread || '—')}</span></div>
    </div>
    ${warn}
    <div class="chips" style="gap:8px">
      <a href="#assembly" class="btn primary" data-goto="assembly">▶ 3D assembly</a>
      <a href="#blueprint" class="btn" data-goto="blueprint">Blueprint</a>
      <a href="#setup" class="btn" data-goto="setup">Machine setup</a>
    </div>
    <p class="small muted" style="margin:10px 0 0">Primary machine: ${mbadge(plan.machinePlan.primary)}</p>`;
}

/** Read an image file and return a JPEG data URL no larger than `max` px on its long edge. */
export function downscale(file, max = 1568) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
