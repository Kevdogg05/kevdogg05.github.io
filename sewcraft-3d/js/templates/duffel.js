// Barrel duffel: body wrapped into a tube, zipper panel across the top,
// circular end caps set in with quarter marks, handles that wrap the body,
// bound interior seams.
import { b, machineLine, execTail, holdNote, changeover, cam, fitCam, boxX } from './common.js';
import { Deform } from '../ui/kit3d.js';

const ICON = `<svg viewBox="0 0 48 48"><rect x="6" y="16" width="36" height="22" rx="11" fill="currentColor" opacity=".18"/><rect x="6" y="16" width="36" height="22" rx="11" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 16h24" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M18 16c0-8 12-8 12 0" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;

function geometry(ctx) {
  const { d, o, sa } = ctx;
  const Ld = d.length, Dd = d.diameter, drop = d.drop;
  const R = Dd / 2;
  const C = Math.PI * Dd;
  const zw = 3;
  const Wb = C - zw;
  const hw = Number(o.webbing);
  const vS = Math.min(Ld / 4, Ld / 2 - hw - 1);
  const sewn = Wb - 2;
  const loopLen = 2 * drop + 4;
  return { Ld, Dd, R, C, zw, Wb, hw, vS, sewn, loopLen, drop, bind: Boolean(o.bind), s: sa.seam };
}

export default {
  id: 'duffel',
  name: 'Barrel Duffel',
  category: 'Bags',
  blurb: 'Round-ended duffel: zipper panel across the top, wrap-around webbing handles, curved end seams set with quarter marks.',
  icon: ICON,
  usesLining: false,
  structural: true,
  dims: [
    { key: 'length', label: 'Length', min: 14, max: 32, step: 0.5, default: 20 },
    { key: 'diameter', label: 'End diameter', min: 8, max: 16, step: 0.5, default: 11 },
    { key: 'drop', label: 'Handle height', min: 3, max: 12, step: 0.5, default: 6 },
  ],
  options: [
    { key: 'webbing', label: 'Handle webbing', type: 'select', default: '1.5', choices: [{ value: '1', label: '1″ webbing' }, { value: '1.5', label: '1½″ webbing' }] },
    { key: 'bind', label: 'Bind the inside end seams', type: 'toggle', default: true },
  ],
  defaults: { material: 'cordura1000' },

  plan(ctx) {
    const g = geometry(ctx);
    const { Ld, Dd, R, C, zw, Wb, hw, vS, sewn, loopLen, drop, bind, s } = g;
    const { L, mat } = ctx;
    const q = C / 4;

    const panels = [
      {
        id: 'A',
        name: 'Body',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [Wb, 0], [Wb, Ld], [0, Ld]],
        sa: s,
        grain: 'v',
        notches: [
          ...[Wb / 2, Wb / 2 - q, Wb / 2 + q].map((x) => ({ x, y: 0, nx: 0, ny: -1, sa: s, label: x === Wb / 2 ? 'bottom' : '' })),
          ...[Wb / 2, Wb / 2 - q, Wb / 2 + q].map((x) => ({ x, y: Ld, nx: 0, ny: 1, sa: s })),
        ],
        folds: [],
        marks: [Ld / 2 - vS, Ld / 2 + vS].map((y, i) => ({ x: 1, y: y - hw / 2, w: Wb - 2, h: hw, label: i ? '' : 'handle strap' })),
        shade: [],
        contour: `Flat rectangle that rolls into a ${L(Dd)} tube; its short edges become the two curved end seams. Quarter notches (${L(q)} apart) match the end caps.`,
      },
      {
        id: 'B',
        name: 'Zipper panel halves',
        fabric: 'main',
        qty: 2,
        outline: [[0, 0], [zw / 2, 0], [zw / 2, Ld], [0, Ld]],
        saEdges: [s, 0.75, s, s],
        grain: 'v',
        notches: [],
        folds: [{ pts: [[zw / 2, 0], [zw / 2, Ld]], label: 'fold', minor: true }],
        marks: [],
        shade: [],
        contour: 'Narrow strips; the ¾″ allowance on the zipper edge folds under so the folds meet over the coil.',
      },
      {
        id: 'C',
        name: 'End caps',
        fabric: 'main',
        qty: 2,
        circleR: R,
        sa: s,
        grain: 'v',
        notches: [0, 1, 2, 3].map((k) => {
          const a = -Math.PI / 2 + (k * Math.PI) / 2;
          return { x: R + Math.cos(a) * R, y: R + Math.sin(a) * R, nx: Math.cos(a), ny: Math.sin(a), sa: s, label: k === 0 ? 'bottom' : k === 2 ? 'zip' : '' };
        }),
        folds: [],
        marks: [],
        shade: [],
        contour: `Ø ${L(Dd)} disc, shaded as a dome — the most curved seam on the bag. Four quarter notches land on the body's notches and the zipper centre.`,
      },
    ];
    // Circles are drawn from a centre-origin outline; shift notches into that frame.
    for (const n of panels[2].notches) {
      n.x -= R;
      n.y -= R;
    }

    const notions = [
      { label: '#10 coil zipper, two-way', qty: L(Ld + 1), note: 'Two sliders, pulls meeting in the middle.' },
      { label: `${hw === 1 ? '1″' : '1½″'} nylon webbing`, qty: `2 × ${L(sewn + loopLen + 2)}`, note: `Each strap: ${L(sewn)} sewn to the body + ${L(loopLen)} carry loop.` },
    ];
    if (bind) notions.push({ label: '1″ binding tape', qty: `2 × ${L(C + 3)}`, note: 'Binds the inside of both end seams.' });

    const webF = hw === 1 ? 'webbing1' : 'webbing15';
    const seams = [
      { id: 'S1', name: 'Handles to body (edge-stitch)', type: 'edgeStitch', role: 'topstitch', length: sewn - 4, count: 4 },
      { id: 'S2', name: 'Handle box-X stops', type: 'boxX', role: 'bartack', length: 2 * 2 + 2 * hw + 2 * Math.hypot(2, hw), count: 4 },
      { id: 'S3', name: 'Zipper into zipper panel', type: 'zipper', role: 'zipper', length: Ld, count: 2 },
      { id: 'S4', name: 'Zipper panel to body', type: 'topstitched', role: 'construction', length: Ld, count: 2 },
      { id: 'S5', name: 'End caps', type: 'plain', role: 'construction', length: C, count: 2 },
    ];
    if (bind) seams.push({ id: 'S6', name: 'Bind the end seams', type: 'bound', role: 'binding', length: C, count: 2 });

    const steps = [
      {
        id: 'prep',
        title: 'Cut, mark & prep',
        pose: 'prep',
        frame: () =>
          `The body ${b('A')} lies face up with two webbing straps ${b('D')} waiting beside it, the zipper panel ${b('B')} on the other side and both end caps ${b('C')} at the ends. Notches mark the quarter points on the body's short edges and on each cap.`,
        action: () =>
          `Cut the body, two zipper-panel halves and two ${L(Dd + 2 * s)} circles (a ${L(Dd)} finished cap). ${mat.cut} Snip the quarter notches on the body ends ${L(q)} apart starting from the bottom centre, and four notches on each cap.`,
        exec: () => `No sewing yet. ${mat.edge}`,
      },
      {
        id: 'handles',
        title: 'Sew the handles to the flat body',
        role: 'topstitch',
        layers: [{ f: 'main', n: 1 }, { f: webF, n: 1 }],
        seams: ['S1', 'S2'],
        prefer: '2206RB',
        pose: 'handles',
        frame: () =>
          `Both straps slide onto the flat body along the placement lines, ${L(2 * vS)} apart. Each edge stitches down, then a box-X locks each strap end where the carry loop leaves the body.`,
        action: (c) =>
          `Lay each strap on its placement line, ends 1″ short of the zipper seams; the free carry loop (${L(loopLen)}) lies across the body for now. Check both loops are the same length and untwisted. ${holdNote(c)}`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)}. Edge-stitch ⅛″ from both strap edges, then box-X a 2″ × ${L(hw)} block at every stop (4 total). The box-X stacks webbing twice — slow down at the edges. ${execTail(c)}`,
      },
      {
        id: 'zipper',
        title: 'Sew the zipper panel',
        role: 'zipper',
        layers: [{ f: 'main', n: 2 }, { f: 'zipper10', n: 1 }],
        seams: ['S3'],
        pose: 'zipper',
        frame: () => `The body flips face down ready for joining, while the two zipper-panel halves close over the black coil and get topstitched ⅛″ from each fold.`,
        action: () => `Fold the zipper edge of each half under ¾″, centre the folds over the coil with ¼″ basting tape, and put both sliders on with pulls meeting in the middle.`,
        exec: (c) => `${changeover(c)}${machineLine(c)} with a zipper foot. Sew both sides in the same direction. ${execTail(c)}`,
      },
      {
        id: 'tube',
        title: 'Join the body into a tube',
        role: 'construction',
        layers: [{ f: 'main', n: 4 }],
        seams: ['S4'],
        prefer: '2206RB',
        pose: 'tube',
        frame: () => `The body curls up into a ${L(Dd)} tube and the zipper panel closes the gap across the top. Two long seams run the length of the bag either side of the zipper, and the carry loops stand up over the top.`,
        action: (c) => `Right sides together, sew each long edge of the zipper panel to a long edge of the body. Press the allowances toward the body and topstitch ⅛″ from the seam. ${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. The second seam closes the tube — roll the bag around the 2206RB's 14″ arm and sew from inside. ${execTail(c)}`,
      },
      {
        id: 'caps',
        title: 'Set in the end caps',
        role: 'construction',
        layers: [{ f: 'main', n: 2 }],
        seams: ['S5'],
        curve: true,
        prefer: '2206RB',
        pose: 'caps',
        frame: () => `Each cap swings up and seats into the open end of the tube. The circular seam highlights red and stitches all the way round.`,
        action: () =>
          `${b('Open the zipper halfway first')} — you turn the bag through it. Right sides together, pin or clip a cap into each end matching its notches to the body's quarter notches (and its "zip" notch to the zipper centre). Clip the body allowance every ½″ between notches so it spreads around the curve.`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)}. Sew with the cap down against the feed dog and the body on top, so you can watch the clipped edge. Stop every 5–6 stitches needle-down to turn the work; never stretch the body to meet the cap — redistribute the ease between notches. ${execTail(c)}`,
      },
    ];
    if (bind) {
      steps.push({
        id: 'bind',
        title: 'Bind the inside end seams',
        role: 'binding',
        layers: [{ f: 'main', n: 2 }, { f: 'binding', n: 2 }],
        seams: ['S6'],
        curve: true,
        prefer: '2206RB',
        pose: 'bind',
        frame: () => `The shell turns translucent to show inside the bag: binding tape wraps the raw edges of each end seam and stitches down all the way round.`,
        action: () => `Trim each end-seam allowance to an even ⅜″. Fold the binding over it, starting at the bottom, and overlap the ends 1″ with the top end folded under.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Stitch ⅛″ from the binding's inner edge, keeping the bag body out of the way inside the arm. ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'final',
      title: 'Turn & inspect',
      pose: 'final',
      spin: true,
      frame: () => `The duffel turns right side out and rotates on the table: round ends, zipper along the top, handles arching ${L(drop)} above.`,
      action: () => `Turn the bag through the zipper and push the end seams out. Load it with 30 lb and lift by the handles; check each box-X and that the end seams sit round, not pleated.`,
      exec: () => `No sewing.`,
    });

    const views = {
      front: `A ${L(Ld)} × ${L(Dd)} barrel of ${mat.name}; two handle straps wrap the body ${L(2 * vS)} apart and rise ${L(drop)} above the zipper.`,
      side: `A perfect ${L(Dd)} circle — the end cap — with the zipper tape crossing the top and the two handle loops standing above.`,
      iso: `A cylinder lying on its side: smooth curved body, crisp circular end seams, and the zipper panel as a flat ${L(zw)} strip along the top.`,
    };

    return { panels, notions, seams, steps, views, needsTurning: true, summary: `${L(Ld)} × Ø${L(Dd)} barrel duffel.`, geom: g };
  },

  rig(kit, ctx, plan) {
    const THREE = kit.THREE;
    const g = plan.geom;
    const { Ld, R, zw, Wb, hw, vS, drop, bind } = g;
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, sm) => (seams[id] ||= []).push(sm);

    const root = kit.group();
    const flipG = kit.group(root);
    const frame = kit.group(flipG);
    // Sheet x (around the body) → world −z, sheet y (along the bag) → world x, sheet z → world −y.
    frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
    frame.position.y = 0.04;
    const bend = Deform.bend({ R, uc: 0 });

    const body = kit.sheet({ parent: frame, w: Wb, h: Ld, u0: -Wb / 2, v0: -Ld / 2, deform: bend, fabric: 'main' });
    add('S4', kit.seam(body, [[Wb / 2 - 0.18, -Ld / 2], [Wb / 2 - 0.18, Ld / 2]], { spi: spiOf('S4'), band: g.s }));
    add('S4', kit.seam(body, [[-Wb / 2 + 0.18, Ld / 2], [-Wb / 2 + 0.18, -Ld / 2]], { spi: spiOf('S4'), band: g.s }));
    kit.label('A', body, 0, 0);

    const zipG = kit.group(frame);
    const zipPanel = kit.sheet({ parent: zipG, w: zw, h: Ld, u0: Wb / 2, v0: -Ld / 2, deform: bend, fabric: 'main' });
    const coil = kit.sheet({ parent: zipG, w: 0.36, h: Ld, u0: Wb / 2 + zw / 2 - 0.18, v0: -Ld / 2, deform: bend, fabric: 'trim', offset: 0.03, outline: false });
    const zipSheets = [zipPanel, coil];
    for (const du of [-0.36, 0.36]) {
      add('S3', kit.seam(zipPanel, [[Wb / 2 + zw / 2 + du, -Ld / 2 + 0.3], [Wb / 2 + zw / 2 + du, Ld / 2 - 0.3]], { spi: spiOf('S3'), band: 0.5, lift: 0.05 }));
    }
    kit.label('B', zipPanel, Wb / 2 + zw / 2, 0);

    // Straps sewn to the body, following its bend.
    const strapG = kit.group(frame);
    const straps = [];
    const uEnd = Wb / 2 - 1;
    for (const v of [-vS, vS]) {
      const st = kit.sheet({ parent: strapG, w: 2 * uEnd, h: hw, u0: -uEnd, v0: v - hw / 2, deform: bend, fabric: 'accent', offset: 0.07 });
      const e = hw / 2 - 0.12;
      add('S1', kit.seam(st, [[-uEnd + 2.3, v - e], [uEnd - 2.3, v - e]], { spi: spiOf('S1'), band: 0.3 }));
      add('S1', kit.seam(st, [[uEnd - 2.3, v + e], [-uEnd + 2.3, v + e]], { spi: spiOf('S1'), band: 0.3 }));
      add('S2', kit.seam(st, boxX(uEnd - 2.1, uEnd - 0.2, v - e, v + e), { spi: spiOf('S2'), band: hw }));
      add('S2', kit.seam(st, boxX(-uEnd + 0.2, -uEnd + 2.1, v - e, v + e), { spi: spiOf('S2'), band: hw }));
      straps.push(st);
    }
    kit.label('D', straps[0], 0, -vS);

    // Carry loops: arches over the zipper, in the plane across the bag.
    const th = uEnd / R;
    const xe = R * Math.sin(th);
    const ze = -R * (1 - Math.cos(th));
    const arch = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = Math.PI * t;
      arch.push([xe * Math.cos(a) * (1 + 0.5 * Math.sin(a)), ze - (drop + 0.4) * Math.sin(a) - 0.07]);
    }
    let archLen = 0;
    for (let i = 1; i < arch.length; i++) archLen += Math.hypot(arch[i][0] - arch[i - 1][0], arch[i][1] - arch[i - 1][1]);
    const loops = [];
    for (const v of [-vS, vS]) {
      const d = Deform.wrap({ path: arch });
      loops.push(kit.sheet({ parent: frame, w: archLen - 0.02, h: hw, u0: 0, v0: v - hw / 2, deform: d, fabric: 'accent', morph: 1 }));
    }

    // End caps.
    const capPts = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      capPts.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
    const caps = [];
    for (const side of [1, -1]) {
      const cg = kit.group(root);
      const cap = kit.shape({ parent: cg, outline: capPts, fabric: 'main' });
      const ring = (r) => capPts.map(([x, y]) => [(x * r) / R, (y * r) / R]);
      add('S5', kit.seam(cap, ring(R - 0.12), { spi: spiOf('S5'), closed: true, band: g.s }));
      let tape = null;
      if (bind) {
        add('S6', kit.seam(cap, ring(R - 0.5), { spi: spiOf('S6'), closed: true, band: 0.5, side: -1 }));
        tape = kit.tube({ parent: cap.obj, points: ring(R - 0.3).map(([x, y]) => [x, y, -0.25]), radius: 0.22, fabric: 'trim' });
      }
      caps.push({ cg, cap, tape, side });
    }
    kit.label('C', caps[0].cap, 0, 0);

    const qFinal = (side) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2);
    const qPrep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

    const params = { face: 1, zipGap: 1, strapT: 0, bend: 0, loopOp: 0, capT: 0, bind: 0, shellOp: 1 };
    const poses = {
      prep: { ...params },
      handles: { strapT: 1 },
      zipper: { face: 0, zipGap: 0.35 },
      tube: { zipGap: 0, bend: 1, loopOp: 1 },
      caps: { capT: 1 },
      bind: { bind: 1, shellOp: 0.3 },
      final: { shellOp: 1 },
    };
    const span = Math.max(Ld, 2 * R);
    const cams = {
      prep: fitCam(0, 66),
      handles: fitCam(0, 70, 0.95),
      zipper: fitCam(0, 62),
      tube: cam([0, R, 0], span * 2.1, 35, 26),
      caps: cam([0, R, 0], span * 2.2, 62, 18),
      bind: cam([0, R, 0], span * 1.9, 70, 24),
      final: cam([0, R + drop / 3, 0], span * 2.1, 35, 22),
    };

    return {
      params,
      poses,
      cams,
      seams,
      labelScale: Math.max(1.6, span / 10),
      apply(p) {
        flipG.rotation.x = Math.PI * p.face;
        zipG.position.x = p.zipGap * 6;
        strapG.position.x = -(1 - p.strapT) * (Wb + 4);
        for (const part of [body, ...zipSheets, ...straps]) part.setMorph(p.bend);
        for (const c of caps) {
          const t = p.capT;
          const prepPos = new THREE.Vector3(c.side * (Ld / 2 + R + 3), 0.05, 0);
          const finalPos = new THREE.Vector3((c.side * Ld) / 2, R + 0.04, 0);
          c.cg.position.lerpVectors(prepPos, finalPos, t);
          c.cg.position.y += Math.sin(Math.PI * t) * R * 0.6;
          c.cg.quaternion.slerpQuaternions(qPrep, qFinal(c.side), t);
          c.tape?.setReveal(p.bind);
        }
        for (const part of [body, ...zipSheets, ...straps, ...caps.map((c) => c.cap)]) part.setOpacity(p.shellOp);
        // Carry loops only stand up once the tube has closed.
        const loopOp = Math.min(p.loopOp, Math.max(0, (p.bend - 0.85) / 0.15));
        for (const l of loops) l.setOpacity(loopOp * (p.shellOp > 0.5 ? 1 : 0.5));
      },
    };
  },
};
