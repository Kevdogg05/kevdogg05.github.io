// Stage 4 — machine training: animated threading path, bobbin, operation
// mechanics and (for the 2206RB) the pedal and automatic panel.
import { MACHINES } from '../data/machines.js';
import { $, $$, esc, mbadge } from './dom.js';

/* Schematic front views (needle left, handwheel right). Not to scale. */
const DIAGRAMS = {
  '315R': {
    draw: () => `
      <rect x="0" y="338" width="700" height="16" fill="#18324d"/>
      <rect x="40" y="296" width="560" height="42" rx="6" fill="#203b58" stroke="#3c6688"/>
      <rect x="84" y="293" width="84" height="5" rx="2" fill="#9fb3c8"/>
      <rect x="470" y="120" width="92" height="178" rx="12" fill="#23425f" stroke="#3c6688"/>
      <rect x="110" y="108" width="452" height="66" rx="26" fill="#23425f" stroke="#3c6688"/>
      <rect x="66" y="96" width="104" height="168" rx="14" fill="#294b6b" stroke="#4a7aa3"/>
      <circle cx="598" cy="158" r="42" fill="#1c3550" stroke="#4a7aa3" stroke-width="3"/>
      <circle cx="598" cy="158" r="10" fill="#4a7aa3"/>
      <path d="M598 120v76M560 158h76" stroke="#4a7aa3" stroke-width="3"/>
      <rect x="448" y="206" width="16" height="44" rx="4" fill="#5d84a8"/>
      <circle cx="510" cy="236" r="14" fill="#1c3550" stroke="#5d84a8" stroke-width="2"/>
      <rect x="101" y="264" width="10" height="28" fill="#9fb3c8"/>
      <line x1="106" y1="292" x2="106" y2="324" stroke="#dfe7ef" stroke-width="2.4"/>
      <ellipse cx="106" cy="316" rx="1.8" ry="3" fill="#0d2238"/>
      <rect x="125" y="264" width="7" height="30" fill="#9fb3c8"/>
      <path d="M112 302h36l4-6h-40z" fill="#c1cfdc"/>
      <path d="M150 150L82 124" stroke="#c1cfdc" stroke-width="7" stroke-linecap="round"/>
      <circle cx="82" cy="124" r="6" fill="#0d2238" stroke="#c1cfdc" stroke-width="2"/>
      <rect x="128" y="96" width="22" height="8" rx="3" fill="#c1cfdc"/>
      <circle cx="158" cy="132" r="7" fill="#c1cfdc"/>
      <circle cx="152" cy="206" r="13" fill="#3a6288" stroke="#c1cfdc" stroke-width="2"/>
      <circle cx="152" cy="206" r="5" fill="#c1cfdc"/>
      <path d="M126 228c-6-4-2-12 6-8" fill="none" stroke="#c1cfdc" stroke-width="2"/>
      <circle cx="122" cy="178" r="4" fill="none" stroke="#c1cfdc" stroke-width="2"/>
      <path d="M90 214h8" stroke="#c1cfdc" stroke-width="3"/>
      <rect x="494" y="98" width="12" height="10" rx="2" fill="#c1cfdc"/>
      <line x1="650" y1="338" x2="650" y2="24" stroke="#5d84a8" stroke-width="3"/>
      <line x1="626" y1="30" x2="670" y2="30" stroke="#5d84a8" stroke-width="3"/>
      <circle cx="650" cy="34" r="4" fill="#0d2238" stroke="#c1cfdc" stroke-width="2"/>
      <path d="M636 336l6-58h16l6 58z" fill="#f2c14e" opacity=".85"/>
      <text x="560" y="222" class="cap">handwheel</text>
      <text x="430" y="268" class="cap">reverse lever</text>
      <text x="486" y="262" class="cap">stitch dial</text>
      <text x="616" y="330" class="cap" text-anchor="end">cone</text>
      <text x="40" y="364" class="cap">needle · DBx1</text>`,
    points: {
      handwheel: [598, 158],
      stand: [[650, 278], [650, 34]],
      armGuide: [[500, 103]],
      preTension: [[139, 100], [158, 132]],
      tension: [[166, 198], [152, 220], [139, 206]],
      checkSpring: [[128, 226]],
      takeUp: [[122, 178], [82, 124]],
      faceGuide: [[94, 214]],
      barGuide: [[106, 272]],
      needle: [[106, 316]],
    },
  },
  '2206RB': {
    draw: () => `
      <rect x="0" y="338" width="700" height="16" fill="#18324d"/>
      <rect x="30" y="292" width="590" height="46" rx="6" fill="#203b58" stroke="#3c6688"/>
      <rect x="70" y="289" width="98" height="5" rx="2" fill="#9fb3c8"/>
      <rect x="478" y="106" width="96" height="190" rx="12" fill="#23425f" stroke="#3c6688"/>
      <rect x="120" y="92" width="454" height="80" rx="28" fill="#23425f" stroke="#3c6688"/>
      <rect x="330" y="76" width="118" height="20" rx="5" fill="#0e2034" stroke="#5d84a8"/>
      <text x="389" y="90" class="cap" text-anchor="middle">operation panel</text>
      <rect x="50" y="80" width="132" height="184" rx="16" fill="#294b6b" stroke="#4a7aa3"/>
      <circle cx="616" cy="150" r="46" fill="#1c3550" stroke="#4a7aa3" stroke-width="3"/>
      <circle cx="616" cy="150" r="11" fill="#4a7aa3"/>
      <path d="M616 108v84M574 150h84" stroke="#4a7aa3" stroke-width="3"/>
      <rect x="456" y="200" width="16" height="50" rx="4" fill="#5d84a8"/>
      <rect x="150" y="242" width="22" height="12" rx="3" fill="#ff8f87"/>
      <rect x="92" y="264" width="12" height="28" fill="#9fb3c8"/>
      <line x1="98" y1="292" x2="98" y2="328" stroke="#dfe7ef" stroke-width="2.8"/>
      <ellipse cx="98" cy="320" rx="2" ry="3.4" fill="#0d2238"/>
      <rect x="116" y="264" width="8" height="32" fill="#9fb3c8"/>
      <path d="M84 304h24l3-6H84z" fill="#e3ebf3"/>
      <path d="M110 304h40l4-8h-44z" fill="#c1cfdc"/>
      <path d="M160 140L66 112" stroke="#c1cfdc" stroke-width="8" stroke-linecap="round"/>
      <circle cx="66" cy="112" r="7" fill="#0d2238" stroke="#c1cfdc" stroke-width="2"/>
      <rect x="152" y="80" width="22" height="9" rx="3" fill="#c1cfdc"/>
      <circle cx="170" cy="112" r="8" fill="#c1cfdc"/>
      <circle cx="166" cy="150" r="3.5" fill="#c1cfdc"/>
      <circle cx="158" cy="200" r="15" fill="#3a6288" stroke="#c1cfdc" stroke-width="2"/>
      <circle cx="158" cy="200" r="6" fill="#c1cfdc"/>
      <path d="M134 224c-7-4-2-13 7-9" fill="none" stroke="#c1cfdc" stroke-width="2"/>
      <circle cx="140" cy="168" r="4" fill="none" stroke="#c1cfdc" stroke-width="2"/>
      <path d="M78 218h9" stroke="#c1cfdc" stroke-width="3"/>
      <rect x="514" y="82" width="12" height="10" rx="2" fill="#c1cfdc"/>
      <line x1="662" y1="338" x2="662" y2="22" stroke="#5d84a8" stroke-width="3"/>
      <line x1="638" y1="28" x2="684" y2="28" stroke="#5d84a8" stroke-width="3"/>
      <circle cx="662" cy="32" r="4" fill="#0d2238" stroke="#c1cfdc" stroke-width="2"/>
      <path d="M648 336l6-58h16l6 58z" fill="#f2c14e" opacity=".85"/>
      <text x="572" y="214" class="cap">handwheel</text>
      <text x="420" y="270" class="cap">reverse lever</text>
      <text x="176" y="252" class="cap">knuckle switch</text>
      <text x="152" y="320" class="cap">walking + presser feet</text>
      <text x="30" y="364" class="cap">needle · 135x17</text>`,
    points: {
      handwheel: [616, 150],
      stand: [[662, 278], [662, 32]],
      armGuide: [[520, 87]],
      preTension: [[163, 84], [170, 112]],
      pins: [[166, 150]],
      tension: [[174, 194], [158, 216], [143, 200]],
      checkSpring: [[134, 222]],
      takeUp: [[140, 168], [66, 112]],
      faceGuide: [[82, 218]],
      barGuide: [[98, 274]],
      needle: [[98, 320]],
    },
  },
};

