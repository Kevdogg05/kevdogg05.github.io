// Utility tote: one-piece shell with cut-out boxed corners, French-seamed
// lining with slip pocket, fold-down facing, webbing handles with box-X tacks.
import { b, machineLine, execTail, pivotHow, holdNote, changeover, cam, fitCam, boxX } from './common.js';

const ICON = `<svg viewBox="0 0 48 48"><path d="M10 18h28l-2 24H12z" fill="currentColor" opacity=".18"/><path d="M10 18h28l-2 24H12zM17 18c0-9 14-9 14 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 22h20" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>`;

function cross(W, H, D) {
  return [
    [0, 0], [W + D, 0], [W + D, H], [W + D / 2, H], [W + D / 2, H + D], [W + D, H + D],
    [W + D, 2 * H + D], [0, 2 * H + D], [0, H + D], [D / 2, H + D], [D / 2, H], [0, H],
  ];
}

const crossSA = (top, side) => [top, side, side, side, side, side, top, side, side, side, side, side];

function geometry(ctx) {
  const { d, o, lin, sa } = ctx;
  const W = d.width, H = d.height, D = d.depth, drop = d.drop;
  const F = 1.5;
  const turn = 0.5;
  const ww = Number(o.webbing);
  const anchor = 2.5;
  const r = W / 4;
  const loop = 2 * drop + (Math.PI - 2) * r;
  const strapLen = loop + 2 * (anchor + 1);
  const hasLining = Boolean(lin);
  const Hl = H - F + 0.375;
  const pocket = Boolean(o.pocket);
  const pH0 = hasLining ? Hl : H - F;
  const pW = Math.max(4, Math.min(W - 3, 10));
  const pH = Math.max(3, Math.min(pH0 - 3.5, 7));
  return { W, H, D, drop, F, turn, ww, anchor, r, loop, strapLen, hasLining, Hl, pocket, pW, pH, s: sa.seam, sl: 0.625 };
}

