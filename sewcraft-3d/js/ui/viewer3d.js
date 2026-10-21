// Three.js viewer: scene, camera, the template rig, and the step player that
// tweens rig parameters and stitches seams in on cue.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Kit } from './kit3d.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const DEG = Math.PI / 180;

export class Viewer {
  constructor(container, { onProgress } = {}) {
    this.container = container;
    this.onProgress = onProgress || (() => {});
    this.speed = 1;
    this.autoCam = true;
    this.playing = false;
    this.step = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '3D assembly view. Drag to orbit, pinch or scroll to zoom.');
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1a2b');
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 0.53 * Math.PI;
    this.controls.addEventListener('start', () => {
      this.userOrbit = true;
      this.controls.autoRotate = false;
      this.camTween = null;
    });
    this.controls.addEventListener('change', () => this.invalidate());

    scene.add(new THREE.HemisphereLight(0xe4eeff, 0x1b2638, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    this.key = key;
    const fill = new THREE.DirectionalLight(0x9cc4ff, 0.55);
    fill.position.set(-40, 30, -30);
    scene.add(fill);

    // Cutting table: dark mat with a 1″ / 6″ grid.
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#10243a', roughness: 1 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.08;
    this.floor.receiveShadow = true;
    scene.add(this.floor);
    this.grid = null;

    // Needle + presser foot marker that rides the active seam.
    const needle = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#d9dee6', metalness: 0.9, roughness: 0.25 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.012, 1.8, 10), steel);
    shaft.position.y = 0.9;
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10), steel);
    clamp.position.y = 2.0;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.32), new THREE.MeshStandardMaterial({ color: '#8b95a5', metalness: 0.7, roughness: 0.35 }));
    foot.position.y = 0.06;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.24, 24), new THREE.MeshBasicMaterial({ color: '#ff5d52', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    glow.renderOrder = 5;
    this.needleShaft = new THREE.Group();
    this.needleShaft.add(shaft, clamp);
    needle.add(this.needleShaft, foot, glow);
    needle.visible = false;
    scene.add(needle);
    this.needle = needle;

    this.clock = new THREE.Clock();
    this.needsRender = true;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  invalidate() {
    this.needsRender = true;
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** Build the rig for a plan. `fabrics` holds face/back looks, accent and thread colours. */
  load(plan, fabrics) {
    if (this.kit) this.kit.dispose();
    this.plan = plan;
    this.kit = new Kit(this.scene, fabrics);
    this.rig = plan.template.rig(this.kit, plan.ctx, plan);
    this.kit.setLabelScale(this.rig.labelScale || 1.5);

    // Cumulative parameter state at the end of every step.
    this.states = [];
    let s = { ...this.rig.params };
    for (const step of plan.steps) {
      s = { ...s, ...(this.rig.poses[step.pose] || {}) };
      this.states.push(s);
    }
    this.stepSeams = plan.steps.map((st) => (st.seams || []).flatMap((id) => this.rig.seams[id] || []));

    // Fit the table, grid and shadow camera to the whole build.
    const box = new THREE.Box3();
    for (const st of [this.rig.params, this.states[this.states.length - 1], ...this.states]) {
      this.applyParams(st);
      box.union(new THREE.Box3().setFromObject(this.kit.root));
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 20) * 1.6;
    this.span = Math.max(size.x, size.y, size.z);
    this.floor.scale.set(span * 2, span * 2, 1);
    this.floor.position.x = center.x;
    this.floor.position.z = center.z;
    if (this.grid) this.scene.remove(this.grid);
    this.grid = makeGrid(span * 2);
    this.grid.position.set(Math.round(center.x / 6) * 6, -0.06, Math.round(center.z / 6) * 6);
    this.scene.add(this.grid);
    const sc = this.key.shadow.camera;
    const r = Math.max(size.x, size.y, size.z) * 0.85 + 4;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.near = 1; sc.far = r * 6;
    sc.updateProjectionMatrix();
    this.key.position.set(center.x + r * 0.9, r * 2.2, center.z + r * 1.4);
    this.key.target.position.copy(center);
    this.camera.near = Math.max(0.2, this.span * 0.01);
    this.kit.setLabelScale(Math.max(this.rig.labelScale || 1.5, this.span / 20));
    this.camera.far = span * 8;
    this.camera.updateProjectionMatrix();

    this.goTo(0, { animate: false, snapCam: true });
  }

  applyParams(p) {
    this.params = { ...p };
    this.rig.apply(this.params);
    this.kit.update();
    this.invalidate();
  }

  /** Jump to a step. With animate, it plays from the previous state; otherwise shows it complete. */
  goTo(i, { animate = true, snapCam = false } = {}) {
    const n = this.plan.steps.length;
    i = Math.max(0, Math.min(n - 1, i));
    this.step = i;
    const from = i > 0 ? this.states[i - 1] : this.rig.params;
    const to = this.states[i];
    for (let k = 0; k < n; k++) {
      const done = k < i || (k === i && !animate);
      for (const sm of this.stepSeams[k]) {
        sm.setProgress(done ? 1 : 0);
        sm.setBand(0);
      }
    }
    this.needle.visible = false;
    this.controls.autoRotate = false;
    this.anim = null;
    this.holdTimer = null;
    // Panel letters only make sense while the pieces lie flat.
    if (this.kit) this.kit.labels.visible = this.labelsOn !== false && i === 0;
    if (animate) {
      this.applyParams(from);
      this.anim = makeAnim(from, to, this.stepSeams[i]);
      this.playingStep = true;
    } else {
      this.applyParams(to);
      this.playingStep = false;
      this.onProgress({ step: i, t: 1, done: true });
      if (this.plan.steps[i].spin) this.controls.autoRotate = true;
    }
    this.userOrbit = false;
    if (this.autoCam || snapCam) this.flyTo(this.camFor(i), snapCam ? 0 : 1.1);
  }

  camFor(i) {
    const st = this.plan.steps[i];
    const c = this.rig.cams[st.id] || this.rig.cams[st.pose] || this.rig.cams.final;
    if (!c?.fit) return c;
    // Frame everything visible at the end of this step.
    const keep = this.params;
    this.applyParams(this.states[i]);
    const box = new THREE.Box3();
    this.kit.root.traverse((o) => {
      if ((o.isMesh || o.isLineSegments) && !o.isInstancedMesh && o.visible && o.parent?.visible !== false && o.geometry) {
        box.expandByObject(o);
      }
    });
    this.applyParams(keep);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = (this.camera.fov * DEG) / 2;
    const fit = sphere.radius / Math.sin(Math.min(fov, fov * Math.max(0.6, this.camera.aspect)));
    return { ...c, target: sphere.center.toArray(), dist: fit * (c.fit === true ? 1.02 : c.fit) };
  }

  flyTo(c, seconds = 1.1) {
    if (!c) return;
    const target = new THREE.Vector3(...c.target);
    const az = c.az * DEG;
    const el = c.el * DEG;
    const aspectBoost = this.camera.aspect < 1 ? 1 / Math.max(0.55, this.camera.aspect) : 1;
    const dist = c.dist * aspectBoost;
    const pos = new THREE.Vector3(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az)
    );
    if (seconds <= 0) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      this.camTween = null;
      this.invalidate();
      return;
    }
    this.camTween = {
      t: 0,
      dur: seconds,
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos,
      t1: target,
    };
  }

  setView(name) {
    const c = this.camFor(this.plan.steps.length - 1);
    const presets = { front: [0, 6], side: [90, 6], iso: [38, 28], top: [0, 85], back: [180, 8] };
    const [az, el] = presets[name] || presets.iso;
    this.userOrbit = false;
    this.controls.autoRotate = false;
    this.flyTo({ ...c, az, el }, 0.9);
  }

  play() {
    this.playing = true;
    if (!this.playingStep) {
      if (this.step < this.plan.steps.length - 1) this.goTo(this.step + 1);
      else this.goTo(0);
    }
  }

  pause() {
    this.playing = false;
  }

  replay() {
    this.goTo(this.step);
  }

  setLabels(on) {
    this.labelsOn = on;
    if (this.kit) this.kit.labels.visible = on && this.step === 0;
    this.invalidate();
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    let active = false;

    if (this.camTween) {
      const ct = this.camTween;
      ct.t += dt / ct.dur;
      const k = ease(Math.min(1, ct.t));
      this.camera.position.lerpVectors(ct.p0, ct.p1, k);
      this.controls.target.lerpVectors(ct.t0, ct.t1, k);
      if (ct.t >= 1) this.camTween = null;
      active = true;
    }

    if (this.anim && this.playingStep) {
      const a = this.anim;
      a.t += (dt * this.speed) / a.dur;
      const t = Math.min(1, a.t);
      // Pose tween.
      const pt = a.poseEnd > 0 ? ease(Math.min(1, t / a.poseEnd)) : 1;
      const p = {};
      for (const k in a.to) p[k] = a.from[k] + (a.to[k] - a.from[k]) * pt;
      this.applyParams(p);
      // Seams: highlight, then stitch in sequence.
      const sewT = (t - a.sewStart) / (1 - a.sewStart);
      let head = null;
      for (const sm of a.seams) {
        const local = Math.max(0, Math.min(1, (sewT - sm.start) / sm.span));
        const bandIn = Math.max(0, Math.min(1, (t - a.poseEnd) / 0.08));
        sm.seam.setBand(t < 0.97 ? bandIn * (local < 1 ? 1 : 0.35) : (1 - t) / 0.03);
        sm.seam.setProgress(local);
        if (local > 0 && local < 1) head = { seam: sm.seam, t: local };
      }
      this.placeNeedle(head);
      this.onProgress({ step: this.step, t, done: false });
      if (a.t >= 1) {
        for (const sm of a.seams) {
          sm.seam.setBand(0);
          sm.seam.setProgress(1);
        }
        this.needle.visible = false;
        this.anim = null;
        this.playingStep = false;
        this.applyParams(a.to);
        this.onProgress({ step: this.step, t: 1, done: true });
        if (this.plan.steps[this.step].spin) this.controls.autoRotate = true;
        if (this.playing) {
          if (this.step < this.plan.steps.length - 1) {
            this.holdTimer = 0.9;
          } else {
            this.playing = false;
            this.onProgress({ step: this.step, t: 1, done: true, ended: true });
          }
        }
      }
      active = true;
    } else if (this.holdTimer != null) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.holdTimer = null;
        if (this.playing) this.goTo(this.step + 1);
      }
    }

    if (this.needle.visible) {
      this.needleShaft.position.y = 0.18 + Math.sin(performance.now() / 32) * 0.18;
      active = true;
    }
    if (this.controls.autoRotate) {
      this.controls.autoRotateSpeed = 1.2;
      active = true;
    }
    if (this.controls.update() || active || this.needsRender) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  }

  placeNeedle(head) {
    if (!head) {
      this.needle.visible = false;
      return;
    }
    const pos = new THREE.Vector3();
    const nor = new THREE.Vector3();
    if (!head.seam.head(head.t, pos, nor)) return;
    this.needle.visible = true;
    this.needle.position.copy(pos);
    this.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nor.normalize());
    const s = Math.max(1, (this.span || 20) / 22);
    this.needle.scale.setScalar(s);
  }

  /** Render the finished model from a preset and return a PNG data URL. */
  snapshot(view, width = 640, height = 440) {
    const prev = {
      params: this.params,
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
      aspect: this.camera.aspect,
      size: this.renderer.getSize(new THREE.Vector2()),
      labels: this.kit.labels.visible,
      needle: this.needle.visible,
      progress: this.kit.seams.map((s) => s.progress),
    };
    this.applyParams(this.states[this.states.length - 1]);
    for (const s of this.kit.seams) {
      s.setProgress(1);
      s.setBand(0);
    }
    this.kit.labels.visible = false;
    this.needle.visible = false;
    const c = this.camFor(this.plan.steps.length - 1);
    const presets = { front: [0, 4], side: [90, 4], iso: [38, 26] };
    const [az, el] = presets[view] || presets.iso;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const target = new THREE.Vector3(...c.target);
    const dist = c.dist * 0.95;
    this.camera.position.set(
      target.x + dist * Math.cos(el * DEG) * Math.sin(az * DEG),
      target.y + dist * Math.sin(el * DEG),
      target.z + dist * Math.cos(el * DEG) * Math.cos(az * DEG)
    );
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    // Restore.
    this.renderer.setSize(prev.size.x, prev.size.y, false);
    this.camera.aspect = prev.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(prev.pos);
    this.controls.target.copy(prev.target);
    this.camera.lookAt(prev.target);
    this.kit.labels.visible = prev.labels;
    this.needle.visible = prev.needle;
    this.applyParams(prev.params);
    this.kit.seams.forEach((s, i) => s.setProgress(prev.progress[i]));
    this.invalidate();
    return url;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    if (this.kit) this.kit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function makeAnim(from, to, seams) {
  const changes = Object.keys(to).some((k) => Math.abs((to[k] ?? 0) - (from[k] ?? 0)) > 1e-4);
  const total = seams.reduce((a, s) => a + Math.max(4, s.stitches.length), 0);
  const sewSeconds = seams.length ? Math.min(7, 1.6 + total * 0.012) : 0;
  const poseSeconds = changes ? 2.2 : seams.length ? 0.4 : 1.2;
  const dur = poseSeconds + sewSeconds + (seams.length ? 0.5 : 0);
  let acc = 0;
  const items = seams.map((seam) => {
    const w = Math.max(4, seam.stitches.length) / Math.max(1, total);
    const item = { seam, start: acc, span: Math.max(0.0001, w) };
    acc += w;
    return item;
  });
  return {
    t: 0,
    dur,
    from,
    to,
    poseEnd: poseSeconds / dur,
    sewStart: (poseSeconds + 0.3) / dur,
    seams: items,
  };
}

function makeGrid(size) {
  const lines = [];
  const half = Math.ceil(size / 2 / 6) * 6;
  for (let x = -half; x <= half; x += 1) {
    const major = x % 6 === 0;
    lines.push({ major, a: [x, 0, -half], b: [x, 0, half] });
    lines.push({ major, a: [-half, 0, x], b: [half, 0, x] });
  }
  const group = new THREE.Group();
  for (const major of [false, true]) {
    const pts = [];
    for (const l of lines.filter((q) => q.major === major)) pts.push(...l.a, ...l.b);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: major ? '#3aa7d6' : '#1f4a6b', transparent: true, opacity: major ? 0.45 : 0.35 });
    group.add(new THREE.LineSegments(geo, mat));
  }
  return group;
}
