// 3D construction kit used by the template rigs. A Part is a fabric panel
// whose surface is a function of material coordinates (u, v) in inches and a
// morph value — so a seam defined in (u, v) stays glued to the cloth while it
// bends, wraps or rolls. All lengths are inches.
import * as THREE from 'three';
import { fabricTexture, labelTexture } from './textures.js';

const TEX_SCALE = 1 / 3;
const tmp = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 };

/* ------------------------------------------------------------------ */
/* Deformers: fn(u, v, morph, out) writes position + unit normal.      */
/* ------------------------------------------------------------------ */

export const Deform = {
  flat() {
    return {
      kind: 'flat',
      fn(u, v, m, o) {
        o.x = u; o.y = v; o.z = 0; o.nx = 0; o.ny = 0; o.nz = 1;
      },
    };
  },

  /** Curl the sheet around an axis parallel to v; the face ends up outside. */
  bend({ R, uc = 0 }) {
    return {
      kind: 'bend',
      fn(u, v, m, o) {
        const k = m / R;
        if (Math.abs(k) < 1e-5) {
          o.x = u; o.y = v; o.z = 0; o.nx = 0; o.ny = 0; o.nz = 1;
          return;
        }
        const th = (u - uc) * k;
        const s = Math.sin(th);
        const c = Math.cos(th);
        o.x = uc + s / k; o.y = v; o.z = -(1 - c) / k;
        o.nx = s; o.ny = 0; o.nz = c;
      },
    };
  },

  /**
   * Wrap a strip along a closed path in the local XZ plane (v becomes height).
   * At morph 0 the strip runs straight off the path's start tangent; as the
   * morph grows it is laid onto the path like tape.
   */
  wrap({ path }) {
    const n = path.length;
    const cum = [0];
    for (let i = 1; i <= n; i++) {
      const a = path[i - 1];
      const b = path[i % n];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[n];
    let cx = 0, cz = 0;
    for (const p of path) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    const t0x = path[1 % n][0] - path[0][0];
    const t0z = path[1 % n][1] - path[0][1];
    const sign = (t0z * (path[0][0] - cx) - t0x * (path[0][1] - cz)) >= 0 ? 1 : -1;
    function at(s, r) {
      s = ((s % total) + total) % total;
      let i = 1;
      while (i < n && cum[i] < s) i++;
      const a = path[i - 1];
      const b = path[i % n];
      const segLen = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / segLen;
      r.px = a[0] + (b[0] - a[0]) * f;
      r.pz = a[1] + (b[1] - a[1]) * f;
      // Blend tangents near vertices so normals stay smooth on sampled curves.
      const tx = (b[0] - a[0]) / segLen;
      const tz = (b[1] - a[1]) / segLen;
      r.tx = tx; r.tz = tz;
    }
    const r = { px: 0, pz: 0, tx: 1, tz: 0 };
    return {
      kind: 'wrap',
      total,
      fn(u, v, m, o) {
        const wrapLen = m * total;
        if (u <= wrapLen) {
          at(u, r);
        } else {
          at(Math.min(wrapLen, total - 1e-6), r);
          const d = u - wrapLen;
          r.px += r.tx * d;
          r.pz += r.tz * d;
        }
        o.x = r.px; o.y = v; o.z = r.pz;
        o.nx = sign * r.tz; o.ny = 0; o.nz = -sign * r.tx;
      },
    };
  },

  /** Roll the sheet up from u = 0 into a spiral resting on the table (local XY sheet, +z up). */
  roll({ length, r0 = 0.7, b = 0.45 }) {
    return {
      kind: 'roll',
      fn(u, v, m, o) {
        const rolled = m * length;
        if (rolled < 1e-4 || u >= rolled) {
          o.x = u; o.y = v; o.z = 0; o.nx = 0; o.ny = 0; o.nz = 1;
          return;
        }
        const Rout = Math.sqrt(r0 * r0 + (b * rolled) / Math.PI);
        const t = rolled - u;
        const disc = Math.max(0, Rout * Rout - (b * t) / Math.PI);
        const phi = ((Rout - Math.sqrt(disc)) * 2 * Math.PI) / b;
        const rad = Rout - (b * phi) / (2 * Math.PI);
        const s = Math.sin(phi);
        const c = Math.cos(phi);
        o.x = rolled - rad * s; o.y = v; o.z = Rout - rad * c;
        o.nx = s; o.ny = 0; o.nz = c;
      },
    };
  },
};

/* ------------------------------------------------------------------ */

export class Kit {
  constructor(scene, fabrics) {
    this.THREE = THREE;
    this.root = new THREE.Group();
    this.root.name = 'rig';
    scene.add(this.root);
    this.fabrics = fabrics;
    this.parts = [];
    this.seams = [];
    this.labels = new THREE.Group();
    this.labels.name = 'labels';
    this.root.add(this.labels);
    this.disposables = [];
  }

  group(parent = this.root, name = '') {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    return g;
  }

  /** `look` picks the fabric face or its backing; `side` is which side of the geometry renders it. */
  material(fabricKey, look, side = look === 'back' ? THREE.BackSide : THREE.FrontSide) {
    const f = this.fabrics[fabricKey] || this.fabrics.main;
    const back = look === 'back';
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(back ? f.back : f.face),
      map: fabricTexture(back ? f.backTex : f.tex),
      roughness: back ? Math.min(1, f.rough + 0.1) : f.rough,
      metalness: 0,
      side,
    });
    this.disposables.push(mat);
    return mat;
  }

  /** Rectangular deformable sheet spanning u0..u0+w, v0..v0+h. */
  sheet(opts) {
    const part = new SheetPart(this, opts);
    this.parts.push(part);
    return part;
  }

  /** Rigid flat panel with an arbitrary outline ([x, y] inches). */
  shape(opts) {
    const part = new ShapePart(this, opts);
    this.parts.push(part);
    return part;
  }

  /** Flat strap following a 2D path in the local XY plane (webbing handles). */
  ribbon(opts) {
    const part = new RibbonPart(this, opts);
    this.parts.push(part);
    return part;
  }

  /** Round cord along 3D points (welt, drawcord). */
  tube({ points, radius = 0.09, closed = true, color = '#ffffff', fabric = null, parent = this.root, radial = 8 }) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.1);
    const segs = Math.max(24, Math.round(curve.getLength() * 3));
    const geo = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
    const mat = fabric ? this.material(fabric, 'front', THREE.DoubleSide) : new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    parent.add(mesh);
    const perSeg = radial * 6;
    const obj = {
      mesh,
      setReveal(t) {
        geo.setDrawRange(0, Math.round(Math.max(0, Math.min(1, t)) * segs) * perSeg);
        mesh.visible = t > 0.001;
      },
      setOpacity(a) {
        mat.transparent = a < 0.999;
        mat.opacity = a;
        mesh.visible = a > 0.01;
      },
    };
    this.disposables.push(geo, mat);
    return obj;
  }

  /** Simple block (foam, stuffing, a form). */
  solid({ w, h, d, color = '#f2d675', parent = this.root, opacity = 1 }) {
    const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: opacity < 1, opacity });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(geo, mat);
    return {
      mesh,
      setOpacity(a) {
        mat.transparent = a < 0.999;
        mat.opacity = a;
        mesh.visible = a > 0.01;
      },
    };
  }

  /** Seam on a part, following a polyline in the part's (u, v) coordinates. */
  seam(part, uv, opts = {}) {
    const s = new Seam(this, part, uv, opts);
    part.seams.push(s);
    this.seams.push(s);
    return s;
  }

  /** Floating letter badge pinned to a point on a part. */
  label(text, part, u, v, lift = 0.6) {
    const tex = labelTexture(text);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 10;
    sprite.userData = { part, u, v, lift };
    this.labels.add(sprite);
    this.disposables.push(tex, mat);
    return sprite;
  }

  /** Rebuild every part whose morph changed, then reposition labels. */
  update() {
    for (const p of this.parts) if (p.dirty) p.rebuild();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const sprite of this.labels.children) {
      const { part, u, v: vv, lift } = sprite.userData;
      part.surface(u, vv, tmp);
      v.set(tmp.x, tmp.y, tmp.z);
      n.set(tmp.nx, tmp.ny, tmp.nz).multiplyScalar(lift);
      v.add(n);
      part.obj.updateWorldMatrix(true, false);
      part.obj.localToWorld(v);
      this.labels.worldToLocal(v);
      sprite.position.copy(v);
      sprite.visible = part.opacity > 0.3 && part.obj.visible;
    }
  }

  setLabelScale(s) {
    for (const sprite of this.labels.children) sprite.scale.set(s, s, 1);
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const d of this.disposables) d.dispose?.();
  }
}