export default {
  id: 'tote',
  name: 'Utility Tote',
  category: 'Bags',
  blurb: 'Boxed-bottom tote: one-piece shell, webbing handles with box-X tacks, French-seamed lining and slip pocket.',
  icon: ICON,
  usesLining: true,
  structural: true,
  dims: [
    { key: 'width', label: 'Width', min: 10, max: 26, step: 0.5, default: 16 },
    { key: 'height', label: 'Height', min: 8, max: 22, step: 0.5, default: 14 },
    { key: 'depth', label: 'Depth (gusset)', min: 3, max: 10, step: 0.5, default: 6 },
    { key: 'drop', label: 'Handle drop', min: 5, max: 24, step: 0.5, default: 11 },
  ],
  options: [
    { key: 'webbing', label: 'Handle webbing', type: 'select', default: '1.5', choices: [{ value: '1', label: '1″ webbing' }, { value: '1.5', label: '1½″ webbing' }] },
    { key: 'pocket', label: 'Inside slip pocket', type: 'toggle', default: true },
  ],
  defaults: { material: 'cordura1000', lining: 'packcloth210' },

  plan(ctx) {
    const g = geometry(ctx);
    const { W, H, D, F, turn, ww, anchor, strapLen, hasLining, Hl, pocket, pW, pH, s, sl } = g;
    const { L, mat, lin } = ctx;
    const pocketFab = hasLining ? 'lining' : 'main';
    const top = F + turn;
    const legX1 = D / 2 + W / 4;
    const legX2 = D / 2 + (3 * W) / 4;

    const panels = [
      {
        id: 'A',
        name: 'Shell body',
        fabric: 'main',
        qty: 1,
        outline: cross(W, H, D),
        saEdges: crossSA(top, s),
        grain: 'v',
        folds: [
          { pts: [[D / 2, H], [W + D / 2, H]], label: 'bottom crease' },
          { pts: [[D / 2, H + D], [W + D / 2, H + D]], label: 'bottom crease' },
          { pts: [[0, 2 * H + D], [W + D, 2 * H + D]], label: 'top fold — facing' },
          { pts: [[0, 0], [W + D, 0]], label: 'top fold — facing' },
          { pts: [[0, 2 * H + D + F], [W + D, 2 * H + D + F]], label: 'turn under ½″', minor: true },
          { pts: [[0, -F], [W + D, -F]], label: 'turn under ½″', minor: true },
        ],
        notches: [
          { x: (W + D) / 2, y: 2 * H + D, nx: 0, ny: 1, sa: top, label: 'CF' },
          { x: (W + D) / 2, y: 0, nx: 0, ny: -1, sa: top, label: 'CB' },
        ],
        marks: [
          { x: legX1 - ww / 2, y: 2 * H + D - 0.25 - anchor, w: ww, h: anchor, label: 'handle' },
          { x: legX2 - ww / 2, y: 2 * H + D - 0.25 - anchor, w: ww, h: anchor },
          { x: legX1 - ww / 2, y: 0.25, w: ww, h: anchor, label: 'handle' },
          { x: legX2 - ww / 2, y: 0.25, w: ww, h: anchor },
        ],
        shade: [{ type: 'crease', y: H }, { type: 'crease', y: H + D }],
        contour: `One piece folds into five faces. The two shaded bands across the base are soft 90° creases; the notched corners close into crisp boxed corners. The ${L(top)} top allowances fold inside as the facing.`,
      },
    ];
    if (hasLining) {
      panels.push({
        id: 'B',
        name: 'Lining body',
        fabric: 'lining',
        qty: 1,
        outline: cross(W, Hl, D),
        saEdges: crossSA(0, sl),
        grain: 'v',
        folds: [
          { pts: [[D / 2, Hl], [W + D / 2, Hl]], label: 'bottom crease' },
          { pts: [[D / 2, Hl + D], [W + D / 2, Hl + D]], label: 'bottom crease' },
        ],
        notches: [
          { x: (W + D) / 2, y: 2 * Hl + D, nx: 0, ny: 1, sa: 0.01, label: 'CF' },
          { x: (W + D) / 2, y: 0, nx: 0, ny: -1, sa: 0.01, label: 'CB' },
        ],
        marks: pocket ? [{ x: (W + D) / 2 - pW / 2, y: 2.5, w: pW, h: pH, label: 'pocket' }] : [],
        shade: [{ type: 'crease', y: Hl }, { type: 'crease', y: Hl + D }],
        contour: `Same cross as the shell, ${L(H - Hl)} shorter so its raw top edge tucks under the facing. ${L(sl)} allowances on the sides for French seams; no allowance on the top edge.`,
      });
    }
    if (pocket) {
      panels.push({
        id: hasLining ? 'C' : 'B',
        name: 'Slip pocket',
        fabric: pocketFab,
        qty: 1,
        outline: [[0, 0], [pW, 0], [pW, pH], [0, pH]],
        saEdges: [0.5, 0.5, 1, 0.5],
        grain: 'v',
        folds: [
          { pts: [[0, pH], [pW, pH]], label: 'fold' },
          { pts: [[0, pH + 0.5], [pW, pH + 0.5]], label: 'fold', minor: true },
        ],
        notches: [{ x: pW / 2, y: pH, nx: 0, ny: 1, sa: 1, label: 'divider' }],
        marks: [],
        shade: [],
        contour: 'Flat panel. Top edge double-folds (½″ + ½″); the other three edges press under ½″ before edge-stitching.',
      });
    }

    const pocketLetter = hasLining ? 'C' : 'B';
    const webLetter = pocket ? (hasLining ? 'D' : 'C') : hasLining ? 'C' : 'B';
    const notions = [
      { label: `${ww === 1 ? '1″' : '1½″'} heavy nylon webbing`, qty: `2 × ${L(strapLen)}`, note: `Handles (${webLetter}). Sear both ends.` },
      { label: '¼″ double-sided basting tape', qty: 'optional', note: 'Holds pocket and handles in place without pin holes.' },
    ];
    if (!hasLining) notions.push({ label: '1″ grosgrain / nylon binding tape', qty: L(2 * (2 * H + 2 * D) + 6), note: 'Binds the exposed inside seam allowances.' });

    const webF = ww === 1 ? 'webbing1' : 'webbing15';
    const seams = [];
    if (pocket) {
      seams.push({ id: 'S1', name: 'Pocket top hem', type: 'hem', role: 'hem', length: pW, count: 1 });
      seams.push({ id: 'S2', name: `Pocket to ${hasLining ? 'lining' : 'shell'} + divider`, type: 'edgeStitch', role: 'edgestitch', length: 2 * pH + pW + pH, count: 1 });
    }
    seams.push({ id: 'S3', name: 'Shell side seams', type: hasLining ? 'plain' : 'bound', role: 'construction', length: H, count: 2 });
    seams.push({ id: 'S4', name: 'Shell boxed corners', type: 'boxCorner', role: 'construction', length: D, count: 2 });
    if (!hasLining) seams.push({ id: 'S4b', name: 'Bind inside seam allowances', type: 'bound', role: 'binding', length: H + D, count: 2 });
    if (hasLining) {
      seams.push({ id: 'S5', name: 'Lining side seams', type: 'french', role: 'french', length: Hl, count: 2 });
      seams.push({ id: 'S6', name: 'Lining boxed corners', type: 'boxCorner', role: 'construction', length: D, count: 2 });
      seams.push({ id: 'S9', name: 'Baste lining to shell', type: 'baste', role: 'baste', length: 2 * (W + D), count: 1 });
    }
    seams.push({ id: 'S7', name: 'Facing topstitch (2 rows)', type: 'hem', role: 'topstitch', length: 2 * (W + D), count: 2 });
    seams.push({ id: 'S8', name: 'Handle box-X tacks', type: 'boxX', role: 'bartack', length: 2 * anchor + 2 * ww + 2 * Math.hypot(anchor, ww), count: 4 });

    const shellStack = [{ f: 'main', n: 2 }];
    const steps = [];
    steps.push({
      id: 'prep',
      title: 'Cut, mark & prep',
      pose: 'prep',
      frame: () =>
        `Every piece lies flat on the cutting table, wrong side up: the cross-shaped shell ${b('A')} with its four notched corners${hasLining ? `, the lining ${b('B')}` : ''}${pocket ? `, the pocket ${b(pocketLetter)}` : ''} and two webbing straps ${b(webLetter)}. Cyan dash-dot lines mark the bottom creases and facing folds; small triangles mark centre front and back.`,
      action: () =>
        `Cut ${b('A')} from ${mat.name}${hasLining ? `; ${b('B')}${pocket ? ` and ${b('C')}` : ''} from ${lin.name}` : ''}. Cut two straps of webbing at ${b(L(strapLen))}. ${mat.cut} Transfer the notches, both bottom creases and the handle boxes to the wrong side — ${mat.mark.toLowerCase()}`,
      exec: () =>
        `No sewing yet. ${mat.edge} Make a test strip now: two layers of ${mat.name} stitched with the Step 3 setup, so tension is dialled in before the real seams.`,
    });
    if (pocket) {
      steps.push({
        id: 'pocket',
        title: `Hem & attach the slip pocket`,
        role: 'edgestitch',
        fabric: pocketFab,
        layers: [{ f: pocketFab, n: 4 }],
        seams: ['S1', 'S2'],
        pivot: true,
        pose: 'pocket',
        frame: () =>
          `The pocket ${b(pocketLetter)} slides onto the ${hasLining ? 'lining' : 'shell'} back panel, 2½″ below the top edge. The top hem stitches first, then a ⅛″ edge-stitch runs down one side, across the bottom and up the other, followed by the centre divider.`,
        action: (c) =>
          `Double-fold the pocket top (½″ + ½″) and press or crease the other three edges under ½″. Centre it on the placement box, right side up. ${holdNote(c, pocketFab)}`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)}. Hem the top first. Then edge-stitch ⅛″ from the folds: start at the top right corner, ${pivotHow(c)} at each bottom corner, finish at the top left. Sew the divider bottom-to-top and lock both top corners with a small triangle tack. ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'shellSides',
      title: 'Sew the shell side seams',
      role: 'construction',
      layers: shellStack,
      seams: ['S3'],
      prefer: '2206RB',
      pose: 'shellSides',
      frame: () =>
        `The front and back of the shell swing up 90° on the bottom creases and the corner flaps fold in to meet at the side centres. Both vertical side seams glow translucent red — the ${L(s)} seam allowance — then stitch from the rim down to the corner.`,
      action: (c) =>
        `Fold the shell right sides together on the bottom crease, matching the centre and corner notches. ${holdNote(c)} Sew each side from the top edge down to the corner notch and stop exactly ${L(s)} from the notch edge — do not stitch into the cut-out.`,
      exec: (c) =>
        `${changeover(c)}${machineLine(c)}, ${L(s)} seam allowance. Keep the edges aligned at the guide; the walking foot feeds both layers evenly, so do not pull. ${execTail(c)} ${mat.press}`,
    });
    steps.push({
      id: 'shellCorners',
      title: 'Box the shell corners',
      role: 'construction',
      layers: [{ f: 'main', n: 4 }],
      seams: ['S4'],
      prefer: '2206RB',
      pose: 'shellCorners',
      frame: () =>
        `Each cut-out corner opens into a triangle: the side seam sits exactly on the bottom crease's centre and the raw edges form one straight ${L(D)} line. That line highlights red and stitches across, squaring the base.`,
      action: () =>
        `Open a corner, centre the side seam on the bottom (the seam lies on the crease mark), and clip the notch edges together into a straight line. Push the side-seam allowances in opposite directions so they nest instead of stacking.`,
      exec: (c) =>
        `${changeover(c)}${machineLine(c)}. Sew straight across at ${L(s)}. The centre of this seam crosses the nested allowances (${c.MM(c.u.stackMm)}) — slow down and hand-wheel over the crossing. ${execTail(c)}`,
    });
    if (!hasLining) {
      steps.push({
        id: 'bind',
        title: 'Bind the inside seam allowances',
        role: 'binding',
        layers: [{ f: 'main', n: 2 }, { f: 'binding', n: 2 }],
        seams: ['S4b'],
        pose: 'shellCorners',
        frame: () => `With the bag still inside out, binding tape wraps each side-seam and corner allowance; the stitches run ⅛″ from the binding edge.`,
        action: () => `Trim the allowances to an even width, fold 1″ binding tape in half over them and clip. Run the binding continuously from the top of one side seam around the corner seam.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Stitch ⅛″ from the binding's inner edge, catching both sides of the tape. ${execTail(c)}`,
      });
    }
    if (hasLining) {
      steps.push({
        id: 'liningSides',
        title: 'Lining side seams — French seams',
        role: 'french',
        fabric: 'lining',
        layers: [{ f: 'lining', n: 4 }],
        seams: ['S5'],
        pose: 'liningSides',
        frame: () =>
          `The lining ${b('B')} folds into its own box beside the shell. Each side seam is sewn twice: a narrow first pass, then a wider second pass that seals the raw edges inside a neat ridge.`,
        action: () =>
          `Fold the lining ${b('wrong')} sides together on the bottom crease. Sew the sides at ¼″, trim to ⅛″, turn so the right sides are together, crease along the seam and sew again at ⅜″. Stop at the corner notches both times.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. ${execTail(c)} Hold the thread tails for the first stitches on light goods.`,
      });
      steps.push({
        id: 'liningCorners',
        title: 'Box the lining corners',
        role: 'construction',
        fabric: 'lining',
        layers: [{ f: 'lining', n: 4 }],
        seams: ['S6'],
        pose: 'liningCorners',
        frame: () => `The lining's corners square off exactly like the shell's — same ${L(D)} line, same nested allowances.`,
        action: () => `Centre the French seam on the bottom crease, nest the ridges in opposite directions and clip the corner edges straight.`,
        exec: (c) => `${changeover(c)}${machineLine(c)}. Sew at ${L(sl)}, then trim the allowance to ¼″. ${execTail(c)}`,
      });
      steps.push({
        id: 'dropIn',
        title: 'Drop the lining in & baste',
        role: 'baste',
        layers: [{ f: 'main', n: 1 }, { f: 'lining', n: 1 }],
        seams: ['S9'],
        pivot: true,
        pose: 'dropIn',
        frame: () =>
          `The shell turns right side out. The lining — still wrong side out — lifts, arcs over and drops inside, wrong sides touching. A long basting stitch runs around the lining's top edge, ${L(H - Hl)} below the rim.`,
        action: (c) =>
          `Turn the shell right side out and push the corners square. Drop the lining in, wrong sides together, matching side seams and centre notches. Smooth it into the corners. ${holdNote(c)}`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)} — this is a basting pass at the longest stitch, ¼″ below the lining edge. Sew from the inside of the bag with the lining up and the bag body pushed under the arm; ${pivotHow(c)} at the four corners. ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'facing',
      title: 'Fold the facing & topstitch the rim',
      role: 'topstitch',
      layers: [{ f: 'main', n: 5 }, ...(hasLining ? [{ f: 'lining', n: 1 }] : [])],
      seams: ['S7'],
      pivot: true,
      prefer: '2206RB',
      pose: 'facing',
      frame: () =>
        `The ${L(top)} top allowance folds inside — ½″ under, then ${L(F)} down${hasLining ? ' over the lining edge' : ''}. Two topstitch rows run all the way around the rim: ⅛″ below the top fold and ⅛″ above the facing's lower edge.`,
      action: (c) =>
        `Fold the top edge under ½″, then ${L(F)} to the inside, all the way round. ${holdNote(c)} At each side seam, splay the allowances apart to spread the bulk.`,
      exec: (c) =>
        `${changeover(c)}${machineLine(c)}. Sew from the inside with the facing up and the bag body around the arm. Start at a side seam, ${pivotHow(c)} at the four corner folds, and overlap the start by ½″ instead of backtacking on the face. The stack peaks at ${c.MM(c.u.stackMm)} where the side seams cross. ${execTail(c)}`,
    });
    steps.push({
      id: 'handles',
      title: 'Box-X the handles',
      role: 'bartack',
      layers: [{ f: webF, n: 2 }, { f: 'main', n: 3 }, ...(hasLining ? [{ f: 'lining', n: 1 }] : [])],
      seams: ['S8'],
      prefer: '2206RB',
      pose: 'handles',
      frame: () =>
        `Both handles slide into place, legs ${L(W / 2)} apart on the front and on the back. Each ${L(anchor)} anchor highlights red, then a box-X appears stitch by stitch: the rectangle first, then the cross.`,
      action: (c) =>
        `Sear the strap ends and fold each under 1″. Place the legs on the handle boxes, ends pointing down, anchor tops ¼″ below the rim. Check that neither strap is twisted. ${holdNote(c)}`,
      exec: (c) =>
        `${changeover(c)}${machineLine(c)}. Sew each box-X through webbing, shell, facing${hasLining ? ' and lining' : ''} (${c.MM(c.u.stackMm)}): start at a corner, sew the rectangle, then the X, and finish 3 stitches past the start. Hand-wheel over the webbing edges. ${execTail(c)}`,
    });
    steps.push({
      id: 'final',
      title: 'Inspect the finished tote',
      pose: 'final',
      spin: true,
      frame: () => `The finished tote turns slowly on the table — front, side, back and isometric — handles standing ${L(g.drop)} above the rim.`,
      action: () =>
        `Hang 20 lb from the handles for a minute; check every box-X for skipped stitches; push out the corners; trim and sear the thread tails.`,
      exec: () => `No sewing. If a box-X shows loops on the underside, raise the top tension a quarter turn on the test strip before re-sewing — never on the bag.`,
    });

    const views = {
      front: `A ${L(W)} × ${L(H)} face of ${mat.name}. Two ${ww === 1 ? '1″' : '1½″'} webbing handles rise ${L(g.drop)} above the rim, legs ${L(W / 2)} apart, each anchored by a ${L(anchor)} box-X. Two parallel topstitch rows circle the rim ⅛″ and ${L(F - 0.125)} below the top edge.`,
      side: `A ${L(D)}-wide gusset. A single vertical seam runs down its centre line and meets the horizontal boxed-corner seam at the base, forming an inverted T. The handle loops read as thin vertical lines.`,
      iso: `A clean box, ${L(W)} × ${L(D)} × ${L(H)} (W × D × H): rigid corners at the base, soft rolled creases along the bottom front and back edges, and a ${L(F)} facing band inside the rim${hasLining ? ` over the ${lin.name} lining` : ''}.`,
    };

    return {
      panels,
      notions,
      seams,
      steps,
      views,
      needsTurning: true,
      summary: `${L(W)} × ${L(H)} × ${L(D)} tote, ${L(g.drop)} handle drop.`,
      geom: g,
    };
  },

  rig(kit, ctx, plan) {
    const g = plan.geom;
    const { W, H, D, Hl, pW, pH, ww, anchor, F, drop, hasLining, pocket } = g;
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, s) => (seams[id] ||= []).push(s);

    const shell = buildBox(kit, { W, D, H, fabric: 'main', swap: false });
    const lining = hasLining ? buildBox(kit, { W, D, H: Hl, fabric: 'lining', swap: true }) : null;

    // Facing strips inside the shell rim.
    const facings = [];
    for (const p of [shell.front, shell.back]) facings.push(kit.sheet({ parent: p.obj, w: W, h: F, u0: -W / 2, v0: H - F, fabric: 'main', swapSides: true, offset: -0.06, outline: false }));
    for (const f of shell.flaps) {
      const right = f.u0 >= 0;
      facings.push(kit.sheet({ parent: f.obj, w: D / 2, h: F, u0: right ? 0 : -D / 2, v0: H - F, fabric: 'main', swapSides: true, offset: -0.06, outline: false }));
    }

    // Pocket on the lining (or shell) back panel, inside face.
    let pocketPart = null;
    let pocketG = null;
    const host = hasLining ? lining : shell;
    const hostH = hasLining ? Hl : H - F;
    if (pocket) {
      pocketG = kit.group(host.back.obj);
      const pTop = hostH - 2.5;
      pocketPart = kit.sheet({ parent: pocketG, w: pW, h: pH, u0: -pW / 2, v0: pTop - pH, fabric: hasLining ? 'lining' : 'main', swapSides: true, offset: -0.05 });
      add('S1', kit.seam(pocketPart, [[-pW / 2, pTop - 0.35], [pW / 2, pTop - 0.35]], { spi: spiOf('S1'), side: -1, band: 0.5 }));
      const e = 0.125;
      add('S2', kit.seam(pocketPart, [[pW / 2 - e, pTop], [pW / 2 - e, pTop - pH + e], [-pW / 2 + e, pTop - pH + e], [-pW / 2 + e, pTop]], { spi: spiOf('S2'), side: -1, band: 0.5 }));
      add('S2', kit.seam(pocketPart, [[0, pTop - pH + e], [0, pTop]], { spi: spiOf('S2'), side: -1, band: 0 }));
      kit.label(hasLining ? 'C' : 'B', pocketPart, 0, pTop - pH / 2);
    }

    // Shell seams.
    const [fr, fl, br, bl] = shell.flaps;
    add('S3', kit.seam(fr, [[D / 2, H], [D / 2, 0]], { spi: spiOf('S3'), band: g.s }));
    add('S3', kit.seam(fl, [[-D / 2, H], [-D / 2, 0]], { spi: spiOf('S3'), band: g.s }));
    for (const f of [fr, br]) add('S4', kit.seam(f, [[0, 0.02], [D / 2, 0.02]], { spi: spiOf('S4'), band: g.s }));
    for (const f of [fl, bl]) add('S4', kit.seam(f, [[-D / 2, 0.02], [0, 0.02]], { spi: spiOf('S4'), band: g.s }));
    if (!hasLining) {
      add('S4b', kit.seam(fr, [[D / 2 - 0.35, H - F], [D / 2 - 0.35, 0.3]], { spi: spiOf('S4b'), side: -1, band: 0.5 }));
      add('S4b', kit.seam(fl, [[-D / 2 + 0.35, H - F], [-D / 2 + 0.35, 0.3]], { spi: spiOf('S4b'), side: -1, band: 0.5 }));
    }
    for (const row of [H - 0.125, H - F + 0.125]) {
      add('S7', kit.seam(shell.front, [[-W / 2, row], [W / 2, row]], { spi: spiOf('S7'), band: 0.4 }));
      add('S7', kit.seam(shell.back, [[-W / 2, row], [W / 2, row]], { spi: spiOf('S7'), band: 0.4 }));
      for (const f of shell.flaps) {
        const right = f.u0 >= 0;
        add('S7', kit.seam(f, right ? [[0, row], [D / 2, row]] : [[-D / 2, row], [0, row]], { spi: spiOf('S7'), band: 0.4 }));
      }
    }

    // Lining seams.
    if (lining) {
      const [lfr, lfl, lbr, lbl] = lining.flaps;
      add('S5', kit.seam(lfr, [[D / 2, Hl], [D / 2, 0]], { spi: spiOf('S5'), side: -1, band: 0.625 }));
      add('S5', kit.seam(lfl, [[-D / 2, Hl], [-D / 2, 0]], { spi: spiOf('S5'), side: -1, band: 0.625 }));
      for (const f of [lfr, lbr]) add('S6', kit.seam(f, [[0, 0.02], [D / 2, 0.02]], { spi: spiOf('S6'), side: -1, band: 0.6 }));
      for (const f of [lfl, lbl]) add('S6', kit.seam(f, [[-D / 2, 0.02], [0, 0.02]], { spi: spiOf('S6'), side: -1, band: 0.6 }));
      const bv = Hl - 0.25;
      add('S9', kit.seam(lining.front, [[-W / 2, bv], [W / 2, bv]], { spi: spiOf('S9'), side: -1, band: 0.4 }));
      add('S9', kit.seam(lining.back, [[-W / 2, bv], [W / 2, bv]], { spi: spiOf('S9'), side: -1, band: 0.4 }));
      for (const f of lining.flaps) {
        const right = f.u0 >= 0;
        add('S9', kit.seam(f, right ? [[0, bv], [D / 2, bv]] : [[-D / 2, bv], [0, bv]], { spi: spiOf('S9'), side: -1, band: 0.4 }));
      }
      kit.label('B', lining.bottom, 0, 0);
    }
    kit.label('A', shell.bottom, 0, 0);

    // Handles: webbing straps in the plane of the front and back panels.
    const r = W / 4;
    const yA = H - 0.25 - anchor;
    const yTop = H + drop - r;
    const path = [[-r, yA], [-r, yTop]];
    for (let i = 1; i < 24; i++) {
      const th = Math.PI - (i / 24) * Math.PI;
      path.push([Math.cos(th) * r, yTop + Math.sin(th) * r]);
    }
    path.push([r, yTop], [r, yA]);
    const handles = [];
    for (const p of [shell.front, shell.back]) {
      const hg = kit.group(p.obj);
      hg.position.z = 0.07;
      const rib = kit.ribbon({ parent: hg, path, width: ww, fabric: 'accent' });
      const a0 = -ww / 2 + 0.15;
      const a1 = ww / 2 - 0.15;
      add('S8', kit.seam(rib, boxX(0.25, anchor - 0.15, a0, a1), { spi: spiOf('S8'), band: ww }));
      add('S8', kit.seam(rib, boxX(rib.length - anchor + 0.15, rib.length - 0.25, a0, a1), { spi: spiOf('S8'), band: ww }));
      handles.push({ g: hg, rib });
    }
    kit.label(pocket ? (hasLining ? 'D' : 'C') : hasLining ? 'C' : 'B', handles[0].rib, handles[0].rib.length / 2, 0);

    const params = {
      fold: 0, flaps: 0, lfold: 0, lflaps: 0,
      liningT: 0, pocketT: 0, facing: 0, handleT: 0, handleOp: 1,
    };
    const P = {
      prep: { fold: 0, flaps: 0, lfold: 0, lflaps: 0, liningT: 0, pocketT: 0, facing: 0, handleT: 0, handleOp: 1 },
      pocket: { pocketT: 1, handleOp: 0 },
      shellSides: { fold: 1, flaps: 1, pocketT: 1, handleOp: 0 },
      shellCorners: {},
      liningSides: { lfold: 1, lflaps: 1 },
      liningCorners: {},
      dropIn: { liningT: 1 },
      facing: { facing: 1 },
      handles: { handleT: 1, handleOp: 1 },
      final: {},
    };
    const ex = W + D + 6;
    const camFor = {
      prep: fitCam(0, 62),
      pocket: cam([hasLining ? ex : 0, 0, -D / 2 - hostH / 2], Math.max(W, H) * 1.7, 0, 70),
      shellSides: cam([0, H / 2, 0], Math.max(W, H) * 2.3, 48, 20),
      shellCorners: cam([0, H * 0.25, 0], Math.max(W, H) * 1.9, 62, 10),
      bind: cam([0, H * 0.4, 0], Math.max(W, H) * 2.1, 55, 35),
      liningSides: cam([ex, Hl / 2, 0], Math.max(W, H) * 2.3, 40, 22),
      liningCorners: cam([ex, Hl * 0.25, 0], Math.max(W, H) * 1.9, 62, 12),
      dropIn: cam([ex / 2, H * 0.7, 0], Math.max(W + ex, H) * 1.6, 15, 25),
      facing: cam([0, H - 1, 0], Math.max(W, H) * 2, 30, 40),
      handles: cam([0, (H + drop) / 2, 0], Math.max(W, H + drop) * 2.1, 22, 14),
      final: cam([0, (H + drop) / 2.4, 0], Math.max(W, H + drop) * 2.2, 35, 22),
    };

    return {
      params,
      poses: P,
      cams: camFor,
      seams,
      labelScale: Math.max(1.2, Math.max(W, H) / 10),
      apply(p) {
        shell.set(p.fold, p.flaps);
        if (lining) {
          lining.set(p.lfold, p.lflaps);
          const t = p.liningT;
          lining.root.position.set(ex * (1 - t), Math.sin(Math.PI * t) * (H + 4) + 0.06 * t, 0);
          lining.root.scale.set(1 - 0.025 * t, 1, 1 - 0.05 * t);
        }
        if (pocketG) {
          const off = (1 - p.pocketT) * (W / 2 + pW / 2 + 3);
          pocketG.position.x = hasLining ? -off : off;
        }
        for (const f of facings) f.setOpacity(p.facing);
        handles.forEach((h, i) => {
          const off = (1 - p.handleT) * (W + D / 2 + 3);
          h.g.position.x = i === 0 ? -off : off;
          h.rib.setOpacity(p.handleOp);
        });
      },
    };
  },
};

