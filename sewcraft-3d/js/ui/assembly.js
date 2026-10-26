// Stage 3 — animated assembly: wires the 3D viewer to the transport controls,
// the step list and the frame / action / execution card.
import { Viewer } from './viewer3d.js';
import { ROLE_LABEL } from '../engine/setup.js';
import { fmtMm, fmtSpi } from '../engine/units.js';
import { $, $$, esc, mbadge } from './dom.js';

export class Assembly {
  constructor(app) {
    this.app = app;
    this.viewer = null;
    this.current = -1;
    this.playBtn = $('#btn-play');
    $('#btn-prev').addEventListener('click', () => this.go(this.viewer?.step - 1, true));
    $('#btn-next').addEventListener('click', () => this.go(this.viewer?.step + 1, true));
    $('#btn-replay').addEventListener('click', () => this.viewer?.replay());
    this.playBtn.addEventListener('click', () => this.togglePlay());
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => this.viewer?.setView(b.dataset.view)));
    $('#opt-labels').addEventListener('change', (e) => this.viewer?.setLabels(e.target.checked));
    $('#opt-autocam').addEventListener('change', (e) => {
      if (this.viewer) this.viewer.autoCam = e.target.checked;
    });
    $('#opt-speed').addEventListener('change', (e) => {
      if (this.viewer) this.viewer.speed = Number(e.target.value);
    });
    document.addEventListener('keydown', (e) => {
      if (this.app.tab !== 'assembly' || e.target.closest('input, select, textarea, button, a')) return;
      if (e.key === 'ArrowRight') this.go(this.viewer?.step + 1, true);
      else if (e.key === 'ArrowLeft') this.go(this.viewer?.step - 1, true);
      else if (e.key === ' ') {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  ensureViewer() {
    if (this.viewer || this.failed) return this.viewer;
    try {
      this.viewer = new Viewer($('#viewer'), { onProgress: (p) => this.onProgress(p) });
    } catch (err) {
      this.failed = true;
      const box = $('#viewer-error');
      box.hidden = false;
      box.textContent = `3D view unavailable: ${err.message || err}. The blueprint, setup sheets and step text below still work.`;
    }
    return this.viewer;
  }

  load(plan, fabrics, { keepStep = false } = {}) {
    this.plan = plan;
    const v = this.ensureViewer();
    const step = keepStep ? Math.min(Math.max(0, this.current), plan.steps.length - 1) : 0;
    this.current = -1;
    this.renderList();
    if (v) {
      v.load(plan, fabrics);
      $('#opt-labels').checked && v.setLabels(true);
      v.autoCam = $('#opt-autocam').checked;
      v.speed = Number($('#opt-speed').value);
      if (step) v.goTo(step, { animate: false, snapCam: true });
    }
    this.renderCard(step);
    this.setPlaying(false);
  }

  go(i, animate) {
    if (!this.plan || !Number.isFinite(i)) return;
    i = Math.max(0, Math.min(this.plan.steps.length - 1, i));
    if (this.viewer) {
      this.viewer.pause();
      this.setPlaying(false);
      this.viewer.goTo(i, { animate });
    } else {
      this.renderCard(i);
    }
  }

  togglePlay() {
    const v = this.viewer;
    if (!v) return;
    if (v.playing) {
      v.pause();
      this.setPlaying(false);
    } else {
      v.play();
      this.setPlaying(true);
    }
  }

  setPlaying(on) {
    this.playBtn.classList.toggle('playing', on);
    this.playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play all steps');
  }

  onProgress({ step, t, ended }) {
    if (step !== this.current) this.renderCard(step);
    $('#step-progress').style.width = `${Math.round(t * 100)}%`;
    if (ended) this.setPlaying(false);
  }

  renderList() {
    const list = $('#step-list');
    list.innerHTML = this.plan.steps
      .map(
        (s, i) => `<li data-i="${i}"><button type="button" data-i="${i}">
          <span class="n">${i + 1}</span>
          <span>${esc(s.title)}</span>
          ${s.setup ? mbadge(s.setup.machine) : '<span class="mbadge none">prep</span>'}
        </button></li>`
      )
      .join('');
    $$('button', list).forEach((b) => b.addEventListener('click', () => this.go(Number(b.dataset.i), true)));
  }

  renderCard(i) {
    const plan = this.plan;
    if (!plan) return;
    this.current = i;
    const s = plan.steps[i];
    const u = s.setup;
    const unit = plan.project.unit;
    $('#step-count').textContent = `${i + 1} / ${plan.steps.length}`;
    $$('#step-list li').forEach((li) => {
      const k = Number(li.dataset.i);
      li.classList.toggle('done', k < i);
      const btn = li.querySelector('button');
      if (k === i) {
        btn.setAttribute('aria-current', 'step');
        btn.scrollIntoView({ block: 'nearest' });
      } else btn.removeAttribute('aria-current');
    });
    const chips = u
      ? `<div class="chips" style="margin:2px 0 12px">
          <span class="chip"><b>Needle</b>${esc(u.needle)}</span>
          <span class="chip"><b>Thread</b>Tex ${u.tex} / ${u.bobbinTex}</span>
          <span class="chip"><b>Stitch</b>${esc(fmtSpi(u.spi, unit))}</span>
          <span class="chip"><b>Stack</b>${esc(fmtMm(u.stackMm, unit))}</span>
          <span class="chip"><b>Speed</b>≤ ${u.speed} SPM</span>
          ${u.altLift ? `<span class="chip"><b>Alt. lift</b>${esc(u.altLift.split(' — ')[0])}</span>` : ''}
        </div>`
      : '';
    const program = u?.program
      ? `<details class="program"><summary class="small">2206RB panel settings for this step</summary>
          <table class="spec small"><tbody>
            <tr><td class="k">Start / end backtack</td><td>${esc(u.program.startBT)}</td></tr>
            <tr><td class="k">Soft start</td><td>${esc(u.program.soft)}</td></tr>
            <tr><td class="k">Needle stop</td><td>${esc(u.program.needle)}</td></tr>
            <tr><td class="k">Trimmer</td><td>${esc(u.program.trim)}</td></tr>
            <tr><td class="k">Speed</td><td>${esc(u.program.speed)}</td></tr>
          </tbody></table></details>`
      : '';
    const notes = u?.notes?.length ? `<p class="small muted" style="margin:8px 0 0">${u.notes.map(esc).join(' · ')}</p>` : '';
    $('#step-card').innerHTML = `
      <header>
        <div>
          <div class="eyebrow">Step ${i + 1} of ${plan.steps.length}${s.role ? ` · ${esc(ROLE_LABEL[s.role])}` : ''}</div>
          <h3>${esc(s.title)}</h3>
        </div>
        ${u ? mbadge(u.machine) : ''}
      </header>
      ${chips}
      <div class="beat frame"><h4>Visual frame</h4><p>${s.text.frame}</p></div>
      <div class="beat action"><h4>Action</h4><p>${s.text.action}</p></div>
      <div class="beat exec"><h4>Sewing execution</h4><p>${s.text.exec}</p></div>
      ${s.warning ? `<div class="callout red">${esc(s.warning)}</div>` : ''}
      ${notes}
      ${program}
      ${u ? `<p class="small" style="margin:10px 0 0"><a href="#training" data-train="${u.machine}">Threading &amp; operation guide for the ${esc(u.machineName)} →</a></p>` : ''}
    `;
    $('#step-card [data-train]')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.app.openTraining(e.currentTarget.dataset.train);
    });
  }

  snapshot(view) {
    return this.viewer ? this.viewer.snapshot(view) : null;
  }
}
