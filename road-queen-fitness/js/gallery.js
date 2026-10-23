// Home media grid, the About "In Motion" strip, and a shared lightbox.
import { GALLERY } from './data.js';
import { $, $$, esc, icon, setupDialog, reducedMotion } from './ui.js';

export function initGallery() {
  const grid = $('#media-grid');
  grid.innerHTML = GALLERY.map((g, i) => `
    <button type="button" class="media-tile ${g.size ? `is-${g.size}` : ''}" data-index="${i}" data-reveal
      aria-label="View photo: ${esc(g.title)}">
      <img src="${g.src}" alt="${esc(g.alt)}" loading="lazy" width="${g.w}" height="${g.h}">
      <span class="media-cap"><strong>${esc(g.title)}</strong><small>${esc(g.caption)}</small></span>
      <span class="media-zoom">${icon('plus')}</span>
    </button>`).join('') + `
    <a class="media-tile media-cta" href="#join" data-reveal>
      ${icon('crown')}
      <strong>Your moment<br>starts here</strong>
      <span>Join the movement ${icon('arrow')}</span>
    </a>`;

  const strip = $('#gallery-strip');
  const order = [4, 0, 6, 1, 3, 2, 5];
  strip.innerHTML = order.map((i) => {
    const g = GALLERY[i];
    return `<figure class="strip-item">
      <button type="button" data-index="${i}" aria-label="View photo: ${esc(g.title)}">
        <img src="${g.src}" alt="${esc(g.alt)}" loading="lazy" width="${g.w}" height="${g.h}">
      </button>
      <figcaption>${esc(g.title)}</figcaption>
    </figure>`;
  }).join('');
  $$('[data-strip]').forEach((btn) => btn.addEventListener('click', () => {
    strip.scrollBy({ left: Number(btn.dataset.strip) * strip.clientWidth * 0.8, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }));

  // Lightbox
  const box = $('#lightbox');
  const img = $('#lightbox-img');
  const cap = $('#lightbox-cap');
  const dialog = setupDialog(box);
  let index = 0;
  const show = (i) => {
    index = (i + GALLERY.length) % GALLERY.length;
    const g = GALLERY[index];
    img.src = g.src;
    img.alt = g.alt;
    cap.innerHTML = `<strong>${esc(g.title)}</strong> ${esc(g.caption)} <span class="muted">${index + 1} / ${GALLERY.length}</span>`;
  };
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#media-grid [data-index], #gallery-strip [data-index]');
    if (!trigger) return;
    show(Number(trigger.dataset.index));
    dialog.open();
  });
  $('#lb-prev').addEventListener('click', () => show(index - 1));
  $('#lb-next').addEventListener('click', () => show(index + 1));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
}
