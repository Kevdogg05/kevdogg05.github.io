/**
 * Brain Gate Quest — drawing the world onto the canvas.
 *
 * The canvas is exactly one "game pixel" per canvas pixel; CSS scales it
 * up with nearest-neighbour filtering. All positions are rounded to whole
 * pixels so the pixel art stays sharp while the camera scrolls. Tiles and
 * scenery come from the current world's themed art (G.art).
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;
  const TILE = BGQ.TILE;
  const T = BGQ.T;

  let canvas = null;
  let ctx = null;
  let S = null; // BGQ.Sprites (characters, items, shared tiles)
  let skyBands = [];
  let skyKey = '';

  // Fixed star field used by night skies and caves (x within a 640px strip).
  const STARS = [];
  for (let i = 0; i < 70; i++) {
    STARS.push({ x: (i * 173) % 640, y: (i * 97) % 150 + 4, phase: (i * 1.7) % 6.28, big: i % 9 === 0 });
  }

  /** Builds the banded retro sky gradient for the current theme. */
  function buildSky(sky) {
    const bands = 10;
    skyBands = [];
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = sky.top.map(function (v, k) { return Math.round(v + (sky.bottom[k] - v) * t); });
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
    const theme = G.level.theme;
    const sky = theme.sky;
    if (skyKey !== theme.key) {
      buildSky(sky);
      skyKey = theme.key;
    }
    const viewW = G.viewW;
    const bandH = Math.ceil(BGQ.VIEW_H / skyBands.length);
    for (let i = 0; i < skyBands.length; i++) {
      ctx.fillStyle = skyBands[i];
      ctx.fillRect(0, i * bandH, viewW, bandH);
    }

    if (sky.stars) {
      const off = Math.floor(G.cam.x * 0.05);
      STARS.forEach(function (s) {
        const twinkle = Math.sin(G.animT * 2 + s.phase) > -0.3;
        if (!twinkle) return;
        let x = (s.x - off) % 640;
        if (x < 0) x += 640;
        if (x > viewW) return;
        ctx.fillStyle = theme.ceiling ? '#b9a6ff' : '#ffffff';
        ctx.fillRect(x, s.y, s.big ? 2 : 1, s.big ? 2 : 1);
      });
    }
    if (sky.moon) {
      const mx = Math.round(viewW * 0.78);
      S.pixelEllipse(ctx, '#fff6d8', mx, 40, 12, 12);
      S.pixelEllipse(ctx, '#e8dcb0', mx + 4, 44, 3, 3);
      S.pixelEllipse(ctx, '#e8dcb0', mx - 4, 36, 2, 2);
    }

    if (G.art.clouds) drawStrip(G.art.clouds, G.cam.x + G.animT * 6, 0.2, 6, viewW);
    drawStrip(G.art.mountains, G.cam.x, 0.15, 0, viewW);
    drawStrip(G.art.hills, G.cam.x, 0.4, 0, viewW);

    if (sky.embers) {
      // Glowing embers drifting up from the volcano.
      for (let i = 0; i < 26; i++) {
        const speed = 14 + (i % 5) * 6;
        const y = BGQ.VIEW_H - ((G.animT * speed + i * 53) % (BGQ.VIEW_H + 20));
        const x = ((i * 89 - G.cam.x * 0.3) % viewW + viewW) % viewW + Math.sin(G.animT + i) * 4;
        ctx.fillStyle = i % 3 ? '#ff9a3a' : '#ffd23f';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }

  function drawDecor(G) {
    const ground = BGQ.GROUND_ROW * TILE;
    G.level.decor.forEach(function (d) {
      if (d.x > G.cam.x + G.viewW + 64 || d.x < G.cam.x - 80) return;
      const img = d.type === 'sign' ? S.sign : G.art.decor[d.type];
      if (img) ctx.drawImage(img, d.x, ground - img.height);
    });
  }

  /** Bottomless pits: a dark chasm, or bubbling lava in the volcano world. */
  function drawPits(G) {
    const L = G.level;
    const top = BGQ.GROUND_ROW * TILE;
    const c0 = Math.max(0, Math.floor(G.cam.x / TILE) - 1);
    const c1 = Math.min(L.cols - 1, Math.floor((G.cam.x + G.viewW) / TILE) + 1);
    for (let c = c0; c <= c1; c++) {
      if (BGQ.Physics.tileAt(L, c, BGQ.GROUND_ROW) !== T.EMPTY) continue;
      const x = c * TILE;
      if (L.lava) {
        const surface = top + 10;
        ctx.fillStyle = '#c42a10';
        ctx.fillRect(x, surface, TILE, BGQ.VIEW_H - surface);
        ctx.fillStyle = '#ff6a1a';
        for (let i = 0; i < TILE; i += 2) {
          const wave = Math.round(Math.sin(G.animT * 3 + (x + i) * 0.35) * 1.5);
          ctx.fillRect(x + i, surface + wave - 1, 2, 4);
        }
        ctx.fillStyle = '#ffd23f';
        for (let i = 0; i < TILE; i += 4) {
          const wave = Math.round(Math.sin(G.animT * 3 + (x + i) * 0.35) * 1.5);
          ctx.fillRect(x + i, surface + wave - 1, 2, 1);
        }
        // Occasional bubbles
        const bubble = (G.animT * 1.3 + c * 0.37) % 1;
        if (bubble < 0.3 && c % 2 === 0) {
          ctx.fillStyle = '#ffb03a';
          ctx.fillRect(x + 6, surface + 6 - Math.round(bubble * 20), 2, 2);
        }
      } else {
        ctx.fillStyle = '#3b3f7a';
        ctx.fillRect(x, top, TILE, 4);
        ctx.fillStyle = '#2b2f63';
        ctx.fillRect(x, top + 4, TILE, 4);
        ctx.fillStyle = '#1b1d3a';
        ctx.fillRect(x, top + 8, TILE, BGQ.VIEW_H - top - 8);
      }
    }
  }

  function drawTiles(G) {
    const L = G.level;
    const art = G.art.tiles;
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
            // Grass/snow/sand only grows where open air is above (cave roofs are all rock).
            const covered = r === 0 || BGQ.Physics.tileAt(L, c, r - 1) === T.GROUND;
            ctx.drawImage(covered ? art.ground : art.groundTop, x, y);
            break;
          }
          case T.BRICK: ctx.drawImage(art.brick, x, y); break;
          case T.QUESTION: ctx.drawImage(S.tiles.question[qFrame], x, y); break;
          case T.USED: ctx.drawImage(S.tiles.used, x, y); break;
          case T.HARD: ctx.drawImage(art.hard, x, y); break;
          case T.PIPE_TL: ctx.drawImage(S.tiles.pipeTop, x, y); break;
          case T.PIPE_L: ctx.drawImage(S.tiles.pipeBody, x, y); break;
          case T.SPIKES: ctx.drawImage(S.tiles.spikes, x, y); break;
          default: break; // right halves of pipes are drawn with the left half
        }
      }
    }

    // Stalactites hang from cave roofs for extra atmosphere.
    if (L.theme.ceiling) {
      ctx.fillStyle = L.theme.ground.dirtDark;
      for (let c = c0; c <= c1; c++) {
        if ((c * 7) % 5 !== 0) continue;
        const len = 3 + ((c * 13) % 6);
        for (let i = 0; i < len; i++) ctx.fillRect(c * TILE + 6 + Math.floor(i / 2), 2 * TILE + i, Math.max(1, 4 - i), 1);
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
      if (x > G.cam.x + G.viewW || x + m.w < G.cam.x) return;
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(x, y, m.w, m.h);
      ctx.fillStyle = m.axis === 'y' ? '#7ec8e3' : '#e8a050';
      ctx.fillRect(x + 1, y + 1, m.w - 2, m.h - 3);
      ctx.fillStyle = m.axis === 'y' ? '#d2f2ff' : '#ffd08a';
      ctx.fillRect(x + 1, y + 1, m.w - 2, 1);
      ctx.fillStyle = m.axis === 'y' ? '#3f8fb0' : '#b06a28';
      for (let i = 8; i < m.w; i += 10) ctx.fillRect(x + i, y + 2, 1, m.h - 4);
      const spin = Math.floor(G.animT * 12) % 2;
      ctx.fillStyle = '#ffffff';
      if (m.axis === 'y') {
        // Elevators show up/down arrows.
        ctx.fillRect(x + 22, y + 2, 4, 1);
        ctx.fillRect(x + 23, y + 1, 2, 1);
        ctx.fillRect(x + 22, y + m.h - 3, 4, 1);
        ctx.fillRect(x + 23, y + m.h - 2, 2, 1);
      } else {
        // Propellers show that the platform moves sideways.
        ctx.fillRect(x - 2 - spin, y + m.h, 4 + spin * 2, 1);
        ctx.fillRect(x + m.w - 2 - spin, y + m.h, 4 + spin * 2, 1);
      }
    });
  }

  function drawSprings(G) {
    G.springs.forEach(function (s) {
      if (s.x > G.cam.x + G.viewW || s.x < G.cam.x - 16) return;
      ctx.drawImage(S.spring[s.squash > 0 ? 1 : 0], s.x, s.y);
    });
  }

  function drawEnemies(G) {
    G.enemies.forEach(function (e) {
      if (e.gone) return;
      if (e.x > G.cam.x + G.viewW + 16 || e.x < G.cam.x - 32) return;
      const x = Math.round(e.x - 1);
      const y = Math.round(e.y - (e.type === 'flyer' ? 4 : 3));
      const frame = Math.floor(e.anim) % 2;
      let img;
      if (e.type === 'flyer') img = (e.vx > 0 ? S.buzz.right : S.buzz.left)[frame];
      else if (e.type === 'spiky') img = (e.vx > 0 ? S.spiky.right : S.spiky.left)[frame];
      else img = S.blob[frame];

      if (!e.alive && !e.flipped) {
        ctx.drawImage(S.blobSquished, x, y);
      } else if (e.flipped) {
        ctx.save();
        ctx.translate(x, y + 16);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y);
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

      const near = Math.abs(G.player.x - g.x) < 7 * TILE;
      if ((g.state === 'closed' && near) || g.state === 'quiz') {
        const bob = Math.round(Math.sin(G.animT * 5) * 1.5);
        ctx.drawImage(S.bubble, g.x + 12, oy - 14 + bob);
      }
    });
  }

  function drawFlag(G) {
    const f = G.level.flag;
    if (f.x > G.cam.x + G.viewW + 32 || f.x < G.cam.x - 32) return;
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
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.life / p.maxLife) * 2));
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
      drawPits(G);
      drawDecor(G);
      drawCastle(G);
      drawFlag(G);
      drawItems(G);      // items emerge from behind their block
      drawTiles(G);
      drawSprings(G);
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