/* ------------------------------------------------------------------ */

class BasePart {
  constructor(kit, opts) {
    this.kit = kit;
    this.name = opts.name || '';
    this.obj = new THREE.Group();
    this.obj.name = this.name;
    (opts.parent || kit.root).add(this.obj);
    this.seams = [];
    this.morph = opts.morph ?? 0;
    this.offset = opts.offset || 0;
    this.opacity = 1;
    this.dirty = true;
    this.mats = [];
  }

  /** Two meshes share the geometry: the fabric face on the normal side, the backing behind (or swapped). */
  makeMeshes(geo, fabric, twoSided = true, swap = false) {
    const face = this.kit.material(fabric, swap ? 'back' : 'front', THREE.FrontSide);
    const front = new THREE.Mesh(geo, face);
    front.castShadow = true;
    front.receiveShadow = true;
    this.obj.add(front);
    this.mats.push(face);
    if (twoSided) {
      const backMat = this.kit.material(fabric, swap ? 'front' : 'back', THREE.BackSide);
      const back = new THREE.Mesh(geo, backMat);
      back.castShadow = true;
      back.receiveShadow = true;
      this.obj.add(back);
      this.mats.push(backMat);
    }
    this.kit.disposables.push(geo);
  }

  makeOutline(count) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x0b1626, transparent: true, opacity: 0.55 });
    this.outline = new THREE.LineSegments(geo, mat);
    this.obj.add(this.outline);
    this.mats.push(mat);
    this.kit.disposables.push(geo, mat);
    return geo;
  }

  surface(u, v, o) {
    this.deform.fn(u, v, this.morph, o);
    if (this.offset) {
      o.x += o.nx * this.offset;
      o.y += o.ny * this.offset;
      o.z += o.nz * this.offset;
    }
    return o;
  }

  setMorph(m) {
    if (Math.abs(m - this.morph) > 1e-5) {
      this.morph = m;
      this.dirty = true;
    }
  }

  setOpacity(a) {
    if (a === this.opacity) return;
    this.opacity = a;
    for (const m of this.mats) {
      const base = m.userData.baseOpacity ?? (m.userData.baseOpacity = m.opacity);
      m.opacity = base * a;
      const t = a < 0.999 || base < 1;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
      m.depthWrite = a > 0.6;
    }
    this.obj.visible = a > 0.01;
  }

  rebuild() {
    this.dirty = false;
    for (const s of this.seams) s.rebuild();
  }
}

