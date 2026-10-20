/**
 * Brain Gate Quest — shared namespace, tuning constants and small helpers.
 *
 * Every script in this game attaches its module to the global `BGQ` object.
 * Plain (non-module) scripts are used on purpose so the game also runs when
 * index.html is opened straight from disk (file://), where ES modules are
 * blocked by browser security rules.
 */
(function () {
  'use strict';

  const BGQ = (window.BGQ = window.BGQ || {});

  /* ------------------------------------------------------------------ *
   * World and view geometry, measured in logical "game pixels".
   * The canvas is drawn at this low resolution and scaled up with
   * nearest-neighbour filtering for a crisp retro look.
   * ------------------------------------------------------------------ */
  BGQ.TILE = 16;                        // one tile is 16x16 game pixels
  BGQ.ROWS = 15;                        // level height in tiles
  BGQ.VIEW_H = BGQ.TILE * BGQ.ROWS;     // 240 game pixels tall
  BGQ.VIEW_MIN_W = 320;                 // narrowest view (4:3 tablets)
  BGQ.VIEW_MAX_W = 576;                 // widest view (2.4:1 ultra-wide phones)
  BGQ.GROUND_ROW = 13;                  // top row of the ground
  BGQ.STEP = 1 / 60;                    // fixed physics timestep in seconds

  /* ------------------------------------------------------------------ *
   * Player physics (pixels, pixels/second, pixels/second²).
   * Two gravity values give "variable height" jumps: holding the jump
   * button while rising uses the lighter gravity for a higher jump.
   * ------------------------------------------------------------------ */
  BGQ.PHYS = {
    accelGround: 720,     // acceleration while running on the ground
    accelAir: 470,        // acceleration while steering in the air
    maxSpeed: 112,        // top horizontal speed
    friction: 820,        // ground slow-down when no direction is held
    skid: 1500,           // slow-down when pushing against current motion
    airDrag: 110,         // gentle air slow-down when no direction is held
    gravityHold: 760,     // rising while jump is held -> higher, floatier jump
    gravity: 1500,        // every other moment -> snappy, precise landings
    maxFall: 440,         // terminal falling speed
    jumpSpeed: 330,       // initial upward speed of a jump
    jumpRunBonus: 0.12,   // extra jump speed per unit of horizontal speed
    coyoteTime: 0.09,     // grace period to jump after walking off a ledge
    jumpBuffer: 0.12,     // a jump pressed slightly early still counts
    stompBounce: 250,     // bounce after stomping an enemy
    stompBounceHold: 360  // bigger bounce if jump is held during the stomp
  };

  BGQ.ENEMY_SPEED = 30;
  BGQ.ENEMY_GRAVITY = 1500;
  BGQ.START_LIVES = 3;
  BGQ.INVULN_TIME = 1.6;               // blinking safety time after respawning

  /** Points awarded for each kind of achievement. */
  BGQ.SCORE = {
    coin: 100,
    stomp: 200,
    brick: 50,
    heart: 1000,
    gateFirstTry: 1000,
    gateRetry: 500
  };

  /** Tile ids stored in the level grid. */
  BGQ.T = {
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,
    QUESTION: 3,
    USED: 4,
    HARD: 5,
    PIPE_TL: 6,
    PIPE_TR: 7,
    PIPE_L: 8,
    PIPE_R: 9,
    SPIKES: 10
  };

  /** Tile ids that block movement. Spikes are a hazard, not a wall. */
  BGQ.SOLID = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  /* ------------------------------------------------------------------ *
   * Small math helpers.
   * ------------------------------------------------------------------ */
  BGQ.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  BGQ.rand = function (lo, hi) {
    return lo + Math.random() * (hi - lo);
  };

  /** Random integer in the inclusive range [lo, hi]. */
  BGQ.randInt = function (lo, hi) {
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  };

  /** Returns a new array with the items in random order (Fisher–Yates). */
  BGQ.shuffle = function (list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  /** Axis-aligned rectangle overlap test. Rectangles use {x, y, w, h}. */
  BGQ.overlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  /* ------------------------------------------------------------------ *
   * Safe localStorage wrapper. Private browsing modes and some embedded
   * browsers throw on access, so every call is guarded and the game
   * simply works without saved data in that case.
   * ------------------------------------------------------------------ */
  BGQ.storage = {
    get: function (key, fallback) {
      try {
        const raw = window.localStorage.getItem('bgq.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem('bgq.' + key, JSON.stringify(value));
      } catch (err) {
        /* Storage unavailable — progress just is not remembered. */
      }
    }
  };
})();
