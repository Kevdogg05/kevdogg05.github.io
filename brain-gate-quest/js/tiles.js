/**
 * Brain Gate Quest — themed tiles and scenery.
 *
 * Each world (meadow, desert, snow, cave, volcano) repaints the same tile
 * shapes with its own palette, plus its own background strips and
 * decorations. Results are cached per theme so switching levels is instant.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const cache = {};

  const DIRT_SPECKS = [[2, 7], [9, 5], [13, 9], [5, 11], [11, 13], [1, 14], [7, 9], [14, 3], [4, 2], [10, 1]];

  function canvas(w, h) {
    const c = BGQ.Art.makeCanvas(w, h);
    return { c: c, g: c.getContext('2d') };
  }

  function rect(g, color, x, y, w, h) {
    BGQ.Art.rect(g, color, x, y, w, h);
  }

  /* ------------------------------------------------------------------ *
   * Tiles (16x16)
   * ------------------------------------------------------------------ */

  function dirt(g, p) {
    rect(g, p.dirt, 0, 0, 16, 16);
    DIRT_SPECKS.forEach(function (s, i) {
      rect(g, i % 2 ? p.dirtDark : p.dirtLight, s[0], s[1], 2, 1);
    });
  }

  function groundTop(p) {
    const t = canvas(16, 16);
    dirt(t.g, p);
    rect(t.g, p.top, 0, 0, 16, 4);
    rect(t.g, p.topLight, 0, 0, 16, 1);
    rect(t.g, p.topDark, 0, 4, 16, 1);
    [1, 5, 8, 12, 14].forEach(function (x) { rect(t.g, p.topDark, x, 5, 2, 1); });
    [3, 10].forEach(function (x) { rect(t.g, p.tuft, x, 1, 2, 1); });
    return t.c;
  }

  function groundFill(p) {
    const t = canvas(16, 16);
    dirt(t.g, p);
    return t.c;
  }

  function brick(p) {
    const t = canvas(16, 16);
    const g = t.g;
    rect(g, p.base, 0, 0, 16, 16);
    rect(g, p.light, 0, 0, 16, 1);
    rect(g, p.light, 0, 8, 16, 1);
    rect(g, p.mortar, 0, 7, 16, 1);
    rect(g, p.mortar, 0, 15, 16, 1);
    rect(g, p.mortar, 15, 0, 1, 7);
    rect(g, p.mortar, 7, 8, 1, 7);
    rect(g, p.light, 0, 1, 1, 6);
    rect(g, p.light, 8, 9, 1, 6);
    return t.c;
  }

  function hard(p) {
    const t = canvas(16, 16);
    const g = t.g;
    rect(g, p.base, 0, 0, 16, 16);
    rect(g, p.light, 0, 0, 16, 2);
    rect(g, p.light, 0, 0, 2, 16);
    rect(g, p.dark, 0, 14, 16, 2);
    rect(g, p.dark, 14, 0, 2, 16);
    rect(g, p.inner, 4, 4, 8, 8);
    rect(g, p.innerLight, 4, 4, 8, 1);
    rect(g, p.innerDark, 4, 11, 8, 1);
    return t.c;
  }

  /* ------------------------------------------------------------------ *
   * Background strips (tile horizontally for parallax scrolling)
   * ------------------------------------------------------------------ */

  /** Draws each feature at -w, 0 and +w so the strip repeats seamlessly. */
  function wrapped(list, w) {
    const out = [];
    list.forEach(function (f) { [-w, 0, w].forEach(function (dx) { out.push([f[0] + dx, f[1], f[2]]); }); });
    return out;
  }

  function mountains(p) {
    const w = 480;
    const t = canvas(w, BGQ.VIEW_H);
    wrapped([[60, 110, 70], [170, 130, 55], [270, 95, 80], [390, 125, 60]], w).forEach(function (m) {
      const px = m[0], top = m[1], half = m[2];
      for (let y = top; y < BGQ.VIEW_H; y++) {
        const spread = Math.min(Math.round((y - top) / 1.1), half * 3);
        rect(t.g, p.light, px - spread, y, spread, 1);
        rect(t.g, p.dark, px, y, spread, 1);
        if (y - top < 14) rect(t.g, p.cap, px - spread, y, spread * 2, 1);
      }
    });
    return t.c;
  }

  function hills(p) {
    const w = 384;
    const t = canvas(w, BGQ.VIEW_H);
    const E = BGQ.Art.pixelEllipse;
    wrapped([[40, 180, 56], [190, 165, 72], [320, 185, 48]], w).forEach(function (h) {
      E(t.g, p.outline, h[0], h[1] + 36, h[2] + 1, 37);
      E(t.g, p.fill, h[0], h[1] + 36, h[2], 36);
      E(t.g, p.light, h[0] - Math.round(h[2] * 0.25), h[1] + 18, Math.round(h[2] * 0.35), 10);
      rect(t.g, p.outline, h[0] - 6, h[1] + 14, 2, 4);
      rect(t.g, p.outline, h[0] + 6, h[1] + 14, 2, 4);
    });
    return t.c;
  }

  function cloud(w, p) {
    const h = Math.round(w * 0.5);
    const t = canvas(w, h);
    const E = BGQ.Art.pixelEllipse;
    const r = Math.round(h * 0.42);
    const parts = [[w * 0.28, h * 0.62, r * 0.9], [w * 0.5, h * 0.45, r * 1.15], [w * 0.72, h * 0.62, r * 0.9]];
    parts.forEach(function (q) { E(t.g, p.shade, q[0], q[1] + 1, Math.round(q[2] * 1.15) + 1, Math.round(q[2]) + 1); });
    parts.forEach(function (q) { E(t.g, p.light, q[0], q[1], Math.round(q[2] * 1.15), Math.round(q[2])); });
    rect(t.g, p.light, Math.round(w * 0.2), Math.round(h * 0.62), Math.round(w * 0.6), Math.round(r * 0.8));
    return t.c;
  }

  function cloudStrip(p) {
    const t = canvas(512, 120);
    t.g.drawImage(cloud(64, p), 30, 22);
    t.g.drawImage(cloud(40, p), 170, 54);
    t.g.drawImage(cloud(52, p), 300, 14);
    t.g.drawImage(cloud(36, p), 430, 66);
    return t.c;
  }

  /* ------------------------------------------------------------------ *
   * Decorations (non-solid scenery standing on the ground)
   * ------------------------------------------------------------------ */

  function bush(w, p) {
    const t = canvas(w, 16);
    const E = BGQ.Art.pixelEllipse;
    const bumps = Math.max(2, Math.round(w / 14));
    const cx = function (i) { return 7 + (i * (w - 14)) / (bumps - 1); };
    for (let i = 0; i < bumps; i++) E(t.g, p.dark, cx(i), 10, 8, 8);
    for (let i = 0; i < bumps; i++) {
      E(t.g, p.mid, cx(i), 10, 7, 7);
      rect(t.g, p.light, Math.round(cx(i)) - 3, 5, 3, 2);
    }
    rect(t.g, p.mid, 1, 12, w - 2, 4);
    return t.c;
  }

  function cactus(h) {
    const t = canvas(16, h);
    const g = t.g;
    const O = '#1e6b32', M = '#3fa34d', L = '#7fd36b';
    const limb = function (x, y, w, hh) { rect(g, O, x, y, w, hh); rect(g, M, x + 1, y + 1, w - 2, hh - 2); };
    const ly = Math.round(h * 0.5);
    const ry = Math.round(h * 0.38);
    // Arms first, so the trunk covers where they join.
    limb(1, ly - 7, 4, 9);
    limb(1, ly - 1, 6, 4);
    rect(g, M, 2, ly - 6, 2, 8);
    limb(11, ry - 6, 4, 8);
    limb(9, ry - 1, 6, 4);
    rect(g, M, 12, ry - 5, 2, 7);
    limb(5, 1, 6, h - 1);
    rect(g, O, 6, 0, 4, 1);
    rect(g, L, 7, 2, 1, h - 4);
    for (let y = 4; y < h - 2; y += 5) rect(g, '#d8f5c8', 9, y, 1, 1);
    return t.c;
  }

  function pine(h) {
    const w = 24;
    const t = canvas(w, h);
    const g = t.g;
    rect(g, '#5a3418', 10, h - 5, 4, 5);
    const tiers = [[h * 0.42, h - 5, 11], [h * 0.2, h * 0.68, 8], [0, h * 0.42, 5]];
    tiers.forEach(function (tier) {
      const top = Math.round(tier[0]), bottom = Math.round(tier[1]), hw = tier[2];
      for (let y = top; y < bottom; y++) {
        const half = Math.max(1, Math.round(((y - top + 1) / (bottom - top)) * hw));
        rect(g, '#1f5a3a', 12 - half - 1, y, half * 2 + 2, 1);
        rect(g, '#2f8a50', 12 - half, y, half * 2, 1);
        rect(g, '#4fb070', 12 - half, y, Math.max(1, Math.round(half * 0.6)), 1);
        if (y - top < 2) rect(g, '#ffffff', 12 - half - 1, y, half * 2 + 2, 1);
      }
      // Snow resting on the edge of each tier
      rect(g, '#ffffff', 12 - hw - 1, bottom - 1, Math.round(hw * 0.8), 1);
      rect(g, '#ffffff', 12 + Math.round(hw * 0.3), bottom - 1, Math.round(hw * 0.7), 1);
    });
    return t.c;
  }

  function crystal(h) {
    const t = canvas(16, h);
    const g = t.g;
    const shards = [
      [1, 4, Math.round(h * 0.4), ['#1a3a6a', '#2a8ab8', '#5ee0ff', '#c8f6ff']],
      [5, 6, 0, ['#3a1a6a', '#8a3ad6', '#c47bff', '#ecd2ff']],
      [11, 4, Math.round(h * 0.28), ['#1a3a6a', '#2a8ab8', '#5ee0ff', '#c8f6ff']]
    ];
    shards.forEach(function (s) {
      const x = s[0], w = s[1], top = s[2], col = s[3];
      const tip = Math.ceil(w / 2);
      for (let y = top; y < h; y++) {
        const k = Math.min(y - top + 1, tip);
        const x0 = x + tip - k, ww = k * 2 - (w % 2 && k === tip ? 1 : 0);
        rect(g, col[0], x0, y, Math.min(ww, w), 1);
        if (ww > 2) {
          rect(g, col[2], x0 + 1, y, Math.min(ww, w) - 2, 1);
          rect(g, col[1], x0 + Math.floor(Math.min(ww, w) / 2), y, Math.ceil(Math.min(ww, w) / 2) - 1, 1);
          rect(g, col[3], x0 + 1, y, 1, 1);
        }
      }
    });
    return t.c;
  }

  function rock(w, h) {
    const t = canvas(w, h);
    const E = BGQ.Art.pixelEllipse;
    const cx = w / 2, cy = h - Math.ceil(h / 2);
    E(t.g, '#2a1e1e', cx, cy, Math.floor(w / 2), Math.ceil(h / 2));
    E(t.g, '#5a4848', cx, cy, Math.floor(w / 2) - 1, Math.ceil(h / 2) - 1);
    E(t.g, '#7a6464', cx - Math.round(w * 0.15), cy - Math.round(h * 0.2), Math.round(w * 0.18), Math.round(h * 0.18));
    rect(t.g, '#2a1e1e', 0, h - 1, w, 1);
    // Glowing cracks
    rect(t.g, '#ff7a3a', Math.round(w * 0.55), Math.round(h * 0.35), 1, 3);
    rect(t.g, '#ffb03a', Math.round(w * 0.55) + 1, Math.round(h * 0.35) + 2, 2, 1);
    rect(t.g, '#ff7a3a', Math.round(w * 0.3), Math.round(h * 0.6), 2, 1);
    return t.c;
  }

  function decorSet(theme) {
    switch (theme.decor) {
      case 'cactus': return { small: cactus(16), medium: cactus(24), large: cactus(32) };
      case 'pine': return { small: pine(24), medium: pine(32), large: pine(40) };
      case 'crystal': return { small: crystal(12), medium: crystal(18), large: crystal(24) };
      case 'rock': return { small: rock(16, 10), medium: rock(24, 14), large: rock(32, 18) };
      default: return { small: bush(32, theme.decorColors), medium: bush(48, theme.decorColors), large: bush(64, theme.decorColors) };
    }
  }

  BGQ.Tiles = {
    /** Returns (and caches) all themed art for a theme from BGQ.getTheme(). */
    build: function (theme) {
      if (cache[theme.key]) return cache[theme.key];
      const art = {
        tiles: {
          groundTop: groundTop(theme.ground),
          ground: groundFill(theme.ground),
          brick: brick(theme.brick),
          hard: hard(theme.hard)
        },
        mountains: mountains(theme.mountains),
        hills: hills(theme.hills),
        clouds: theme.clouds ? cloudStrip(theme.clouds) : null,
        decor: decorSet(theme)
      };
      cache[theme.key] = art;
      return art;
    }
  };
})();
