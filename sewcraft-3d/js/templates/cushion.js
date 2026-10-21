// Boxed cushion: two plates, a boxing loop (boxing strip + zipper boxing),
// optional welt on both seams, foam insert.
import { b, machineLine, execTail, pivotHow, holdNote, changeover, cam, fitCam } from './common.js';
import { roundRect, perimeter, translate, offsetPolygon, loopFrom, arcTo } from '../engine/geom2d.js';
import { Deform } from '../ui/kit3d.js';

const ICON = `<svg viewBox="0 0 48 48"><path d="M6 20l10-7h26l-10 7z" fill="currentColor" opacity=".25"/><path d="M6 20l10-7h26v12l-10 7H6z M6 20h26v12M32 20l10-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 26h14" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>`;

function geometry(ctx) {
  const { d, o, sa } = ctx;
  const L = d.length, Wc = d.width, T = d.thick;
  const R = Math.max(0, Math.min(d.radius, Wc / 2 - 0.5, L / 2 - 0.5));
  const plate = roundRect(L, Wc, R, 8);
  const P = perimeter(plate);
  const Z = Math.min(L + 8, P - 10);
  const tab = 1.5;
  return { L, Wc, T, R, plate, P, Z, B: P - Z, tab, welt: Boolean(o.welt), s: sa.seam };
}

/** Notch positions on the plate outline: side centres and corner centres. */
function plateNotches(g) {
  const { L, Wc, R } = g;
  const k = Math.SQRT1_2;
  const n = [
    { x: L / 2, y: 0, nx: 0, ny: -1, label: 'CF' },
    { x: L / 2, y: Wc, nx: 0, ny: 1, label: 'CB' },
    { x: 0, y: Wc / 2, nx: -1, ny: 0 },
    { x: L, y: Wc / 2, nx: 1, ny: 0 },
  ];
  const corners = [[L - R, R, k, -k], [L - R, Wc - R, k, k], [R, Wc - R, -k, k], [R, R, -k, -k]];
  for (const [cx, cy, dx, dy] of corners) n.push({ x: cx + dx * R, y: cy + dy * R, nx: dx, ny: dy });
  return n.map((q) => ({ ...q, sa: g.s }));
}