const ORDER = ['stand', 'armGuide', 'preTension', 'pins', 'tension', 'checkSpring', 'takeUp', 'faceGuide', 'barGuide', 'needle'];

export function renderTraining(el, app) {
  const id = app.training.machine;
  const m = MACHINES[id];
  const plan = app.plan;
  const myGroups = plan ? programsFor(plan, id) : [];

  el.innerHTML = `
    <h2 class="section-title"><span class="stage">4</span>Machine training &amp; threading</h2>
    <p class="section-lead">Threading, bobbin and operation for your two Consews. The diagrams are schematic — use them to learn the order, then confirm each guide against the threading figure in your machine's manual.</p>
    <div class="seg" role="group" aria-label="Machine" style="margin-bottom:14px">
      ${Object.values(MACHINES).map((mm) => `<button type="button" data-machine="${mm.id}" aria-pressed="${mm.id === id}">${esc(mm.name)}</button>`).join('')}
    </div>

    <div class="grid-2">
      <div>
        <div class="diagram" id="thread-diagram">${diagramSvg(id)}</div>
        <div class="transport" style="border:1px solid var(--line-soft);border-top:0;border-radius:0 0 12px 12px">
          <button type="button" class="icon-btn" id="th-prev" aria-label="Previous threading step"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z" fill="currentColor"/></svg></button>
          <button type="button" class="icon-btn primary" id="th-play" aria-label="Animate the whole thread path"><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg></button>
          <button type="button" class="icon-btn" id="th-next" aria-label="Next threading step"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z" fill="currentColor"/></svg></button>
          <span class="step-count" id="th-count"></span>
        </div>
      </div>
      <div class="card">
        <h3>Threading walkthrough — ${esc(m.name)}</h3>
        <ol class="thread-steps" id="thread-steps">
          ${m.threading.map((t, i) => `<li><button type="button" data-i="${i}"><span class="n">${i + 1}</span><span><strong>${esc(t.title)}</strong><span class="t">${esc(t.text)}</span></span></button></li>`).join('')}
        </ol>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Bobbin</h3>
        <p class="small muted" style="margin-top:-4px">${esc(m.bobbin.type)}</p>
        <div class="grid-2" style="gap:12px;align-items:center">
          <div class="diagram" style="max-width:220px">${bobbinSvg()}</div>
          <p class="small" style="margin:0">Viewed from the open side of the case: the thread leaves the bobbin so it turns <strong>clockwise</strong> when you pull the tail, then runs through the slit and under the tension spring.</p>
        </div>
        <h4>Winding</h4>
        <ol class="plain small">${m.bobbin.wind.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <h4>Loading</h4>
        <ol class="plain small">${m.bobbin.load.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <h4>Bobbin tension</h4>
        <p class="small" style="margin:0">${esc(m.bobbin.tension)}</p>
      </div>
      <div class="card">
        <h3>Specifications</h3>
        <table class="spec small"><tbody>${m.specs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        <p class="small muted" style="margin:10px 0 0">${esc(m.autoNote)}</p>
      </div>
    </div>

    <div class="card">
      <h3>Operation mechanics</h3>
      <div class="mech">${m.mechanics.map((x) => `<div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>
    </div>

    ${m.panel ? panelCard(m, myGroups) : ''}

    <div class="grid-2">
      <div class="card"><h3>Best for</h3><ul class="small">${m.bestFor.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="card"><h3>Send elsewhere</h3><ul class="small">${m.avoid.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
  `;

  $$('[data-machine]', el).forEach((b) =>
    b.addEventListener('click', () => {
      app.training.machine = b.dataset.machine;
      app.training.step = 0;
      renderTraining(el, app);
    })
  );
  const steps = m.threading;
  const set = (i) => {
    app.training.step = Math.max(0, Math.min(steps.length - 1, i));
    showStep(el, id, app.training.step);
  };
  $$('#thread-steps button', el).forEach((b) => b.addEventListener('click', () => set(Number(b.dataset.i))));
  $('#th-prev', el).addEventListener('click', () => set(app.training.step - 1));
  $('#th-next', el).addEventListener('click', () => set(app.training.step + 1));
  const play = $('#th-play', el);
  play.addEventListener('click', () => {
    if (app.training.timer) {
      clearInterval(app.training.timer);
      app.training.timer = null;
      play.classList.remove('playing');
      return;
    }
    play.classList.add('playing');
    if (app.training.step >= steps.length - 1) set(0);
    app.training.timer = setInterval(() => {
      if (app.training.step >= steps.length - 1 || !el.isConnected) {
        clearInterval(app.training.timer);
        app.training.timer = null;
        play.classList.remove('playing');
        return;
      }
      set(app.training.step + 1);
    }, 2600);
  });
  showStep(el, id, app.training.step);
}

function diagramSvg(id) {
  const d = DIAGRAMS[id];
  const pts = [];
  for (const key of ORDER) if (d.points[key]) pts.push(...d.points[key]);
  const pathD = `M${pts.map((p) => p.join(' ')).join('L')}`;
  const markers = ORDER.filter((k) => d.points[k])
    .map((k) => {
      const p = d.points[k][d.points[k].length - 1];
      return `<g class="th-mark" data-key="${k}"><circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#0d2238" stroke="#ffb547" stroke-width="2"/></g>`;
    })
    .join('');
  const [hx, hy] = d.points.handwheel;
  return `<svg viewBox="0 0 700 372" role="img" aria-label="Schematic thread path for the ${esc(MACHINES[id].name)}">
    <style>.cap{font:11px 'IBM Plex Sans',system-ui,sans-serif;fill:#93abc3}</style>
    ${d.draw()}
    <path d="${pathD}" fill="none" stroke="#ffb547" stroke-opacity=".18" stroke-width="2" stroke-dasharray="3 4"/>
    <path id="th-path" d="${pathD}" fill="none" stroke="#ffb547" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke-dashoffset 1.2s ease"/>
    ${markers}
    <circle id="th-hand" cx="${hx}" cy="${hy}" r="52" fill="none" stroke="#ff5d52" stroke-width="3" stroke-dasharray="6 6" class="pulse" opacity="0"/>
    <g id="th-active" opacity="0"><circle r="14" fill="none" stroke="#ff5d52" stroke-width="3" class="pulse"/></g>
  </svg>`;
}

