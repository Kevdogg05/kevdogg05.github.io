// Seam architecture library. Each entry carries a short explanation for the
// blueprint's seam schedule and a schematic cross-section (SVG, 160×72).
// Colours: a = first panel, b = second panel, t = trim/binding, s = stitch.

const C = { a: '#f0a640', b: '#4fb8de', t: '#9ba6b4', s: '#ff5d52', cord: '#f5f1e8' };

const layer = (d, color, w = 4) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const stitch = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.s}" stroke-width="2" stroke-dasharray="4 3"/>`;
const label = (x, y, text) => `<text x="${x}" y="${y}" font-size="8" fill="currentColor" opacity=".75">${text}</text>`;
const svg = (body) => `<svg viewBox="0 0 160 72" role="img" aria-hidden="true">${body}</svg>`;

export const SEAM_TYPES = {
  plain: {
    name: 'Plain seam',
    desc: 'Right sides together, one row of stitching at the seam allowance, allowances pressed open or to one side.',
    use: 'General construction where the seam is enclosed by a lining or binding.',
    svg: () =>
      svg(
        layer('M4 30 H80 V40 H54', C.a) +
          layer('M156 30 H84 V40 H110', C.b) +
          stitch(82, 22, 82, 46) +
          label(6, 62, 'pressed open')
      ),
  },
  topstitched: {
    name: 'Plain seam, topstitched',
    desc: 'Plain seam with both allowances pressed to one side and locked down by a topstitch ⅛″–¼″ from the seam.',
    use: 'Bag side seams and boxing joins that must lie flat and resist rolling.',
    svg: () =>
      svg(
        layer('M4 30 H82 V44 H120', C.a) +
          layer('M156 30 H85 V37 H120', C.b) +
          stitch(83.5, 22, 83.5, 50) +
          stitch(104, 22, 104, 50) +
          label(6, 62, 'allowances to one side + topstitch')
      ),
  },
  french: {
    name: 'French seam',
    desc: 'Sewn twice: wrong sides together at ¼″, trimmed to ⅛″, then right sides together at ⅜″ so the raw edges are sealed inside.',
    use: 'Unlined or lightweight seams (linings, pack cloth) where frayed edges would show.',
    svg: () =>
      svg(
        layer('M4 26 H76 V60 Q76 66 82 66 Q88 66 88 60 V44', C.a) +
          layer('M156 26 H92 V58', C.b) +
          layer('M84 46 V58', C.b, 3) +
          stitch(70, 34, 98, 34) +
          stitch(72, 58, 96, 58) +
          label(104, 62, 'edges sealed')
      ),
  },
  flatFelled: {
    name: 'Flat-felled seam',
    desc: 'One allowance is trimmed, the other wraps around it, and the whole fold is stitched flat with two rows — four interlocked layers, no raw edges.',
    use: 'Covers, aprons and work wear: the strongest, most weather-shedding flat seam.',
    svg: () =>
      svg(
        layer('M4 28 H104 Q112 28 112 32 Q112 36 104 36 H72', C.a) +
          layer('M156 48 H64 Q56 48 56 44 Q56 40 64 40 H98', C.b) +
          stitch(76, 20, 76, 56) +
          stitch(100, 20, 100, 56) +
          label(6, 66, 'two rows, interlocked')
      ),
  },
  welt: {
    name: 'Welted (piped) seam',
    desc: 'A fabric-covered cord is sandwiched between two panels and sewn with a welt or zipper foot crowded tight against the cord.',
    use: 'Cushion plates to boxing; defines edges and takes the wear on upholstery.',
    svg: () =>
      svg(
        layer('M10 24 H120', C.a) +
          layer('M10 34 H104 A6 6 0 0 1 104 46 H10', C.t, 3.5) +
          `<circle cx="104" cy="40" r="4" fill="${C.cord}"/>` +
          layer('M10 56 H120', C.b) +
          stitch(95, 18, 95, 62) +
          label(122, 44, 'cord')
      ),
  },
  bound: {
    name: 'Bound seam allowance',
    desc: 'After the seam is sewn, the stacked allowances are wrapped in binding tape and stitched ⅛″ from the binding edge.',
    use: 'Inside duffels and unlined bags — clean, abrasion-proof interior seams.',
    svg: () =>
      svg(
        layer('M10 30 H112', C.a) +
          layer('M10 38 H112', C.b) +
          layer('M78 22 H114 Q122 22 122 34 Q122 46 114 46 H78', C.t, 3.5) +
          stitch(40, 22, 40, 46) +
          stitch(86, 16, 86, 52) +
          label(8, 62, 'seam')
      ),
  },
  boxCorner: {
    name: 'Boxed corner',
    desc: 'The side seam is centred on the bottom fold to make a triangle; one straight seam across the triangle sets the depth.',
    use: 'Totes and lined bags — gives a flat base from one body piece.',
    svg: () =>
      svg(
        `<path d="M30 62 L130 62 L80 14 Z" fill="none" stroke="${C.a}" stroke-width="3" stroke-linejoin="round"/>` +
          `<line x1="80" y1="14" x2="80" y2="62" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 3"/>` +
          stitch(49, 44, 111, 44) +
          label(114, 42, 'depth')
      ),
  },
  hem: {
    name: 'Double-fold hem',
    desc: 'The edge is folded under twice so the raw edge is enclosed, then stitched close to the inner fold.',
    use: 'Top edges, apron edges, cover hems.',
    svg: () =>
      svg(
        layer('M4 28 H124 Q132 28 132 34 Q132 40 124 40 H98 Q92 40 92 44 Q92 48 98 48 H122', C.a) +
          stitch(104, 20, 104, 56) +
          label(6, 62, 'raw edge enclosed')
      ),
  },
  channel: {
    name: 'Drawcord channel hem',
    desc: 'A double-fold hem sewn wide enough to carry a drawcord or shock cord.',
    use: 'Bottom edge of fitted covers.',
    svg: () =>
      svg(
        layer('M4 26 H120 Q136 26 136 38 Q136 50 120 50 H96 Q90 50 90 54 Q90 58 96 58 H112', C.a) +
          `<circle cx="122" cy="38" r="5" fill="${C.cord}"/>` +
          stitch(104, 18, 104, 64) +
          label(6, 66, 'cord channel')
      ),
  },
  boxX: {
    name: 'Box-X bartack',
    desc: 'A rectangle sewn around the strap end with an X through it, spreading the load over the whole overlap.',
    use: 'Every load-bearing webbing joint: handles, strap anchors, D-ring tabs.',
    svg: () =>
      svg(
        `<rect x="60" y="4" width="40" height="64" rx="2" fill="${C.t}" opacity=".55"/>` +
          `<path d="M64 26 H96 V62 H64 Z M64 26 L96 62 M96 26 L64 62" fill="none" stroke="${C.s}" stroke-width="2" stroke-dasharray="4 3"/>` +
          label(104, 46, 'webbing')
      ),
  },
  zipper: {
    name: 'Zipper seam',
    desc: 'Folded panel edges are set either side of the coil and topstitched through the zipper tape.',
    use: 'Duffel tops, cushion zipper boxing.',
    svg: () =>
      svg(
        layer('M4 30 H70 Q75 30 75 34 Q75 38 70 38 H50', C.a) +
          layer('M156 30 H90 Q85 30 85 34 Q85 38 90 38 H110', C.b) +
          layer('M46 44 H114', '#3b4048', 3) +
          `<rect x="76" y="38" width="8" height="9" rx="2" fill="#16181b" stroke="#596170"/>` +
          stitch(64, 22, 64, 50) +
          stitch(96, 22, 96, 50) +
          label(64, 64, 'coil')
      ),
  },
  edgeBound: {
    name: 'Bound edge',
    desc: 'Binding tape is folded over a raw edge and stitched through all layers near the binding’s inner edge.',
    use: 'Tool rolls, flaps and pocket tops — finishes and reinforces in one pass.',
    svg: () =>
      svg(
        layer('M8 30 H110', C.a) +
          layer('M8 38 H110', C.b) +
          layer('M70 22 H114 Q122 22 122 34 Q122 46 114 46 H70', C.t, 3.5) +
          stitch(78, 16, 78, 52) +
          label(8, 62, 'all layers bound')
      ),
  },
  edgeStitch: {
    name: 'Edge-stitch / topstitch',
    desc: 'A visible row stitched ⅛″ (edge-stitch) or ¼″ (topstitch) from a folded edge, through every layer below.',
    use: 'Patch pockets, dividers, appliqués and anything sewn on top of a panel.',
    svg: () =>
      svg(
        layer('M4 50 H156', C.b) +
          layer('M150 34 H42 Q36 34 36 38 Q36 42 42 42 H70', C.a) +
          stitch(46, 26, 46, 58) +
          label(100, 26, 'pocket on panel')
      ),
  },
  baste: {
    name: 'Machine baste',
    desc: 'A temporary long stitch inside the seam allowance to hold layers in register before the real seam.',
    use: 'Holding linings, welt and pleats while you sew the structural seam.',
    svg: () =>
      svg(
        layer('M4 30 H156', C.a) +
          layer('M4 38 H156', C.b) +
          `<line x1="20" y1="34" x2="140" y2="34" stroke="${C.s}" stroke-width="2" stroke-dasharray="12 6"/>` +
          label(6, 58, 'long stitch, removable')
      ),
  },
};

export function seamType(id) {
  return SEAM_TYPES[id] || SEAM_TYPES.plain;
}
