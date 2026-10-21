// SewCraft 3D — app shell: state, tabs, and rebuilding every view when the
// project changes.
import { buildPlan, defaultProject, normalizeProject } from './engine/plan.js';
import { renderProjectPanel, refreshGlance } from './ui/projectPanel.js';
import { renderBlueprint } from './ui/blueprint.js';
import { renderSetup } from './ui/setupView.js';
import { renderTraining } from './ui/training.js';
import { renderPrint } from './ui/print.js';
import { Assembly } from './ui/assembly.js';
import { $, $$, debounce, store } from './ui/dom.js';

const TABS = ['project', 'blueprint', 'setup', 'assembly', 'training', 'ai'];
const STORE_KEY = 'sewcraft3d.project';
const wide = () => window.matchMedia('(min-width: 1100px)').matches;

const app = {
  project: normalizeProject(store.get(STORE_KEY) || defaultProject('tote')),
  plan: null,
  photo: null,
  tab: null,
  snapshots: null,
  dirty: new Set(),
  training: { machine: '2206RB', step: 0, timer: null },
  ai: null,

  /** Merge a change into the project. `soft` changes (colours) skip the plan rebuild. */
  update(patch, { soft = false } = {}) {
    this.project = normalizeProject({ ...this.project, ...patch });
    store.set(STORE_KEY, this.project);
    if (soft) softRefresh();
    else scheduleRebuild();
  },

  setTemplate(id) {
    this.project = { ...defaultProject(id), unit: this.project.unit };
    store.set(STORE_KEY, this.project);
    rebuild({ rerenderPanel: true, keepStep: false });
  },

  /** Load a whole project (used by the AI hand-off). */
  loadProject(p) {
    this.project = normalizeProject({ ...p, unit: this.project.unit });
    store.set(STORE_KEY, this.project);
    rebuild({ rerenderPanel: true, keepStep: false });
    this.switchTab('assembly');
  },

  setPhoto(url) {
    this.photo = url;
    this.ai?.addPhoto?.(url);
  },

  switchTab(name) {
    if (!TABS.includes(name)) name = 'assembly';
    if (name === 'project' && wide()) name = 'assembly';
    this.tab = name;
    for (const t of TABS) {
      const btn = $(`.tabs [data-tab="${t}"]`);
      const panel = $(`#tab-${t}`);
      btn.setAttribute('aria-selected', String(t === name));
      btn.tabIndex = t === name ? 0 : -1;
      if (t === 'project') panel.hidden = t !== name && !wide();
      else panel.hidden = t !== name;
    }
    $(`.tabs [data-tab="${name}"]`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    renderTab(name);
    if (name !== 'project') window.scrollTo({ top: 0 });
  },

  openTraining(machineId) {
    this.training.machine = machineId;
    this.training.step = 0;
    this.dirty.add('training');
    this.switchTab('training');
  },
};
window.sewcraft = app;

const assembly = new Assembly(app);
app.assembly = assembly;

function fabricsFor() {
  const { plan, project } = app;
  const m = plan.mat.look;
  const l = (plan.lin || plan.mat).look;
  const accent = project.colors.accent || '#1f2226';
  return {
    main: { ...m, face: project.colors.main || m.face },
    lining: { ...l },
    accent: { face: accent, back: accent, tex: 'webbing', backTex: 'webbing', rough: 0.78 },
    trim: { face: '#2b2f36', back: '#2b2f36', tex: 'nylon', backTex: 'nylon', rough: 0.7 },
    thread: project.colors.thread || '#f2c14e',
  };
}

function rebuild({ rerenderPanel = false, keepStep = true } = {}) {
  try {
    app.plan = buildPlan(app.project);
  } catch (err) {
    console.error(err);
    toast(`Could not build that plan: ${err.message}`);
    return;
  }
  app.snapshots = null;
  try {
    assembly.load(app.plan, fabricsFor(), { keepStep });
  } catch (err) {
    console.error(err);
    toast(`3D view error: ${err.message}`);
  }
  const panel = $('#tab-project');
  if (rerenderPanel || !panel.childElementCount) renderProjectPanel(panel, app);
  else refreshGlance(panel, app);
  app.dirty = new Set(['blueprint', 'setup', 'training']);
  if (app.tab) renderTab(app.tab);
}
const scheduleRebuild = debounce(() => rebuild(), 160);

const softRefresh = debounce(() => {
  app.snapshots = null;
  assembly.load(app.plan, fabricsFor(), { keepStep: true });
  app.dirty.add('blueprint');
}, 120);

function snapshots() {
  if (!app.snapshots && assembly.viewer) {
    try {
      app.snapshots = { front: assembly.snapshot('front'), side: assembly.snapshot('side'), iso: assembly.snapshot('iso') };
    } catch (err) {
      console.warn('snapshot failed', err);
      app.snapshots = {};
    }
  }
  return app.snapshots;
}

function renderTab(name) {
  if (!app.plan) return;
  const el = $(`#tab-${name}`);
  if (name === 'blueprint' && app.dirty.has('blueprint')) {
    renderBlueprint(el, app, snapshots());
    app.dirty.delete('blueprint');
  } else if (name === 'setup' && app.dirty.has('setup')) {
    renderSetup(el, app);
    app.dirty.delete('setup');
  } else if (name === 'training' && app.dirty.has('training')) {
    renderTraining(el, app);
    app.dirty.delete('training');
  } else if (name === 'assembly') {
    assembly.viewer?.resize();
  } else if (name === 'ai' && !app.ai) {
    el.innerHTML = '<p class="muted">Loading the AI assistant…</p>';
    import('./ui/ai.js')
      .then((mod) => {
        app.ai = mod.initAI(el, app);
      })
      .catch((err) => {
        el.innerHTML = `<div class="callout red">The AI panel could not load: ${String(err.message || err).replace(/[<>&]/g, '')}</div>`;
      });
  }
}

function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#2a1418;border:1px solid #ff5d52;color:#ffe9e7;padding:10px 16px;border-radius:10px;z-index:99;max-width:min(560px,calc(100vw - 32px));font-size:14px';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.hidden = true), 6000);
}