class SheetPart extends BasePart {
  constructor(kit, opts) {
    super(kit, opts);
    const { w, h, u0 = 0, v0 = 0, fabric = 'main' } = opts;
    this.w = w; this.h = h; this.u0 = u0; this.v0 = v0;
    this.deform = opts.deform || Deform.flat();
    const curved = this.deform.kind !== 'flat';
    this.segU = opts.segU ?? (curved ? Math.min(220, Math.max(8, Math.round(w / 0.45))) : 1);
    this.segV = opts.segV ?? 1;
    const nu = this.segU + 1;
    const nv = this.segV + 1;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(nu * nv * 3);
    const nor = new Float32Array(nu * nv * 3);
    const uvs = new Float32Array(nu * nv * 2);
    const idx = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = j * nu + i;
        uvs[k * 2] = (u0 + (w * i) / this.segU) * TEX_SCALE;
        uvs[k * 2 + 1] = (v0 + (h * j) / this.segV) * TEX_SCALE;
        if (i < this.segU && j < this.segV) {
          const a = k, b = k + 1, c = k + nu, d = k + nu + 1;
          idx.push(a, b, d, a, d, c);
        }
      }
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geo = geo;
    this.makeMeshes(geo, fabric, opts.twoSided !== false, opts.swapSides);
    // Outline: the four borders, drawn just off both faces.
    this.borderCount = (this.segU * 2 + this.segV * 2) * 4;
    this.lineGeo = opts.outline === false ? null : this.makeOutline(this.borderCount);
    this.rebuild();
  }

  rebuild() {
    const nu = this.segU + 1;
    const nv = this.segV + 1;
    const pos = this.geo.attributes.position.array;
    const nor = this.geo.attributes.normal.array;
    for (let j = 0; j < nv; j++) {
      const v = this.v0 + (this.h * j) / this.segV;
      for (let i = 0; i < nu; i++) {
        const u = this.u0 + (this.w * i) / this.segU;
        this.surface(u, v, tmp);
        const k = (j * nu + i) * 3;
        pos[k] = tmp.x; pos[k + 1] = tmp.y; pos[k + 2] = tmp.z;
        nor[k] = tmp.nx; nor[k + 1] = tmp.ny; nor[k + 2] = tmp.nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
    if (this.lineGeo) {
      const lp = this.lineGeo.attributes.position.array;
      let q = 0;
      let off = 0.015;
      const push = (u, v) => {
        this.surface(u, v, tmp);
        lp[q++] = tmp.x + tmp.nx * off; lp[q++] = tmp.y + tmp.ny * off; lp[q++] = tmp.z + tmp.nz * off;
      };
      const U = (i) => this.u0 + (this.w * i) / this.segU;
      const V = (j) => this.v0 + (this.h * j) / this.segV;
      for (const o of [0.015, -0.015]) {
        off = o;
        for (let i = 0; i < this.segU; i++) {
          push(U(i), V(0)); push(U(i + 1), V(0));
          push(U(i), V(this.segV)); push(U(i + 1), V(this.segV));
        }
        for (let j = 0; j < this.segV; j++) {
          push(U(0), V(j)); push(U(0), V(j + 1));
          push(U(this.segU), V(j)); push(U(this.segU), V(j + 1));
        }
      }
      this.lineGeo.attributes.position.needsUpdate = true;
      this.lineGeo.computeBoundingSphere();
    }
    super.rebuild();
  }
}

class ShapePart extends BasePart {
  constructor(kit, opts) {
    super(kit, opts);
    this.deform = Deform.flat();
    const shape = new THREE.Shape(opts.outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of opts.holes || []) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ShapeGeometry(shape, 8);
    const uv = geo.attributes.uv;
    const p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * TEX_SCALE, p.getY(i) * TEX_SCALE);
    this.makeMeshes(geo, opts.fabric || 'main', opts.twoSided !== false, opts.swapSides);
    const pts = opts.outline;
    const lg = this.makeOutline(pts.length * 4);
    const lp = lg.attributes.position.array;
    let q = 0;
    for (const z of [0.015, -0.015]) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        lp[q++] = a[0]; lp[q++] = a[1]; lp[q++] = z;
        lp[q++] = b[0]; lp[q++] = b[1]; lp[q++] = z;
      }
    }
    lg.attributes.position.needsUpdate = true;
    lg.computeBoundingSphere();
    this.rebuild();
  }
}

