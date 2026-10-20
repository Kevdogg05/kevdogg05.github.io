/**
 * Brain Gate Quest — level layout.
 *
 * The level is described with small builder helpers instead of a giant
 * hand-typed map, which keeps every row the right length and makes the
 * layout easy to read and tweak. Coordinates are in tiles: column 0 is the
 * far left, row 0 is the top of the screen and row 13 is the ground surface.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const T = BGQ.T;
  const TILE = BGQ.TILE;
  const GROUND = BGQ.GROUND_ROW;

  BGQ.Level = {
    build: function () {
      const cols = 216;
      const rows = BGQ.ROWS;
      const tiles = new Uint8Array(cols * rows);

      const L = {
        cols: cols,
        rows: rows,
        width: cols * TILE,
        height: rows * TILE,
        tiles: tiles,
        contents: new Map(), // tile index -> 'coin' | 'heart' for ? blocks
        coins: [],
        enemies: [],
        platforms: [],
        gates: [],
        decor: [],
        start: { x: 3 * TILE + 2, y: GROUND * TILE - 15 },
        flag: null,
        castle: null
      };

      /* ---------------- builder helpers ---------------- */

      function set(c, r, t) {
        if (c >= 0 && c < cols && r >= 0 && r < rows) tiles[r * cols + c] = t;
      }

      /** Solid ground (two tiles deep) from column c0 to c1 inclusive. */
      function ground(c0, c1) {
        for (let c = c0; c <= c1; c++) {
          set(c, GROUND, T.GROUND);
          set(c, GROUND + 1, T.GROUND);
        }
      }

      function block(c, r, t, content) {
        set(c, r, t);
        if (content) L.contents.set(r * cols + c, content);
      }

      /** A row of blocks described by a pattern, e.g. 'B?B?B'. */
      function blocks(c, r, pattern) {
        for (let i = 0; i < pattern.length; i++) {
          const ch = pattern[i];
          if (ch === 'B') block(c + i, r, T.BRICK);
          else if (ch === '?') block(c + i, r, T.QUESTION, 'coin');
          else if (ch === 'H') block(c + i, r, T.QUESTION, 'heart');
          else if (ch === '#') block(c + i, r, T.HARD);
        }
      }

      /** A two-tile-wide pipe `h` tiles tall standing on the ground. */
      function pipe(c, h) {
        const top = GROUND - h;
        set(c, top, T.PIPE_TL);
        set(c + 1, top, T.PIPE_TR);
        for (let r = top + 1; r < GROUND; r++) {
          set(c, r, T.PIPE_L);
          set(c + 1, r, T.PIPE_R);
        }
      }

      /** Stone staircase climbing to the right, `h` steps high. */
      function stairsUp(c, h) {
        for (let i = 0; i < h; i++) {
          for (let r = GROUND - 1 - i; r < GROUND; r++) set(c + i, r, T.HARD);
        }
      }

      /** Stone staircase descending to the right, `h` steps high. */
      function stairsDown(c, h) {
        for (let i = 0; i < h; i++) {
          for (let r = GROUND - (h - i); r < GROUND; r++) set(c + i, r, T.HARD);
        }
      }

      function coin(c, r) {
        L.coins.push({ x: c * TILE + 3, y: r * TILE + 1, w: 10, h: 14, taken: false });
      }

      function coinRow(c, r, n) {
        for (let i = 0; i < n; i++) coin(c + i, r);
      }

      function enemy(c, r) {
        const row = r === undefined ? GROUND - 1 : r;
        L.enemies.push({ x: c * TILE + 1, y: (row + 1) * TILE - 13 });
      }

      function spikes(c0, c1) {
        for (let c = c0; c <= c1; c++) set(c, GROUND - 1, T.SPIKES);
      }

      /** A platform 3 tiles wide gliding between columns c0 and c1 at row r. */
      function mover(c0, c1, r, speed) {
        L.platforms.push({
          x: c0 * TILE, y: r * TILE, w: 48, h: 8,
          minX: c0 * TILE, maxX: c1 * TILE,
          speed: speed || 40, dir: 1, dx: 0
        });
      }

      /**
       * A Brain Gate: an iron gate guarded by Professor Hoot the owl.
       * The stone cap at row 4 is where the owl perches.
       */
      function gate(c) {
        set(c, 4, T.HARD);
        L.gates.push({
          col: c,
          x: c * TILE,
          index: L.gates.length,
          type: null,         // 'math' or 'knowledge', assigned by the game
          state: 'closed',    // closed -> quiz -> opening -> open
          open: 0,            // 0..1 animation progress
          cheer: 0,           // seconds left of the owl's celebration
          box: { x: c * TILE + 2, y: -2000, w: 12, h: 2000 + GROUND * TILE }
        });
      }

      function decor(type, c, extra) {
        L.decor.push({ type: type, x: c * TILE + (extra || 0) });
      }

      /* ---------------- Section 1: Meadow start ---------------- */
      ground(0, 38);
      decor('sign', 6);
      decor('bushLarge', 1);
      decor('bushSmall', 11);
      blocks(12, 9, '?');
      blocks(17, 9, 'B?B?B');
      blocks(19, 5, '?');
      enemy(22);
      decor('bushMedium', 23);
      pipe(26, 2);
      coinRow(29, 10, 3);
      enemy(31);
      pipe(34, 3);

      /* First pit with a coin arc over it */
      coin(39, 9);
      coin(40, 8);
      coin(41, 9);
      ground(42, 86);

      /* Floating brick bridge with coins on top */
      blocks(46, 9, 'BB?B');
      coinRow(46, 8, 4);
      enemy(48);
      enemy(53);
      decor('bushSmall', 51);

      /* ---------------- Brain Gate 1 ---------------- */
      decor('bushMedium', 56);
      gate(61);
      coinRow(64, 11, 3);

      /* ---------------- Section 2: Stone steps ---------------- */
      stairsUp(67, 4);
      // Pit between the staircases
      for (let c = 71; c <= 73; c++) {
        set(c, GROUND, T.EMPTY);
        set(c, GROUND + 1, T.EMPTY);
      }
      coinRow(71, 7, 3);
      stairsDown(74, 4);
      decor('bushSmall', 79);
      spikes(81, 82);
      coinRow(81, 9, 2);
      blocks(84, 9, '?');

      /* Wide pit crossed on a moving platform */
      mover(87, 94, 10, 38);
      coinRow(89, 7, 6);
      ground(97, 130);

      /* ---------------- Section 3: Brick heights ---------------- */
      decor('bushLarge', 98);
      blocks(100, 9, '?');
      enemy(103);
      enemy(105);
      blocks(106, 9, 'BBBBB');
      blocks(108, 5, 'H');
      coinRow(106, 8, 2);
      coinRow(109, 8, 2);

      /* ---------------- Brain Gate 2 ---------------- */
      decor('bushSmall', 113);
      gate(117);
      coinRow(120, 11, 2);

      /* ---------------- Section 4: Pipe valley ---------------- */
      pipe(123, 3);
      enemy(127);
      ground(134, 158);
      coin(131, 8);
      coin(132, 7);
      coin(133, 8);
      pipe(137, 4);
      enemy(141);
      enemy(143);
      pipe(146, 2);
      decor('bushMedium', 148);

      /* Brick bridge over a spike bed */
      blocks(150, 10, 'BB?BBB');
      spikes(151, 154);
      coinRow(150, 9, 6);

      /* Second moving platform pit */
      mover(159, 164, 10, 42);
      coinRow(160, 7, 4);
      ground(168, 215);

      /* ---------------- Brain Gate 3 ---------------- */
      decor('bushLarge', 169);
      gate(176);
      coinRow(179, 11, 2);

      /* ---------------- Section 5: Grand finale ---------------- */
      enemy(184);
      enemy(186);
      blocks(181, 9, 'B?B');
      stairsUp(189, 8);
      decor('bushSmall', 198);

      /* Flagpole on a stone base, then the castle */
      block(201, GROUND - 1, T.HARD);
      L.flag = {
        col: 201,
        x: 201 * TILE + 7,          // left edge of the 2px-wide pole
        top: 3 * TILE,              // pole top (ball sits just above)
        bottom: (GROUND - 1) * TILE // top of the stone base
      };
      L.castle = {
        x: 206 * TILE,
        y: GROUND * TILE - 96,
        w: 80,
        h: 96,
        doorX: 206 * TILE + 40
      };
      decor('bushMedium', 212);

      return L;
    }
  };
})();
