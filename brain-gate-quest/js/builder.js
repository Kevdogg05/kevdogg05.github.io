/**
 * Brain Gate Quest — level builder and section library.
 *
 * Levels are assembled left-to-right from hand-designed "sections"
 * (pits, pipe rows, elevators, spring walls, ...). Every section starts
 * and ends on solid ground and keeps its jumps within the player's reach
 * (about 4 tiles up and 5 tiles across), so any sequence of sections is
 * always playable. Coordinates are tiles: row 0 is the top of the screen
 * and row 13 is the ground surface.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const T = BGQ.T;
  const TILE = BGQ.TILE;
  const GROUND = BGQ.GROUND_ROW;
  const ROWS = BGQ.ROWS;
  const MAX_COLS = 480;

  /* ------------------------------------------------------------------ *
   * Builder: a cursor (b.x, in columns) plus placement helpers.
   * ------------------------------------------------------------------ */

  function createBuilder() {
    const tiles = new Uint8Array(MAX_COLS * ROWS);
    const L = {
      contents: new Map(), // (r * MAX_COLS + c) -> 'coin' | 'heart' while building
      coins: [], enemies: [], platforms: [], springs: [], gates: [], decor: [],
      start: null, flag: null, castle: null
    };

    const b = {
      x: 0,
      L: L,
      tiles: tiles,
      enemyCount: 0,

      set: function (c, r, t) {
        if (c >= 0 && c < MAX_COLS && r >= 0 && r < ROWS) tiles[r * MAX_COLS + c] = t;
      },

      /** Two-tile-deep ground from column c0 to c1 inclusive. */
      ground: function (c0, c1) {
        for (let c = c0; c <= c1; c++) {
          b.set(c, GROUND, T.GROUND);
          b.set(c, GROUND + 1, T.GROUND);
        }
      },

      block: function (c, r, t, content) {
        b.set(c, r, t);
        if (content) L.contents.set(r * MAX_COLS + c, content);
      },

      /** Row of blocks from a pattern: B brick, ? coin block, H heart block, # stone, . gap. */
      blocks: function (c, r, pattern) {
        for (let i = 0; i < pattern.length; i++) {
          const ch = pattern[i];
          if (ch === 'B') b.block(c + i, r, T.BRICK);
          else if (ch === '?') b.block(c + i, r, T.QUESTION, 'coin');
          else if (ch === 'H') b.block(c + i, r, T.QUESTION, 'heart');
          else if (ch === '#') b.block(c + i, r, T.HARD);
        }
      },

      /** Solid stone column `h` tiles tall standing on the ground. */
      pillar: function (c, h) {
        for (let r = GROUND - h; r < GROUND; r++) b.set(c, r, T.HARD);
      },

      pipe: function (c, h) {
        const top = GROUND - h;
        b.set(c, top, T.PIPE_TL);
        b.set(c + 1, top, T.PIPE_TR);
        for (let r = top + 1; r < GROUND; r++) {
          b.set(c, r, T.PIPE_L);
          b.set(c + 1, r, T.PIPE_R);
        }
      },

      stairsUp: function (c, h) {
        for (let i = 0; i < h; i++) b.pillar(c + i, i + 1);
      },

      stairsDown: function (c, h) {
        for (let i = 0; i < h; i++) b.pillar(c + i, h - i);
      },

      coin: function (c, r) {
        L.coins.push({ x: c * TILE + 3, y: r * TILE + 1, w: 10, h: 14, taken: false });
      },

      coinRow: function (c, r, n) {
        for (let i = 0; i < n; i++) b.coin(c + i, r);
      },

      /** A gentle arc of coins over a gap of `n` columns. */
      coinArc: function (c, n) {
        for (let i = 0; i < n; i++) b.coin(c + i, i === 0 || i === n - 1 ? 9 : 8);
      },

      /** type: 'walker' | 'spiky' | 'mixed' (alternates walker/spiky). */
      enemy: function (c, type) {
        let t = type || 'walker';
        if (t === 'mixed') t = b.enemyCount % 2 ? 'spiky' : 'walker';
        b.enemyCount++;
        L.enemies.push({ type: t, x: c * TILE + 1, y: GROUND * TILE - 13 });
      },

      /** A flying enemy hovering around row r, patrolling `range` pixels each way. */
      flyer: function (c, r, range) {
        L.enemies.push({ type: 'flyer', x: c * TILE + 1, y: r * TILE + 3, range: range || 40 });
      },

      spikes: function (c0, c1) {
        for (let c = c0; c <= c1; c++) b.set(c, GROUND - 1, T.SPIKES);
      },

      /** Horizontal moving platform (3 tiles wide) between columns c0 and c1. */
      mover: function (c0, c1, r, speed) {
        L.platforms.push({
          axis: 'x', x: c0 * TILE, y: r * TILE, w: 48, h: 8,
          min: c0 * TILE, max: c1 * TILE, speed: speed || 40, dir: 1, dx: 0, dy: 0
        });
      },

      /** Vertical moving platform (elevator) between rows rTop and rBottom. */
      elevator: function (c, rTop, rBottom, speed) {
        L.platforms.push({
          axis: 'y', x: c * TILE, y: rBottom * TILE, w: 48, h: 8,
          min: rTop * TILE, max: rBottom * TILE, speed: speed || 36, dir: -1, dx: 0, dy: 0
        });
      },

      spring: function (c) {
        L.springs.push({ x: c * TILE, y: (GROUND - 1) * TILE, top: (GROUND - 1) * TILE + 4, w: 16, squash: 0 });
      },

      decor: function (size, c) {
        L.decor.push({ type: size, x: c * TILE });
      },

      /** Removes ground to make a pit from c0 to c1. */
      pit: function (c0, c1) {
        for (let c = c0; c <= c1; c++) {
          b.set(c, GROUND, T.EMPTY);
          b.set(c, GROUND + 1, T.EMPTY);
        }
      },

      gate: function (c) {
        b.set(c, 4, T.HARD); // stone cap where Professor Hoot perches
        L.gates.push({
          col: c, x: c * TILE, index: L.gates.length, type: null,
          state: 'closed', open: 0, cheer: 0,
          box: { x: c * TILE + 2, y: -2000, w: 12, h: 2000 + GROUND * TILE }
        });
      }
    };
    return b;
  }

  /* ------------------------------------------------------------------ *
   * Section library. Each section starts at b.x and advances it.
   * ------------------------------------------------------------------ */

  const SECTIONS = {
    /** Opening area with the start sign. */
    start: function (b) {
      const x = b.x;
      b.ground(x, x + 9);
      b.decor('large', x);
      b.L.decor.push({ type: 'sign', x: (x + 6) * TILE });
      b.L.start = { x: (x + 3) * TILE + 2, y: GROUND * TILE - 15 };
      b.x += 10;
    },

    /** Flat ground, optionally with a coin line and enemies. */
    flat: function (b, o) {
      const x = b.x, w = o.w || 8;
      b.ground(x, x + w - 1);
      if (o.coins) b.coinRow(x + 2, 10, Math.max(1, w - 4));
      for (let i = 0; i < (o.enemies || 0); i++) b.enemy(x + w - 2 - i * 3, o.type);
      b.decor('medium', x + 1);
      b.x += w;
    },

    /** Floating block formations. */
    blocks: function (b, o) {
      const x = b.x, v = o.v || 'classic';
      b.ground(x, x + 13);
      if (v === 'classic') {
        b.blocks(x + 2, 9, '?');
        b.blocks(x + 6, 9, 'B?B?B');
        b.blocks(x + 8, 5, '?');
        b.enemy(x + 12, o.type);
      } else if (v === 'row') {
        b.blocks(x + 3, 9, 'BBB?BBB');
        b.coinRow(x + 3, 8, 7);
        b.enemy(x + 11, o.type);
      } else if (v === 'heart') {
        b.blocks(x + 3, 9, 'BB?BB');
        b.blocks(x + 5, 5, 'H');
        b.coinRow(x + 9, 10, 3);
        b.enemy(x + 12, o.type);
      } else if (v === 'high') {
        b.blocks(x + 2, 10, 'BB');
        b.blocks(x + 5, 6, '?B?');
        b.coinRow(x + 5, 5, 3);
        b.enemy(x + 10, o.type);
        b.enemy(x + 12, o.type);
      }
      b.decor('small', x + 1);
      b.x += 14;
    },

    /** Pipes of the given heights with an enemy trapped between each pair. */
    pipes: function (b, o) {
      const x = b.x, hs = o.h || [2, 3];
      const w = 4 + hs.length * 5;
      b.ground(x, x + w - 1);
      hs.forEach(function (h, i) {
        b.pipe(x + 2 + i * 5, h);
        b.coinRow(x + 2 + i * 5, GROUND - h - 2, 2);
        if (i < hs.length - 1 && o.enemies !== 0) b.enemy(x + 5 + i * 5, o.type);
      });
      b.x += w;
    },

    /** A simple pit (2–4 tiles) with a coin arc. */
    pit: function (b, o) {
      const x = b.x, w = o.w || 3;
      b.ground(x, x + 1);
      b.ground(x + 2 + w, x + 3 + w);
      b.coinArc(x + 2, w);
      b.x += w + 4;
    },

    /** Stairs up, a pit, then stairs down. */
    stairsPit: function (b, o) {
      const x = b.x, h = o.h || 4, gap = o.gap || 3;
      const total = 2 * h + gap + 2;
      b.ground(x, x + total - 1);
      b.pit(x + 1 + h, x + h + gap);
      b.stairsUp(x + 1, h);
      b.stairsDown(x + 1 + h + gap, h);
      b.coinRow(x + 1 + h, GROUND - h - 3, gap);
      b.x += total;
    },

    /** A wide pit crossed by riding a sideways-moving platform. */
    moverPit: function (b, o) {
      const x = b.x, w = o.w || 8, row = o.row || 11;
      b.ground(x, x + 1);
      b.ground(x + w + 2, x + w + 3);
      b.mover(x + 2, x + w - 1, row, o.speed || 40);
      b.coinRow(x + 4, row - 3, Math.max(1, w - 4));
      b.x += w + 4;
    },

    /** A pit too wide to jump, crossed on an up-and-down elevator. */
    elevatorPit: function (b, o) {
      const x = b.x, w = o.w || 7;
      const pc = x + 2 + Math.floor((w - 3) / 2);
      b.ground(x, x + 1);
      b.ground(x + w + 2, x + w + 3);
      b.elevator(pc, 6, 11, o.speed || 36);
      b.coinRow(pc, 4, 3);
      b.x += w + 4;
    },

    /** A brick bridge over a bed of spikes. */
    bridge: function (b, o) {
      const x = b.x, w = o.w || 4;
      const total = w + 4;
      b.ground(x, x + total - 1);
      let pattern = '';
      for (let i = 0; i < w + 2; i++) pattern += i === Math.floor((w + 2) / 2) ? '?' : 'B';
      b.blocks(x + 1, 10, pattern);
      b.spikes(x + 2, x + w + 1);
      b.coinRow(x + 1, 9, w + 2);
      b.x += total;
    },

    /** Pairs of spikes to hop over, with three safe tiles between them. */
    spikeHops: function (b, o) {
      const x = b.x, n = o.n || 2;
      const total = 5 * n + 2;
      b.ground(x, x + total - 1);
      for (let i = 0; i < n; i++) {
        b.spikes(x + 2 + 5 * i, x + 3 + 5 * i);
        b.coinRow(x + 2 + 5 * i, 10, 2);
      }
      b.x += total;
    },

    /** Floating stepping stones across a pit. */
    steps: function (b, o) {
      const x = b.x, w = o.w || 8;
      b.ground(x, x);
      b.ground(x + w + 1, x + w + 2);
      for (let c = x + 2, i = 0; c + 1 < x + w; c += 3, i++) {
        const r = i % 2 === 0 ? 11 : 10;
        b.set(c, r, T.HARD);
        b.set(c + 1, r, T.HARD);
        b.coin(c, r - 2);
        b.coin(c + 1, r - 2);
      }
      b.x += w + 3;
    },

    /** A wall too tall to jump, with a spring in front of it and a long, safe landing area. */
    springWall: function (b, o) {
      const x = b.x, h = o.h || 6;
      const total = 16;
      b.ground(x, x + total - 1);
      b.spring(x + 3);
      b.pillar(x + 5, h);
      b.pillar(x + 6, h);
      b.coin(x + 3, 8);
      b.coin(x + 3, 6);
      b.coinRow(x + 5, GROUND - h - 1, 2);
      b.x += total;
    },

    /** Small islands separated by gaps, with optional flyers over the gaps. */
    islands: function (b, o) {
      const n = o.n || 3, gap = o.gap || 3;
      let c = b.x;
      b.ground(c, c + 1);
      c += 2;
      for (let i = 0; i < n; i++) {
        b.coinArc(c, gap);
        if (o.flyers && i % 2 === 1) b.flyer(c + Math.floor(gap / 2), 8, 24);
        c += gap;
        b.ground(c, c + 3);
        if (i === Math.floor(n / 2)) b.decor('small', c);
        c += 4;
      }
      b.x = c;
    },

    /** A brick tunnel: walk through underneath or run along the top. */
    tunnel: function (b, o) {
      const x = b.x, w = o.w || 10;
      const total = w + 4;
      b.ground(x, x + total - 1);
      let pattern = '';
      for (let i = 0; i < w; i++) pattern += i === Math.floor(w / 2) ? '?' : 'B';
      b.blocks(x + 2, 10, pattern);
      b.coinRow(x + 3, 12, w - 2);
      for (let i = 0; i < w; i += 2) b.coin(x + 2 + i, 9);
      b.x += total;
    },

    /** Stone towers (3 tiles wide) separated by narrow pits. */
    towers: function (b, o) {
      const hs = o.h || [2, 3, 2];
      let c = b.x;
      b.ground(c, c + 1);
      c += 2;
      hs.forEach(function (h, i) {
        b.ground(c, c + 2);
        for (let k = 0; k < 3; k++) b.pillar(c + k, h);
        b.coinRow(c, GROUND - h - 2, 3);
        c += 3;
        if (i < hs.length - 1) c += 2; // two-tile pit between towers
      });
      b.ground(c, c + 2);
      b.x = c + 3;
    },

    /** A relaxing reward area full of coins and coin blocks. */
    coinGarden: function (b) {
      const x = b.x;
      b.ground(x, x + 15);
      for (let i = 0; i < 5; i++) b.coin(x + 2 + i, i === 0 || i === 4 ? 10 : i === 2 ? 8 : 9);
      b.blocks(x + 9, 9, '?.?');
      b.coinRow(x + 8, 6, 5);
      b.decor('large', x + 12);
      b.x += 16;
    },

    /** A line of ground enemies with coins above them. */
    parade: function (b, o) {
      const x = b.x, n = o.n || 3;
      const total = 5 + 4 * n;
      b.ground(x, x + total - 1);
      for (let i = 0; i < n; i++) {
        b.enemy(x + 4 + 4 * i, o.type);
        b.coin(x + 4 + 4 * i, 9);
      }
      b.x += total;
    },

    /** Buzzers patrolling at head height over flat ground. */
    flyers: function (b, o) {
      const x = b.x, n = o.n || 2;
      const total = 6 + 5 * n;
      b.ground(x, x + total - 1);
      for (let i = 0; i < n; i++) {
        b.flyer(x + 4 + 5 * i, i % 2 ? 9 : 11, 32);
        b.coin(x + 4 + 5 * i, 6);
      }
      b.decor('medium', x + 1);
      b.x += total;
    },

    /** A Brain Gate in a safe, flat clearing. */
    gate: function (b) {
      const x = b.x;
      b.ground(x, x + 11);
      b.decor('small', x + 1);
      b.gate(x + 6);
      b.coinRow(x + 9, 11, 2);
      b.x += 12;
    },

    /** Final staircase, flagpole and castle. */
    finish: function (b, o) {
      const x = b.x, h = o.h || 8;
      b.stairsUp(x + 2, h);
      const flagCol = x + h + 6;
      b.ground(x, flagCol + 15);
      b.set(flagCol, GROUND - 1, T.HARD);
      b.L.flag = { col: flagCol, x: flagCol * TILE + 7, top: 3 * TILE, bottom: (GROUND - 1) * TILE };
      const castleCol = flagCol + 5;
      b.L.castle = { x: castleCol * TILE, y: GROUND * TILE - 96, w: 80, h: 96, doorX: castleCol * TILE + 40 };
      b.decor('medium', castleCol + 6);
      b.x = flagCol + 16;
    }
  };

  /** Builds level data from a list of [sectionName, options] pairs. */
  function assemble(sections, theme) {
    const b = createBuilder();
    const layout = []; // [sectionName, startColumn] — handy when tuning levels
    sections.forEach(function (s) {
      const fn = SECTIONS[s[0]];
      if (!fn) throw new Error('Unknown level section: ' + s[0]);
      layout.push([s[0], b.x]);
      fn(b, s[1] || {});
    });
    b.L.layout = layout;

    // Copy the used columns into a right-sized grid.
    const cols = b.x;
    const tiles = new Uint8Array(cols * ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < cols; c++) tiles[r * cols + c] = b.tiles[r * MAX_COLS + c];
    }
    // Caves get a solid rock roof across the top two rows.
    if (theme.ceiling) {
      for (let c = 0; c < cols; c++) {
        tiles[c] = T.GROUND;
        tiles[cols + c] = T.GROUND;
      }
    }
    const contents = new Map();
    b.L.contents.forEach(function (v, key) {
      contents.set(Math.floor(key / MAX_COLS) * cols + (key % MAX_COLS), v);
    });

    const L = b.L;
    L.cols = cols;
    L.rows = ROWS;
    L.width = cols * TILE;
    L.height = ROWS * TILE;
    L.tiles = tiles;
    L.contents = contents;
    return L;
  }

  BGQ.Builder = { assemble: assemble, sections: SECTIONS };
})();