/* ---------- wiring ---------- */

$$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => app.switchTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const visible = $$('.tabs [data-tab]').filter((b) => b.offsetParent !== null);
  const i = visible.findIndex((b) => b.dataset.tab === app.tab);
  const next = visible[(i + (e.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length];
  app.switchTab(next.dataset.tab);
  next.focus();
});
window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (TABS.includes(name) && name !== app.tab) app.switchTab(name);
});

function syncUnitButtons() {
  $$('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === app.project.unit)));
}
$$('[data-unit]').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.unit === app.project.unit) return;
    app.project = normalizeProject({ ...app.project, unit: b.dataset.unit });
    store.set(STORE_KEY, app.project);
    syncUnitButtons();
    rebuild({ rerenderPanel: true });
  })
);
syncUnitButtons();

const QR_URL = 'https://kevdogg05.github.io/sewcraft-3d/';
$('#btn-qr').addEventListener('click', () => $('#qr-dialog').showModal());
$('#qr-dialog').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
$('#qr-copy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(QR_URL);
    e.target.textContent = 'Copied ✓';
  } catch {
    e.target.textContent = 'Copy failed — long-press the link';
  }
  setTimeout(() => (e.target.textContent = 'Copy link'), 2500);
});

$('#btn-print').addEventListener('click', () => {
  if (!app.plan) return;
  renderPrint($('#print-root'), app.plan, snapshots());
  window.print();
});

let wasWide = wide();
window.addEventListener('resize', () => {
  if (wide() !== wasWide) {
    wasWide = wide();
    app.switchTab(app.tab);
  }
});

/* ---------- boot ---------- */
rebuild({ rerenderPanel: true, keepStep: false });
const initial = location.hash.slice(1);
app.switchTab(TABS.includes(initial) ? initial : wide() ? 'assembly' : 'project');
