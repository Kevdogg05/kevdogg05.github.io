// Tool roll: outer panel, hemmed pocket panel with stitched dividers, top
// flap, bound perimeter, webbing tie. The finale rolls it up.
import { b, machineLine, execTail, pivotHow, holdNote, changeover, cam, fitCam, boxX } from './common.js';
import { Deform } from '../ui/kit3d.js';

const ICON = `<svg viewBox="0 0 48 48"><rect x="6" y="12" width="36" height="24" rx="2" fill="currentColor" opacity=".18"/><rect x="6" y="12" width="36" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M6 25h36M14 25v11M22 25v11M30 25v11M38 25v11" stroke="currentColor" stroke-width="1.6"/></svg>`;

function geometry(ctx) {
  const { d, o } = ctx;
  const Lr = d.width, Hr = d.height, n = d.pockets;
  const pd = Math.min(d.depth, Hr - 3);
  const fh = o.flap ? Math.min(4, Hr - pd - 1) : 0;
  const spacing = (Lr - 1) / n;
  return { Lr, Hr, pd, n, fh, spacing, flap: Boolean(o.flap), tie: Boolean(o.tie), bindW: 0.5 };
}

export default {
  id: 'toolroll',
  name: 'Tool Roll',
  category: 'Shop & tools',
  blurb: 'Roll-up tool organizer: hemmed pocket panel with stitched dividers, protective flap, bound edges, webbing tie.',
  icon: ICON,
  usesLining: false,
  structural: false,
  dims: [
    { key: 'width', label: 'Open width', min: 12, max: 40, step: 0.5, default: 24 },
    { key: 'height', label: 'Height', min: 8, max: 20, step: 0.5, default: 14 },
    { key: 'depth', label: 'Pocket depth', min: 4, max: 12, step: 0.5, default: 8 },
    { key: 'pockets', label: 'Pockets', min: 3, max: 14, step: 1, default: 8, count: true },
  ],
  options: [
    { key: 'flap', label: 'Top flap over the tools', type: 'toggle', default: true },
    { key: 'tie', label: 'Webbing tie', type: 'toggle', default: true },
  ],
  defaults: { material: 'waxed' },

  plan(ctx) {
    const g = geometry(ctx);
    const { Lr, Hr, pd, n, fh, spacing, flap, tie } = g;
    const { L, mat } = ctx;
    const leather = mat.group === 'Leather';

    const panels = [
      {
        id: 'A',
        name: 'Outer panel',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [Lr, 0], [Lr, Hr], [0, Hr]],
        sa: 0,
        grain: 'v',
        notches: [],
        folds: [],
        marks: [
          { x: 0.25, y: 0.25, w: Lr - 0.5, h: pd - 0.25, label: 'pocket panel' },
          ...(flap ? [{ x: 0.25, y: Hr - fh, w: Lr - 0.5, h: fh - 0.25, label: 'flap' }] : []),
        ],
        shade: [],
        contour: 'Flat panel cut to finished size — the binding encloses every raw edge, so there is no seam allowance.',
      },
      {
        id: 'B',
        name: 'Pocket panel',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [Lr, 0], [Lr, pd], [0, pd]],
        saEdges: [0, 0, 1, 0],
        grain: 'v',
        notches: Array.from({ length: n - 1 }, (_, k) => ({ x: 0.5 + (k + 1) * spacing, y: pd, nx: 0, ny: 1, sa: 1 })),
        folds: [{ pts: [[0, pd], [Lr, pd]], label: 'hem fold' }],
        marks: Array.from({ length: n - 1 }, (_, k) => ({ x: 0.5 + (k + 1) * spacing - 0.02, y: 0.3, w: 0.04, h: pd - 0.4 })),
        shade: [],
        contour: `Flat panel; the ${L(1)} top allowance double-folds into the pocket hem. Notches mark ${n - 1} divider lines ${L(spacing)} apart.`,
      },
    ];
    if (flap) {
      panels.push({
        id: 'C',
        name: 'Flap',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [Lr, 0], [Lr, fh], [0, fh]],
        saEdges: [1, 0, 0, 0],
        grain: 'v',
        notches: [],
        folds: [{ pts: [[0, 0], [Lr, 0]], label: 'hem fold' }],
        marks: [],
        shade: [],
        contour: 'Flat strip caught in the top binding; its free edge is hemmed and folds down over the tool tops.',
      });
    }
    const perim = 2 * (Lr + Hr);
    const notions = [
      { label: leather ? 'Edge paint & burnishing (no binding)' : '1″ binding tape (or 2″ self-bias strips)', qty: leather ? '—' : L(perim + 8), note: leather ? 'Leather edges are bevelled, dyed and burnished instead of bound.' : 'Folded in half over every raw edge.' },
    ];
    if (tie) notions.push({ label: '1″ webbing (or leather lace) tie', qty: L(36), note: 'Wraps the rolled bundle twice.' });

    const seams = [
      { id: 'S1', name: 'Pocket top hem', type: 'hem', role: 'hem', length: Lr, count: 1 },
      ...(flap ? [{ id: 'S2', name: 'Flap hem', type: 'hem', role: 'hem', length: Lr, count: 1 }] : []),
      { id: 'S3', name: 'Baste layers to the outer panel', type: 'baste', role: 'baste', length: Lr + 2 * pd + (flap ? Lr + 2 * fh : 0), count: 1 },
      { id: 'S4', name: 'Pocket dividers', type: 'edgeStitch', role: 'topstitch', length: pd, count: n - 1 },
      { id: 'S5', name: leather ? 'Perimeter edge-stitch' : 'Bind the perimeter', type: leather ? 'edgeStitch' : 'edgeBound', role: leather ? 'topstitch' : 'binding', length: perim, count: 1 },
      ...(tie ? [{ id: 'S6', name: 'Tie box-X', type: 'boxX', role: 'bartack', length: 2 * 1.5 + 2 + 2 * Math.hypot(1.5, 1), count: 1 }] : []),
    ];

    const steps = [
      {
        id: 'prep',
        title: 'Cut, mark & prep',
        pose: 'prep',
        frame: () => `The outer panel ${b('A')} lies face down, with the pocket panel ${b('B')}${flap ? ` and flap ${b('C')}` : ''} beside it${tie ? ' and the tie strap laid out to the right' : ''}. Divider notches line the pocket's top edge.`,
        action: () => `Cut the outer panel to ${L(Lr)} × ${L(Hr)}, the pocket panel to ${L(Lr)} × ${L(pd + 1)}${flap ? ` and the flap to ${L(Lr)} × ${L(fh + 1)}` : ''}. ${mat.cut} Mark the ${n - 1} divider lines on the pocket panel ${L(spacing)} apart — ${mat.mark.toLowerCase()}`,
        exec: () => `No sewing yet. ${mat.edge}`,
      },
      {
        id: 'hems',
        title: flap ? 'Hem the pocket and flap edges' : 'Hem the pocket edge',
        role: 'hem',
        layers: [{ f: 'main', n: 3 }],
        seams: ['S1', ...(flap ? ['S2'] : [])],
        pose: 'hems',
        frame: () => `The pocket's top edge${flap ? ' and the flap\'s free edge' : ''} roll under twice and a stitch line runs ⅛″ from the inner fold.`,
        action: (c) => `${leather ? 'Leather needs no hem — skip the fold and just edge-stitch ³⁄₁₆″ from the edge. ' : 'Fold ½″ then ½″ again and press or crease. '}${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. ${execTail(c)}`,
      },
      {
        id: 'baste',
        title: 'Baste the layers to the outer panel',
        role: 'baste',
        layers: [{ f: 'main', n: 2 }],
        seams: ['S3'],
        pivot: true,
        pose: 'baste',
        frame: () => `The pocket panel${flap ? ' and flap' : ''} slide onto the outer panel, raw edges aligned; a long basting stitch runs around the three raw edges of each, inside the area the binding will cover.`,
        action: (c) => `Lay the pocket panel on the outer panel's wrong side, bottom and sides even${flap ? '; lay the flap face down at the top edge' : ''}. ${holdNote(c)}`,
        exec: (c) => `${changeover(c)}${machineLine(c)} — longest stitch, ¼″ from the edge; ${pivotHow(c)} at the corners. ${execTail(c)}`,
      },
      {
        id: 'dividers',
        title: 'Stitch the pocket dividers',
        role: 'topstitch',
        layers: [{ f: 'main', n: 4 }],
        seams: ['S4'],
        pose: 'dividers',
        frame: () => `${n - 1} divider lines stitch from the bottom edge up to the pocket hem, splitting the panel into ${n} slots ${L(spacing)} wide.`,
        action: () => `Sew each divider from the bottom raw edge up to the hem. At the hem, pivot and sew a small triangle (¼″ across, back down) — that is where the tool handles lever the pocket open.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Start at the bottom edge without backtacking (the binding will lock it) and finish with the triangle tack at the top. ${execTail(c)}`,
      },
      {
        id: 'bind',
        title: leather ? 'Edge-stitch the perimeter' : 'Bind the perimeter',
        role: leather ? 'topstitch' : 'binding',
        layers: [{ f: 'main', n: 4 }, ...(leather ? [] : [{ f: 'binding', n: 2 }])],
        seams: ['S5'],
        pivot: true,
        prefer: '2206RB',
        pose: 'bind',
        frame: () => leather ? `A single decorative stitch line runs ³⁄₁₆″ inside the edge all the way around.` : `Binding tape wraps every raw edge; the stitch line runs around the whole perimeter, mitring at each corner.`,
        action: () =>
          leather
            ? 'Bevel the edges, then mark a ³⁄₁₆″ stitch line with a wing divider. After stitching, dye and burnish the edges.'
            : `Fold the binding over the edge, starting mid-bottom with 1″ folded back. At each corner, stop at the edge, fold the tape up at 45° then down square to form a mitre, and continue.${tie ? ' Tuck the tie end under the binding at the centre of the right edge as you pass it.' : ''}`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Stitch ⅛″ from the binding's inner edge, catching both sides; at corners ${pivotHow(c)}. ${execTail(c)}`,
      },
    ];
    if (tie) {
      steps.push({
        id: 'tie',
        title: 'Box-X the tie',
        role: 'bartack',
        layers: [{ f: 'main', n: 3 }, { f: 'binding', n: 2 }, { f: 'webbing1', n: 1 }],
        seams: ['S6'],
        prefer: '2206RB',
        pose: 'tie',
        frame: () => `A box-X locks the tie where it leaves the right-hand edge.`,
        action: () => `Fold the tie end under ½″ and centre it on the right edge, 1½″ in from the edge.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Sew the rectangle, then the X, through tie, binding and all panel layers. ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'final',
      title: 'Load & roll',
      pose: 'final',
      spin: true,
      frame: () => `The roll curls up from the left-hand end into a tight bundle${tie ? ' and the tie wraps around it' : ''}.`,
      action: () => `Load the tools handles-up, fold the flap down over them and roll from the end opposite the tie.`,
      exec: () => `No sewing.`,
    });

    const views = {
      front: `Open: a ${L(Lr)} × ${L(Hr)} panel of ${mat.name} with ${n} pockets ${L(spacing)} wide across the lower ${L(pd)}${flap ? `, a ${L(fh)} flap across the top` : ''}, bound all round.`,
      side: `Rolled: a cylinder about ${L(Hr)} long, bound edges spiralling at each end${tie ? ', the tie wrapped twice around the middle' : ''}.`,
      iso: `Flat on the bench it reads as three bands — flap, open field and pocket row — framed by the binding.`,
    };

    return { panels, notions, seams, steps, views, needsTurning: false, summary: `${L(Lr)} × ${L(Hr)} tool roll, ${n} pockets.`, geom: g };
  },

  rig(kit, ctx, plan) {
    const g = plan.geom;
    const { Lr, Hr, pd, n, fh, spacing, flap, tie, bindW } = g;
    const leather = plan.mat.group === 'Leather';
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, sm) => (seams[id] ||= []).push(sm);

    const frame = kit.group();
    frame.rotation.x = -Math.PI / 2;
    frame.position.set(-Lr / 2, 0.02, Hr / 2);
    const roll = Deform.roll({ length: Lr, r0: 0.8, b: 0.42 });
    const rollParts = [];
    const sheet = (opts) => {
      const p = kit.sheet({ deform: roll, segU: Math.max(60, Math.round(Lr / 0.25)), ...opts });
      rollParts.push(p);
      return p;
    };

    const outer = sheet({ parent: frame, w: Lr, h: Hr, fabric: 'main', swapSides: true });
    kit.label('A', outer, Lr / 2, Hr / 2);
    const pocketG = kit.group(frame);
    const pocket = sheet({ parent: pocketG, w: Lr, h: pd, fabric: 'main', offset: 0.05 });
    kit.label('B', pocket, Lr / 2, pd / 2);
    add('S1', kit.seam(pocket, [[0.2, pd - 0.35], [Lr - 0.2, pd - 0.35]], { spi: spiOf('S1'), band: 0.5 }));
    add('S3', kit.seam(pocket, [[0.2, pd], [0.2, 0.2], [Lr - 0.2, 0.2], [Lr - 0.2, pd]], { spi: spiOf('S3'), band: 0.4 }));
    for (let k = 1; k < n; k++) {
      const x = 0.5 + k * spacing;
      add('S4', kit.seam(pocket, [[x, 0.25], [x, pd - 0.15], [x - 0.25, pd - 0.4]], { spi: spiOf('S4'), band: 0.25 }));
    }
    let flapG = null;
    if (flap) {
      flapG = kit.group(frame);
      const fl = sheet({ parent: flapG, w: Lr, h: fh, v0: Hr - fh, fabric: 'main', offset: 0.05 });
      kit.label('C', fl, Lr / 2, Hr - fh / 2);
      add('S2', kit.seam(fl, [[0.2, Hr - fh + 0.35], [Lr - 0.2, Hr - fh + 0.35]], { spi: spiOf('S2'), band: 0.5 }));
      add('S3', kit.seam(fl, [[0.2, Hr - fh], [0.2, Hr - 0.2], [Lr - 0.2, Hr - 0.2], [Lr - 0.2, Hr - fh]], { spi: spiOf('S3'), band: 0.4 }));
    }
    // Binding strips along all four edges.
    const binds = leather
      ? []
      : [
          sheet({ parent: frame, w: Lr, h: bindW, v0: 0, fabric: 'accent', offset: 0.09, outline: false }),
          sheet({ parent: frame, w: Lr, h: bindW, v0: Hr - bindW, fabric: 'accent', offset: 0.09, outline: false }),
          sheet({ parent: frame, w: bindW, h: Hr, u0: 0, fabric: 'accent', offset: 0.09, outline: false }),
          sheet({ parent: frame, w: bindW, h: Hr, u0: Lr - bindW, fabric: 'accent', offset: 0.09, outline: false }),
        ];
    const e = leather ? 0.2 : bindW - 0.12;
    // The outer panel shows its face underneath, but the binding stitches show on top.
    add('S5', kit.seam(outer, [[e, e], [Lr - e, e], [Lr - e, Hr - e], [e, Hr - e]], { spi: spiOf('S5'), closed: true, band: 0.5, lift: 0.14 }));

    let tieStrip = null;
    let tieLoop = null;
    if (tie) {
      tieStrip = sheet({ parent: frame, w: 18, h: 1, u0: Lr - 1.6, v0: Hr / 2 - 0.5, fabric: 'accent', offset: 0.13 });
      add('S6', kit.seam(tieStrip, boxX(Lr - 1.5, Lr - 0.15, Hr / 2 - 0.38, Hr / 2 + 0.38), { spi: spiOf('S6'), band: 1, lift: 0.04 }));
      const Rout = Math.sqrt(0.8 * 0.8 + (0.42 * Lr) / Math.PI);
      const pts = [];
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        pts.push([Lr + (Rout + 0.18) * Math.sin(a), Hr / 2, Rout - (Rout + 0.18) * Math.cos(a)]);
      }
      tieLoop = kit.tube({ parent: frame, points: pts, radius: 0.12, color: plan.project.colors.accent || '#1f2226' });
    }

    const params = { pocketT: 0, flapT: 0, roll: 0, tieWrap: 0, bindOp: 1 };
    const poses = {
      prep: { ...params },
      hems: {},
      baste: { pocketT: 1, flapT: 1 },
      dividers: {},
      bind: {},
      tie: {},
      final: { roll: 1, tieWrap: 1 },
    };
    const span = Math.max(Lr, Hr);
    const cams = {
      prep: fitCam(0, 70),
      hems: fitCam(0, 70),
      baste: fitCam(0, 66, 1.1),
      dividers: cam([0, 0, Hr / 2 - pd / 2], span * 1.4, 0, 62),
      bind: fitCam(20, 55, 1.1),
      tie: cam([Lr / 2, 0, 0], span * 1.2, 30, 45),
      final: cam([Lr / 2, 1.5, 0], span * 1.5, 40, 22),
    };

    return {
      params,
      poses,
      cams,
      seams,
      labelScale: Math.max(1.4, span / 10),
      apply(p) {
        pocketG.position.y = -(1 - p.pocketT) * (pd + 3);
        if (flapG) flapG.position.y = (1 - p.flapT) * (fh + 3);
        for (const part of rollParts) part.setMorph(p.roll);
        if (tieStrip) tieStrip.setOpacity(1 - p.tieWrap * 0.999);
        tieLoop?.setReveal(p.tieWrap);
        for (const bd of binds) bd.setOpacity(p.bindOp);
      },
    };
  },
};