/**
 * A box net: bottom panel with front/back panels hinged on its long edges and
 * half-depth flaps hinged on their sides. fold/flaps 0 = flat cross on the
 * table (face down), 1 = assembled box (face out).
 */
function buildBox(kit, { W, D, H, fabric, swap }) {
  const root = kit.group();
  const bottomG = kit.group(root);
  bottomG.rotation.x = Math.PI / 2;
  const bottom = kit.sheet({ parent: bottomG, w: W, h: D, u0: -W / 2, v0: -D / 2, fabric, swapSides: swap });

  const frontPivot = kit.group(root);
  frontPivot.position.set(0, 0, D / 2);
  const front = kit.sheet({ parent: frontPivot, w: W, h: H, u0: -W / 2, v0: 0, fabric, swapSides: swap });

  const backPivot = kit.group(root);
  backPivot.position.set(0, 0, -D / 2);
  const backFlip = kit.group(backPivot);
  backFlip.rotation.y = Math.PI;
  const back = kit.sheet({ parent: backFlip, w: W, h: H, u0: -W / 2, v0: 0, fabric, swapSides: swap });

  const flapGroups = [];
  const flaps = [];
  for (const panel of [front, back]) {
    for (const side of [1, -1]) {
      const fg = kit.group(panel.obj);
      fg.position.set((side * W) / 2, 0, 0);
      const flap = kit.sheet({ parent: fg, w: D / 2, h: H, u0: side > 0 ? 0 : -D / 2, v0: 0, fabric, swapSides: swap });
      flapGroups.push({ fg, side });
      flaps.push(flap);
    }
  }
  // flaps order: front-right, front-left, back-right, back-left
  return {
    root,
    bottom,
    front,
    back,
    flaps,
    set(fold, flapFold) {
      frontPivot.rotation.x = (Math.PI / 2) * (1 - fold);
      backPivot.rotation.x = -(Math.PI / 2) * (1 - fold);
      for (const { fg, side } of flapGroups) fg.rotation.y = side * (Math.PI / 2) * flapFold;
    },
  };
}
