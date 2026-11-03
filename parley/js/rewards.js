// Shows newly earned badges after an activity.
import * as store from './store.js';
import { h, sheet, medal, confetti } from './ui.js';
import * as sfx from './sfx.js';

export function celebrateBadges() {
  const fresh = store.takeNewBadges();
  if (!fresh.length) return Promise.resolve();
  sfx.win();
  confetti();
  return new Promise((resolve) => {
    const s = sheet([
      h('div', { class: 'badge-award' },
        h('p', { class: 'eyebrow' }, fresh.length > 1 ? 'New badges' : 'New badge'),
        ...fresh.map((b) => h('div', { class: 'badge-award-item' },
          h('div', { html: medal(b.icon, b.tone, 96) }),
          h('h3', {}, b.name),
          h('p', { class: 'muted' }, b.desc))),
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => s.close() }, 'Awesome')),
    ], { onClose: resolve, cls: 'center' });
  });
}
