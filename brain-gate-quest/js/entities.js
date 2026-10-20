/**
 * Brain Gate Quest — physics, the player and enemies.
 *
 * Collision uses axis-separated resolution against the tile grid: move
 * along X and push out of any solid tile, then do the same along Y. With
 * a 60 Hz fixed step and speeds well under one tile per step, nothing can
 * tunnel through walls. Closed Brain Gates act as extra solid walls.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const TILE = BGQ.TILE;
  const P = BGQ.PHYS;
  const EPS = 0.001;

  /* ------------------------------------------------------------------ *
   * World queries
   * ------------------------------------------------------------------ */

  function tileAt(L, c, r) {
    if (c < 0 || c >= L.cols || r < 0 || r >= L.rows) return BGQ.T.EMPTY;
    return L.tiles[r * L.cols + c];
  }

  /** The level edges act as walls; above and below the level is open air. */
  function isSolid(L, c, r) {
    if (c < 0 || c >= L.cols) return true;
    if (r < 0 || r >= L.rows) return false;
    return BGQ.SOLID.has(L.tiles[r * L.cols + c]);
  }

  /** Moves an entity horizontally, stopping at walls. Returns true on impact. */
  function moveX(L, e, dx) {
    e.x += dx;
    let hit = false;
    const r0 = Math.floor(e.y / TILE);
    const r1 = Math.floor((e.y + e.h - EPS) / TILE);
    if (dx > 0) {
      const c = Math.floor((e.x + e.w - EPS) / TILE);
      for (let r = r0; r <= r1; r++) {
        if (isSolid(L, c, r)) { e.x = c * TILE - e.w; hit = true; break; }
      }
    } else if (dx < 0) {
      const c = Math.floor(e.x / TILE);
      for (let r = r0; r <= r1; r++) {
        if (isSolid(L, c, r)) { e.x = (c + 1) * TILE; hit = true; break; }
      }
    }
    // Closed Brain Gates are walls that reach far above the screen.
    for (let i = 0; i < L.gates.length; i++) {
      const g = L.gates[i];
      if (g.state !== 'open' && BGQ.overlap(e, g.box)) {
        const fromLeft = e.x + e.w / 2 < g.box.x + g.box.w / 2;
        e.x = fromLeft ? g.box.x - e.w : g.box.x + g.box.w;
        hit = true;
      }
    }
    return hit;
  }

  /**
   * Moves an entity vertically. Returns { landed, ceilingRow, ceilingCols }
   * so the caller can react to bumping blocks from below.
   */
  function moveY(L, e, dy) {
    e.y += dy;
    const res = { landed: false, ceilingRow: -1, ceilingCols: [] };
    const c0 = Math.floor(e.x / TILE);
    const c1 = Math.floor((e.x + e.w - EPS) / TILE);
    if (dy > 0) {
      const r = Math.floor((e.y + e.h - EPS) / TILE);
      for (let c = c0; c <= c1; c++) {
        if (isSolid(L, c, r)) { e.y = r * TILE - e.h; res.landed = true; break; }
      }
    } else if (dy < 0) {
      const r = Math.floor(e.y / TILE);
      for (let c = c0; c <= c1; c++) {
        if (isSolid(L, c, r)) res.ceilingCols.push(c);
      }
      if (res.ceilingCols.length) {
        e.y = (r + 1) * TILE;
        res.ceilingRow = r;
      }
    }
    return res;
  }

  /* ------------------------------------------------------------------ *
   * Player
   * ------------------------------------------------------------------ */

  function createPlayer(x, y) {
    return {
      x: x, y: y, w: 12, h: 15,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      coyote: 0,
      jumpBuffer: 0,
      platform: null,
      anim: 0,
      frame: 'idle',
      invuln: 0,
      dead: false,
      rot: 0,
      hidden: false,
      stompChain: 0
    };
  }

  /**
   * Advances the player one physics step.
   * @param {object} G   - game state (level, platforms, callbacks)
   * @param {object} p   - the player
   * @param {number} dt  - timestep in seconds
   * @param {object} inp - { left, right, jumpHeld, jumpPressed }
   */
  function updatePlayer(G, p, dt, inp) {
    const L = G.level;

    // Ride along with a moving platform from the previous step.
    if (p.platform) {
      moveX(L, p, p.platform.dx);
      p.y = p.platform.y - p.h;
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) p.facing = dir;
    p.skidding = false;

    // Icy levels: less grip when speeding up, turning and stopping.
    const grip = L.slippery ? P.iceGrip : 1;

    if (p.onGround) {
      if (dir !== 0) {
        if (p.vx !== 0 && Math.sign(p.vx) !== dir) {
          p.vx += dir * P.skid * grip * dt;
          p.skidding = Math.abs(p.vx) > 40;
        } else {
          p.vx += dir * P.accelGround * (L.slippery ? 0.6 : 1) * dt;
        }
      } else {
        p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), P.friction * grip * dt);
      }
    } else if (dir !== 0) {
      const opposing = p.vx !== 0 && Math.sign(p.vx) !== dir;
      p.vx += dir * P.accelAir * (opposing ? 1.6 : 1) * dt;
    } else {
      p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), P.airDrag * dt);
    }
    p.vx = BGQ.clamp(p.vx, -P.maxSpeed, P.maxSpeed);

    // Jump buffering and coyote time make jumps feel fair and responsive.
    p.jumpBuffer = inp.jumpPressed ? P.jumpBuffer : p.jumpBuffer - dt;
    p.coyote = p.onGround ? P.coyoteTime : p.coyote - dt;
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -(P.jumpSpeed + Math.abs(p.vx) * P.jumpRunBonus);
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.platform = null;
      BGQ.Audio.play('jump');
    }

    const gravity = p.vy < 0 && inp.jumpHeld ? P.gravityHold : P.gravity;
    p.vy = Math.min(p.vy + gravity * dt, P.maxFall);

    // Horizontal move
    if (moveX(L, p, p.vx * dt)) p.vx = 0;

    // Vertical move against tiles
    const prevBottom = p.y + p.h;
    const fallSpeed = p.vy;
    p.onGround = false;
    const res = moveY(L, p, p.vy * dt);
    if (res.landed) {
      p.onGround = true;
      p.vy = 0;
    } else if (res.ceilingRow >= 0) {
      p.vy = Math.max(p.vy, 30);
      // Bump the block closest to the player's head (like classic platformers).
      const center = p.x + p.w / 2;
      let best = res.ceilingCols[0];
      res.ceilingCols.forEach(function (c) {
        if (Math.abs(c * TILE + 8 - center) < Math.abs(best * TILE + 8 - center)) best = c;
      });
      G.bumpBlock(best, res.ceilingRow);
    }

    // One-way moving platforms: only solid when landing on them from above.
    let standingOn = null;
    if (p.vy >= 0) {
      for (let i = 0; i < G.platforms.length; i++) {
        const m = G.platforms[i];
        const withinX = p.x + p.w > m.x + 1 && p.x < m.x + m.w - 1;
        if (withinX && prevBottom <= m.y + 2 && p.y + p.h >= m.y) {
          p.y = m.y - p.h;
          p.vy = 0;
          p.onGround = true;
          standingOn = m;
          break;
        }
      }
    }
    // Springs launch the player high into the air when landed on or run over.
    if (p.vy >= 0) {
      for (let i = 0; i < G.springs.length; i++) {
        const s = G.springs[i];
        const center = p.x + p.w / 2;
        const feet = p.y + p.h;
        if (center > s.x + 1 && center < s.x + s.w - 1 && feet >= s.top && feet <= s.y + s.w) {
          p.y = s.top - p.h;
          p.vy = -(inp.jumpHeld ? P.springHold : P.spring);
          p.onGround = false;
          standingOn = null;
          s.squash = 0.18;
          BGQ.Audio.play('spring');
          break;
        }
      }
    }
    p.platform = standingOn;

    if (p.onGround) {
      p.stompChain = 0;
      if (fallSpeed > 260) G.spawnDust(p.x + p.w / 2, p.y + p.h, 4);
    }
    if (p.skidding && Math.random() < 0.4) G.spawnDust(p.x + p.w / 2, p.y + p.h, 1);

    // Animation frame selection
    if (!p.onGround) {
      p.frame = 'jump';
    } else if (Math.abs(p.vx) > 4) {
      p.anim += dt * (6 + Math.abs(p.vx) * 0.09);
      p.frame = ['run1', 'run2', 'run3', 'run2'][Math.floor(p.anim) % 4];
    } else {
      p.anim = 0;
      p.frame = 'idle';
    }
    if (p.invuln > 0) p.invuln -= dt;
  }

  /* ------------------------------------------------------------------ *
   * Enemies ("Grumblobs")
   * ------------------------------------------------------------------ */

  /**
   * Enemy types:
   *   walker - Grumblob: walks, turns at walls, can be stomped
   *   spiky  - Spikeshell: walks, hurts if stomped (jump over it instead)
   *   flyer  - Buzzer: hovers back and forth through the air, can be stomped
   */
  function speedOf(type) {
    return type === 'spiky' ? BGQ.SPIKY_SPEED : type === 'flyer' ? BGQ.FLYER_SPEED : BGQ.ENEMY_SPEED;
  }

  function createEnemy(spawn) {
    const type = spawn.type || 'walker';
    return {
      type: type,
      x: spawn.x, y: spawn.y, w: 14, h: type === 'flyer' ? 10 : 13,
      spawnX: spawn.x, spawnY: spawn.y,
      range: spawn.range || 40,
      vx: -speedOf(type), vy: 0,
      alive: true, active: false,
      squish: 0, flipped: false, gone: false,
      anim: Math.random() * 2,
      t: Math.random() * 6
    };
  }

  function resetEnemy(e) {
    e.x = e.spawnX;
    e.y = e.spawnY;
    e.vx = -speedOf(e.type);
    e.vy = 0;
    e.active = false;
  }

  function updateEnemies(G, dt) {
    const L = G.level;
    const list = G.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.gone) continue;

      if (!e.alive) {
        if (e.flipped) {
          // Knocked off by a bumped block: tumble off the screen.
          e.vy += BGQ.ENEMY_GRAVITY * dt;
          e.y += e.vy * dt;
          e.x += e.vx * dt;
          if (e.y > L.height + 32) e.gone = true;
        } else {
          e.squish -= dt;
          if (e.squish <= 0) e.gone = true;
        }
        continue;
      }

      // Enemies wake up just before they scroll into view.
      if (!e.active) {
        if (e.x < G.cam.x + G.viewW + 24) e.active = true;
        else continue;
      }

      e.anim += dt * 5;

      if (e.type === 'flyer') {
        // Buzzers ignore walls: patrol around their spawn point and bob up and down.
        e.anim += dt * 7;
        e.t += dt;
        e.x += e.vx * dt;
        if (e.x < e.spawnX - e.range) e.vx = Math.abs(e.vx);
        else if (e.x > e.spawnX + e.range) e.vx = -Math.abs(e.vx);
        e.y = e.spawnY + Math.sin(e.t * 2.6) * 10;
        continue;
      }

      e.vy = Math.min(e.vy + BGQ.ENEMY_GRAVITY * dt, P.maxFall);
      if (moveX(L, e, e.vx * dt)) e.vx = -e.vx;
      const res = moveY(L, e, e.vy * dt);
      if (res.landed) e.vy = 0;
      if (e.y > L.height + 16) { e.alive = false; e.gone = true; }
    }

    // Enemies bounce off each other instead of overlapping.
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || !a.active || a.type === 'flyer') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || !b.active || b.type === 'flyer' || !BGQ.overlap(a, b)) continue;
        const aLeft = a.x < b.x;
        a.vx = (aLeft ? -1 : 1) * speedOf(a.type);
        b.vx = (aLeft ? 1 : -1) * speedOf(b.type);
      }
    }
  }

  BGQ.Physics = { tileAt: tileAt, isSolid: isSolid, moveX: moveX, moveY: moveY };
  BGQ.Entities = {
    createPlayer: createPlayer,
    updatePlayer: updatePlayer,
    createEnemy: createEnemy,
    resetEnemy: resetEnemy,
    updateEnemies: updateEnemies
  };
})();
