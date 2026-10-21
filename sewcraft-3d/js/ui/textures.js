// Procedural fabric textures, drawn once per type onto small canvases.
// They are near-white detail maps; the material colour tints them.
import * as THREE from 'three';

const SIZE = 256;
const cache = new Map();

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

function noise(g, r, amount) {
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  g.putImageData(img, 0, 0);
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function weave(g, cell, light, dark, r, jitter = 6) {
  for (let y = 0; y < SIZE; y += cell) {
    for (let x = 0; x < SIZE; x += cell) {
      const over = ((x / cell) + (y / cell)) % 2 === 0;
      const j = (r() - 0.5) * jitter;
      g.fillStyle = shade(over ? light : dark, j);
      if (over) g.fillRect(x, y + 1, cell, cell - 2);
      else g.fillRect(x + 1, y, cell - 2, cell);
    }
  }
}

function shade(v, j = 0) {
  const c = clamp(Math.round(v + j));
  return `rgb(${c},${c},${c})`;
}

const PAINTERS = {
  nylon(g, r) {
    g.fillStyle = shade(226);
    g.fillRect(0, 0, SIZE, SIZE);
    weave(g, 4, 244, 214, r, 10);
    noise(g, r, 22);
  },
  ballistic(g, r) {
    g.fillStyle = shade(220);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 8) {
      for (let x = 0; x < SIZE; x += 8) {
        const over = ((x / 8) + (y / 8)) % 2 === 0;
        g.fillStyle = shade(over ? 250 : 205, (r() - 0.5) * 8);
        if (over) {
          g.fillRect(x, y + 1, 8, 3);
          g.fillRect(x, y + 4, 8, 3);
        } else {
          g.fillRect(x + 1, y, 3, 8);
          g.fillRect(x + 4, y, 3, 8);
        }
      }
    }
    noise(g, r, 12);
  },
  xpac(g, r) {
    g.fillStyle = shade(232);
    g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 14);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.2;
    for (let i = -SIZE; i < SIZE * 2; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + SIZE, SIZE);
      g.moveTo(i, SIZE);
      g.lineTo(i + SIZE, 0);
      g.stroke();
    }
    g.strokeStyle = 'rgba(90,90,90,0.18)';
    for (let i = 0; i < SIZE; i += 16) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(SIZE, i);
      g.stroke();
    }
  },
  canvas(g, r) {
    g.fillStyle = shade(224);
    g.fillRect(0, 0, SIZE, SIZE);
    weave(g, 4, 240, 206, r, 18);
    noise(g, r, 30);
  },
  waxed(g, r) {
    PAINTERS.canvas(g, r);
    for (let i = 0; i < 40; i++) {
      const x = r() * SIZE;
      const y = r() * SIZE;
      const rad = 10 + r() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.18)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  },
  denim(g, r) {
    g.fillStyle = shade(200);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = -SIZE; i < SIZE * 2; i += 4) {
      g.strokeStyle = shade(240, (r() - 0.5) * 20);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + SIZE, SIZE);
      g.stroke();
    }
    noise(g, r, 26);
  },
  denimBack(g, r) {
    g.fillStyle = shade(246);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = -SIZE; i < SIZE * 2; i += 4) {
      g.strokeStyle = shade(212, (r() - 0.5) * 16);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(i + SIZE, 0);
      g.lineTo(i, SIZE);
      g.stroke();
    }
    noise(g, r, 18);
  },
  acrylic(g, r) {
    g.fillStyle = shade(226);
    g.fillRect(0, 0, SIZE, SIZE);
    weave(g, 3, 242, 212, r, 22);
    noise(g, r, 34);
  },
  vinyl(g, r) {
    g.fillStyle = shade(238);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 2600; i++) {
      const x = r() * SIZE;
      const y = r() * SIZE;
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.07)';
      g.beginPath();
      g.arc(x, y, 1 + r() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  },
  leather(g, r) {
    g.fillStyle = shade(228);
    g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 18);
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 140; i++) {
      const x = r() * SIZE;
      const y = r() * SIZE;
      g.lineWidth = 0.6 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + r() * 20 - 10, y + r() * 20 - 10, x + r() * 30 - 15, y + r() * 30 - 15, x + r() * 40 - 20, y + r() * 40 - 20);
      g.stroke();
    }
  },
  knit(g, r) {
    g.fillStyle = shade(222);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 6) {
      for (let x = 0; x < SIZE; x += 6) {
        g.fillStyle = shade(244, (r() - 0.5) * 14);
        g.beginPath();
        g.ellipse(x + 3, y + 3, 2.2, 3, 0.3, 0, Math.PI * 2);
        g.fill();
      }
    }
    noise(g, r, 22);
  },
  cotton(g, r) {
    g.fillStyle = shade(236);
    g.fillRect(0, 0, SIZE, SIZE);
    weave(g, 2, 246, 226, r, 8);
    noise(g, r, 14);
  },
  coating(g, r) {
    g.fillStyle = shade(238);
    g.fillRect(0, 0, SIZE, SIZE);
    weave(g, 4, 244, 232, r, 4);
    noise(g, r, 8);
  },
  scrim(g, r) {
    g.fillStyle = shade(246);
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < SIZE; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, SIZE);
      g.moveTo(0, i);
      g.lineTo(SIZE, i);
      g.stroke();
    }
    noise(g, r, 6);
  },
  knitback(g, r) {
    g.fillStyle = shade(242);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 4) {
      for (let x = 0; x < SIZE; x += 4) {
        g.fillStyle = shade(226, (r() - 0.5) * 10);
        g.fillRect(x + ((y / 4) % 2) * 2, y, 2, 2);
      }
    }
  },
  suede(g, r) {
    g.fillStyle = shade(230);
    g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 40);
  },
  flesh(g, r) {
    g.fillStyle = shade(232);
    g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 34);
    g.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 300; i++) {
      const x = r() * SIZE;
      const y = r() * SIZE;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + r() * 8 - 4, y + r() * 8 - 4);
      g.stroke();
    }
  },
  napped(g, r) {
    g.fillStyle = shade(236);
    g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 30);
  },
  webbing(g, r) {
    g.fillStyle = shade(214);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 3) {
      g.fillStyle = shade(y % 6 === 0 ? 246 : 222, (r() - 0.5) * 10);
      g.fillRect(0, y, SIZE, 2);
    }
    noise(g, r, 10);
  },
  same(g, r) {
    PAINTERS.canvas(g, r);
  },
};

export function fabricTexture(type) {
  const key = PAINTERS[type] ? type : 'canvas';
  if (cache.has(key)) return cache.get(key);
  const c = canvas();
  const g = c.getContext('2d', { willReadFrequently: true });
  PAINTERS[key](g, rand(key.length * 7919 + key.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** A circular badge with a panel letter, used as a 3D label sprite. */
export function labelTexture(text, color = '#ffd166') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,22,40,0.88)';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `bold ${text.length > 2 ? 40 : 60}px "IBM Plex Sans", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
