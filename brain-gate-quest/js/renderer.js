/**
 * Brain Gate Quest — drawing the world onto the canvas.
 *
 * The canvas is exactly one "game pixel" per canvas pixel; CSS scales it
 * up with nearest-neighbour filtering. All positions are rounded to whole
 * pixels so the pixel art stays sharp while the camera scrolls.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const TILE = BGQ.TILE;
  const T = BGQ.T;

  let canvas = null;
  let ctx = null;
  let S = null; // BGQ.Sprites
  let skyBands = [];

  /** Precomputes the banded retro sky gradient. */
  function buildSky() {
    const top = [58, 145, 255];
    const bottom = [176, 226, 255];
    const bands = 10;
    skyBands = [];
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = top.map(function (v, k) { return Math.round(v + (bottom[k] - v) * t); });
      skyBands.push('rgb(' + c.join(',') + ')');
    }
  }

  /** Draws a horizontally repeating strip with a parallax factor. */
  function drawStrip(img, camX, factor, y, viewW) {
    const w = img.width;
    let x = -Math.floor((camX * factor) % w);
    if (x > 0) x -= w;
    for (; x < viewW; x += w) ctx.drawImage(img, x, y);
  }

  function drawBackground(G) {
    const viewW = G.viewW;
    const bandH = Math.ceil(BGQ.VIEW_H / skyBands.length);
    for (let i = 0; i < skyBands.length; i++) {
      ctx.fillStyle = skyBands[i];
      ctx.fillRect(0, i * bandH, viewW, bandH);
    }
    // Drifting clouds move a little on their own as well as with the camera.
    drawStrip(S.clouds, G.cam.x + G.animT * 6, 0.2, 6, viewW);
    drawStrip(S.mountains, G.cam.x, 0.15, 0, viewW);
    drawStrip(S.hills, G.cam.x, 0.4, 0, viewW);
  }

  function drawDecor(G) {
    const ground = BGQ.GROUND_ROW * TILE;
    G.level.decor.forEach(function (d) {
      if (d.x > G.cam.x + G.viewW + 64 || d.x < G.cam.x - 80) return;
      let img = null;
      if (d.type === 'bushSmall') img = S.bushes.small;
      else if (d.type === 'bushMedium') img = S.bushes.medium;
      else if (d.type === 'bushLarge') img = S.bushes.large;
      else if (d.type === 'sign') img = S.sign;
      if (img) ctx.drawImage(img, d.x, ground - img.height);
    });
  }

  /** Darkens the bottom of bottomless pits so they clearly read as danger. */
  function drawChasms(G) {
    const L = G.level;
    const top = BGQ.GROUND_ROW * TILE;
    const c0 = Math.max(0, Math.floor(G.cam.x / TILE) - 1);
    const c1 = Math.min(L.cols - 1, Math.floor((G.cam.x + G.viewW) / TILE) + 1);
    for (let c = c0; c <= c1; c++) {
      if (BGQ.Physics.tileAt(L, c, BGQ.GROUND_ROW) !== T.EMPTY) continue;
      const x = c * TILE;
      ctx.fillStyle = '#2b2f63';
      ctx.fillRect(x, top + 4, TILE, 4);
      ctx.fillStyle = '#1b1d3a';
      ctx.fillRect(x, top + 8, TILE, BGQ.VIEW_H - top - 8);
      ctx.fillStyle = '#3b3f7a';
      ctx.fillRect(x, top, TILE, 4);
    }
  }

  function drawTiles(G) {
    const L = G.level;
    const c0 = Math.max(0, Math.floor(G.cam.x / TILE) - 1);
    const c1 = Math.min(L.cols - 1, Math.floor((G.cam.x + G.viewW) / TILE) + 1);
    const qFrame = [0, 0, 1, 2, 1][Math.floor(G.animT * 6) % 5];

    for (let r = 0; r < L.rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = L.tiles[r * L.cols + c];
        if (t === T.EMPTY) continue;
        const x = c * TILE;
        let y = r * TILE;
        const bump = G.bumps.get(r * L.cols + c);
        if (bump) y -= Math.round(Math.sin((bump.t / bump.dur) * Math.PI) * 5);

        switch (t) {
          case T.GROUND: {
            const above = BGQ.Physics.tileAt(L, c, r - 1);
            ctx.drawImage(above === T.GROUND ? S.tiles.ground : S.tiles.groundTop, x, y);
            break;
          }
          case T.BRICK: ctx.drawImage(S.tiles.brick, x, y); break;
          case T.QUESTION: ctx.drawImage(S.tiles.question[qFrame], x, y); break;
          case T.USED: ctx.drawImage(S.tiles.used, x, y); break;
          case T.HARD: ctx.drawImage(S.tiles.hard, x, y); break;
          case T.PIPE_TL: ctx.drawImage(S.tiles.pipeTop, x, y); break;
          case T.PIPE_L: ctx.drawImage(S.tiles.pipeBody, x, y); break;
          case T.SPIKES: ctx.drawImage(S.tiles.spikes, x, y); break;
          default: break; // right halves of pipes are drawn with the left half
        }
      }
    }
  }

  function drawCoins(G) {
    const frame = Math.floor(G.animT * 8) % S.coin.length;
    G.level.coins.forEach(function (c) {
      if (c.taken || c.x > G.cam.x + G.viewW || c.x < G.cam.x - 16) return;
      ctx.drawImage(S.coin[frame], c.x - 3, c.y - 1);
    });
  }

  function drawItems(G) {
    G.items.forEach(function (it) {
      if (it.type === 'popcoin') {
        const frame = Math.floor(it.t * 20) % S.coin.length;
        ctx.drawImage(S.coin[frame], Math.round(it.x), Math.round(it.y));
      } else if (it.type === 'heart') {
        const bob = it.emerge >= 1 ? Math.round(Math.sin(G.animT * 4) * 2) : 0;
        const h = Math.round(16 * Math.min(1, it.emerge));
        // While emerging, only the part above the block is visible.
        ctx.drawImage(S.heart, 0, 0, 16, h, Math.round(it.x), Math.round(it.baseY - h + bob), 16, h);
      }
    });
  }

  function drawPlatforms(G) {
    G.platforms.forEach(function (m) {
      const x = Math.round(m.x), y = Math.round(m.y);
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(x, y, m.w, m.h);
      ctx.fillStyle = '#e8a050';
      ctx.fillRect(x + 1, y + 1, m.w - 2, m.h - 3);
      ctx.fillStyle = '#ffd08a';
      ctx.fillRect(x + 1, y + 1, m.w - 2, 1);
      ctx.fillStyle = '#b06a28';
      for (let i = 8; i < m.w; i += 10) ctx.fillRect(x + i, y + 2, 1, m.h - 4);
      // Little propellers on each end show that the platform moves.
      const spin = Math.floor(G.animT * 12) % 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2 - spin, y + m.h, 4 + spin * 2, 1);
      ctx.fillRect(x + m.w - 2 - spin, y + m.h, 4 + spin * 2, 1);
    });
  }

  function drawEnemies(G) {
    G.enemies.forEach(function (e) {
      if (e.gone) return;
      if (e.x > G.cam.x + G.viewW + 16 || e.x < G.cam.x - 32) return;
      const x = Math.round(e.x - 1);
      const y = Math.round(e.y - 3);
      if (!e.alive && !e.flipped) {
        ctx.drawImage(S.blobSquished, x, y);
      } else if (e.flipped) {
        ctx.save();
        ctx.translate(x, y + 16);
        ctx.scale(1, -1);
        ctx.drawImage(S.blob[0], 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(S.blob[Math.floor(e.anim) % 2], x, y);
      }
    });
  }

  function drawPlayer(G) {
    const p = G.player;
    if (p.hidden) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    const set = p.facing < 0 ? S.pip.left : S.pip.right;
    const img = set[p.frame] || set.idle;
    const x = Math.round(p.x - 2);
    const y = Math.round(p.y - 1);
    if (p.dead) {
      ctx.save();
      ctx.translate(x + 8, y + 8);
      ctx.rotate(p.rot);
      ctx.drawImage(set.jump, -8, -8);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y);
    }
  }

  /** Brain Gates: iron bars below a stone cap, with the owl on top. */
  function drawGates(G) {
    const ground = BGQ.GROUND_ROW * TILE;
    const capBottom = 5 * TILE;
    G.level.gates.forEach(function (g) {
      if (g.x > G.cam.x + G.viewW + 32 || g.x < G.cam.x - 48) return;

      // Bars (slide up into the cap while opening)
      if (g.state !== 'open') {
        const lift = Math.round((ground - capBottom) * easeInOut(g.open));
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.x, capBottom, TILE, ground - capBottom);
        ctx.clip();
        const top = capBottom - lift;
        const h = ground - capBottom;
        for (let i = 0; i < 4; i++) {
          const bx = g.x + 2 + i * 4;
          ctx.fillStyle = '#2b2f3a';
          ctx.fillRect(bx, top, 2, h);
          ctx.fillStyle = '#8d95a8';
          ctx.fillRect(bx, top, 1, h);
          // Pointed bar tips
          ctx.fillStyle = '#2b2f3a';
          ctx.fillRect(bx, top + h, 2, 1);
        }
        for (let yy = 12; yy < h; yy += 34) {
          ctx.fillStyle = '#2b2f3a';
          ctx.fillRect(g.x + 1, top + yy, 14, 3);
          ctx.fillStyle = '#8d95a8';
          ctx.fillRect(g.x + 1, top + yy, 14, 1);
        }
        // Golden lock with the gate number
        const ly = top + Math.round(h / 2) - 6;
        ctx.fillStyle = '#7a4a00';
        ctx.fillRect(g.x + 3, ly, 10, 10);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(g.x + 4, ly + 1, 8, 8);
        ctx.fillStyle = '#7a4a00';
        ctx.fillRect(g.x + 5, ly - 4, 1, 4);
        ctx.fillRect(g.x + 10, ly - 4, 1, 4);
        ctx.fillRect(g.x + 5, ly - 5, 6, 1);
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(g.index + 1), g.x + 8, ly + 5);
        ctx.restore();
      }

      // Professor Hoot
      let owlImg = S.owl;
      let ox = g.x;
      let oy = 4 * TILE - 20;
      if (g.cheer > 0) {
        owlImg = S.owlCheer;
        ox -= 2;
        oy -= Math.round(Math.abs(Math.sin(g.cheer * 10)) * 4);
      } else if (Math.floor(G.animT * 10) % 37 === 0) {
        owlImg = S.owlBlink;
      }
      ctx.drawImage(owlImg, ox, oy);

      // Speech bubble with a "?" when the player is getting close
      const near = Math.abs(G.player.x - g.x) < 7 * TILE;
      if ((g.state === 'closed' && near) || g.state === 'quiz') {
        const bob = Math.round(Math.sin(G.animT * 5) * 1.5);
        ctx.drawImage(S.bubble, g.x + 12, oy - 14 + bob);
      }
    });
  }

  function drawFlag(G) {
    const f = G.level.flag;
    // Pole
    ctx.fillStyle = '#4c8a4c';
    ctx.fillRect(f.x, f.top, 2, f.bottom - f.top);
    ctx.fillStyle = '#b8f0a0';
    ctx.fillRect(f.x, f.top, 1, f.bottom - f.top);
    S.pixelEllipse(ctx, '#1f7a2c', f.x + 1, f.top - 3, 4, 4);
    S.pixelEllipse(ctx, '#3fbf4a', f.x + 1, f.top - 3, 3, 3);
    ctx.drawImage(S.flag, f.x - 16, Math.round(G.flagY));
  }

  function drawCastle(G) {
    const c = G.level.castle;
    if (c.x > G.cam.x + G.viewW || c.x + c.w < G.cam.x) return;
    ctx.drawImage(S.castle, c.x, c.y);
    // Victory flag rises from the tower once the player is inside.
    if (G.castleFlag > 0) {
      const poleTop = c.y - 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x + 39, poleTop, 1, 18);
      const fy = Math.round(c.y - 6 - 12 * G.castleFlag);
      ctx.drawImage(S.castleFlag, c.x + 40, fy);
    }
  }

  function drawParticles(G) {
    G.particles.forEach(function (p) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife * 2));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    G.popups.forEach(function (p) {
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.fillStyle = '#1b1d3a';
      ctx.fillText(p.text, x + 1, y + 1);
      ctx.fillStyle = p.color || '#ffffff';
      ctx.fillText(p.text, x, y);
    });
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  BGQ.Renderer = {
    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d', { alpha: false });
      S = BGQ.Sprites;
      buildSky();
    },

    /** Called when the logical view size changes. */
    resize: function (viewW) {
      canvas.width = viewW;
      canvas.height = BGQ.VIEW_H;
      ctx.imageSmoothingEnabled = false;
    },

    draw: function (G) {
      ctx.imageSmoothingEnabled = false;
      drawBackground(G);

      ctx.save();
      ctx.translate(-Math.round(G.cam.x), 0);
      drawChasms(G);
      drawDecor(G);
      drawCastle(G);
      drawFlag(G);
      drawItems(G);      // items emerge from behind their block
      drawTiles(G);
      drawGates(G);
      drawCoins(G);
      drawPlatforms(G);
      drawEnemies(G);
      drawPlayer(G);
      drawParticles(G);
      ctx.restore();
    }
  };
})();
