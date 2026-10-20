/**
 * Brain Gate Quest — game state, main loop and screen scaling.
 *
 * States:
 *   title    -> attract mode behind the title screen
 *   playing  -> normal gameplay
 *   quiz     -> action frozen while a Brain Gate question is open
 *   paused   -> pause menu
 *   dying    -> short death animation, then respawn or game over
 *   flag     -> end-of-level flagpole and castle sequence
 *   victory  -> results screen
 *   gameover -> out of lives
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const TILE = BGQ.TILE;
  const T = BGQ.T;
  const E = BGQ.Entities;
  const Input = BGQ.Input;
  const Audio = BGQ.Audio;
  const UI = BGQ.UI;

  const CONFETTI = ['#ffd23f', '#ff5d8f', '#19a68f', '#3a9bff', '#9b4fd0', '#7ee05a', '#ffffff'];
  const FIREWORK = [['#ffd23f', '#fff3b0'], ['#ff5d8f', '#ffd1e0'], ['#3a9bff', '#c9e6ff'], ['#7ee05a', '#e0ffd0']];

  /** All mutable game state lives here (also handy for debugging in the console). */
  const G = (BGQ.game = {
    state: 'title',
    level: null,
    player: null,
    enemies: [],
    platforms: [],
    items: [],
    particles: [],
    popups: [],
    bumps: new Map(),
    cam: { x: 0 },
    viewW: 400,
    animT: 0,
    score: 0,
    coins: 0,
    totalCoins: 0,
    lives: BGQ.START_LIVES,
    time: 0,
    stars: 0,
    checkpoint: null,
    flagY: 0,
    castleFlag: 0,
    finish: null,
    deathT: 0,
    runCount: 0
  });

  let rotateBlocked = false;

  /* ------------------------------------------------------------------ *
   * Setup and flow between screens
   * ------------------------------------------------------------------ */

  function newGame() {
    const L = BGQ.Level.build();
    G.level = L;

    // Brain Gates alternate between multiplication and general knowledge.
    // The starting type flips every run, so across replays exactly half of
    // the challenges are multiplication and half are general knowledge.
    const mathFirst = G.runCount % 2 === 1;
    L.gates.forEach(function (g, i) {
      g.type = (i % 2 === 0) === mathFirst ? 'math' : 'knowledge';
    });

    G.player = E.createPlayer(L.start.x, L.start.y);
    G.enemies = L.enemies.map(E.createEnemy);
    G.platforms = L.platforms;
    G.items = [];
    G.particles = [];
    G.popups = [];
    G.bumps.clear();
    G.score = 0;
    G.coins = 0;
    G.totalCoins = L.coins.length;
    L.contents.forEach(function (v) { if (v === 'coin') G.totalCoins++; });
    G.lives = BGQ.START_LIVES;
    G.time = 0;
    G.stars = 0;
    G.checkpoint = null;
    G.flagY = L.flag.top + 4;
    G.castleFlag = 0;
    G.finish = null;
    G.cam.x = 0;
    UI.resetHud();
  }

  function startPlaying() {
    G.state = 'playing';
    UI.hideScreens();
    UI.setPlaying(true);
    Input.capture = true;
    Input.releaseAll();
    Audio.suspend(false);
    Audio.startMusic();
  }

  function play() {
    G.runCount++;
    newGame();
    startPlaying();
    UI.toast('Reach the castle — unlock 3 Brain Gates on the way!');
  }

  function restart() {
    Audio.stopMusic();
    play();
  }

  function pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    Input.capture = false;
    Input.releaseAll();
    Audio.play('pause');
    Audio.suspend(true);
    UI.showScreen('pause');
  }

  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'playing';
    UI.hideScreens();
    Input.capture = true;
    Input.releaseAll();
    Audio.suspend(false);
  }

  function togglePause() {
    if (G.state === 'playing') pause();
    else if (G.state === 'paused') resume();
  }

  function toggleMute() {
    Audio.toggleMuted();
    UI.updateMute();
  }

  function continueAfterGameOver() {
    G.lives = BGQ.START_LIVES;
    UI.hideScreens();
    UI.setPlaying(true);
    respawn();
  }

  function gameOver() {
    G.state = 'gameover';
    Input.capture = false;
    UI.setPlaying(false);
    UI.showGameOver(G);
  }

  function victory() {
    G.state = 'victory';
    Input.capture = false;
    UI.setPlaying(false);
    const best = BGQ.storage.get('best', null);
    const isBest = !best || G.score > best.score;
    const record = {
      score: best ? Math.max(best.score, G.score) : G.score,
      time: best && best.time ? Math.min(best.time, G.time) : G.time
    };
    BGQ.storage.set('best', record);
    UI.setBest(record);
    UI.showVictory(G, isBest);
  }

  /* ------------------------------------------------------------------ *
   * Effects
   * ------------------------------------------------------------------ */

  function addParticle(p) {
    if (G.particles.length < 450) G.particles.push(p);
  }

  function popup(text, x, y, color) {
    G.popups.push({ text: text, x: x, y: y, vy: -26, life: 0.9, color: color });
  }

  G.spawnDust = function (x, y, n) {
    for (let i = 0; i < n; i++) {
      addParticle({ x: x + BGQ.rand(-4, 4), y: y - 2, vx: BGQ.rand(-30, 30), vy: BGQ.rand(-40, -10), gravity: 0, life: 0.35, maxLife: 0.35, size: 2, color: '#f4ead8' });
    }
  };

  function sparkle(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addParticle({ x: x, y: y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, gravity: 0, life: 0.3, maxLife: 0.3, size: 1, color: '#fff3b0' });
    }
  }

  function confetti(x, y, n) {
    for (let i = 0; i < n; i++) {
      addParticle({ x: x, y: y, vx: BGQ.rand(-100, 100), vy: BGQ.rand(-230, -60), gravity: 320, life: 1.8, maxLife: 1.8, size: 2, color: CONFETTI[i % CONFETTI.length] });
    }
  }

  function firework(x, y) {
    const colors = FIREWORK[BGQ.randInt(0, FIREWORK.length - 1)];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const s = BGQ.rand(40, 110);
      addParticle({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 70, life: 1.3, maxLife: 1.3, size: 2, color: colors[i % 2] });
    }
    Audio.play('firework');
  }

  function updateParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (let i = G.popups.length - 1; i >= 0; i--) {
      const p = G.popups[i];
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) G.popups.splice(i, 1);
    }
    G.bumps.forEach(function (b, key) {
      b.t += dt;
      if (b.t >= b.dur) G.bumps.delete(key);
    });
  }

  /* ------------------------------------------------------------------ *
   * Scoring and pickups
   * ------------------------------------------------------------------ */

  function addCoin(x, y) {
    G.coins++;
    G.score += BGQ.SCORE.coin;
    Audio.play('coin');
    sparkle(x, y);
    if (G.coins % 50 === 0) {
      G.lives++;
      Audio.play('oneUp');
      UI.toast('50 coins — extra life!');
    }
  }

  function collectCoins() {
    const p = G.player;
    G.level.coins.forEach(function (c) {
      if (!c.taken && BGQ.overlap(p, c)) {
        c.taken = true;
        addCoin(c.x + 5, c.y + 7);
      }
    });
  }

  /** Called by the physics when the player's head hits a block. */
  G.bumpBlock = function (c, r) {
    const L = G.level;
    const idx = r * L.cols + c;
    const t = L.tiles[idx];
    const x = c * TILE;
    const y = r * TILE;

    if (t === T.QUESTION) {
      L.tiles[idx] = T.USED;
      G.bumps.set(idx, { t: 0, dur: 0.2 });
      const content = L.contents.get(idx) || 'coin';
      if (content === 'heart') {
        G.items.push({ type: 'heart', x: x, baseY: y, emerge: 0 });
        Audio.play('item');
      } else {
        G.items.push({ type: 'popcoin', x: x, y: y - 16, vy: -280, t: 0 });
        addCoin(x + 8, y - 8);
      }
    } else if (t === T.BRICK) {
      L.tiles[idx] = T.EMPTY;
      G.score += BGQ.SCORE.brick;
      Audio.play('brick');
      [[-1, -1], [1, -1], [-1, -0.6], [1, -0.6]].forEach(function (d, i) {
        addParticle({ x: x + (i % 2) * 8 + 2, y: y + (i < 2 ? 0 : 8), vx: d[0] * 70, vy: d[1] * 280, gravity: 900, life: 1.2, maxLife: 1.2, size: 4, color: i % 2 ? '#d2642c' : '#f29a62' });
      });
    } else {
      G.bumps.set(idx, { t: 0, dur: 0.12 });
      Audio.play('bump');
    }

    // Anything standing on the bumped block gets knocked upward.
    const above = { x: x, y: y - 16, w: 16, h: 16 };
    G.enemies.forEach(function (e) {
      if (e.alive && e.active && BGQ.overlap(e, above)) {
        e.alive = false;
        e.flipped = true;
        e.vy = -220;
        e.vx = e.x < x ? -40 : 40;
        G.score += BGQ.SCORE.stomp;
        popup(String(BGQ.SCORE.stomp), e.x + 7, e.y);
        Audio.play('stomp');
      }
    });
    L.coins.forEach(function (coin) {
      if (!coin.taken && BGQ.overlap(coin, above)) {
        coin.taken = true;
        addCoin(coin.x + 5, coin.y + 7);
      }
    });
  };

  function updateItems(dt) {
    const p = G.player;
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i];
      if (it.type === 'popcoin') {
        it.t += dt;
        it.vy += 900 * dt;
        it.y += it.vy * dt;
        if (it.t > 0.45) {
          popup(String(BGQ.SCORE.coin), it.x + 8, it.y + 4);
          G.items.splice(i, 1);
        }
      } else if (it.type === 'heart') {
        it.emerge = Math.min(1, it.emerge + dt * 2);
        const box = { x: it.x + 2, y: it.baseY - 15, w: 12, h: 12 };
        if (it.emerge >= 1 && BGQ.overlap(p, box)) {
          G.lives++;
          G.score += BGQ.SCORE.heart;
          popup('1UP', it.x + 8, it.baseY - 12, '#ff8fab');
          Audio.play('oneUp');
          UI.toast('Extra life!');
          G.items.splice(i, 1);
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Hazards, enemies and death
   * ------------------------------------------------------------------ */

  function checkHazards() {
    const p = G.player;
    const L = G.level;
    if (p.y > L.height + 8) {
      killPlayer(true);
      return;
    }

    // Spikes: only the pointy upper part of the tile hurts.
    const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w - 0.01) / TILE);
    const r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (BGQ.Physics.tileAt(L, c, r) === T.SPIKES && BGQ.overlap(p, { x: c * TILE + 2, y: r * TILE + 8, w: 12, h: 8 })) {
          killPlayer(false);
          return;
        }
      }
    }

    for (let i = 0; i < G.enemies.length; i++) {
      const e = G.enemies[i];
      if (!e.alive || !e.active || !BGQ.overlap(p, e)) continue;
      const feetAboveHead = p.y + p.h - e.y < 9;
      if (p.vy > 0 && feetAboveHead) {
        e.alive = false;
        e.squish = 0.45;
        p.vy = -(Input.jumpHeld() ? BGQ.PHYS.stompBounceHold : BGQ.PHYS.stompBounce);
        p.onGround = false;
        p.stompChain = Math.min(p.stompChain + 1, 8);
        const pts = BGQ.SCORE.stomp * p.stompChain;
        G.score += pts;
        popup(String(pts), e.x + 7, e.y - 4);
        Audio.play('stomp');
        G.spawnDust(e.x + 7, e.y + e.h, 5);
      } else if (p.invuln <= 0) {
        killPlayer(false);
        return;
      }
    }
  }

  function killPlayer(fell) {
    if (G.state !== 'playing') return;
    const p = G.player;
    G.state = 'dying';
    G.deathT = 0;
    p.dead = true;
    p.fell = fell;
    p.vx = 0;
    p.vy = fell ? 0 : -300;
    Input.releaseAll();
    Audio.stopMusic();
    Audio.play('die');
  }

  function updateDeath(dt) {
    const p = G.player;
    G.deathT += dt;
    if (!p.fell && G.deathT > 0.45) {
      p.vy += 1100 * dt;
      p.y += p.vy * dt;
      p.rot += dt * 9 * p.facing;
    }
    if (G.deathT > (p.fell ? 1.4 : 2.3)) {
      G.lives--;
      if (G.lives <= 0) gameOver();
      else respawn();
    }
  }

  /** Puts the player back at the start or just past the last unlocked gate. */
  function respawn() {
    const L = G.level;
    const x = G.checkpoint ? G.checkpoint.x + 22 : L.start.x;
    G.player = E.createPlayer(x, BGQ.GROUND_ROW * TILE - 15);
    G.player.invuln = BGQ.INVULN_TIME;
    G.player.onGround = true;
    G.enemies.forEach(function (e) { if (e.alive) E.resetEnemy(e); });
    G.items = G.items.filter(function (it) { return it.type === 'heart'; });
    snapCamera();
    G.state = 'playing';
    Input.capture = true;
    Input.releaseAll();
    Audio.startMusic();
    if (G.checkpoint) UI.toast('Back at Brain Gate ' + (G.checkpoint.index + 1) + '!');
  }

  /* ------------------------------------------------------------------ *
   * Brain Gates
   * ------------------------------------------------------------------ */

  function checkGates() {
    const p = G.player;
    G.level.gates.forEach(function (g) {
      if (g.state === 'closed' && p.x + p.w >= g.box.x - 14 && p.x < g.box.x + g.box.w) openQuiz(g);
    });
  }

  function openQuiz(g) {
    if (G.state !== 'playing') return;
    G.state = 'quiz';
    g.state = 'quiz';
    G.player.vx = 0;
    Input.capture = false;
    Input.releaseAll();
    Audio.play('gateAppear');
    Audio.duck(true);

    UI.showQuiz(BGQ.Questions.make(g.type), g.index + 1, G.level.gates.length, {
      onCorrect: function (firstTry) {
        const pts = firstTry ? BGQ.SCORE.gateFirstTry : BGQ.SCORE.gateRetry;
        G.score += pts;
        if (firstTry) G.stars++;
        g.points = pts;
      },
      onContinue: function () {
        g.state = 'opening';
        g.cheer = 1.8;
        G.checkpoint = g;
        popup('+' + g.points, g.x + 8, 4 * TILE - 24, '#ffd23f');
        confetti(g.x + 8, 4 * TILE - 10, 60);
        Audio.duck(false);
        Audio.play('gateOpen');
        G.state = 'playing';
        Input.capture = true;
        Input.releaseAll();
        UI.toast('Gate unlocked! Checkpoint saved.');
      }
    });
  }

  function updateGates(dt) {
    G.level.gates.forEach(function (g) {
      if (g.state === 'opening') {
        g.open = Math.min(1, g.open + dt / 1.1);
        if (g.open >= 1) g.state = 'open';
      }
      if (g.cheer > 0) g.cheer = Math.max(0, g.cheer - dt);
    });
  }

  /* ------------------------------------------------------------------ *
   * Flagpole and castle finale
   * ------------------------------------------------------------------ */

  function checkFlag() {
    const p = G.player;
    const f = G.level.flag;
    if (p.x + p.w >= f.col * TILE - 0.5) startFinish();
  }

  function startFinish() {
    const p = G.player;
    const f = G.level.flag;
    G.state = 'flag';
    p.x = f.x - p.w + 1;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.frame = 'jump';
    p.platform = null;

    // Grabbing higher on the pole earns more points.
    const height = BGQ.clamp((f.bottom - (p.y + p.h)) / (f.bottom - f.top), 0, 1);
    const pts = height > 0.9 ? 5000 : height > 0.65 ? 2000 : height > 0.4 ? 800 : height > 0.15 ? 400 : 100;
    G.score += pts;
    popup(String(pts), f.x + 12, Math.max(20, p.y), '#ffd23f');

    Input.releaseAll();
    Audio.stopMusic();
    Audio.play('flag');
    G.finish = { phase: 'slide', t: 0, fireworks: 0 };
  }

  function updateFinish(dt) {
    const fin = G.finish;
    const p = G.player;
    const f = G.level.flag;
    const castle = G.level.castle;
    fin.t += dt;

    if (fin.phase === 'slide') {
      p.y = Math.min(p.y + 130 * dt, f.bottom - p.h);
      G.flagY = Math.min(G.flagY + 130 * dt, f.bottom - 12);
      if (p.y >= f.bottom - p.h && G.flagY >= f.bottom - 12) {
        fin.phase = 'turn';
        fin.t = 0;
        p.x = f.x + 1;
        p.facing = -1;
        p.frame = 'idle';
      }
    } else if (fin.phase === 'turn') {
      if (fin.t > 0.4) {
        fin.phase = 'walk';
        p.facing = 1;
      }
    } else if (fin.phase === 'walk') {
      E.updatePlayer(G, p, dt, { left: false, right: true, jumpHeld: false, jumpPressed: false });
      p.vx = Math.min(p.vx, 70);
      if (p.x + p.w / 2 >= castle.doorX) {
        fin.phase = 'enter';
        fin.t = 0;
        p.hidden = true;
        Audio.play('victory');
      }
    } else if (fin.phase === 'enter') {
      G.castleFlag = Math.min(1, fin.t / 1.2);
      if (fin.fireworks < 3 && fin.t > 0.7 + fin.fireworks * 0.6) {
        firework(castle.x + BGQ.rand(-20, 100), BGQ.rand(30, 80));
        fin.fireworks++;
      }
      if (fin.t > 3.4) victory();
    }
  }

  /* ------------------------------------------------------------------ *
   * Camera
   * ------------------------------------------------------------------ */

  function clampCamera() {
    G.cam.x = BGQ.clamp(G.cam.x, 0, Math.max(0, G.level.width - G.viewW));
  }

  /** Keeps the player inside a dead zone, slightly left of center. */
  function updateCamera() {
    const center = G.player.x + G.player.w / 2;
    const leftEdge = G.cam.x + G.viewW * 0.33;
    const rightEdge = G.cam.x + G.viewW * 0.45;
    if (center > rightEdge) G.cam.x = center - G.viewW * 0.45;
    else if (center < leftEdge) G.cam.x = center - G.viewW * 0.33;
    clampCamera();
  }

  function snapCamera() {
    G.cam.x = G.player.x + G.player.w / 2 - G.viewW * 0.4;
    clampCamera();
  }

  /* ------------------------------------------------------------------ *
   * Main update
   * ------------------------------------------------------------------ */

  function update(dt) {
    G.animT += dt;

    switch (G.state) {
      case 'title':
        // Attract mode: slowly pan across the level behind the title screen.
        G.cam.x = (G.animT * 24) % Math.max(1, G.level.width - G.viewW);
        break;

      case 'playing': {
        G.time += dt;
        G.platforms.forEach(function (m) {
          const before = m.x;
          m.x += m.speed * m.dir * dt;
          if (m.x > m.maxX) { m.x = m.maxX; m.dir = -1; }
          if (m.x < m.minX) { m.x = m.minX; m.dir = 1; }
          m.dx = m.x - before;
        });
        E.updatePlayer(G, G.player, dt, {
          left: Input.left(),
          right: Input.right(),
          jumpHeld: Input.jumpHeld(),
          jumpPressed: Input.consumeJump()
        });
        E.updateEnemies(G, dt);
        updateItems(dt);
        collectCoins();
        checkHazards();
        if (G.state === 'playing') checkGates();
        if (G.state === 'playing') checkFlag();
        updateCamera();
        break;
      }

      case 'dying':
        updateDeath(dt);
        break;

      case 'flag':
        updateFinish(dt);
        updateCamera();
        break;

      default:
        break; // quiz, paused, victory and game over freeze the world
    }

    updateGates(dt);
    updateParticles(dt);
  }

  /* ------------------------------------------------------------------ *
   * Responsive scaling
   * ------------------------------------------------------------------ */

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');

  /**
   * Fits the game to the window: the view is always 15 tiles tall and as
   * wide as the screen's aspect ratio allows (within limits), then scaled
   * up uniformly so it fills the screen without stretching.
   */
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let viewW = Math.round(BGQ.VIEW_H * (w / h));
    viewW = BGQ.clamp(viewW, BGQ.VIEW_MIN_W, BGQ.VIEW_MAX_W);
    viewW -= viewW % 2;
    if (viewW !== G.viewW || canvas.width !== viewW) {
      G.viewW = viewW;
      BGQ.Renderer.resize(viewW);
    }
    const scale = Math.min(w / viewW, h / BGQ.VIEW_H);
    stage.style.width = Math.floor(viewW * scale) + 'px';
    stage.style.height = Math.floor(BGQ.VIEW_H * scale) + 'px';
    document.documentElement.style.setProperty('--scale', scale.toFixed(3));
    if (G.level) clampCamera();
    rotateBlocked = UI.checkOrientation();
    if (rotateBlocked) Input.releaseAll();
  }

  /* ------------------------------------------------------------------ *
   * Main loop: fixed 60 Hz physics, render every animation frame.
   * ------------------------------------------------------------------ */

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // avoid a huge catch-up after a stall

    if (!rotateBlocked && G.state !== 'paused') {
      acc += dt;
      let steps = 0;
      while (acc >= BGQ.STEP && steps < 8) {
        update(BGQ.STEP);
        acc -= BGQ.STEP;
        steps++;
      }
      if (steps === 8) acc = 0;
    } else {
      acc = 0;
    }

    BGQ.Renderer.draw(G);
    if (G.state !== 'title') UI.updateHud(G);
    window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    BGQ.Sprites.build();
    BGQ.Renderer.init(canvas);
    Input.init();
    UI.init({
      onPlay: play,
      onResume: resume,
      onRestart: restart,
      onContinue: continueAfterGameOver,
      onPause: togglePause,
      onMute: toggleMute
    });
    Input.onPause = togglePause;
    Input.onMute = toggleMute;
    UI.setBest(BGQ.storage.get('best', null));

    newGame();
    G.state = 'title';
    layout();
    UI.showScreen('title');

    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () {
      layout();
      // Some phones report the new size a moment after rotating.
      window.setTimeout(layout, 300);
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
    document.addEventListener('fullscreenchange', layout);

    // Pause automatically when the tab is hidden or the app is switched away.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (G.state === 'playing') pause();
        Audio.suspend(true);
      } else if (G.state !== 'paused') {
        Audio.suspend(false);
      }
    });

    // Stop page scrolling / pinch-zoom gestures from fighting the game,
    // while still letting tall menus scroll on very small screens.
    document.addEventListener('touchmove', function (e) {
      if (!e.target.closest('.scrollable')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });

    window.requestAnimationFrame(function (t) {
      last = t;
      window.requestAnimationFrame(frame);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