class RibbonPart extends BasePart {
  constructor(kit, opts) {
    super(kit, opts);
    const { path, width, fabric = 'accent' } = opts;
    // Resample the path finely and build an in-plane band.
    const pts = resample(path, 0.25);
    this.pts = pts;
    this.width = width;
    const n = pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.cum = cum;
    this.length = cum[n - 1];
    const nrm = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    this.nrm = nrm;
    const pos = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const nor = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n; i++) {
      for (let side = 0; side < 2; side++) {
        const k = i * 2 + side;
        const off = (side ? 0.5 : -0.5) * width;
        pos[k * 3] = pts[i][0] + nrm[i][0] * off;
        pos[k * 3 + 1] = pts[i][1] + nrm[i][1] * off;
        pos[k * 3 + 2] = 0;
        nor[k * 3 + 2] = 1;
        uvs[k * 2] = (side ? 1 : 0) * 0.5;
        uvs[k * 2 + 1] = cum[i] * TEX_SCALE;
      }
      if (i < n - 1) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geo = geo;
    this.segCount = n - 1;
    this.makeMeshes(geo, fabric, true, opts.swapSides);
    this.deform = {
      kind: 'ribbon',
      fn: (s, a, m, o) => {
        let i = 1;
        while (i < n - 1 && cum[i] < s) i++;
        const f = Math.min(1, Math.max(0, (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
        const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
        const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
        const nx = nrm[i - 1][0] + (nrm[i][0] - nrm[i - 1][0]) * f;
        const ny = nrm[i - 1][1] + (nrm[i][1] - nrm[i - 1][1]) * f;
        o.x = x + nx * a; o.y = y + ny * a; o.z = 0;
        o.nx = 0; o.ny = 0; o.nz = 1;
      },
    };
    this.rebuild();
  }

  setReveal(t) {
    this.geo.setDrawRange(0, Math.round(Math.max(0, Math.min(1, t)) * this.segCount) * 6);
  }
}

function resample(path, step) {
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 1; j <= k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}

/* ------------------------------------------------------------------ */

const dashGeo = new THREE.BoxGeometry(1, 1, 1);
const X = new THREE.Vector3();
const Y = new THREE.Vector3();
const Z = new THREE.Vector3();
const M = new THREE.Matrix4();

class Seam {
  constructor(kit, part, uv, { spi = 7, side = 1, band = 0.5, bandOffset = 0, color, lift = 0.025, closed = false } = {}) {
    this.kit = kit;
    this.part = part;
    this.side = side;
    this.lift = lift;
    this.band = band;
    this.bandOffset = bandOffset;
    const path = closed ? [...uv, uv[0]] : uv;
    this.path = path;
    // Stitch positions in (u, v), evenly spaced by stitch length.
    const spacing = 1 / spi;
    const stitches = [];
    let carry = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-6) continue;
      const dx = (b[0] - a[0]) / len;
      const dy = (b[1] - a[1]) / len;
      let d = carry;
      while (d + spacing * 0.62 <= len + 1e-6) {
        stitches.push([a[0] + dx * d, a[1] + dy * d, a[0] + dx * (d + spacing * 0.62), a[1] + dy * (d + spacing * 0.62)]);
        d += spacing;
      }
      carry = d - len;
    }
    this.stitches = stitches;
    this.length = path.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);
    const mat = new THREE.MeshStandardMaterial({
      color: color || kit.fabrics.thread,
      roughness: 0.55,
      emissive: new THREE.Color(color || kit.fabrics.thread).multiplyScalar(0.25),
    });
    this.mesh = new THREE.InstancedMesh(dashGeo, mat, Math.max(1, stitches.length));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    part.obj.add(this.mesh);
    kit.disposables.push(mat);

    // Translucent red seam-allowance band.
    this.bandMesh = null;
    if (band > 0) {
      const pts = resample(path, 0.3);
      this.bandPts = pts;
      const n = pts.length;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
      const idx = [];
      for (let i = 0; i < n - 1; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
      g.setIndex(idx);
      const bm = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      this.bandMesh = new THREE.Mesh(g, bm);
      this.bandMesh.visible = false;
      this.bandMesh.renderOrder = 2;
      part.obj.add(this.bandMesh);
      kit.disposables.push(g, bm);
    }
    this.progress = 0;
    this.rebuild();
  }

  rebuild() {
    const p = this.part;
    const s = this.side;
    for (let i = 0; i < this.stitches.length; i++) {
      const [u1, v1, u2, v2] = this.stitches[i];
      p.surface(u1, v1, tmp);
      const ax = tmp.x, ay = tmp.y, az = tmp.z;
      p.surface(u2, v2, tmp);
      const bx = tmp.x, by = tmp.y, bz = tmp.z;
      Z.set(tmp.nx * s, tmp.ny * s, tmp.nz * s);
      X.set(bx - ax, by - ay, bz - az);
      const len = X.length() || 0.01;
      X.divideScalar(len);
      Y.crossVectors(Z, X).normalize();
      Z.crossVectors(X, Y);
      M.makeBasis(X, Y, Z);
      M.scale(new THREE.Vector3(len, 0.045, 0.03));
      M.setPosition((ax + bx) / 2 + Z.x * this.lift, (ay + by) / 2 + Z.y * this.lift, (az + bz) / 2 + Z.z * this.lift);
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.bandMesh) {
      const pts = this.bandPts;
      const arr = this.bandMesh.geometry.attributes.position.array;
      const half = this.band / 2;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        for (let k = 0; k < 2; k++) {
          const off = this.bandOffset + (k ? half : -half);
          p.surface(pts[i][0] + nx * off, pts[i][1] + ny * off, tmp);
          const q = (i * 2 + k) * 3;
          arr[q] = tmp.x + tmp.nx * s * this.lift * 0.6;
          arr[q + 1] = tmp.y + tmp.ny * s * this.lift * 0.6;
          arr[q + 2] = tmp.z + tmp.nz * s * this.lift * 0.6;
        }
      }
      this.bandMesh.geometry.attributes.position.needsUpdate = true;
      this.bandMesh.geometry.computeBoundingSphere();
    }
  }

  setProgress(t) {
    this.progress = t;
    this.mesh.count = Math.round(Math.max(0, Math.min(1, t)) * this.stitches.length);
  }

  setBand(opacity) {
    if (!this.bandMesh) return;
    this.bandMesh.material.opacity = opacity * 0.42;
    this.bandMesh.visible = opacity > 0.01;
  }

  /** World position + needle direction at the stitch head for progress t. */
  head(t, outPos, outNormal) {
    const n = this.stitches.length;
    if (!n) return false;
    const i = Math.min(n - 1, Math.max(0, Math.round(t * n) - 1));
    const [u1, v1] = this.stitches[i];
    this.part.surface(u1, v1, tmp);
    outPos.set(tmp.x, tmp.y, tmp.z);
    outNormal.set(tmp.nx * this.side, tmp.ny * this.side, tmp.nz * this.side);
    this.part.obj.updateWorldMatrix(true, false);
    this.part.obj.localToWorld(outPos);
    outNormal.transformDirection(this.part.obj.matrixWorld);
    return true;
  }
}