export default {
  id: 'cushion',
  name: 'Boxed Cushion',
  category: 'Upholstery',
  blurb: 'Boat or bench cushion: welted plates, boxing strip and zipper boxing, foam insert.',
  icon: ICON,
  usesLining: false,
  structural: false,
  dims: [
    { key: 'length', label: 'Length', min: 12, max: 80, step: 0.5, default: 36 },
    { key: 'width', label: 'Width (depth)', min: 10, max: 36, step: 0.5, default: 20 },
    { key: 'thick', label: 'Thickness (boxing)', min: 2, max: 8, step: 0.5, default: 4 },
    { key: 'radius', label: 'Corner radius', min: 0, max: 4, step: 0.25, default: 1 },
  ],
  options: [{ key: 'welt', label: 'Welt (piping) on both seams', type: 'toggle', default: true }],
  defaults: { material: 'acrylic' },

  plan(ctx) {
    const g = geometry(ctx);
    const { L, Wc, T, R, plate, P, Z, B, tab, welt, s } = g;
    const { L: fl, mat } = ctx;
    const notches = plateNotches(g);

    // Where the plate notches fall along the boxing strip (loop starts at the zipper start).
    const s0 = arcTo(plate, [L / 2, Wc]) - Z / 2;
    const boxStart = Z - tab;
    const boxNotches = [];
    for (const n of notches) {
      const sn = (((arcTo(plate, [n.x, n.y]) - s0) % P) + P) % P;
      const x = sn - boxStart;
      if (x > 0.5 && x < B + 2 * tab - 0.5) {
        boxNotches.push({ x, y: 0, nx: 0, ny: -1, sa: s }, { x, y: T, nx: 0, ny: 1, sa: s });
      }
    }

    const panels = [
      {
        id: 'A',
        name: 'Top & bottom plates',
        fabric: 'main',
        qty: 2,
        outline: plate,
        sa: s,
        grain: 'h',
        notches,
        folds: [],
        marks: [{ x: L / 2 - Z / 2 + 4, y: Wc - 0.6, w: Z - 8, h: 0.5, label: 'zipper boxing span' }],
        shade: R > 0 ? [{ type: 'curve', pts: plate }] : [],
        contour: R > 0 ? `Flat plate with ${fl(R)} radius corners — shaded as curves; ease the boxing around them rather than clipping the plate.` : 'Flat plate with square (rigid 90°) corners; the boxing pivots at each one.',
      },
      {
        id: 'B',
        name: 'Boxing strip',
        fabric: 'main',
        qty: 1,
        outline: [[0, 0], [B + 2 * tab, 0], [B + 2 * tab, T], [0, T]],
        saEdges: [s, 0.5, s, 0.5],
        grain: 'h',
        rotatable: true,
        notches: boxNotches,
        folds: [{ pts: [[tab, 0], [tab, T]], label: 'tab' }, { pts: [[B + tab, 0], [B + tab, T]], label: 'tab' }],
        marks: [],
        shade: [],
        contour: `Long straight band that wraps the front and sides. Notches mirror the plate's corner and side marks so the corners line up top and bottom.`,
      },
      {
        id: 'C',
        name: 'Zipper boxing halves',
        fabric: 'main',
        qty: 2,
        outline: [[0, 0], [Z, 0], [Z, T / 2], [0, T / 2]],
        saEdges: [s, 0.5, 0.75, 0.5],
        grain: 'h',
        rotatable: true,
        notches: [{ x: Z / 2, y: 0, nx: 0, ny: -1, sa: s, label: 'CB' }],
        folds: [{ pts: [[0, T / 2], [Z, T / 2]], label: 'fold to zipper' }],
        marks: [],
        shade: [],
        contour: 'Two narrow strips; the ¾″ allowance on the zipper edge folds under so the fold sits ⅛″ off the coil.',
      },
    ];
    if (welt) {
      panels.push({
        id: 'D',
        name: 'Welt cover strips',
        fabric: 'main',
        qty: 2,
        outline: [[0, 0], [P + 4, 0], [P + 4, 1.5], [0, 1.5]],
        sa: 0,
        grain: 'h',
        rotatable: true,
        notches: [],
        folds: [{ pts: [[0, 0.75], [P + 4, 0.75]], label: 'wraps the cord', minor: true }],
        marks: [],
        shade: [],
        contour: `1½″ strips (cut size, no further allowance). ${mat.id === 'vinyl' ? 'Vinyl welt can be cut on the straight; it eases round corners.' : 'Cut on the bias if the corners are tight.'}`,
      });
    }

    const notions = [
      { label: '#10 marine coil zipper (UV)', qty: `${fl(Z + 2)} + slider`, note: 'Two head-to-head sliders let the zipper open from either end.' },
      { label: 'Foam', qty: `${fl(L + 0.5)} × ${fl(Wc + 0.5)} × ${fl(T)}`, note: `Cut ½″ oversize in length and width for a crisp fill; ${mat.outdoor ? 'outdoor: open-cell reticulated (dry-fast) foam' : 'high-density polyurethane'}, wrapped in Dacron.` },
    ];
    if (welt) notions.push({ label: '5⁄32″ welt cord', qty: `2 × ${fl(P + 4)}`, note: 'Polyester cord — cotton cord rots outdoors.' });

    const seams = [];
    if (welt) {
      seams.push({ id: 'S1', name: 'Cover the welt cord', type: 'welt', role: 'welt', length: P + 4, count: 2 });
      seams.push({ id: 'S2', name: 'Welt to both plates', type: 'welt', role: 'welt', length: P, count: 2 });
    }
    seams.push({ id: 'S3', name: 'Zipper into zipper boxing', type: 'zipper', role: 'zipper', length: Z, count: 2 });
    seams.push({ id: 'S4', name: 'Close the boxing loop', type: 'topstitched', role: 'construction', length: T, count: 2 });
    seams.push({ id: 'S5', name: 'Boxing to top plate', type: welt ? 'welt' : 'plain', role: welt ? 'welt' : 'construction', length: P, count: 1 });
    seams.push({ id: 'S6', name: 'Boxing to bottom plate', type: welt ? 'welt' : 'plain', role: welt ? 'welt' : 'construction', length: P, count: 1 });

    const plateLayers = welt ? [{ f: 'main', n: 4 }, { f: 'weltCord', n: 1 }] : [{ f: 'main', n: 2 }];
    const steps = [
      {
        id: 'prep',
        title: 'Cut, mark & prep',
        pose: 'prep',
        frame: () =>
          `The two plates ${b('A')} lie face up in front, the long boxing strip ${b('B')} and zipper boxing ${b('C')} lie end to end behind them${welt ? `, and the welt strips ${b('D')} wait beside a coil of cord` : ''}. Red triangles on the plates mark centre front, centre back, the sides and every corner — the same marks repeat on the boxing.`,
        action: () =>
          `Cut two plates, one boxing strip (${fl(B + 2 * tab)} finished length), two zipper-boxing halves${welt ? ' and two 1½″ welt strips' : ''}. ${mat.cut} Snip every notch ¼″ deep — on ${mat.name} the notches are your only alignment reference later.`,
        exec: () => `No sewing yet. ${mat.edge} ${mat.id === 'vinyl' ? 'Mark on the knit backing only.' : ''}`,
      },
    ];
    if (welt) {
      steps.push({
        id: 'welt',
        title: 'Cover the welt cord',
        role: 'welt',
        layers: [{ f: 'main', n: 2 }, { f: 'weltCord', n: 1 }],
        seams: ['S1'],
        pose: 'welt',
        frame: () => `A welt strip folds around the white cord, raw edges together, and a stitch line runs tight against the cord along its whole length.`,
        action: (c) => `Wrap each strip around the cord, wrong sides in, raw edges even. ${holdNote(c)}`,
        exec: (c) =>
          `${changeover(c)}${machineLine(c)}. Fit a welt (piping) foot set — on the 2206RB both the presser foot and walking foot must have the cord groove — and sew with the needle ⅛″ from the cord. ${execTail(c)}`,
      });
      steps.push({
        id: 'weltPlates',
        title: 'Welt to both plates',
        role: 'welt',
        layers: [{ f: 'main', n: 3 }, { f: 'weltCord', n: 1 }],
        seams: ['S2'],
        curve: R > 0,
        pivot: R === 0,
        pose: 'weltPlates',
        frame: () => `The welt lays itself around the edge of each plate, cord facing inward, and a stitch line follows it all the way round — ${R > 0 ? 'easing through the four rounded corners' : 'pivoting at the four corners'}.`,
        action: () =>
          `Start mid-back with 2″ of welt free. Raw edges together, cord toward the centre of the plate. ${R > 0 ? `At each corner clip the welt allowance every ⅜″ so it fans around the ${fl(R)} radius.` : 'At each corner clip the welt allowance to the stitch line so it turns square.'} To finish, open one welt end, trim the cords to butt, wrap the overlap and sew across.`,
        exec: (c) => `${changeover(c)}${machineLine(c)} on the welt stitching line, plate underneath. ${R > 0 ? 'Through the curves stop every few stitches needle-down and turn the work slightly.' : `At corners ${pivotHow(c)}.`} ${execTail(c)}`,
      });
    }
    steps.push({
      id: 'zipper',
      title: 'Sew the zipper boxing',
      role: 'zipper',
      layers: [{ f: 'main', n: 2 }, { f: 'zipper10', n: 1 }],
      seams: ['S3'],
      pose: 'zipper',
      frame: () => `The two narrow halves ${b('C')} close either side of the black coil; two topstitch lines run the full length, ⅛″ from each fold.`,
      action: (c) => `Fold the zipper edge of each half under ¾″. Lay the folds either side of the coil, ⅛″ away from the teeth, and hold them with ¼″ basting tape. ${holdNote(c)}`,
      exec: (c) => `${changeover(c)}${machineLine(c)}. Use a zipper foot (or the narrow welt foot) and topstitch ⅛″ from each fold, both in the same direction so the halves do not shift. Run the slider on before you close the ends. ${execTail(c)}`,
    });
    steps.push({
      id: 'loop',
      title: 'Close the boxing loop',
      role: 'construction',
      layers: [{ f: 'main', n: 4 }],
      seams: ['S4'],
      pose: 'loop',
      frame: () => `The boxing stands up and wraps into a closed ring the shape of the plate: zipper boxing across the back, boxing strip around the front and sides. Two short vertical seams lock the ends together.`,
      action: () =>
        `Fold each end of the boxing strip back ${fl(tab)} on itself to make a pocket (a "garage" that hides the zipper slider). Slip the zipper-boxing ends into the garages and clip. Check the loop against the plate: it must measure ${fl(P)} at the stitch line.`,
      exec: (c) => `${changeover(c)}${machineLine(c)}. Sew across each end through all four layers, ¼″ from the fold, then again ⅛″ inside. ${execTail(c)}`,
    });
    steps.push({
      id: 'top',
      title: 'Boxing to the top plate',
      role: welt ? 'welt' : 'construction',
      layers: plateLayers,
      seams: ['S5'],
      curve: R > 0,
      pivot: R === 0,
      prefer: '2206RB',
      pose: 'top',
      frame: () => `The top plate drops onto the ring. The seam glows red around the full perimeter, then stitches in, starting at the back beside the zipper.`,
      action: (c) =>
        `Right sides together, match every boxing notch to its plate notch, zipper centred on the back. ${holdNote(c)} ${R > 0 ? 'Ease the boxing around the corners; do not stretch it.' : 'Clip the boxing allowance to the stitch line at each corner.'}`,
      exec: (c) =>
        `${changeover(c)}${machineLine(c)}, boxing on top so you can see the welt stitching and sew just inside it, crowding the cord. ${R > 0 ? 'Slow right down in the corners.' : `At the corners ${pivotHow(c)}.`} ${execTail(c)}`,
    });
    steps.push({
      id: 'bottom',
      title: 'Boxing to the bottom plate',
      role: welt ? 'welt' : 'construction',
      layers: plateLayers,
      seams: ['S6'],
      curve: R > 0,
      pivot: R === 0,
      prefer: '2206RB',
      pose: 'bottom',
      frame: () => `The bottom plate slides in underneath and the last perimeter seam stitches closed.`,
      action: () => `${b('Open the zipper fully first')} — you will turn the cover through it. Before clipping, check that the top and bottom corner marks line up vertically; a twisted boxing is the classic cushion defect.`,
      exec: (c) => `${changeover(c)}${machineLine(c)} exactly as the top seam. ${execTail(c)}`,
    });
    steps.push({
      id: 'stuff',
      title: 'Turn & insert the foam',
      pose: 'stuff',
      frame: () => `The cover turns translucent so you can watch the Dacron-wrapped foam slide in through the open zipper and spring out to fill the corners.`,
      action: () =>
        `Turn the cover right side out and push the corners out with a point turner. Wrap the foam in Dacron, fold it lengthwise like a taco, feed it in through the zipper and let it open. ${mat.id === 'vinyl' ? 'Warm the vinyl first; a thin plastic bag over the foam makes it slide.' : ''} Work the corners square and close the zipper.`,
      exec: () => `No sewing. If the corners are soft, add a strip of Dacron in each one.`,
    });
    steps.push({
      id: 'final',
      title: 'Inspect the cushion',
      pose: 'final',
      spin: true,
      frame: () => `The finished cushion turns on the table — crisp ${welt ? 'welted ' : ''}edges top and bottom, zipper boxing tucked across the back.`,
      action: () => `Run a hand along both seams for skipped stitches, sight down each corner to confirm it is vertical, and run the zipper end to end.`,
      exec: () => `No sewing.`,
    });

    const views = {
      front: `A ${fl(L)} × ${fl(T)} band of ${mat.name} framed top and bottom by ${welt ? 'welt cord' : 'crisp seams'}; the boxing strip is uninterrupted across the front.`,
      side: `A ${fl(Wc)} × ${fl(T)} end with ${R > 0 ? `${fl(R)} rounded corners` : 'square corners'}; the zipper boxing appears ${fl(4)} around the back corner.`,
      iso: `A slab ${fl(L)} × ${fl(Wc)} × ${fl(T)}. The top plate is a flat field; the boxing wall is straight and vertical; the welt reads as a raised rope line around both edges.`,
    };

    return { panels, notions, seams, steps, views, needsTurning: true, summary: `${fl(L)} × ${fl(Wc)} × ${fl(T)} boxed cushion${welt ? ' with welt' : ''}.`, geom: g };
  },

  rig(kit, ctx, plan) {
    const THREE = kit.THREE;
    const g = plan.geom;
    const { L, Wc, T, plate, P, Z, welt } = g;
    const spiOf = (id) => plan.seams.find((s) => s.id === id)?.setup?.spi || 7;
    const seams = {};
    const add = (id, sm) => (seams[id] ||= []).push(sm);

    const root = kit.group();
    root.position.y = 0.15;
    const plateC = translate(plate, -L / 2, -Wc / 2);

    // Plates: top face up, bottom face down.
    const topG = kit.group(root);
    const topRot = kit.group(topG);
    topRot.rotation.x = -Math.PI / 2;
    const topPlate = kit.shape({ parent: topRot, outline: plateC, fabric: 'main' });
    const botG = kit.group(root);
    const botRot = kit.group(botG);
    botRot.rotation.x = Math.PI / 2;
    const botPlate = kit.shape({ parent: botRot, outline: plateC, fabric: 'main' });
    const inner = offsetPolygon(plateC, -0.15);
    if (welt) {
      add('S2', kit.seam(topPlate, inner, { spi: spiOf('S2'), closed: true, band: g.s }));
      add('S2', kit.seam(botPlate, inner, { spi: spiOf('S2'), closed: true, band: g.s }));
    }
    kit.label('A', topPlate, 0, 0);

    // Welt cord around both plates.
    const weltPts = offsetPolygon(plateC, 0.04).map(([x, y]) => [x, y, 0.13]);
    const weltTop = welt ? kit.tube({ parent: topPlate.obj, points: weltPts, radius: 0.13, fabric: 'main' }) : null;
    const weltBot = welt ? kit.tube({ parent: botPlate.obj, points: weltPts, radius: 0.13, fabric: 'main' }) : null;

    // Boxing loop: one wrap path starting where the zipper boxing starts.
    const path = plateC.map(([x, y]) => [x, -y]);
    const s0 = arcTo(path, [0, -Wc / 2]) - Z / 2;
    const loop = loopFrom(path, s0, 0.35);
    const deform = Deform.wrap({ path: loop.pts });
    const Pl = deform.total;
    const o = {};
    deform.fn(0, 0, 1, o);
    const P0 = new THREE.Vector3(o.x, 0, o.z);
    const n0 = new THREE.Vector3(o.nx, 0, o.nz).normalize();
    deform.fn(0.5, 0, 1, o);
    const T0 = new THREE.Vector3(o.x, 0, o.z).sub(P0).normalize();
    // Flat pose: the unwrapped strip (standing on its edge along T0) is turned
    // to lie face up behind the cushion, running along +x.
    const up = new THREE.Vector3(0, 1, 0);
    const src = new THREE.Matrix4().makeBasis(T0, up, n0);
    const zDir = new THREE.Vector3(0, 0, src.determinant() > 0 ? -1 : 1);
    const dst = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), zDir, up);
    const qFlat = new THREE.Quaternion().setFromRotationMatrix(dst.multiply(src.transpose()));
    const flatStart = new THREE.Vector3(-Pl / 2, 0.02, -(Wc / 2 + 3) - (zDir.z > 0 ? T : 0));
    const tFlat = flatStart.clone().sub(P0.clone().applyQuaternion(qFlat));
    const qId = new THREE.Quaternion();
    const boxInner = kit.group(root);
    const zipPart = kit.sheet({ parent: boxInner, w: Z, h: T, u0: 0, v0: 0, deform, fabric: 'main' });
    const coil = kit.sheet({ parent: boxInner, w: Z, h: 0.36, u0: 0, v0: T / 2 - 0.18, deform, fabric: 'trim', offset: 0.03, outline: false });
    const boxPart = kit.sheet({ parent: boxInner, w: Pl - Z, h: T, u0: Z, v0: 0, deform, fabric: 'main' });
    const boxParts = [zipPart, coil, boxPart];
    add('S3', kit.seam(zipPart, [[0.3, T / 2 + 0.34], [Z - 0.3, T / 2 + 0.34]], { spi: spiOf('S3'), band: 0.5, lift: 0.05 }));
    add('S3', kit.seam(zipPart, [[0.3, T / 2 - 0.34], [Z - 0.3, T / 2 - 0.34]], { spi: spiOf('S3'), band: 0.5, lift: 0.05 }));
    add('S4', kit.seam(boxPart, [[Z + 0.35, T], [Z + 0.35, 0]], { spi: spiOf('S4'), band: 0.6 }));
    add('S4', kit.seam(boxPart, [[Pl - 0.35, T], [Pl - 0.35, 0]], { spi: spiOf('S4'), band: 0.6 }));
    for (const [id, v] of [['S5', T - 0.12], ['S6', 0.12]]) {
      add(id, kit.seam(zipPart, [[0, v], [Z, v]], { spi: spiOf(id), band: g.s }));
      add(id, kit.seam(boxPart, [[Z, v], [Pl, v]], { spi: spiOf(id), band: g.s }));
    }
    kit.label('C', zipPart, Z / 2, T / 2);
    kit.label('B', boxPart, Z + (Pl - Z) / 2, T / 2);

    // Welt strips (shown at a representative length) for the "cover the cord" step.
    const strips = [];
    if (welt) {
      const Ls = Math.min(P + 4, Math.max(18, L * 0.8));
      for (let i = 0; i < 2; i++) {
        const sg = kit.group(root);
        sg.rotation.x = -Math.PI / 2;
        sg.position.set(-Ls / 2, 0, Wc * 1.5 + 10 + i * 3);
        const strip = kit.sheet({ parent: sg, w: Ls, h: 1.5, fabric: 'main' });
        const cord = kit.tube({ parent: strip.obj, points: [[0, 0.75, 0.15], [Ls, 0.75, 0.15]], radius: 0.13, closed: false, color: '#f5f1e8' });
        add('S1', kit.seam(strip, [[0.4, 0.3], [Ls - 0.4, 0.3]], { spi: spiOf('S1'), band: 0.4 }));
        strips.push({ strip, cord });
        if (i === 0) kit.label('D', strip, Ls / 2, 0.75);
      }
    }

    const foam = kit.solid({ w: L - 0.4, h: T - 0.3, d: Wc - 0.4, color: '#f2d675', parent: root });
    const shellParts = [topPlate, botPlate, ...boxParts];

    const params = { topT: 0, botT: 0, flat: 1, wrap: 0, welt: 0, strip: welt ? 1 : 0, foam: 0, foamOp: 0, shellOp: 1 };
    const poses = {
      prep: { ...params },
      welt: {},
      weltPlates: { welt: 1, strip: 0 },
      zipper: {},
      loop: { flat: 0, wrap: 1, strip: 0 },
      top: { topT: 1 },
      bottom: { botT: 1 },
      stuff: { foam: 1, foamOp: 1, shellOp: 0.35 },
      final: { shellOp: 1 },
    };
    const span = Math.max(L, Wc);
    const zipCenter = flatStart.clone().add(new THREE.Vector3(Z / 2, 0, zDir.z * T / 2));
    const cams = {
      prep: fitCam(0, 64),
      welt: cam([0, 0, Wc * 1.5 + 11.5], Math.max(L, 20) * 1.1, 0, 55),
      weltPlates: fitCam(0, 58, 1.05),
      zipper: cam(zipCenter.toArray(), Math.max(Z * 1.25, 22), 0, 62),
      loop: cam([0, T / 2, 0], span * 1.9, 30, 32),
      top: cam([0, T / 2, 0], span * 1.7, 35, 34),
      bottom: cam([0, T / 2, 0], span * 1.7, 42, 10),
      stuff: cam([0, T / 2, -Wc / 3], span * 1.9, 155, 30),
      final: cam([0, T / 2, 0], span * 1.6, 35, 28),
    };
    const prepTop = new THREE.Vector3(-(L / 2 + 1.5), 0, Wc + 4);
    const prepBot = new THREE.Vector3(L / 2 + 1.5, 0, Wc + 4);

    return {
      params,
      poses,
      cams,
      seams,
      labelScale: Math.max(1.6, span / 12),
      apply(p) {
        topG.position.set(prepTop.x * (1 - p.topT), T * p.topT + Math.sin(Math.PI * p.topT) * 5, prepTop.z * (1 - p.topT));
        botG.position.set(prepBot.x * (1 - p.botT), Math.sin(Math.PI * p.botT) * 3, prepBot.z * (1 - p.botT));
        boxInner.quaternion.slerpQuaternions(qId, qFlat, p.flat);
        boxInner.position.copy(tFlat).multiplyScalar(p.flat);
        for (const bp of boxParts) bp.setMorph(p.wrap);
        weltTop?.setReveal(p.welt);
        weltBot?.setReveal(p.welt);
        for (const s of strips) {
          s.strip.setOpacity(p.strip);
          s.cord.setOpacity(p.strip);
        }
        foam.mesh.position.set(0, T / 2, -(Wc + 14) * (1 - p.foam));
        foam.setOpacity(p.foamOp);
        for (const sp of shellParts) sp.setOpacity(p.shellOp);
        weltTop?.setOpacity(p.shellOp);
        weltBot?.setOpacity(p.shellOp);
      },
    };
  },
};
