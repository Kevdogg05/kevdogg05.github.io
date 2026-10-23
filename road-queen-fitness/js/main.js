// Road Queen Fitness — boots each section. Content renders first so the
// reveal and parallax effects can find everything on the page.
import { initNav, initEffects } from './nav.js';
import { initGallery } from './gallery.js';
import { initLive } from './live.js';
import { initVideos } from './videos.js';
import { initUploads } from './uploads.js';
import { initShop } from './shop.js';
import { initJoin } from './join.js';

document.documentElement.classList.add('js');
document.getElementById('year').textContent = new Date().getFullYear();

for (const init of [initJoin, initGallery, initLive, initVideos, initUploads, initShop, initNav, initEffects]) {
  try {
    init();
  } catch (err) {
    // One broken section shouldn't take the rest of the page down.
    console.error(`${init.name} failed`, err);
  }
}
