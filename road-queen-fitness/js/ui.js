// Shared DOM helpers: selectors, escaping, icons, toasts, dialogs and forms.
import { CONFIG } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: CONFIG.currency });
export const formatMoney = (n) => money.format(n);

export function toast(message, tone = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'error' ? 'close' : 'check')}<span>${esc(message)}</span>`;
  const host = $('#toasts');
  host.append(el);
  // Re-show the popover so it stacks above any dialog opened since.
  if (host.showPopover) {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  }
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

// <dialog> gives focus trapping and Escape for free; add backdrop-click to
// close, [data-close] buttons, and an onClose hook for cleanup.
export function setupDialog(dialog, { onClose } = {}) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
    const closer = e.target.closest('[data-close]');
    if (closer) {
      dialog.close();
      const target = closer.dataset.goto && $(closer.dataset.goto);
      if (target) target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  });
  if (onClose) dialog.addEventListener('close', onClose);
  return {
    open() {
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('has-dialog');
    },
    close: () => dialog.close(),
  };
}
document.addEventListener('close', () => {
  if (!$('dialog[open]')) document.documentElement.classList.remove('has-dialog');
}, true);

// Accessible tab group: arrow keys move between tabs, selection calls onSelect.
export function setupTabs(list, onSelect) {
  const tabs = $$('[role="tab"]', list);
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tab.focus();
    onSelect(tab);
  };
  tabs.forEach((t, i) => {
    t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step) {
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        select(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true);
      }
    });
  });
}

// Form validation with inline messages. rules: { inputId: (value, input) => error | '' }
export function validate(form, rules) {
  let firstBad = null;
  for (const [id, rule] of Object.entries(rules)) {
    const input = $(`#${id}`, form);
    const message = rule(input.type === 'checkbox' ? input.checked : input.value.trim(), input);
    const slot = $(`[data-error-for="${id}"]`, form);
    if (slot) slot.textContent = message || '';
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && slot) {
      slot.id = slot.id || `${id}-error`;
      input.setAttribute('aria-describedby', slot.id);
    }
    if (message && !firstBad) firstBad = input;
  }
  if (firstBad) firstBad.focus();
  return !firstBad;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function mailto(subject, body) {
  return `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function showResult(el, html, tone = 'success') {
  el.className = `form-result is-${tone}`;
  el.innerHTML = html;
  el.hidden = false;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