/** Reveal the thread path up to the step's guide and highlight it. */
function showStep(el, id, i) {
  const m = MACHINES[id];
  const d = DIAGRAMS[id];
  const step = m.threading[i];
  $('#th-count', el).textContent = `${i + 1} / ${m.threading.length}`;
  $$('#thread-steps button', el).forEach((b) => {
    if (Number(b.dataset.i) === i) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  const path = $('#th-path', el);
  if (!path) return;
  const total = path.getTotalLength();
  // Length of the polyline up to the active key's last waypoint.
  let reveal = 0;
  if (step.at !== 'handwheel') {
    const pts = [];
    let endIndex = -1;
    for (const key of ORDER) {
      if (!d.points[key]) continue;
      pts.push(...d.points[key]);
      if (key === step.at) endIndex = pts.length - 1;
    }
    for (let k = 1; k <= endIndex; k++) reveal += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  }
  path.style.strokeDasharray = `${total} ${total}`;
  path.style.strokeDashoffset = `${total - reveal}`;
  $$('.th-mark', el).forEach((g) => {
    const reached = ORDER.indexOf(g.dataset.key) <= ORDER.indexOf(step.at);
    g.querySelector('circle').setAttribute('fill', reached && step.at !== 'handwheel' ? '#ffb547' : '#0d2238');
  });
  const active = $('#th-active', el);
  const hand = $('#th-hand', el);
  if (step.at === 'handwheel') {
    active.setAttribute('opacity', '0');
    hand.setAttribute('opacity', '1');
  } else {
    hand.setAttribute('opacity', '0');
    const p = d.points[step.at][d.points[step.at].length - 1];
    active.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    active.setAttribute('opacity', '1');
  }
}

function bobbinSvg() {
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Bobbin case seen from the open side; bobbin turns clockwise as the thread is pulled">
    <defs><marker id="bb-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff5d52"/></marker></defs>
    <circle cx="100" cy="100" r="74" fill="#23425f" stroke="#9fb3c8" stroke-width="3"/>
    <circle cx="100" cy="100" r="52" fill="#f2c14e" opacity=".85"/>
    <circle cx="100" cy="100" r="14" fill="#23425f" stroke="#9fb3c8" stroke-width="2"/>
    <path d="M150 46l26 -6" stroke="#9fb3c8" stroke-width="6" stroke-linecap="round"/>
    <path d="M100 48 C130 48 150 44 172 40 L196 38" fill="none" stroke="#ffb547" stroke-width="3"/>
    <path d="M60 64 A56 56 0 0 1 140 64" fill="none" stroke="#ff5d52" stroke-width="3" marker-end="url(#bb-arr)"/>
    <text x="100" y="186" text-anchor="middle" style="font:12px 'IBM Plex Sans',sans-serif;fill:#93abc3">pull → bobbin turns clockwise</text>
  </svg>`;
}

function programsFor(plan, id) {
  const out = [];
  for (const s of plan.steps) {
    if (s.setup?.machine !== id || !s.setup.program) continue;
    const key = JSON.stringify(s.setup.program);
    let g = out.find((q) => q.key === key);
    if (!g) {
      g = { key, program: s.setup.program, steps: [] };
      out.push(g);
    }
    g.steps.push(s.index + 1);
  }
  return out;
}

function panelCard(m, groups) {
  return `<div class="card">
    <h3>Pedal &amp; automatic panel</h3>
    <div class="grid-2">
      <div>
        <h4>Pedal</h4>
        <table class="spec small"><tbody>
          <tr><td class="k">Toe down</td><td>Sew — speed follows pedal travel up to the panel's max</td></tr>
          <tr><td class="k">Neutral</td><td>Stop; needle parks at the programmed position</td></tr>
          <tr><td class="k">Heel back halfway</td><td>Presser and walking feet lift (hold to keep them up)</td></tr>
          <tr><td class="k">Heel back fully</td><td>End backtack (if on) → thread trim → foot lift</td></tr>
          <tr><td class="k">Knuckle switch</td><td>Reverse while held — manual tacks mid-seam</td></tr>
        </tbody></table>
      </div>
      <div>
        <h4>Panel functions to find</h4>
        <table class="spec small"><tbody>${m.panel.map((p) => `<tr><td class="k">${p.icon} ${esc(p.label)}</td><td>${esc(p.help)}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    ${groups.length ? `<h4>Programs for your current project</h4>
      <div class="table-scroll"><table class="spec small">
        <thead><tr><th>Steps</th><th>Backtack (start / end)</th><th>Soft start</th><th>Needle stop</th><th>Trimmer</th><th>Speed</th></tr></thead>
        <tbody>${groups.map((g) => `<tr><td class="mono">${g.steps.join(', ')}</td><td>${esc(g.program.startBT)}</td><td>${esc(g.program.soft)}</td><td>${esc(g.program.needle)}</td><td>${esc(g.program.trim)}</td><td>${esc(g.program.speed)}</td></tr>`).join('')}</tbody>
      </table></div>` : `<p class="small muted">Your current project does not use this machine. ${mbadge(m.id)}</p>`}
  </div>`;
}
