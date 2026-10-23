// ACTIVE: on-demand video library with category tabs, search, a saved list
// and a player dialog.
import { CONFIG } from './config.js';
import { VIDEOS, CATEGORY_LABELS } from './data.js';
import { createStore } from './store.js';
import { $, esc, icon, setupTabs, setupDialog, toast } from './ui.js';

export function initVideos() {
  const saved = createStore([], 'saved-videos');
  const view = createStore({ cat: 'all', q: '' });
  const grid = $('#vod-grid');

  function card(v) {
    const isSaved = saved.get().includes(v.id);
    return `<article class="vod-card cat-${v.cat}">
      <button type="button" class="vod-thumb" data-play="${v.id}" aria-label="Play ${esc(v.title)}">
        <img src="${v.thumb}" alt="" loading="lazy" style="object-position:${v.pos}">
        <span class="vod-play">${icon('play')}</span>
        <span class="vod-duration">${v.minutes} min</span>
        <span class="vod-cat">${CATEGORY_LABELS[v.cat]}</span>
      </button>
      <div class="vod-body">
        <h3>${esc(v.title)}</h3>
        <p class="muted small">${esc(v.level)}${v.youtubeId ? '' : ' · <span class="soon">Premieres soon</span>'}</p>
      </div>
      <button type="button" class="icon-btn vod-save ${isSaved ? 'is-saved' : ''}" data-save="${v.id}"
        aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remove from' : 'Save to'} my list: ${esc(v.title)}">${icon('heart')}</button>
    </article>`;
  }

  function render() {
    const { cat, q } = view.get();
    const list = saved.get();
    const query = q.toLowerCase();
    const items = VIDEOS.filter((v) => (cat === 'all' || (cat === 'saved' ? list.includes(v.id) : v.cat === cat))
      && (!query || `${v.title} ${CATEGORY_LABELS[v.cat]} ${v.level}`.toLowerCase().includes(query)));
    grid.innerHTML = items.map(card).join('');
    const empty = $('#vod-empty');
    empty.hidden = items.length > 0;
    empty.textContent = cat === 'saved' && !list.length
      ? 'Nothing saved yet — tap the heart on any video to build your list.'
      : 'No videos match — try another category or search.';
    $('#saved-count').textContent = list.length;
  }

  setupTabs($('#vod-tabs'), (tab) => view.set((s) => ({ ...s, cat: tab.dataset.cat })));
  $('#vod-search').addEventListener('input', (e) => view.set((s) => ({ ...s, q: e.target.value.trim() })));
  view.subscribe(render);
  saved.subscribe(render);

  // Player
  const dialogEl = $('#video-dialog');
  const frame = $('#video-frame');
  const dialog = setupDialog(dialogEl, { onClose: () => { frame.innerHTML = ''; } });

  grid.addEventListener('click', (e) => {
    const save = e.target.closest('[data-save]');
    if (save) {
      const id = save.dataset.save;
      const was = saved.get().includes(id);
      saved.set((l) => (was ? l.filter((x) => x !== id) : [...l, id]));
      toast(was ? 'Removed from your list.' : 'Saved to your list.', was ? 'info' : 'success');
      $(`[data-save="${id}"]`)?.focus();
      return;
    }
    const play = e.target.closest('[data-play]');
    if (!play) return;
    const v = VIDEOS.find((x) => x.id === play.dataset.play);
    $('#video-dialog-title').textContent = v.title;
    $('#video-dialog-meta').textContent = `${CATEGORY_LABELS[v.cat]} · ${v.minutes} min · ${v.level}`;
    frame.innerHTML = v.youtubeId
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtubeId)}?autoplay=1&rel=0" title="${esc(v.title)}"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : `<div class="video-soon" style="--thumb:url('${new URL(v.thumb, document.baseURI).href}')">
          <span class="soon-badge">${icon('sparkle')} Premieres soon</span>
          <p>This one is in the edit suite. Subscribe and you'll be first to press play.</p>
          <a class="btn btn-gem" href="${esc(CONFIG.socials.youtube)}" target="_blank" rel="noopener">${icon('youtube')} Subscribe on YouTube</a>
        </div>`;
    dialog.open();
  });
}
