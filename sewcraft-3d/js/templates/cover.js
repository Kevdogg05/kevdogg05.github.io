// Fitted equipment cover (grill, generator, outboard, AC unit): top panel,
// four walls, flat-felled or welted seams, drawcord channel hem.
import { b, machineLine, execTail, pivotHow, holdNote, changeover, fitCam } from './common.js';

const ICON = `<svg viewBox="0 0 48 48"><path d="M10 14h28l2 26H8z" fill="currentColor" opacity=".18"/><path d="M10 14h28l2 26H8zM10 14l-2 26M38 14l2 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 36h32" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>`;

function geometry(ctx) {
  const { d, o, sa } = ctx;
  const L = d.length, Wd = d.depth, Hc = d.height;
  const welt = o.seam === 'welt';
  const channel = o.hem === 'channel';
  const hemA = channel ? 2 : 1;
  const corner = welt ? sa.seam : 0.75;
  return { L, Wd, Hc, welt, channel, hemA, corner, s: sa.seam, P: 2 * (L + Wd) };
}

export default {
  id: 'cover',
  name: 'Equipment Cover',
  category: 'Marine & outdoor',
  blurb: 'Fitted box cover for a grill, generator or outboard: five panels, weather-shedding seams, drawcord hem.',
  icon: ICON,
  usesLining: false,
  structural: false,
  dims: [
    { key: 'length', label: 'Equipment length', min: 10, max: 72, step: 0.5, default: 30 },
    { key: 'depth', label: 'Equipment depth', min: 8, max: 48, step: 0.5, default: 20 },
    { key: 'height', label: 'Cover drop (height)', min: 8, max: 48, step: 0.5, default: 24 },
  ],
  options: [
    { key: 'seam', label: 'Seam style', type: 'select', default: 'felled', choices: [{ value: 'felled', label: 'Flat-felled corners (no welt)' }, { value: 'welt', label: 'Welted top seam' }] },
    { key: 'hem', label: 'Bottom edge', type: 'select', default: 'channel', choices: [{ value: 'channel', label: 'Drawcord channel' }, { value: 'hem', label: 'Plain double-fold hem' }] },
  ],
  defaults: { material: 'acrylic' },

  plan(ctx) {
    const g = geometry(ctx);
    const { L, Wd, Hc, welt, channel, hemA, corner, s, P } = g;
    const { L: fl, mat } = ctx;
    const ease = 0.5;

    const wall = (id, name, w) => ({
      id,
      name,
      fabric: 'main',
      qty: 2,
      outline: [[0, 0], [w + ease, 0], [w + ease, Hc], [0, Hc]],
      saEdges: [hemA, corner, s, corner],
      grain: 'v',
      notches: [{ x: (w + ease) / 2, y: Hc, nx: 0, ny: 1, sa: s, label: 'C' }],
      folds: channel
        ? [{ pts: [[0, 0], [w + ease, 0]], label: 'hem fold' }, { pts: [[0, -1.5], [w + ease, -1.5]], label: 'turn under', minor: true }]
        : [{ pts: [[0, 0], [w + ease, 0]], label: 'hem fold' }],
      marks: [],
      shade: [],
      contour: `Flat wall that hangs straight down; ${welt ? 'its top edge meets the welt' : 'its side edges become flat-felled corners'}. Includes ${fl(ease)} wearing ease.`,
    });
    const panels = [
      {
        id: 'A',
        name: 'Top',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [L + ease, 0], [L + ease, Wd + ease], [0, Wd + ease]],
        sa: s,
        grain: 'v',
        notches: [
          { x: (L + ease) / 2, y: 0, nx: 0, ny: -1, sa: s, label: 'CF' },
          { x: (L + ease) / 2, y: Wd + ease, nx: 0, ny: 1, sa: s, label: 'CB' },
          { x: 0, y: (Wd + ease) / 2, nx: -1, ny: 0, sa: s },
          { x: L + ease, y: (Wd + ease) / 2, nx: 1, ny: 0, sa: s },
        ],
        folds: [],
        marks: [],
        shade: [],
        contour: 'Flat roof panel; its four corners are rigid 90° pivots where the walls meet it.',
      },
      wall('B', 'Front & back walls', L),
      wall('C', 'Side walls', Wd),
    ];
    if (welt) {
      panels.push({
        id: 'D',
        name: 'Welt cover strip',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [P + 6, 0], [P + 6, 1.5], [0, 1.5]],
        sa: 0,
        grain: 'h',
        rotatable: true,
        notches: [],
        folds: [{ pts: [[0, 0.75], [P + 6, 0.75]], label: 'wraps the cord', minor: true }],
        marks: [],
        shade: [],
        contour: '1½″ strip (cut size). Piece it with diagonal seams if it is longer than the roll.',
      });
    }

    const notions = [];
    if (channel) {
      notions.push({ label: '⅛″ shock cord or drawcord', qty: fl(P + 24), note: 'Plus one cord lock.' });
      notions.push({ label: '#0 grommets (or 2 bartacked buttonholes)', qty: '2', note: 'Centre back, in the channel, for the cord to exit.' });
    }
    if (welt) notions.push({ label: '5⁄32″ polyester welt cord', qty: fl(P + 6), note: 'For the welted top seam.' });

    const seams = [
      { id: 'S1', name: 'Corner seams', type: welt ? 'topstitched' : 'flatFelled', role: 'construction', length: Hc, count: 4 },
      { id: 'S2', name: welt ? 'Welted top seam' : 'Top seam, topstitched', type: welt ? 'welt' : 'topstitched', role: welt ? 'welt' : 'construction', length: P, count: 1 },
      { id: 'S3', name: channel ? 'Drawcord channel' : 'Bottom hem', type: channel ? 'channel' : 'hem', role: 'hem', length: P, count: 1 },
    ];

    const steps = [
      {
        id: 'prep',
        title: 'Cut, mark & prep',
        pose: 'prep',
        frame: () =>
          `The cover lies on the table as a flat cross: the top ${b('A')} in the middle, the front and back walls ${b('B')} and the side walls ${b('C')} folded out around it, face up. Notches mark the centre of every edge.`,
        action: () =>
          `Measure the equipment and add the ${fl(ease)} ease already built in. Cut one top, two front/back walls and two side walls${welt ? ' and a welt strip' : ''}. ${mat.cut}`,
        exec: () => `No sewing yet. ${mat.edge}`,
      },
      {
        id: 'corners',
        title: welt ? 'Sew the walls into a ring' : 'Flat-fell the corner seams',
        role: 'construction',
        layers: [{ f: 'main', n: welt ? 3 : 4 }],
        seams: ['S1'],
        prefer: '2206RB',
        pose: 'corners',
        frame: () => `The walls fold down and the cover rises off the table into its box shape. The four vertical corner seams highlight red, then stitch from the top down — ${welt ? 'one seam line plus a topstitch' : 'two parallel rows on each, the signature of a flat-felled seam'}.`,
        action: (c) =>
          welt
            ? `Sew each front/back wall to a side wall, right sides together at ${fl(corner)}, to make a closed ring. Press the allowances toward the front and back and topstitch ⅛″ from the seam. ${holdNote(c)}`
            : `Right sides together, sew each corner at ¾″. Trim the front/back allowance to ¼″, wrap the side allowance over it, fold the pair flat toward the front/back wall and topstitch the fold down — four layers, no raw edges. ${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. ${welt ? '' : 'Sew the first pass, trim and wrap, then topstitch ⅛″ from the fold and again ⅛″ from the first seam. '}${execTail(c)}`,
      },
      {
        id: 'top',
        title: welt ? 'Welt & set the top' : 'Set the top & topstitch',
        role: welt ? 'welt' : 'construction',
        layers: welt ? [{ f: 'main', n: 4 }, { f: 'weltCord', n: 1 }] : [{ f: 'main', n: 4 }],
        seams: ['S2'],
        pivot: true,
        prefer: '2206RB',
        pose: 'top',
        frame: () => `${welt ? 'The welt cord wraps the top edge and ' : ''}the top seam glows red around all four sides, stitching continuously and pivoting at each corner.`,
        action: () =>
          `${welt ? 'Cover the welt cord with the strip and sew it to the top panel first, clipping the welt allowance at the corners. ' : ''}Match the top's centre notches to the wall notches and each corner seam to a top corner. Clip the wall allowance to the stitch line ½″ either side of each corner so it can turn.`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)}. Sew with the wall on top; at each corner ${pivotHow(c)}. ${welt ? 'Crowd the welt with the welt foot.' : 'Then press the allowance toward the walls and topstitch ⅛″ below the seam all the way round.'} ${execTail(c)}`,
      },
      {
        id: 'hem',
        title: channel ? 'Hem the drawcord channel' : 'Hem the bottom edge',
        role: 'hem',
        layers: [{ f: 'main', n: welt ? 3 : 5 }],
        seams: ['S3'],
        pose: 'hem',
        frame: () => `Around the bottom, the edge rolls under twice; ${channel ? 'a stitch line ⅛″ from the inner fold closes a 1″ channel and the drawcord threads through it.' : 'a stitch line ⅛″ from the inner fold locks the hem.'}`,
        action: () =>
          channel
            ? `Set two grommets at centre back, ¾″ above the raw edge. Fold the bottom under ½″, then 1½″, and clip. At the corners, splay the felled allowances so they lie flat.`
            : 'Fold the bottom under ½″, then ½″ again, and clip.',
        exec: (c) => `${changeover(c)}${machineLine(c)}. Sew from the inside with the cover around the arm, ⅛″ from the inner fold, overlapping the start by 1″. ${execTail(c)}`,
      },
      {
        id: 'final',
        title: channel ? 'Thread the cord & fit' : 'Fit the cover',
        pose: 'final',
        spin: true,
        frame: () => `The finished cover lifts and drops over the equipment${channel ? ', the drawcord cinching it snug at the base' : ''}.`,
        action: () => `${channel ? 'Thread the cord through the channel with a bodkin, out through both grommets, and add the cord lock. ' : ''}Fit the cover; it should slide on without strain and hang 1″ clear of the ground.`,
        exec: () => `No sewing.`,
      },
    ];

    const views = {
      front: `A ${fl(L)} × ${fl(Hc)} wall of ${mat.name}, ${welt ? 'framed at the top by a welt cord' : 'with flat-felled corners showing as twin topstitch rows at each edge'}${channel ? ', drawn in at the hem by the cord' : ''}.`,
      side: `A ${fl(Wd)} × ${fl(Hc)} wall; the corner seams run plumb from the roof line to the hem.`,
      iso: `A crisp box ${fl(L)} × ${fl(Wd)} × ${fl(Hc)}: flat roof, rigid 90° roof corners, straight walls and a stitched hem band.`,
    };

    return { panels, notions, seams, steps, views, needsTurning: false, summary: `${fl(L)} × ${fl(Wd)} × ${fl(Hc)} fitted cover.`, geom: g };
  },

  rig(kit, ctx, plan) {
    const THREE = kit.THREE;
    const g = plan.geom;
    const { L, Wd, Hc, welt, channel } = g;
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, sm) => (seams[id] ||= []).push(sm);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    const root = kit.group();
    const topG = kit.group(root);
    topG.rotation.x = -Math.PI / 2;
    const top = kit.sheet({ parent: topG, w: L, h: Wd, u0: -L / 2, v0: -Wd / 2, fabric: 'main' });
    kit.label('A', top, 0, 0);

    const hinges = [];
    const wallDefs = [
      { pos: V(0, 0, Wd / 2), axis: 'x', sign: 1, basis: [V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0)], w: L, label: 'B' },
      { pos: V(0, 0, -Wd / 2), axis: 'x', sign: -1, basis: [V(1, 0, 0), V(0, 0, -1), V(0, 1, 0)], w: L },
      { pos: V(L / 2, 0, 0), axis: 'z', sign: -1, basis: [V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)], w: Wd, label: 'C' },
      { pos: V(-L / 2, 0, 0), axis: 'z', sign: 1, basis: [V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0)], w: Wd },
    ];
    const walls = [];
    for (const d of wallDefs) {
      const hinge = kit.group(root);
      hinge.position.copy(d.pos);
      const base = kit.group(hinge);
      base.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(...d.basis));
      const w = kit.sheet({ parent: base, w: d.w, h: Hc, u0: -d.w / 2, v0: 0, fabric: 'main' });
      hinges.push({ hinge, axis: d.axis, sign: d.sign });
      walls.push(w);
      if (d.label) kit.label(d.label, w, 0, Hc / 2);
      // Top seam and hem run along every wall.
      add('S2', kit.seam(w, [[-d.w / 2, 0.14], [d.w / 2, 0.14]], { spi: spiOf('S2'), band: g.s }));
      add('S3', kit.seam(w, [[-d.w / 2, Hc - 0.2], [d.w / 2, Hc - 0.2]], { spi: spiOf('S3'), band: 0.5 }));
      if (channel) add('S3', kit.seam(w, [[-d.w / 2, Hc - 1.15], [d.w / 2, Hc - 1.15]], { spi: spiOf('S3'), band: 0.5 }));
    }
    // Corner seams on the front and back walls (two rows when flat-felled).
    for (const w of [walls[0], walls[1]]) {
      for (const sgn of [1, -1]) {
        const rows = welt ? [0.12, 0.3] : [0.12, 0.62];
        for (const r of rows) add('S1', kit.seam(w, [[sgn * (L / 2 - r), 0], [sgn * (L / 2 - r), Hc]], { spi: spiOf('S1'), band: 0.75 }));
      }
    }

    let weltTube = null;
    if (welt) {
      const pts = [[-L / 2 - 0.08, -Wd / 2 - 0.08], [L / 2 + 0.08, -Wd / 2 - 0.08], [L / 2 + 0.08, Wd / 2 + 0.08], [-L / 2 - 0.08, Wd / 2 + 0.08]];
      const dense = [];
      for (let i = 0; i < 4; i++) {
        const a = pts[i];
        const bq = pts[(i + 1) % 4];
        for (let k = 0; k < 12; k++) dense.push([a[0] + ((bq[0] - a[0]) * k) / 12, a[1] + ((bq[1] - a[1]) * k) / 12, 0.08]);
      }
      weltTube = kit.tube({ parent: top.obj, points: dense, radius: 0.14, fabric: 'main' });
    }
    let cord = null;
    if (channel) {
      const y = -Hc + 0.6;
      const o = 0.16;
      const pts = [[-L / 2 - o, y, Wd / 2 + o], [L / 2 + o, y, Wd / 2 + o], [L / 2 + o, y, -Wd / 2 - o], [-L / 2 - o, y, -Wd / 2 - o]];
      const dense = [];
      for (let i = 0; i < 4; i++) {
        const a = pts[i];
        const bq = pts[(i + 1) % 4];
        for (let k = 0; k < 10; k++) dense.push(a.map((v, j) => v + ((bq[j] - v) * k) / 10));
      }
      cord = kit.tube({ parent: root, points: dense, radius: 0.09, color: '#22252a' });
    }
    const equip = kit.solid({ w: L - 0.6, h: Hc - 0.2, d: Wd - 0.6, color: '#4b5768' });
    equip.mesh.position.set(0, (Hc - 0.2) / 2, 0);

    const params = { fold: 0, lift: 0, welt: 0, cord: 0, drape: 0, equipOp: 0 };
    const poses = {
      prep: { ...params },
      corners: { fold: 1, lift: 1 },
      top: { welt: 1 },
      hem: {},
      final: { cord: 1, drape: 1, equipOp: 1 },
    };
    const span = Math.max(L, Wd, Hc);
    const cams = {
      prep: fitCam(0, 68),
      corners: fitCam(40, 16, 1.2),
      top: fitCam(35, 38, 1.15),
      hem: fitCam(50, 8, 1.2),
      final: fitCam(35, 22, 1.2),
    };

    return {
      params,
      poses,
      cams,
      seams,
      labelScale: Math.max(1.6, span / 10),
      apply(p) {
        for (const h of hinges) h.hinge.rotation[h.axis] = h.sign * (Math.PI / 2) * p.fold;
        root.position.y = p.lift * (Hc + 0.25) + Math.sin(Math.PI * p.drape) * Hc * 0.7;
        weltTube?.setReveal(p.welt);
        cord?.setReveal(p.cord);
        equip.setOpacity(Math.min(1, p.equipOp * 3));
      },
    };
  },
};
