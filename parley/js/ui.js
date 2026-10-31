// Small DOM helpers shared by every screen.
import { icon } from './icons.js';

/** h('div', {class: 'x', onclick: fn}, child, 'text', [more]) → HTMLElement */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** HTML string → element (first child). */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function iconBtn(name, label, onclick, cls = '') {
  return h('button', { type: 'button', class: `icon-btn ${cls}`, 'aria-label': label, title: label, onclick, html: icon(name) });
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
export function fmtShort(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
}

/** Turn "text with [[term]]" into HTML with tappable glossary terms. */
export function richText(text, glossary = null) {
  return esc(text).replace(/\[\[([^\]]+)\]\]/g, (_, term) =>
    glossary ? `<button type="button" class="term" data-term="${esc(term)}">${esc(term)}</button>` : `<strong>${esc(term)}</strong>`);
}
export const plainText = (text) => String(text).replace(/\[\[|\]\]/g, '');

// ------------------------------------------------------------------ overlays
const root = () => document.getElementById('overlay-root');

let toastTimer;
export function toast(msg, kind = '') {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  root().append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

/** Bottom sheet. Returns { el, close }. content: Node or array. */
export function sheet(content, { onClose, cls = '', dismissible = true } = {}) {
  const scrim = h('div', { class: 'scrim' });
  const panel = h('div', { class: `sheet ${cls}`, role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet-grip' }), content);
  const wrap = h('div', { class: 'sheet-wrap' }, scrim, panel);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 260);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  if (dismissible) scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  root().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  setTimeout(() => panel.querySelector('button, [tabindex]')?.focus({ preventScroll: true }), 50);
  return { el: panel, close };
}

export function confirmSheet({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { if (answered) return; answered = true; s.close(); resolve(v); };
    const s = sheet([
      h('h3', { class: 'sheet-title' }, title),
      body ? h('p', { class: 'muted' }, body) : null,
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn ghost grow', onclick: () => done(false) }, cancel),
        h('button', { type: 'button', class: `btn grow ${danger ? 'danger' : 'primary'}`, onclick: () => done(true) }, ok)),
    ], { onClose: () => { if (!answered) { answered = true; resolve(false); } } });
  });
}

// ------------------------------------------------------------------ confetti
export function confetti(count = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = h('canvas', { class: 'confetti' });
  root().append(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#5ef0ff', '#7ed957', '#ffd23f', '#ff6b8b', '#8b7bff', '#ffffff'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4,
    r: Math.random() * 6 + 4, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (++t < 140) requestAnimationFrame(frame); else c.remove();
  })();
}

// ------------------------------------------------------------------ medals and gauges
const MEDAL_TONES = {
  blue: ['#9fe6ff', '#2d7fe0', '#123b8c'],
  purple: ['#e1c8ff', '#8a4ff0', '#3b1a8c'],
  teal: ['#a6fff0', '#16b5a6', '#0b5a5c'],
  gold: ['#fff1a8', '#f0a62d', '#8c4a10'],
  rose: ['#ffd0dc', '#f0507a', '#8c1a3b'],
  gray: ['#e5e7ef', '#9aa1b8', '#5b6178'],
};

/** Gear-edged medal badge with an icon in the middle. */
export function medal(iconName, tone = 'blue', size = 64) {
  const [hi, mid, lo] = MEDAL_TONES[tone] || MEDAL_TONES.blue;
  const id = 'm' + Math.random().toString(36).slice(2, 8);
  const teeth = 14;
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 ? 40 : 46;
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
  }
  return `<svg class="medal" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <radialGradient id="${id}b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
    </defs>
    <path d="${d}Z" fill="url(#${id}a)" stroke="${hi}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="31" fill="url(#${id}b)" stroke="${hi}" stroke-width="3"/>
    <g transform="translate(34 34) scale(1.333)" color="#fff">${icon(iconName).replace('<svg', '<svg width="24" height="24"')}</g>
  </svg>`;
}

/** Semi-circular score gauge (0–100). */
export function gauge(score, { size = 220, label = '/100' } = {}) {
  const r = 80, cx = 100, cy = 100;
  const start = Math.PI * 0.85, end = Math.PI * 2.15;
  const arc = (a0, a1) => {
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
  };
  const val = start + (end - start) * clamp(score, 0, 100) / 100;
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return `<svg class="gauge" width="${size}" height="${size * 0.78}" viewBox="0 0 200 156" role="img" aria-label="Score ${score} out of 100">
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#3aa0ff"/><stop offset="1" stop-color="#5ef0ff"/></linearGradient></defs>
    <path d="${arc(start, end)}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="14" stroke-linecap="round"/>
    <path class="gauge-val" d="${arc(start, Math.max(start + 0.001, val))}" fill="none" stroke="url(#${id})" stroke-width="14" stroke-linecap="round"/>
    <text x="100" y="104" text-anchor="middle" class="gauge-num">${Math.round(score)}</text>
    <text x="100" y="132" text-anchor="middle" class="gauge-lbl">${label}</text>
  </svg>`;
}

/** Circular progress ring. */
export function ring(pct, { size = 56, stroke = 6, color = '#5ef0ff', track = 'rgba(255,255,255,.2)', inner = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(pct, 0, 1))}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${inner}
  </svg>`;
}

export function scoreTone(score) {
  if (score >= 75) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

/** Header bar used by most sub-screens. */
export function topBar(title, { back = '#/home', right = null, onBack = null } = {}) {
  return h('header', { class: 'topbar' },
    h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': 'Back', html: icon('back'),
      onclick: () => { if (onBack) onBack(); else if (history.length > 1 && sessionStorage.getItem('parley.nav')) history.back(); else location.hash = back; },
    }),
    h('h1', { class: 'topbar-title' }, title),
    right || h('span', { class: 'icon-btn-spacer' }));
}

export function pill(text, cls = '') {
  return h('span', { class: `pill ${cls}` }, text);
}
