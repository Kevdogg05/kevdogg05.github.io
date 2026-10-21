// Shop apron (apparel): shaped bib with bound armhole curves, double-fold
// hems, divided patch pocket, webbing neck strap and waist ties. Leather
// switches to burnished raw edges with a perimeter stitch.
import { b, machineLine, execTail, pivotHow, holdNote, changeover, fitCam, cam, boxX } from './common.js';
import { offsetPolygon, translate } from '../engine/geom2d.js';

const ICON = `<svg viewBox="0 0 48 48"><path d="M17 6h14c0 7 3 11 8 12v24H9V18c5-1 8-5 8-12z" fill="currentColor" opacity=".18"/><path d="M17 6h14c0 7 3 11 8 12v24H9V18c5-1 8-5 8-12zM13 28h22v8H13zM24 28v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

function curvePts(g, side, n = 14) {
  // Quarter-ellipse armhole, centred on the top corner of the rectangle.
  const { La, Wa, Bh, a } = g;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = side < 0 ? ((n - i) / n) * (Math.PI / 2) : (i / n) * (Math.PI / 2);
    const x = side < 0 ? a * Math.sin(t) : Wa - a * Math.sin(t);
    pts.push([x, La - Bh * Math.cos(t)]);
  }
  return pts;
}

function geometry(ctx) {
  const { d, o, mat } = ctx;
  const La = d.length, Wa = d.width, Bw = Math.min(d.bib, d.width - 6), Bh = Math.min(d.bibDepth, d.length - 12);
  const a = (Wa - Bw) / 2;
  const g = { La, Wa, Bw, Bh, a, pockets: o.pockets, leather: mat.group === 'Leather' };
  const right = curvePts(g, 1);
  const left = curvePts(g, -1);
  g.right = right;
  g.left = left;
  // Outline CCW: bottom, right side, right armhole, bib top, left armhole, left side.
  g.outline = [[0, 0], [Wa, 0], ...right, ...left];
  const nC = right.length - 1;
  const hem = g.leather ? 0 : 1;
  g.saEdges = [hem, hem, ...new Array(nC).fill(0), hem, ...new Array(nC).fill(0), hem];
  g.arc = right.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - right[i - 1][0], p[1] - right[i - 1][1]) : 0), 0);
  g.PW = Wa - 4;
  g.PH = Math.min(9, (La - Bh) * 0.45);
  g.pTop = La - Bh - 3;
  g.dividers = o.pockets === '3' ? [1 / 3, 2 / 3] : o.pockets === '2' ? [0.5] : [];
  return g;
}

export default {
  id: 'apron',
  name: 'Shop Apron',
  category: 'Apparel',
  blurb: 'Bib apron: bound armhole curves, double-fold hems, divided patch pocket, webbing neck strap and ties. Leather gets burnished edges.',
  icon: ICON,
  usesLining: false,
  structural: false,
  dims: [
    { key: 'length', label: 'Length (bib top to hem)', min: 24, max: 42, step: 0.5, default: 34 },
    { key: 'width', label: 'Width at hips', min: 18, max: 32, step: 0.5, default: 24 },
    { key: 'bib', label: 'Bib width', min: 8, max: 15, step: 0.5, default: 11 },
    { key: 'bibDepth', label: 'Bib depth (top to waist)', min: 8, max: 18, step: 0.5, default: 12 },
  ],
  options: [
    { key: 'pockets', label: 'Pocket band', type: 'select', default: '3', choices: [{ value: '3', label: '3 pockets' }, { value: '2', label: '2 pockets' }, { value: 'none', label: 'No pocket' }] },
  ],
  defaults: { material: 'duck18' },

  plan(ctx) {
    const g = geometry(ctx);
    const { La, Wa, Bw, Bh, a, PW, PH, pTop, dividers, leather, outline, saEdges, arc } = g;
    const { L, mat } = ctx;
    const hasPocket = g.pockets !== 'none';

    const panels = [
      {
        id: 'A',
        name: 'Apron body',
        fabric: 'main',
        qty: 1,
        outline,
        saEdges,
        grain: 'v',
        notches: [
          { x: Wa / 2, y: 0, nx: 0, ny: -1, sa: leather ? 0.15 : 1, label: 'CF' },
          { x: Wa / 2, y: La, nx: 0, ny: 1, sa: leather ? 0.15 : 1, label: 'CF' },
          { x: 0, y: La - Bh, nx: -1, ny: 0, sa: leather ? 0.15 : 1, label: 'waist' },
          { x: Wa, y: La - Bh, nx: 1, ny: 0, sa: leather ? 0.15 : 1, label: 'waist' },
        ],
        folds: leather ? [] : [{ pts: [[0, 0], [Wa, 0]], label: 'hem fold' }, { pts: [[a, La], [Wa - a, La]], label: 'hem fold' }],
        marks: [
          ...(hasPocket ? [{ x: 2, y: pTop - PH, w: PW, h: PH, label: 'pocket' }] : []),
          { x: a + 0.4, y: La - 2, w: 1, h: 1.6, label: 'strap' },
          { x: Wa - a - 1.4, y: La - 2, w: 1, h: 1.6 },
          { x: 0.6, y: La - Bh - 1.4, w: 1.6, h: 1, label: 'tie' },
          { x: Wa - 2.2, y: La - Bh - 1.4, w: 1.6, h: 1 },
        ],
        shade: [{ type: 'curve', pts: [...g.left.slice().reverse(), [0, La]] }, { type: 'curve', pts: [...g.right, [Wa, La]] }],
        contour: `Flat body with two concave armhole curves (shaded) sweeping from the ${L(Bw)} bib down to the ${L(Wa)} waist. ${leather ? 'Every edge is a finished raw edge.' : 'Straight edges hem; the curves are bound because a folded hem will not lie flat on a concave curve.'}`,
      },
    ];
    if (hasPocket) {
      panels.push({
        id: 'B',
        name: 'Pocket band',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [PW, 0], [PW, PH], [0, PH]],
        saEdges: leather ? [0, 0, 0, 0] : [0.5, 0.5, 1, 0.5],
        grain: 'v',
        notches: dividers.map((f) => ({ x: PW * f, y: PH, nx: 0, ny: 1, sa: leather ? 0.15 : 1 })),
        folds: leather ? [] : [{ pts: [[0, PH], [PW, PH]], label: 'hem fold' }],
        marks: [],
        shade: [],
        contour: `Flat band; ${dividers.length ? `${dividers.length} stitched divider${dividers.length > 1 ? 's' : ''} split it into ${dividers.length + 1} pockets` : 'a single wide pocket'}.`,
      });
    }

    const notions = [
      { label: '1″ cotton or poly webbing', qty: `${L(24)} neck strap + 2 × ${L(32)} ties`, note: 'Sear synthetic webbing ends; hem cotton webbing ends.' },
    ];
    if (!leather) notions.push({ label: '1″ double-fold bias binding', qty: `2 × ${L(arc + 2)}`, note: 'For the armhole curves.' });
    if (leather) notions.push({ label: 'Edge beveler, dye and burnishing compound', qty: '—', note: 'Leather edges are finished, not hemmed.' });

    const seams = leather
      ? [{ id: 'S0', name: 'Perimeter edge-stitch', type: 'edgeStitch', role: 'topstitch', length: 2 * La + Wa + Bw, count: 1 }]
      : [
          { id: 'S1', name: 'Bind the armhole curves', type: 'edgeBound', role: 'binding', length: arc, count: 2 },
          { id: 'S2', name: 'Side hems', type: 'hem', role: 'hem', length: La - Bh, count: 2 },
          { id: 'S3', name: 'Bottom & bib-top hems', type: 'hem', role: 'hem', length: Wa + Bw, count: 1 },
        ];
    if (hasPocket) {
      if (!leather) seams.push({ id: 'S5', name: 'Pocket top hem', type: 'hem', role: 'hem', length: PW, count: 1 });
      seams.push({ id: 'S6', name: 'Pocket to body + dividers', type: 'edgeStitch', role: 'edgestitch', length: 2 * PH + PW + dividers.length * PH, count: 1 });
    }
    seams.push({ id: 'S7', name: 'Strap & tie box-X tacks', type: 'boxX', role: 'bartack', length: 2 * 1.6 + 2 + 2 * Math.hypot(1.6, 1), count: 4 });

    const steps = [
      {
        id: 'prep',
        title: 'Cut, mark & prep',
        pose: 'prep',
        frame: () => `The apron body ${b('A')} lies face up${hasPocket ? ` with the pocket band ${b('B')} beside it` : ''}. The two armhole curves are shaded; violet boxes mark the pocket, strap and tie positions.`,
        action: () => `Cut the body${hasPocket ? ' and pocket band' : ''}. ${mat.cut} Mark the waist notches, pocket placement and the strap and tie boxes — ${mat.mark.toLowerCase()}`,
        exec: () => (leather ? 'No sewing yet. Bevel every edge on both sides, then dye and burnish before stitching — it is much easier while the piece is flat.' : `No sewing yet. ${mat.edge}`),
      },
    ];
    if (leather) {
      steps.push({
        id: 'edges',
        title: 'Edge-stitch the perimeter',
        role: 'topstitch',
        layers: [{ f: 'main', n: 1 }],
        seams: ['S0'],
        pivot: true,
        curve: true,
        pose: 'edges',
        frame: () => `A single decorative stitch line runs ³⁄₁₆″ inside every edge, following the armhole curves and pivoting at the corners.`,
        action: () => `Scribe the stitch line ³⁄₁₆″ from the edge with a wing divider. Start at a hidden point under where a strap will go.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Follow the groove; at corners ${pivotHow(c)}, and through the curves turn every 2–3 stitches. ${execTail(c)}`,
      });
    } else {
      steps.push({
        id: 'armholes',
        title: 'Bind the armhole curves',
        role: 'binding',
        layers: [{ f: 'main', n: 1 }, { f: 'binding', n: 2 }],
        seams: ['S1'],
        curve: true,
        pose: 'armholes',
        frame: () => `Bias binding wraps each concave armhole curve from bib to waist; the stitch line follows it ⅛″ from the binding edge.`,
        action: () => `Pre-shape the bias binding to the curve with a steam iron. Fold it over the raw edge, easing it (not stretching) through the deepest part of the curve. Leave ½″ beyond each end — the hems fold over it.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Sew with the curve to the right of the needle; stop needle-down every few stitches and turn the work so the binding feeds straight. ${execTail(c)}`,
      });
      steps.push({
        id: 'sides',
        title: 'Hem the sides',
        role: 'hem',
        layers: [{ f: 'main', n: 3 }],
        seams: ['S2'],
        pose: 'sides',
        frame: () => `Both straight sides roll under twice and stitch from the waist down to the hem.`,
        action: (c) => `Fold each side under ½″ then ½″ again, catching the binding tails. Press with steam. ${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}, ⅛″ from the inner fold. ${execTail(c)}`,
      });
      steps.push({
        id: 'hems',
        title: 'Hem the bottom & bib top',
        role: 'hem',
        layers: [{ f: 'main', n: 5 }],
        seams: ['S3'],
        pose: 'hems',
        frame: () => `The bottom edge and the bib top fold under twice; the stitch lines run straight across, crossing the side hems at the corners.`,
        action: () => `Fold ½″ then ½″ at the bottom and the bib top; at the bottom corners trim the side hem allowance inside the fold to cut bulk.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. The corners stack ${c.MM(c.u.stackMm)} — hand-wheel across them. ${execTail(c)}`,
      });
    }
    if (hasPocket) {
      if (!leather) {
        steps.push({
          id: 'pocketHem',
          title: 'Hem the pocket band',
          role: 'hem',
          layers: [{ f: 'main', n: 3 }],
          seams: ['S5'],
          pose: 'pocketHem',
          frame: () => `The pocket band's top edge rolls under twice and stitches across.`,
          action: () => `Double-fold the top ½″ + ½″ and press the other three edges under ½″.`,
          exec: (c) => `${changeover(c)}${machineLine(c)}. ${execTail(c)}`,
        });
      }
      steps.push({
        id: 'pocket',
        title: 'Attach the pocket band',
        role: 'edgestitch',
        layers: [{ f: 'main', n: leather ? 2 : 4 }],
        seams: ['S6'],
        pivot: true,
        prefer: '2206RB',
        pose: 'pocket',
        frame: () => `The pocket band slides into place below the waist and edge-stitches down three sides; ${dividers.length ? `${dividers.length} divider line${dividers.length > 1 ? 's' : ''} then stitch top to bottom` : 'it stays one open pocket'}.`,
        action: (c) => `Place the band on its marks, ${L(3)} below the waist. ${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Edge-stitch the sides and bottom, pivoting needle-down at the corners, and lock both top corners with a small triangle. Sew the dividers bottom-to-top with a bartack at the top. ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'straps',
      title: 'Box-X the neck strap & ties',
      role: 'bartack',
      layers: [{ f: 'webbing1', n: 2 }, { f: 'main', n: leather ? 1 : 3 }],
      seams: ['S7'],
      prefer: '2206RB',
      pose: 'straps',
      frame: () => `The neck strap arches over the bib and the two ties extend from the waist; each end gets a box-X.`,
      action: () => `Fold each webbing end under ½″, lay it on the back of the apron in its box, and check the neck strap is not twisted.`,
      exec: (c) => `${changeover(c)}${machineLine(c)}. Box-X each end — rectangle first, then the X. ${execTail(c)}`,
    });
    steps.push({
      id: 'final',
      title: 'Hang & inspect',
      pose: 'final',
      spin: true,
      frame: () => `The apron lifts off the table and hangs as if worn: bib up, pockets at the hips, ties trailing.`,
      action: () => `Try it on; the bib top should sit at the collarbone and the pockets at hand height. Check every bartack.`,
      exec: () => `No sewing.`,
    });

    const views = {
      front: `A ${L(Wa)}-wide, ${L(La)}-long panel of ${mat.name}: a ${L(Bw)} bib rising between two concave armhole curves, ${hasPocket ? `a ${L(PW)} pocket band ${dividers.length ? `split into ${dividers.length + 1}` : ''} below the waist,` : ''} ${leather ? 'burnished edges' : 'hemmed edges'} all round.`,
      side: `Almost flat — a single layer that drapes from the neck strap; the waist ties trail ${L(30)} behind.`,
      iso: `A hanging garment: the bib, the waist line marked by the tie anchors, and the pocket band standing slightly proud of the body.`,
    };

    return { panels, notions, seams, steps, views, needsTurning: false, summary: `${L(Wa)} × ${L(La)} bib apron.`, geom: g };
  },

  rig(kit, ctx, plan) {
    const g = plan.geom;
    const { La, Wa, Bw, Bh, a, PW, PH, pTop, dividers, leather, outline } = g;
    const hasPocket = g.pockets !== 'none';
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, sm) => (seams[id] ||= []).push(sm);
    const X = (x) => x - Wa / 2;
    const C = (pts) => translate(pts, -Wa / 2, 0);

    const pivot = kit.group();
    const body = kit.shape({ parent: pivot, outline: C(outline), fabric: 'main' });
    kit.label('A', body, 0, La / 2);

    if (leather) {
      add('S0', kit.seam(body, offsetPolygon(C(outline), -0.19), { spi: spiOf('S0'), closed: true, band: 0.4 }));
    } else {
      // Armhole binding (tube) and its stitch line, offset into the body.
      const inward = (pts, side, d) =>
        pts.map(([x, y]) => {
          const gx = side < 0 ? x / (a * a) : (x - Wa) / (a * a);
          const gy = (y - La) / (Bh * Bh);
          const l = Math.hypot(gx, gy) || 1;
          return [x + (gx / l) * d, y + (gy / l) * d];
        });
      const bindTubes = [];
      for (const [pts, side] of [[g.left, -1], [g.right, 1]]) {
        bindTubes.push(kit.tube({ parent: body.obj, points: C(inward(pts, side, 0.12)).map(([x, y]) => [x, y, 0.06]), radius: 0.16, closed: false, fabric: 'accent' }));
        add('S1', kit.seam(body, C(inward(pts, side, 0.32)), { spi: spiOf('S1'), band: 0.5 }));
      }
      body.bindTubes = bindTubes;
      add('S2', kit.seam(body, [[X(0.4), La - Bh], [X(0.4), 0.3]], { spi: spiOf('S2'), band: 0.5 }));
      add('S2', kit.seam(body, [[X(Wa - 0.4), La - Bh], [X(Wa - 0.4), 0.3]], { spi: spiOf('S2'), band: 0.5 }));
      add('S3', kit.seam(body, [[X(0.3), 0.4], [X(Wa - 0.3), 0.4]], { spi: spiOf('S3'), band: 0.5 }));
      add('S3', kit.seam(body, [[X(a + 0.3), La - 0.4], [X(Wa - a - 0.3), La - 0.4]], { spi: spiOf('S3'), band: 0.5 }));
    }

    let pocketG = null;
    if (hasPocket) {
      pocketG = kit.group(body.obj);
      const x0 = X(2);
      const pocket = kit.shape({ parent: pocketG, outline: [[x0, pTop - PH], [x0 + PW, pTop - PH], [x0 + PW, pTop], [x0, pTop]], fabric: 'main' });
      pocket.obj.position.z = 0.05;
      kit.label('B', pocket, x0 + PW / 2, pTop - PH / 2);
      if (!leather) add('S5', kit.seam(pocket, [[x0 + 0.2, pTop - 0.35], [x0 + PW - 0.2, pTop - 0.35]], { spi: spiOf('S5'), band: 0.5 }));
      const e = 0.13;
      add('S6', kit.seam(pocket, [[x0 + e, pTop], [x0 + e, pTop - PH + e], [x0 + PW - e, pTop - PH + e], [x0 + PW - e, pTop]], { spi: spiOf('S6'), band: 0.4 }));
      for (const f of dividers) add('S6', kit.seam(pocket, [[x0 + PW * f, pTop - PH + e], [x0 + PW * f, pTop]], { spi: spiOf('S6'), band: 0.3 }));
    }

    // Neck strap and waist ties, lying in the apron's plane.
    const strapG = kit.group(body.obj);
    strapG.position.z = -0.06;
    const xs = Bw / 2 - 0.9;
    const neckPath = [[-xs, La - 1.8], [-xs, La + 2]];
    for (let i = 1; i < 20; i++) {
      const t = Math.PI - (i / 20) * Math.PI;
      neckPath.push([Math.cos(t) * xs, La + 2 + Math.sin(t) * 7]);
    }
    neckPath.push([xs, La + 2], [xs, La - 1.8]);
    const neck = kit.ribbon({ parent: strapG, path: neckPath, width: 1, fabric: 'accent' });
    const ties = [];
    for (const s of [-1, 1]) {
      const x0 = s * (Wa / 2 - 2.2);
      const y0 = La - Bh - 0.9;
      const path = [[x0, y0], [x0 + s * 3, y0], [x0 + s * 7, y0 - 1.2], [x0 + s * 10, y0 - 5], [x0 + s * 11, y0 - 12], [x0 + s * 10.5, y0 - 20]];
      ties.push(kit.ribbon({ parent: strapG, path, width: 1, fabric: 'accent' }));
      // The box-X goes through the body, so it shows on the face.
      const xa = Math.min(x0, x0 + s * 1.5);
      add('S7', kit.seam(body, boxX(xa + 0.1, xa + 1.4, y0 - 0.38, y0 + 0.38), { spi: spiOf('S7'), band: 1 }));
    }
    for (const s of [-1, 1]) add('S7', kit.seam(body, boxX(La - 1.7, La - 0.3, s * xs - 0.38, s * xs + 0.38).map(([y, x]) => [x, y]), { spi: spiOf('S7'), band: 1 }));

    const params = { hang: 0, pocketT: 0, bindT: 0, strapT: 0, strapOp: 0 };
    const poses = {
      prep: { ...params },
      edges: {},
      armholes: { bindT: 1 },
      sides: {},
      hems: {},
      pocketHem: {},
      pocket: { pocketT: 1 },
      straps: { strapT: 1, strapOp: 1 },
      final: { hang: 1 },
    };
    const span = Math.max(La, Wa);
    const cams = {
      prep: fitCam(0, 72),
      edges: fitCam(0, 70, 1.1),
      armholes: cam([0, 0.2, -La / 2 + Bh / 2], span * 1.1, 0, 68),
      sides: fitCam(0, 70, 1.1),
      hems: fitCam(0, 70, 1.1),
      pocketHem: fitCam(0, 70),
      pocket: fitCam(0, 70, 1.1),
      straps: fitCam(0, 70, 1.05),
      final: cam([0, 6 + La * 0.55, 0], span * 2.1, 20, 6),
    };
    const H0 = 6;

    return {
      params,
      poses,
      cams,
      seams,
      labelScale: Math.max(1.6, span / 10),
      apply(p) {
        const t = p.hang;
        pivot.rotation.x = -(Math.PI / 2) * (1 - t);
        pivot.position.set(0, 0.03 + (H0 + Math.sin(Math.PI * t) * 4) * t, (La / 2) * (1 - t));
        body.bindTubes?.forEach((tb) => tb.setReveal(p.bindT));
        if (pocketG) pocketG.position.x = (1 - p.pocketT) * (Wa + 3);
        strapG.position.y = (1 - p.strapT) * 10;
        neck.setOpacity(p.strapOp);
        for (const tie of ties) tie.setOpacity(p.strapOp);
      },
    };
  },
};
