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
   * Enemy "Buzzer" — a flying bug (16x16, drawn facing left)
   * ------------------------------------------------------------------ */

  const BUZZ_PALETTE = {
    Y: '#ffcf3f', K: '#2a1a0a', W: '#e8f6ff', w: '#8ab8e0', E: '#ffffff', P: '#111111', S: '#2a1a0a'
  };

  const BUZZ_BODY = [
    '...KYYYKYYKYK...',
    '..KEPYYKYYKYYK..',
    '..KEEYYKYYKYYKS.',
    '..KYYYYKYYKYYK..',
    '...KYYYKYYKYK...',
    '....KKKKKKKK....'
  ];

  const BUZZ_WINGS_UP = [
    '................',
    '.....ww..ww.....',
    '....wWWwwWWw....',
    '....wWWWWWWw....',
    '.....wwYYww.....'
  ];

  const BUZZ_WINGS_DOWN = [
    '................',
    '................',
    '................',
    '....wwwwwwww....',
    '.....wWYYWw.....'
  ];

  /* ------------------------------------------------------------------ *
   * Enemy "Spikeshell" — cannot be stomped (16x16, drawn facing left)
   * ------------------------------------------------------------------ */

  const SPIKY_PALETTE = {
    R: '#e53950', r: '#8f1a2e', W: '#ffe0e6', B: '#f0a050', b: '#a8622a', E: '#111111', F: '#5a3010'
  };

  const SPIKY_TOP = [
    '................',
    '................',
    '................',
    '................',
    '......W...W.....',
    '...W..R..RR..W..',
    '...RR.RR.RRR.RR.',
    '..WRRRRRRRRRRRR.',
    '..rRRRRRRRRRRRRW',
    '.BBrRRRRRRRRRRr.',
    'BEBBrrrrrrrrrrr.',
    'BBBBBbbbbbbbbbb.',
    '.BBBBBBBBBBBBBb.',
    '..bbbbbbbbbbbb..'
  ];

  const SPIKY_FEET_A = ['...FF......FF...', '..FFF.....FFF...'];
  const SPIKY_FEET_B = ['....FF....FF....', '...FFF....FFF...'];

  /** Spring: frame 0 is relaxed, frame 1 is squashed after a bounce. */
  function makeSpring(squashed) {
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    const plateY = squashed ? 9 : 4;
    rect(g, '#3e444c', 1, 13, 14, 3);
    rect(g, '#8a949f', 2, 13, 12, 1);
    // Zig-zag coil between the base and the plate
    for (let y = plateY + 3, i = 0; y < 13; y += 2, i++) {
      rect(g, '#c3cbd3', i % 2 ? 4 : 6, y, 6, 1);
      rect(g, '#6a737d', i % 2 ? 4 : 6, y + 1, 6, 1);
    }
    rect(g, '#8f1a2e', 0, plateY, 16, 3);
    rect(g, '#ff4f5e', 1, plateY, 14, 2);
    rect(g, '#ffb3bb', 2, plateY, 6, 1);
    return c;
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
      const buzz = [
        fromPixels(BUZZ_WINGS_UP.concat(BUZZ_BODY), BUZZ_PALETTE),
        fromPixels(BUZZ_WINGS_DOWN.concat(BUZZ_BODY), BUZZ_PALETTE)
      ];
      this.buzz = { left: buzz, right: buzz.map(mirror) };
      const spiky = [
        fromPixels(SPIKY_TOP.concat(SPIKY_FEET_A), SPIKY_PALETTE),
        fromPixels(SPIKY_TOP.concat(SPIKY_FEET_B), SPIKY_PALETTE)
      ];
      this.spiky = { left: spiky, right: spiky.map(mirror) };
      this.spring = [makeSpring(false), makeSpring(true)];
      this.owl = owl;
      this.owlBlink = fromPixels(owlBlinkRows(), OWL_PALETTE);
      this.owlCheer = owlCheer(owl);
      this.heart = fromPixels(HEART, { R: '#ff3b5c', r: '#a3122e', W: '#ffd1da' });
      this.coin = makeCoinFrames();
      this.tiles = {
        question: [makeQuestion('#f8b830'), makeQuestion('#ffcf5a'), makeQuestion('#e89a1c')],
        used: makeUsed(),
        pipeTop: makePipeTop(),
        pipeBody: makePipeBody(),
        spikes: makeSpikes()
      };
      this.castle = makeCastle();
      this.flag = makeFlag();
      this.castleFlag = makeCastleFlag();
      this.sign = makeSign();
      this.bubble = makeBubble();
      this.pixelEllipse = pixelEllipse;
    }
  };

  /** Drawing helpers shared with the themed tile painter (tiles.js). */
  BGQ.Art = {
    makeCanvas: makeCanvas,
    fromPixels: fromPixels,
    mirror: mirror,
    rect: rect,
    pixelEllipse: pixelEllipse,
    brickWall: brickWall
  };
})();
