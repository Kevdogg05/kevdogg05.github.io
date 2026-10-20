/**
 * Brain Gate Quest — pixel art.
 *
 * All graphics are generated at start-up into small off-screen canvases:
 * characters come from text "pixel maps" (one character = one pixel) and
 * tiles/scenery are painted procedurally. Nothing is downloaded, so the
 * game works fully offline.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  /* ------------------------------------------------------------------ *
   * Canvas helpers
   * ------------------------------------------------------------------ */

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** Builds a sprite from rows of characters, looked up in a palette. */
  function fromPixels(rows, palette) {
    const w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    const c = makeCanvas(w, rows.length);
    const g = c.getContext('2d');
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (color) {
          g.fillStyle = color;
          g.fillRect(x, y, 1, 1);
        }
      }
    });
    return c;
  }

  /** Returns a horizontally mirrored copy of a sprite. */
  function mirror(src) {
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  function rect(g, color, x, y, w, h) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }

  /** Fills a hard-edged (non anti-aliased) ellipse, row by row. */
  function pixelEllipse(g, color, cx, cy, rx, ry) {
    g.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      const t = y / (ry + 0.5);
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      if (half > 0) g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
    }
  }

  /** Paints a running-bond brick pattern into a rectangle. */
  function brickWall(g, x, y, w, h, base, mortar, light) {
    rect(g, base, x, y, w, h);
    for (let row = 0; row * 8 < h; row++) {
      const yy = y + row * 8;
      rect(g, mortar, x, yy + 7, w, 1);
      rect(g, light, x, yy, w, 1);
      const offset = row % 2 === 0 ? 0 : 8;
      for (let xx = x + offset; xx + 15 < x + w; xx += 16) {
        rect(g, mortar, xx + 15, yy, 1, 7);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Player character "Pip" (16x16, drawn facing right)
   * ------------------------------------------------------------------ */

  const PIP_PALETTE = {
    C: '#19a68f', c: '#0d6b5c', W: '#ffffff',
    H: '#6b3a1e', S: '#ffcc99', s: '#e39a74',
    Y: '#ffd23f', y: '#d9a400',
    B: '#3a5cd8', R: '#e03c3c'
  };

  const PIP_HEAD = [
    '................',
    '.....CCCCC......',
    '....CCCCCCCC....',
    '...cCCCWCCCCCCC.',
    '...HHHSSSES.....',
    '..HHSHSSSESSS...',
    '..HHSSSSSSSSSS..',
    '...HSSSSSSsss...'
  ];

  const PIP_BODY = [
    '....SSSSSSSS....',
    '...yYYYYYYY.....',
    '..SyYYYYYYYYS...',
    '..SSyYYYYYYSS...'
  ];

  const PIP_BODY_JUMP = [
    '....SSSSSSSS.SS.',
    '...yYYYYYYYYSS..',
    '...yYYYYYYYYS...',
    '...SyYYYYYY.....'
  ];

  const PIP_LEGS = {
    idle: [
      '....BBBBBBB.....',
      '....BBB.BBB.....',
      '...RRRR.RRRR....',
      '...RRRR.RRRR....'
    ],
    run1: [
      '...BBBBBBBB.....',
      '..BBB....BBB....',
      '.RRR......RRR...',
      '.RRRR.....RRRR..'
    ],
    run2: [
      '....BBBBBB......',
      '.....BBBB.......',
      '.....RRRR.......',
      '.....RRRRRR.....'
    ],
    run3: [
      '....BBBBBBB.....',
      '...BBB...BBB....',
      '..RRR.....RRR...',
      '..RRRR....RRRR..'
    ],
    jump: [
      '...BBBBBBBB.....',
      '..BBB...BBBB....',
      '..RRR....RRR....',
      '.RRR.....RR.....'
    ]
  };

  /* ------------------------------------------------------------------ *
   * Enemy "Grumblob" (16x16)
   * ------------------------------------------------------------------ */

  const BLOB_PALETTE = {
    P: '#9b4fd0', p: '#5a2280', L: '#d7a6f5',
    W: '#ffffff', K: '#1a0c24', M: '#3a0f4f', F: '#3b1a4a'
  };

  const BLOB_TOP = [
    '................',
    '......pppp......',
    '....ppPPPPpp....',
    '...pPLLPPPPPp...',
    '..pPLLPPPPPPPp..',
    '..pPWWWPPWWWPp..',
    '.pPPWKWPPWKWPPp.',
    '.pPPWKWPPWKWPPp.',
    '.pPPPPPPPPPPPPp.',
    '.pPPPMMMMMMPPPp.',
    '.pPPPPMMMMPPPPp.',
    '.pPPPPPPPPPPPPp.',
    '..pppppppppppp..'
  ];

  const BLOB_FEET_A = [
    '...FFF....FFF...',
    '..FFFF....FFFF..',
    '..FFF......FFF..'
  ];

  const BLOB_FEET_B = [
    '....FFF..FFF....',
    '...FFFF..FFFF...',
    '...FFF....FFF...'
  ];

  const BLOB_SQUISHED = [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................', '................',
    '..pppppppppppp..',
    '.pPPWKPPPPKWPPp.',
    '.pPPPPPPPPPPPPp.',
    '.pPPPMMMMMMPPPp.',
    '..pppppppppppp..',
    '..FFFF....FFFF..'
  ];

  /* ------------------------------------------------------------------ *
   * Gatekeeper "Professor Hoot" the owl (16x20)
   * ------------------------------------------------------------------ */

  const OWL_PALETTE = {
    M: '#262650', T: '#ffd23f', D: '#5c3a1a', O: '#9a6532',
    o: '#ecd3a0', W: '#ffffff', E: '#1a1a1a', Y: '#ffa726'
  };

  const OWL = [
    '................',
    '...MMMMMMMMMM...',
    '.MMMMMMMMMMMMMMT',
    '...MMMMMMMMMM..T',
    '....MMMMMMMM...T',
    '...DOOOOOOOOD..T',
    '..DOOOOOOOOOODTT',
    '..OWWWWOOWWWWO..',
    '.DWWWEWOOWEWWWD.',
    '.DWWEEWYYWEEWWD.',
    '.DOWWWOYYOWWWOD.',
    '.DOOOOOOOOOOOOD.',
    '.DOooooooooooOD.',
    '.DOoDooDooDooOD.',
    '.DOooooooooooOD.',
    '..DOoDooDooDOD..',
    '..DOOooooooOOD..',
    '...DOOOOOOOOD...',
    '....YY....YY....',
    '...YYYY..YYYY...'
  ];

  /** Owl with eyes closed (used for blinking). */
  function owlBlinkRows() {
    return OWL.map(function (row, y) {
      if (y === 7 || y === 10) return row.replace(/[WE]/g, 'O');
      if (y === 8) return row.replace(/[WE]/g, 'O');
      if (y === 9) return row.replace(/[WE]/g, 'D');
      return row;
    });
  }

  /** Owl with wings raised, used when celebrating a correct answer. */
  function owlCheer(base) {
    const c = makeCanvas(20, 20);
    const g = c.getContext('2d');
    g.drawImage(base, 2, 0);
    // Left wing raised
    rect(g, '#5c3a1a', 0, 6, 3, 2);
    rect(g, '#9a6532', 1, 8, 2, 4);
    rect(g, '#5c3a1a', 0, 8, 1, 4);
    // Right wing raised
    rect(g, '#5c3a1a', 17, 6, 3, 2);
    rect(g, '#9a6532', 17, 8, 2, 4);
    rect(g, '#5c3a1a', 19, 8, 1, 4);
    return c;
  }

  /* ------------------------------------------------------------------ *
   * Items
   * ------------------------------------------------------------------ */

  const HEART = [
    '................',
    '................',
    '...RRR...RRR....',
    '..RWWRR.RRRRR...',
    '.RWWRRRRRRRRRR..',
    '.RWRRRRRRRRRRR..',
    '.RRRRRRRRRRRRR..',
    '..RRRRRRRRRRR...',
    '...RRRRRRRRr....',
    '....RRRRRRr.....',
    '.....RRRRr......',
    '......RRr.......',
    '.......r........'
  ];

  /** Spinning coin: one frame per apparent width. */
  function makeCoinFrames() {
    const widths = [5, 4, 2, 1, 2, 4];
    return widths.map(function (rx) {
      const c = makeCanvas(16, 16);
      const g = c.getContext('2d');
      pixelEllipse(g, '#a86b00', 8, 8, rx + 1, 7);
      if (rx > 1) pixelEllipse(g, '#ffd23f', 8, 8, rx, 6);
      if (rx > 3) {
        rect(g, '#fff3b0', 6, 4, 1, 7);
        rect(g, '#d9a400', 9, 5, 1, 6);
      }
      return c;
    });
  }

  /* ------------------------------------------------------------------ *
   * Tiles (16x16)
   * ------------------------------------------------------------------ */

  const DIRT_SPECKS = [[2, 7], [9, 5], [13, 9], [5, 11], [11, 13], [1, 14], [7, 9], [14, 3], [4, 2], [10, 1]];

  function dirt(g) {
    rect(g, '#c87b3c', 0, 0, 16, 16);
    DIRT_SPECKS.forEach(function (p, i) {
      rect(g, i % 2 ? '#a35d26' : '#dc9456', p[0], p[1], 2, 1);
    });
  }

  function makeGroundTop() {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    dirt(g);
    rect(g, '#43c443', 0, 0, 16, 4);
    rect(g, '#8ef06a', 0, 0, 16, 1);
    rect(g, '#2f9a3a', 0, 4, 16, 1);
    [1, 5, 8, 12, 14].forEach(function (x) { rect(g, '#2f9a3a', x, 5, 2, 1); });
    [3, 10].forEach(function (x) { rect(g, '#6edc58', x, 1, 2, 1); });
    return c;
  }

  function makeGround() {
    const c = makeCanvas(16, 16);
    dirt(c.getContext('2d'));
    return c;
  }

  function makeBrick() {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    rect(g, '#d2642c', 0, 0, 16, 16);
    rect(g, '#f29a62', 0, 0, 16, 1);
    rect(g, '#f29a62', 0, 8, 16, 1);
    rect(g, '#6b2a12', 0, 7, 16, 1);
    rect(g, '#6b2a12', 0, 15, 16, 1);
    rect(g, '#6b2a12', 15, 0, 1, 7);
    rect(g, '#6b2a12', 7, 8, 1, 7);
    rect(g, '#f29a62', 0, 1, 1, 6);
    rect(g, '#f29a62', 8, 9, 1, 6);
    return c;
  }

  const QUESTION_GLYPH = [
    '.XXXX.',
    'XX..XX',
    '....XX',
    '...XX.',
    '..XX..',
    '..XX..',
    '......',
    '..XX..'
  ];

  function makeQuestion(base) {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    rect(g, base, 0, 0, 16, 16);
    rect(g, '#ffe9a8', 0, 0, 16, 1);
    rect(g, '#ffe9a8', 0, 0, 1, 16);
    rect(g, '#8a4508', 0, 15, 16, 1);
    rect(g, '#8a4508', 15, 0, 1, 16);
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(function (p) { rect(g, '#8a4508', p[0], p[1], 1, 1); });
    g.drawImage(fromPixels(QUESTION_GLYPH, { X: '#8a4508' }), 6, 5);
    g.drawImage(fromPixels(QUESTION_GLYPH, { X: '#ffffff' }), 5, 4);
    return c;
  }

  function makeUsed() {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    rect(g, '#a86a34', 0, 0, 16, 16);
    rect(g, '#c98a50', 0, 0, 16, 1);
    rect(g, '#c98a50', 0, 0, 1, 16);
    rect(g, '#5e3010', 0, 15, 16, 1);
    rect(g, '#5e3010', 15, 0, 1, 16);
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(function (p) { rect(g, '#5e3010', p[0], p[1], 1, 1); });
    return c;
  }

  function makeHard() {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    rect(g, '#8f9aa6', 0, 0, 16, 16);
    rect(g, '#d5dde5', 0, 0, 16, 2);
    rect(g, '#d5dde5', 0, 0, 2, 16);
    rect(g, '#56606b', 0, 14, 16, 2);
    rect(g, '#56606b', 14, 0, 2, 16);
    rect(g, '#a6b0bb', 4, 4, 8, 8);
    rect(g, '#c3cbd3', 4, 4, 8, 1);
    rect(g, '#76808b', 4, 11, 8, 1);
    return c;
  }

  /** Pipes are 32 game pixels wide, so each piece covers two tiles. */
  function makePipeTop() {
    const c = makeCanvas(32, 16);
    const g = c.getContext('2d');
    rect(g, '#0b4d1a', 0, 0, 32, 16);
    rect(g, '#3fbf4a', 1, 1, 30, 14);
    rect(g, '#9cf27a', 3, 1, 3, 14);
    rect(g, '#9cf27a', 8, 1, 1, 14);
    rect(g, '#1f8a32', 23, 1, 6, 14);
    rect(g, '#0b4d1a', 26, 1, 1, 14);
    return c;
  }

  function makePipeBody() {
    const c = makeCanvas(32, 16);
    const g = c.getContext('2d');
    rect(g, '#0b4d1a', 2, 0, 28, 16);
    rect(g, '#3fbf4a', 3, 0, 26, 16);
    rect(g, '#9cf27a', 5, 0, 3, 16);
    rect(g, '#9cf27a', 10, 0, 1, 16);
    rect(g, '#1f8a32', 22, 0, 5, 16);
    rect(g, '#0b4d1a', 25, 0, 1, 16);
    return c;
  }

  function makeSpikes() {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    for (let i = 0; i < 2; i++) {
      const cx = 4 + i * 8;
      for (let y = 6; y < 14; y++) {
        const half = Math.floor((y - 5) / 2) + 1;
        rect(g, '#3e444c', cx - half, y, half * 2, 1);
        if (half > 1) {
          rect(g, '#e3e8ee', cx - half + 1, y, half - 1, 1);
          rect(g, '#8a949f', cx, y, half - 1, 1);
        }
      }
    }
    rect(g, '#5b636d', 0, 14, 16, 2);
    rect(g, '#8a949f', 0, 14, 16, 1);
    return c;
  }

  /* ------------------------------------------------------------------ *
   * Scenery
   * ------------------------------------------------------------------ */

  function makeCloud(w) {
    const h = Math.round(w * 0.5);
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const r = Math.round(h * 0.42);
    const parts = [
      [w * 0.28, h * 0.62, r * 0.9],
      [w * 0.5, h * 0.45, r * 1.15],
      [w * 0.72, h * 0.62, r * 0.9]
    ];
    parts.forEach(function (p) { pixelEllipse(g, '#c9e3ff', p[0], p[1] + 1, Math.round(p[2] * 1.15) + 1, Math.round(p[2]) + 1); });
    parts.forEach(function (p) { pixelEllipse(g, '#ffffff', p[0], p[1], Math.round(p[2] * 1.15), Math.round(p[2])); });
    rect(g, '#ffffff', Math.round(w * 0.2), Math.round(h * 0.62), Math.round(w * 0.6), Math.round(r * 0.8));
    return c;
  }

  function makeBush(w) {
    const h = 16;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const bumps = Math.max(2, Math.round(w / 14));
    for (let i = 0; i < bumps; i++) {
      const cx = 7 + (i * (w - 14)) / (bumps - 1);
      pixelEllipse(g, '#1d7a2c', cx, 10, 8, 8);
    }
    for (let i = 0; i < bumps; i++) {
      const cx = 7 + (i * (w - 14)) / (bumps - 1);
      pixelEllipse(g, '#3fbf4a', cx, 10, 7, 7);
      rect(g, '#8ef06a', Math.round(cx) - 3, 5, 3, 2);
    }
    rect(g, '#3fbf4a', 1, 12, w - 2, 4);
    return c;
  }

  /** A far-away mountain range strip that tiles horizontally. */
  function makeMountains() {
    const w = 480;
    const c = makeCanvas(w, BGQ.VIEW_H);
    const g = c.getContext('2d');
    const peaks = [[60, 110, 70], [170, 130, 55], [270, 95, 80], [390, 125, 60]];
    // Each peak is also drawn one strip-width to the left and right so the
    // strip repeats without a visible seam.
    const wrapped = [];
    peaks.forEach(function (p) { [-w, 0, w].forEach(function (dx) { wrapped.push([p[0] + dx, p[1], p[2]]); }); });
    wrapped.forEach(function (p) {
      const px = p[0], top = p[1], half = p[2];
      for (let y = top; y < BGQ.VIEW_H; y++) {
        const spread = Math.round(((y - top) / 1.1));
        const x0 = px - Math.min(spread, half * 3);
        const x1 = px + Math.min(spread, half * 3);
        rect(g, '#7a9fd6', x0, y, Math.round((x1 - x0) / 2), 1);
        rect(g, '#6488c2', px, y, x1 - px, 1);
        if (y - top < 14) {
          rect(g, '#eef6ff', x0, y, x1 - x0, 1);
        }
      }
    });
    return c;
  }

  /** Rolling green hills that tile horizontally. */
  function makeHills() {
    const w = 384;
    const c = makeCanvas(w, BGQ.VIEW_H);
    const g = c.getContext('2d');
    const hills = [[40, 180, 56], [190, 165, 72], [320, 185, 48]];
    const wrapped = [];
    hills.forEach(function (h) { [-w, 0, w].forEach(function (dx) { wrapped.push([h[0] + dx, h[1], h[2]]); }); });
    wrapped.forEach(function (h) {
      pixelEllipse(g, '#2f8f3a', h[0], h[1] + 36, h[2] + 1, 37);
      pixelEllipse(g, '#5ccf5c', h[0], h[1] + 36, h[2], 36);
      pixelEllipse(g, '#79dc6c', h[0] - Math.round(h[2] * 0.25), h[1] + 18, Math.round(h[2] * 0.35), 10);
      rect(g, '#2f8f3a', h[0] - 6, h[1] + 14, 2, 4);
      rect(g, '#2f8f3a', h[0] + 6, h[1] + 14, 2, 4);
    });
    return c;
  }

  function makeCloudStrip() {
    const w = 512;
    const c = makeCanvas(w, 120);
    const g = c.getContext('2d');
    g.drawImage(makeCloud(64), 30, 22);
    g.drawImage(makeCloud(40), 170, 54);
    g.drawImage(makeCloud(52), 300, 14);
    g.drawImage(makeCloud(36), 430, 66);
    return c;
  }

  function makeCastle() {
    const c = makeCanvas(80, 96);
    const g = c.getContext('2d');
    const base = '#b9a3d6', mortar = '#5b4a78', light = '#dccdf0';
    // Lower keep
    brickWall(g, 0, 40, 80, 56, base, mortar, light);
    // Battlements on the keep
    for (let x = 0; x < 80; x += 16) brickWall(g, x, 32, 8, 8, base, mortar, light);
    // Tower
    brickWall(g, 20, 8, 40, 32, base, mortar, light);
    for (let x = 20; x < 60; x += 10) brickWall(g, x, 0, 6, 8, base, mortar, light);
    // Tower windows
    rect(g, '#2a1a3a', 28, 18, 6, 12);
    rect(g, '#2a1a3a', 46, 18, 6, 12);
    rect(g, '#ffd23f', 29, 20, 4, 2);
    rect(g, '#ffd23f', 47, 20, 4, 2);
    // Arched door
    rect(g, '#2a1a3a', 30, 70, 20, 26);
    pixelEllipse(g, '#2a1a3a', 40, 70, 10, 8);
    rect(g, '#4a3460', 39, 64, 2, 32);
    return c;
  }

  function makeFlag() {
    return fromPixels([
      '..............FF',
      '...........FFFFF',
      '........FFFFFFFF',
      '.....FFFFFFYFFFF',
      '..FFFFFFFFYYYFFF',
      'FFFFFFFFYYYYYYYF',
      '..FFFFFFFFYYYFFF',
      '.....FFFFFYFYFFF',
      '........FFFFFFFF',
      '...........FFFFF',
      '..............FF'
    ], { F: '#19a68f', Y: '#ffd23f' });
  }

  function makeCastleFlag() {
    return fromPixels([
      'PPPPPPPPP',
      'PPPYPPPPP.',
      'PPYYYPPP..',
      'PPPYPPP...',
      'PPPPPP....',
      'PPPPP.....'
    ], { P: '#ff5d8f', Y: '#ffd23f' });
  }

  function makeSign() {
    const c = makeCanvas(24, 24);
    const g = c.getContext('2d');
    rect(g, '#6b3f1a', 11, 10, 3, 14);
    rect(g, '#5a3010', 0, 0, 24, 13);
    rect(g, '#c98a50', 1, 1, 22, 11);
    rect(g, '#e2a868', 1, 1, 22, 1);
    // Arrow pointing right
    rect(g, '#5a3010', 5, 5, 10, 3);
    rect(g, '#5a3010', 14, 3, 2, 7);
    rect(g, '#5a3010', 16, 4, 1, 5);
    rect(g, '#5a3010', 17, 5, 1, 3);
    rect(g, '#5a3010', 18, 6, 1, 1);
    return c;
  }

  function makeBubble() {
    return fromPixels([
      '.KKKKKKKKK.',
      'KWWWWWWWWWK',
      'KWWWQQQWWWK',
      'KWWQWWWQWWK',
      'KWWWWWWQWWK',
      'KWWWWWQWWWK',
      'KWWWWQWWWWK',
      'KWWWWWWWWWK',
      'KWWWWQWWWWK',
      'KWWWWWWWWWK',
      '.KKKKWKKKK.',
      '.....KK....',
      '.....K.....'
    ], { K: '#262650', W: '#ffffff', Q: '#ff5d8f' });
  }

  /* ------------------------------------------------------------------ *
   * Build everything once
   * ------------------------------------------------------------------ */

  BGQ.Sprites = {
    build: function () {
      const pipFrame = function (legs, jump) {
        return fromPixels(PIP_HEAD.concat(jump ? PIP_BODY_JUMP : PIP_BODY, PIP_LEGS[legs]), PIP_PALETTE);
      };
      const pip = {
        idle: pipFrame('idle'),
        run1: pipFrame('run1'),
        run2: pipFrame('run2'),
        run3: pipFrame('run3'),
        jump: pipFrame('jump', true)
      };
      const pipLeft = {};
      Object.keys(pip).forEach(function (k) { pipLeft[k] = mirror(pip[k]); });

      const owl = fromPixels(OWL, OWL_PALETTE);

      this.pip = { right: pip, left: pipLeft };
      this.blob = [
        fromPixels(BLOB_TOP.concat(BLOB_FEET_A), BLOB_PALETTE),
        fromPixels(BLOB_TOP.concat(BLOB_FEET_B), BLOB_PALETTE)
      ];
      this.blobSquished = fromPixels(BLOB_SQUISHED, BLOB_PALETTE);
      this.owl = owl;
      this.owlBlink = fromPixels(owlBlinkRows(), OWL_PALETTE);
      this.owlCheer = owlCheer(owl);
      this.heart = fromPixels(HEART, { R: '#ff3b5c', r: '#a3122e', W: '#ffd1da' });
      this.coin = makeCoinFrames();
      this.tiles = {
        groundTop: makeGroundTop(),
        ground: makeGround(),
        brick: makeBrick(),
        question: [makeQuestion('#f8b830'), makeQuestion('#ffcf5a'), makeQuestion('#e89a1c')],
        used: makeUsed(),
        hard: makeHard(),
        pipeTop: makePipeTop(),
        pipeBody: makePipeBody(),
        spikes: makeSpikes()
      };
      this.bushes = { small: makeBush(32), medium: makeBush(48), large: makeBush(64) };
      this.mountains = makeMountains();
      this.hills = makeHills();
      this.clouds = makeCloudStrip();
      this.castle = makeCastle();
      this.flag = makeFlag();
      this.castleFlag = makeCastleFlag();
      this.sign = makeSign();
      this.bubble = makeBubble();
      this.pixelEllipse = pixelEllipse;
    }
  };
})();
