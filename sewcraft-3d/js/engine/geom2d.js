// 2D helpers for pattern pieces. Outlines are arrays of [x, y] in inches,
// y pointing up (the blueprint flips it when drawing).

export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Offset a simple polygon outward. `dist` is a number or one value per edge
 * (edge i runs from pts[i] to pts[i+1]). Corners are mitred, with a limit so
 * sampled curves stay smooth.
 */
export function offsetPolygon(pts, dist) {
  const n = pts.length;
  const dists = Array.isArray(dist) ? dist.slice() : new Array(n).fill(dist);
  let P = pts;
  if (signedArea(pts) < 0) {
    // Work counter-clockwise; edge i of the reversed loop is edge n-2-i of the original.
    P = pts.slice().reverse();
    const d2 = new Array(n);
    for (let i = 0; i < n; i++) d2[i] = dists[(n - 2 - i + n) % n];
    dists.splice(0, n, ...d2);
  }
  const lines = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % n];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (y2 - y1) / len;
    const ny = -(x2 - x1) / len;
    const d = dists[i];
    lines.push({ x1: x1 + nx * d, y1: y1 + ny * d, x2: x2 + nx * d, y2: y2 + ny * d, nx, ny, d });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const hit = intersect(a, b);
    const [px, py] = P[i];
    const maxMiter = Math.max(a.d, b.d) * 4 + 0.001;
    if (!hit || Math.hypot(hit[0] - px, hit[1] - py) > maxMiter) {
      out.push([b.x1, b.y1]);
    } else {
      out.push(hit);
    }
  }
  return out;
}

function intersect(a, b) {
  const dax = a.x2 - a.x1, day = a.y2 - a.y1;
  const dbx = b.x2 - b.x1, dby = b.y2 - b.y1;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.x1 - a.x1) * dby - (b.y1 - a.y1) * dbx) / den;
  return [a.x1 + dax * t, a.y1 + day * t];
}

export function rect(w, h, x = 0, y = 0) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Rounded rectangle sampled as a polygon (counter-clockwise from bottom-left). */
export function roundRect(w, h, r, seg = 6) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r < 0.01) return rect(w, h);
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(w - r, r, -Math.PI / 2);
  corner(w - r, h - r, 0);
  corner(r, h - r, Math.PI / 2);
  corner(r, r, Math.PI);
  return pts;
}

export function circle(r, seg = 48, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function perimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

export function translate(pts, dx, dy) {
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

/**
 * Re-start a closed polyline at arc length `s0` and resample it evenly, so a
 * wrap strip can begin anywhere on the loop.
 */
export function loopFrom(pts, s0, step = 0.5) {
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[n];
  const at = (s) => {
    s = ((s % total) + total) % total;
    let i = 1;
    while (i < n && cum[i] < s) i++;
    const a = pts[i - 1];
    const b = pts[i % n];
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const count = Math.max(8, Math.round(total / step));
  const out = [];
  for (let k = 0; k < count; k++) out.push(at(s0 + (k * total) / count));
  return { pts: out, total };
}

/** Arc length along a closed polyline to the point nearest `p`. */
export function arcTo(pts, p) {
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)));
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
    if (d < best) { best = d; bestS = acc + t * len; }
    acc += len;
  }
  return bestS;
}
