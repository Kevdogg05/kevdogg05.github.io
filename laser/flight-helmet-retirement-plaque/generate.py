#!/usr/bin/env python3
"""Layered flight-helmet retirement plaque - 3 mm basswood laser files.

Builds every wood layer as real geometry (shapely) so offsets, reveals and
layer stacking are exact, converts all lettering to outlines, and writes:

  helmet-plaque-cut.svg      laser file, every piece laid out on 12x12 in sheets
  sheets/sheet-N-*.svg       the same pieces, one 12x12 in sheet per file
  helmet-plaque-preview.svg  assembled preview, parts list and glue-up steps

Requirements:  pip install shapely fonttools uharfbuzz skia-pathops
Edit the personalisation block and re-run:  python3 generate.py
"""
import io
import math
import os

import pathops
import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- personalisation
NAME = "MSgt Renholm"
TITLE = "RETIRED"
LINES = [
    "In Honor of Your 20 Years",
    "of Dedicated Service",
    "As an Aircrew Flight",
    "Equipment Technician",
]
BRANCH = "U.S. AIR FORCE"
INCLUDE_EMBLEM = True

# ---------------------------------------------------------------- material / scale
DU = 0.35          # millimetres per design unit (finished plaque ~210 x 235 mm)
THICK = 3.0        # basswood thickness, mm (stand slot & tab sizes)
SLOT = 3.0         # cross-lap slot width, mm (kerf makes it a snug ~3.15 mm)
LEAN = 15.0        # stand lean angle, degrees from vertical

FONT_NAME = os.path.join(HERE, "fonts", "alegreya-latin-600-italic.woff")
FONT_BODY = os.path.join(HERE, "fonts", "eb-garamond-latin-500-normal.woff")
FONT_SANS = os.path.join(HERE, "fonts", "arimo-latin-700-normal.woff")

RES = 32


# ================================================================ geometry helpers
def circle(c, r):
    return Point(c).buffer(r, resolution=RES * 4)


def soften(g, r):
    """Round every convex and concave corner with radius r."""
    return g.buffer(r, resolution=RES).buffer(-2 * r, resolution=RES).buffer(r, resolution=RES)


def spline(pts, closed=False, n=24):
    """Catmull-Rom spline through pts, returned as a dense point list."""
    p = [tuple(q) for q in pts]
    ext = [p[-1]] + p + [p[0], p[1]] if closed else [p[0]] + p + [p[-1]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for k in range(n):
            t = k / n
            out.append(tuple(
                0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t
                       + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                       + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t ** 3)
                for j in (0, 1)))
    if not closed:
        out.append(p[-1])
    return out


def blob(pts):
    return Polygon(spline(pts, closed=True)).buffer(0)


def rrect(cx, cy, w, h, r, ang=0.0):
    g = box(cx - w / 2 + r, cy - h / 2 + r, cx + w / 2 - r, cy + h / 2 - r).buffer(r, resolution=RES)
    return affinity.rotate(g, ang, origin=(cx, cy))


def polar(c, r, deg):
    a = math.radians(deg)
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))


def wedge(c, a0, a1, r=3000):
    steps = 16
    return Polygon([c] + [polar(c, r, a0 + (a1 - a0) * i / steps) for i in range(steps + 1)])


def largest(g):
    if isinstance(g, MultiPolygon):
        return max(g.geoms, key=lambda q: q.area)
    return g


def polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [q for q in getattr(g, "geoms", []) if isinstance(q, Polygon)]


def lines(g):
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    out = []
    for q in getattr(g, "geoms", []):
        out += lines(q)
    return out


class Centerline:
    """Arc-length parametrised polyline (for the hose and its ribs)."""

    def __init__(self, pts):
        self.line = LineString(pts)

    def at(self, s):
        s = max(0.0, min(self.line.length, s))
        p = self.line.interpolate(s)
        q = self.line.interpolate(min(self.line.length, s + 0.5))
        r = self.line.interpolate(max(0.0, s - 0.5))
        dx, dy = q.x - r.x, q.y - r.y
        n = math.hypot(dx, dy) or 1.0
        return (p.x, p.y), (dx / n, dy / n)


# ================================================================ text to outlines
def _aff(m, p):
    a, b, c, d, e, f = m
    return (a * p[0] + b * p[1] + c, d * p[0] + e * p[1] + f)


class GPath:
    """Bezier outline (glyphs) that can be affinely transformed exactly."""

    def __init__(self, ops=None):
        self.ops = ops or []

    def transformed(self, m):
        return GPath([(op, [_aff(m, p) for p in pts]) for op, pts in self.ops])

    def bounds(self):
        xs = [p[0] for _, pts in self.ops for p in pts]
        ys = [p[1] for _, pts in self.ops for p in pts]
        return min(xs), min(ys), max(xs), max(ys)

    def merged(self):
        """Union all contours (overlapping glyphs/serifs) into clean outlines."""
        p = pathops.Path()
        for op, pts in self.ops:
            if op == "M":
                p.moveTo(*pts[0])
            elif op == "L":
                p.lineTo(*pts[0])
            elif op == "Q":
                p.quadTo(*pts[0], *pts[1])
            elif op == "C":
                p.cubicTo(*pts[0], *pts[1], *pts[2])
            elif op == "Z":
                p.close()
        p = pathops.simplify(p, fix_winding=True)
        verbs = {"moveTo": "M", "lineTo": "L", "qCurveTo": "Q", "curveTo": "C", "closePath": "Z"}
        ops = []
        for verb, pts in p.segments:
            if verb == "qCurveTo" and len(pts) > 2:
                for a, b in pathops.decompose_quadratic_segment(pts):
                    ops.append(("Q", [a, b]))
            elif verb in verbs:
                ops.append((verbs[verb], list(pts)))
        return GPath(ops)

    def d(self, nd=3):
        out = []
        for op, pts in self.ops:
            out.append(op + " ".join(f"{round(x, nd):g},{round(y, nd):g}" for x, y in pts))
        return "".join(out)


class _Pen(BasePen):
    def __init__(self, gs, m, ops):
        super().__init__(gs)
        self.m, self.ops = m, ops

    def _moveTo(self, p):
        self.ops.append(("M", [_aff(self.m, p)]))

    def _lineTo(self, p):
        self.ops.append(("L", [_aff(self.m, p)]))

    def _curveToOne(self, p1, p2, p3):
        self.ops.append(("C", [_aff(self.m, p) for p in (p1, p2, p3)]))

    def _qCurveToOne(self, p1, p2):
        self.ops.append(("Q", [_aff(self.m, p) for p in (p1, p2)]))

    def _closePath(self):
        self.ops.append(("Z", []))

    _endPath = _closePath


class Font:
    def __init__(self, path):
        self.tt = TTFont(path)
        self.tt.flavor = None
        buf = io.BytesIO()
        self.tt.save(buf)
        self.hb = hb.Font(hb.Face(buf.getvalue()))
        self.upm = self.tt["head"].unitsPerEm
        self.gs = self.tt.getGlyphSet()

    def path(self, text, size, tracking=0.0):
        """Outline of text at em-size `size`, origin at baseline-left (y down)."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True, "liga": True})
        s = size / self.upm
        ops, x = [], 0.0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            name = self.tt.getGlyphName(info.codepoint)
            m = (s, 0, (x + pos.x_offset) * s, 0, -s, -pos.y_offset * s)
            self.gs[name].draw(_Pen(self.gs, m, ops))
            x += pos.x_advance + tracking * self.upm
        return GPath(ops)


def place_text(font, text, cx, baseline, width=None, size=None, tracking=0.0):
    """Centre text (by ink) on cx; scale to `width` or use em-size `size`."""
    if size is None:
        x0, _, x1, _ = font.path(text, 100.0, tracking).bounds()
        size = 100.0 * width / (x1 - x0)
    p = font.path(text, size, tracking)
    x0, _, x1, _ = p.bounds()
    return p.transformed((1, 0, cx - (x0 + x1) / 2, 0, 1, baseline)).merged(), size


# ================================================================ pieces
STAINS = {
    # name: (preview fill, preview edge, description)
    "natural": ("#ead6b1", "#c9ad83", "natural basswood (clear coat)"),
    "medium": ("#b07a45", "#7d5130", "medium stain (e.g. golden oak / early american)"),
    "dark": ("#4a3b32", "#2b211c", "dark stain (e.g. dark walnut / ebony)"),
}


class Piece:
    def __init__(self, key, label, level, stain, shape):
        self.key, self.label, self.level, self.stain = key, label, level, stain
        self.shape = shape
        self.score = []      # LineStrings (du)
        self.engrave = []    # GPath or Polygon (du)

    def add_score(self, g):
        self.score += lines(g) if not isinstance(g, Polygon) else lines(g.boundary)


def build():
    C = (678.0, 322.0)          # dome centre
    R = 269.0                   # helmet shell radius
    BASE_OFF = 7.0              # natural backer reveal
    DARK_OFF = 4.0              # dark rim reveal around accessories

    dome = circle(C, R)

    # ---- helmet outline: dome, lower edge, face opening
    bottom = spline([(330, 500), (440, 499), (470, 500), (500, 504), (525, 513), (550, 527),
                     (575, 541), (600, 552), (625, 560), (650, 564), (675, 566), (700, 567),
                     (730, 567), (760, 565), (790, 561), (840, 554)])
    above_bottom = Polygon(bottom + [(1300, 554), (1300, -300), (330, -300)])
    face = [(1300, 250), (900, 250)] + spline(
        [(900, 250), (850, 250), (830, 255), (818, 270), (814, 295), (813, 340),
         (812, 390), (808, 440), (800, 490), (790, 530), (780, 570), (775, 640)])
    left_of_face = Polygon(face + [(330, 640), (330, -300), (1300, -300)])

    helmet = soften(dome & above_bottom & left_of_face, 4)
    shell = soften(dome & affinity.translate(above_bottom, 0, -15)
                   & left_of_face.buffer(-17, resolution=RES), 3)

    # ---- visor housing
    A0 = -67.5
    sector = (circle(C, 281) - circle(C, 178)) & wedge(C, A0, A0 + 120) & box(0, -1000, 2000, 230)
    u = (math.cos(math.radians(A0)), math.sin(math.radians(A0)))
    t = (-u[1], u[0])

    def radial(r, s):
        return (C[0] + r * u[0] + s * t[0], C[1] + r * u[1] + s * t[1])

    lip = Polygon([radial(171, -9), radial(203, -9), radial(203, 6), radial(171, 6)])
    visor_cover = soften(sector | lip, 5)
    visor_base = soften(visor_cover.buffer(5, resolution=RES), 3)

    # ---- edge roll along the face opening
    edge_roll = (left_of_face.buffer(-17, resolution=RES) - left_of_face.buffer(-47, resolution=RES)) \
        & dome & box(730, 190, 870, 470)

    # ---- oxygen mask
    mask = blob([(838, 402), (862, 388), (888, 374), (908, 366), (928, 372), (947, 391),
                 (961, 418), (969, 446), (973, 474), (975, 503), (971, 528), (960, 546),
                 (942, 558), (918, 564), (895, 562), (877, 552), (866, 534), (859, 510),
                 (855, 482), (851, 452), (845, 425)])
    window = blob([(918, 406), (936, 401), (950, 418), (955, 444), (948, 459), (930, 456), (917, 432)])
    tab = rrect(978, 494, 22, 74, 5, 6)
    strap = soften(LineString(spline([(888, 432), (850, 435), (820, 447), (799, 472), (797, 505),
                                      (812, 531), (843, 546), (888, 548)])).buffer(13, cap_style=2), 3)
    valve_c = (893, 455)
    pad_top = rrect(852, 435, 42, 16, 5, -5)
    pad_bot = rrect(845, 543, 40, 15, 5, 10)
    receiver = soften(box(712, 428, 768, 468) | circle((749, 423), 12) | circle((735, 470), 9), 3)
    buckle = rrect(787, 478, 28, 38, 4, 35)
    block = rrect(731, 527, 48, 44, 7, -12)
    bracket = rrect(704, 536, 30, 18, 6, -12)

    # ---- hose
    hose_cl = Centerline(spline([(736, 515), (747, 565), (765, 612), (797, 652), (842, 677),
                                 (890, 681), (935, 664), (966, 630), (979, 592), (972, 560),
                                 (955, 535)], n=32))
    hose = LineString(hose_cl.line.coords).buffer(28, cap_style=2, resolution=RES)

    # ================================================= assemble levels
    pieces = []

    def add(key, label, level, stain, shape):
        p = Piece(key, label, level, stain, shape)
        pieces.append(p)
        return p

    # Level 3 (on the dark rim): shell face, mask, strap, hose - cut so they tile.
    GAP = 0.3
    shell = soften(shell | visor_base, 2)
    p_shell = add("shell", "Helmet shell face", 3, "natural", shell)
    mask_l3 = soften((mask | tab.buffer(3, resolution=RES)) - window, 2)
    p_mask = add("mask", "Oxygen mask", 3, "dark", mask_l3 - shell.buffer(GAP))
    strap_l3 = largest(strap - (shell | mask_l3).buffer(GAP))
    add("strap", "Mask strap arm", 3, "medium", strap_l3)
    hose_l3 = largest(hose - (shell | mask_l3 | strap_l3).buffer(GAP))
    p_hose = add("hose", "Breathing hose", 3, "natural", soften(hose_l3, 1.5))

    # Level 4 pieces (priority order: earlier pieces win overlaps).
    l4_raw = [
        ("visor_base", "Visor housing base", "medium", visor_base),
        ("valve_ring", "Exhalation valve ring", "dark", circle(valve_c, 19)),
        ("receiver", "Bayonet receiver", "natural", receiver),
        ("buckle", "Strap buckle", "natural", buckle),
        ("block", "Hose connector block", "medium", block),
        ("pad_top", "Upper grip pad", "natural", pad_top),
        ("pad_bot", "Lower grip pad", "natural", pad_bot),
        ("tab", "Right bayonet tab", "natural", tab),
        ("bracket", "Hose bracket", "natural", bracket),
        ("edge_roll", "Face-opening edge roll", "medium", edge_roll),
    ]
    taken = Polygon()
    l4 = {}
    for key, label, stain, g in l4_raw:
        g2 = largest(soften(g - taken.buffer(GAP), 1.2))
        l4[key] = add(key, label, 4, stain, g2)
        taken = taken | g2

    # hose cuff where the hose enters the mask
    s_cuff = hose_cl.line.project(hose_cl.line.intersection(mask.exterior)) - 2
    (cx, cy), (tx, ty) = hose_cl.at(s_cuff)
    cuff = rrect(cx, cy, 56, 13, 3, math.degrees(math.atan2(ty, tx)) + 90)
    cuff = largest(cuff - taken.buffer(GAP))
    l4["cuff"] = add("cuff", "Hose cuff", 4, "natural", cuff)
    taken = taken | cuff

    # Level 5
    p_visor = add("visor_cover", "Visor housing cover", 5, "natural", visor_cover)
    p_valve = add("valve_cap", "Exhalation valve cap", 5, "dark", circle(valve_c, 11))

    # Level 2 (dark rim) and level 1 (natural backer) follow everything above.
    accessories = unary_union([p.shape for p in pieces if p.key not in ("shell", "visor_base", "visor_cover")])
    rim = soften(helmet | visor_base | accessories.buffer(DARK_OFF, resolution=RES), 3)
    add("rim", "Helmet rim / backer", 2, "dark", rim)
    base = soften(rim.buffer(BASE_OFF, resolution=RES), 4)
    base = Polygon(base.exterior, [r for r in base.interiors if Polygon(r).area > 4000])
    p_base = add("base", "Back plate", 1, "natural", base)

    # ================================================= details
    # shell: engraved lettering and emblem
    f_name, f_body, f_sans = Font(FONT_NAME), Font(FONT_BODY), Font(FONT_SANS)
    TX = 628
    name, _ = place_text(f_name, NAME, TX + 2, 225, width=290)
    title, _ = place_text(f_body, TITLE, TX, 287, width=186, tracking=0.02)
    body_size = None
    body = []
    for txt, base_y in zip(LINES, (322, 347, 385, 410)):
        if body_size is None:
            g, body_size = place_text(f_body, txt, TX, base_y, width=240)
        else:
            g, _ = place_text(f_body, txt, TX, base_y, size=body_size)
        body.append(g)
    p_shell.engrave += [name, title] + body
    if INCLUDE_EMBLEM:
        p_shell.engrave.append(emblem(TX - 2, 430, 60))
    if BRANCH:
        branch, _ = place_text(f_sans, BRANCH, TX - 2, 500, width=100, tracking=0.01)
        p_shell.engrave.append(branch)

    covered = unary_union([p.shape for p in pieces if p.level >= 4]).buffer(4, resolution=RES)
    p_shell.add_score(LineString(shell.buffer(-8, resolution=RES).exterior.coords).difference(covered))

    # visor cover: lens track, lock knob
    ang12 = math.degrees(math.atan2(12, 194))
    end = math.degrees(math.asin((222 - C[1]) / 194))
    track = [radial(271, 12), radial(194, 12)] + [polar(C, 194, A0 + ang12 + (end - A0 - ang12) * i / 40)
                                                   for i in range(41)]
    p_visor.add_score(LineString(track))
    kx, ky = polar(C, 185, -36)
    p_visor.engrave.append(rrect(kx, ky, 9, 8, 1.5, -36 + 90) - rrect(kx, ky, 4, 3.5, 0.8, -36 + 90))

    # valve
    p_valve.add_score(circle(valve_c, 5.5).exterior)
    l4["valve_ring"].add_score(circle(valve_c, 15.5).exterior)

    # mask seam
    p_mask.add_score(LineString(spline([(898, 486), (913, 512), (933, 531), (958, 541)]))
                     .difference(unary_union([l4["tab"].shape, l4["cuff"].shape]).buffer(3)))

    # grip-pad ribs, bayonet tab ribs
    for pad, n in ((l4["pad_top"], 6), (l4["pad_bot"], 6)):
        ribs(pad, n)
    tb = l4["tab"].shape
    (tx0, ty0, tx1, ty1) = tb.bounds
    for i in range(5):
        y = ty0 + 8 + i * 4.2
        l4["tab"].add_score(LineString([(tx0 - 5, y - 4), (tx1 + 5, y + 2)]).intersection(tb.buffer(-3)))

    # receiver screws, bracket bolt, block inset, buckle bars, cuff band
    rec = l4["receiver"]
    for (x, y), r in (((722, 440), 3.2), ((749, 423), 6), ((749, 423), 3), ((735, 471), 3.2)):
        rec.add_score(circle((x, y), r).exterior)
    l4["bracket"].add_score(circle((700, 537), 4).exterior)
    l4["block"].add_score(l4["block"].shape.buffer(-5, resolution=RES).exterior)
    for off in (-7, 7):
        bar = rrect(787, 478, 16, 5.5, 2, 35)
        l4["buckle"].add_score(affinity.translate(bar, off * math.cos(math.radians(125)),
                                                  off * math.sin(math.radians(125))).exterior)
    l4["cuff"].add_score(LineString([(cx - 40 * -ty, cy - 40 * tx), (cx + 40 * -ty, cy + 40 * tx)])
                         .intersection(l4["cuff"].shape.buffer(-2.5)))

    # hose corrugations
    skip = unary_union([l4["block"].shape, l4["cuff"].shape, l4["bracket"].shape]).buffer(2.5)
    inner = p_hose.shape.buffer(-4)
    s = 4.0
    while s < hose_cl.line.length:
        (px, py), (tx, ty) = hose_cl.at(s)
        nx, ny = -ty, tx
        seg = LineString([(px - nx * 30, py - ny * 30), (px + nx * 30, py + ny * 30)])
        groove = seg.intersection(inner).buffer(1.1, resolution=8).intersection(inner).difference(skip)
        if not groove.is_empty:
            p_hose.engrave.append(groove)
        s += 8.5

    stand(pieces, p_base)
    return pieces


def ribs(piece, n):
    g = piece.shape
    mrr = g.minimum_rotated_rectangle
    xs = list(mrr.exterior.coords)[:4]
    e0 = (xs[1][0] - xs[0][0], xs[1][1] - xs[0][1])
    e1 = (xs[2][0] - xs[1][0], xs[2][1] - xs[1][1])
    if math.hypot(*e0) < math.hypot(*e1):
        xs = xs[1:] + xs[:1]
        e0, e1 = e1, e0
    for i in range(n):
        f = (i + 1) / (n + 1)
        a = (xs[0][0] + e0[0] * f, xs[0][1] + e0[1] * f)
        b = (a[0] + e1[0], a[1] + e1[1])
        piece.add_score(LineString([a, b]).intersection(g.buffer(-2.5)))


def emblem(cx, top, width):
    """Stylised wings-and-star emblem (engrave), sized to `width` du."""
    axis = 347.0
    wing = [
        Polygon([(78, 68), (52, 126), (150, 205), (118, 140)]),
        Polygon([(45, 152), (338, 357), (318, 412), (112, 282), (80, 235), (58, 195)]),
        Polygon([(117, 290), (305, 420), (300, 432), (220, 428), (165, 400), (145, 365), (128, 320)]),
    ]
    kite = Polygon([(208, 507), (262, 465), (302, 486), (288, 555)])
    parts = wing + [affinity.scale(w, -1, 1, origin=(axis, 0)) for w in wing]
    parts += [kite, affinity.scale(kite, -1, 1, origin=(axis, 0)),
              Polygon([(292, 568), (347, 520), (402, 568), (347, 605)]),
              Point(axis, 470).buffer(37, resolution=RES)]
    g = unary_union([soften(p, 5) for p in parts])
    x0, y0, x1, _ = g.bounds
    k = width / (x1 - x0)
    return affinity.affine_transform(g, [k, 0, 0, k, cx - axis * k, top - y0 * k])


def stand(pieces, p_base):
    """Easel leg (tab glues into a slot in the back plate) plus a cross-lap foot."""
    a = math.radians(LEAN)
    base = p_base.shape
    y_table = base.bounds[3]
    x_leg = 650.0

    def s_of(y):
        return (y_table - y) * DU

    top_y, slot_top, slot_bot = 380.0, 400.0, 540.0
    s2 = s_of(top_y)
    s_t0, s_t1 = s_of(slot_bot), s_of(slot_top)
    D = 80.0

    def B(s):
        return (-s * math.sin(a), s * math.cos(a))

    n = (math.cos(a), math.sin(a))
    tab_d = THICK - 0.2
    p0, p_top = B(0), B(s2)
    t0, t1 = B(s_t0 + 0.5), B(s_t1 - 0.5)
    leg = Polygon([p0, t0, (t0[0] + n[0] * tab_d, t0[1] + n[1] * tab_d),
                   (t1[0] + n[0] * tab_d, t1[1] + n[1] * tab_d), t1, p_top, (-D, 0)])
    slot_x = -D + 12
    leg = leg - box(slot_x - SLOT / 2, -1, slot_x + SLOT / 2, 7.0)
    leg = leg.buffer(0.8, join_style=1).buffer(-0.8, join_style=1)
    # profile coords (mm, z up) -> du, y down
    leg_du = affinity.affine_transform(leg, [1 / DU, 0, 0, -1 / DU, 0, 0])
    pieces.append(Piece("leg", "Stand leg", 0, "natural", leg_du))

    foot = box(-45, 0, 45, 14) - box(-SLOT / 2, 7.0, SLOT / 2, 15)
    foot = foot.buffer(1.0, join_style=1).buffer(-1.0, join_style=1)
    foot_du = affinity.affine_transform(foot, [1 / DU, 0, 0, -1 / DU, 0, 0])
    pieces.append(Piece("foot", "Stand foot", 0, "natural", foot_du))

    # matching slot through the back plate (hidden behind the dark rim)
    w = SLOT / DU
    slot = box(x_leg - w / 2, y_table - s_t1 / DU, x_leg + w / 2, y_table - s_t0 / DU)
    p_base.shape = p_base.shape - slot


# ================================================================ assembly data
# (key, sheet) in glue-up order; the list position is the part number.
ORDER = [
    ("base", 1), ("rim", 3), ("shell", 2), ("mask", 3), ("strap", 4), ("hose", 2),
    ("visor_base", 4), ("edge_roll", 4), ("valve_ring", 3), ("receiver", 1), ("buckle", 1),
    ("block", 4), ("bracket", 1), ("pad_top", 1), ("pad_bot", 1), ("tab", 1), ("cuff", 1),
    ("visor_cover", 2), ("valve_cap", 3), ("leg", 2), ("foot", 1),
]
SHEETS = {1: "natural", 2: "natural", 3: "dark", 4: "medium"}
SHEET_MM = 304.8          # 12 x 12 in boards
MARGIN, GAP, LABEL_H = 6.0, 4.0, 4.5


def number_pieces(pieces):
    by = {p.key: p for p in pieces}
    out = []
    for i, (key, sheet) in enumerate(ORDER, 1):
        p = by[key]
        p.num, p.sheet = i, sheet
        assert SHEETS[sheet] == p.stain, (key, sheet, p.stain)
        out.append(p)
    assert len(out) == len(pieces)
    return out


def check(pieces):
    """Print anything that would make the glue-up or the cut go wrong."""
    issues = []
    for lvl in (2, 3, 4, 5):
        below = unary_union([p.shape for p in pieces if p.level == lvl - 1])
        here = [p for p in pieces if p.level == lvl]
        for p in here:
            loose = p.shape.difference(below).area / p.shape.area
            if loose > 0.04:
                issues.append(f"{p.key}: {loose:.0%} not supported by level {lvl - 1}")
        for i, a in enumerate(here):
            for b in here[i + 1:]:
                ov = a.shape.intersection(b.shape).area * DU * DU
                if ov > 0.5:
                    issues.append(f"{a.key}/{b.key} overlap {ov:.1f} mm2 on level {lvl}")
    for p in pieces:
        r = 0.6 / DU
        thin = p.shape.difference(p.shape.buffer(-r, resolution=RES).buffer(r, resolution=RES))
        if thin.area * DU * DU > 3:
            issues.append(f"{p.key}: {thin.area * DU * DU:.1f} mm2 narrower than 1.2 mm")
    shell = next(p for p in pieces if p.key == "shell")
    raised = unary_union([p.shape for p in pieces if p.level >= 4]).buffer(1.5 / DU)
    for e in shell.engrave:
        bb = box(*e.bounds()) if isinstance(e, GPath) else e
        if bb.intersects(raised):
            issues.append(f"lettering at {tuple(round(v) for v in bb.bounds)} runs under a raised part")
    base = next(p for p in pieces if p.key == "base")
    rim = next(p for p in pieces if p.key == "rim")
    for hole in base.shape.interiors:
        if Polygon(hole).area < 4000 and not rim.shape.buffer(-2 / DU).contains(Polygon(hole)):
            issues.append("stand slot is not hidden behind the rim layer")
    for msg in issues:
        print("CHECK:", msg)
    return issues


# ================================================================ SVG output
def _ring_d(coords, m, nd=3):
    pts = [_aff(m, p) for p in coords]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return "M" + "L".join(f"{round(x, nd):g},{round(y, nd):g}" for x, y in pts) + "Z"


def poly_d(g, m, tol=0.03, holes_first=False):
    out = []
    for p in polys(g.simplify(tol)):
        rings = [_ring_d(r.coords, m) for r in p.interiors]
        ext = _ring_d(p.exterior.coords, m)
        out += rings + [ext] if holes_first else [ext] + rings
    return "".join(out)


def line_d(ls, m, nd=3):
    pts = [_aff(m, p) for p in ls.simplify(0.02).coords]
    return "M" + "L".join(f"{round(x, nd):g},{round(y, nd):g}" for x, y in pts)


def engrave_d(item, m):
    if isinstance(item, GPath):
        return item.transformed(m).d()
    return poly_d(item, m, tol=0.01)


def compose(m2, m1):
    """Affine m2 after m1."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (a2 * a1 + b2 * d1, a2 * b1 + b2 * e1, a2 * c1 + b2 * f1 + c2,
            d2 * a1 + e2 * d1, d2 * b1 + e2 * e1, d2 * c1 + e2 * f1 + f2)


def shapely_m(m):
    a, b, c, d, e, f = m
    return [a, b, d, e, c, f]


def pack(items, W, H):
    """Bottom-left maxrects packing. items: (key, w, h, can_rotate)."""
    free = [(0.0, 0.0, W, H)]
    placed = {}
    for key, w, h, rot in sorted(items, key=lambda t: -t[1] * t[2]):
        best = None
        options = [(w, h, False)] + ([(h - LABEL_H + 0, w + LABEL_H, True)] if rot else [])
        for fx, fy, fw, fh in free:
            for ww, hh, r in options:
                if ww + GAP <= fw + 1e-6 and hh + GAP <= fh + 1e-6:
                    score = (r, round(fy + hh, 3), fx)
                    if best is None or score < best[0]:
                        best = (score, fx, fy, ww, hh, r)
        if best is None:
            raise SystemExit(f"layout: {key} does not fit on its sheet")
        _, x, y, ww, hh, r = best
        placed[key] = (x, y, r)
        pw, ph = ww + GAP, hh + GAP
        split = set()
        for f in free:
            fx, fy, fw, fh = f
            if x >= fx + fw or x + pw <= fx or y >= fy + fh or y + ph <= fy:
                split.add(f)
                continue
            if x > fx:
                split.add((fx, fy, x - fx, fh))
            if x + pw < fx + fw:
                split.add((x + pw, fy, fx + fw - x - pw, fh))
            if y > fy:
                split.add((fx, fy, fw, y - fy))
            if y + ph < fy + fh:
                split.add((fx, y + ph, fw, fy + fh - y - ph))
        free = [f for f in split if not any(
            g != f and g[0] <= f[0] and g[1] <= f[1] and f[0] + f[2] <= g[0] + g[2] and f[1] + f[3] <= g[1] + g[3]
            for g in split)]
    return placed


def layout(pieces):
    """Return {key: affine du->canvas mm} and sheet origins."""
    origins = {}
    for sheet in SHEETS:
        col, row = (sheet - 1) % 2, (sheet - 1) // 2
        origins[sheet] = (10 + col * (SHEET_MM + 20), 22 + row * (SHEET_MM + 28))
    placement = {}
    for sheet in SHEETS:
        items, base_m = [], {}
        for p in [q for q in pieces if q.sheet == sheet]:
            m = (DU, 0, 0, 0, DU, 0)
            x0, y0, x1, y1 = affinity.affine_transform(p.shape, shapely_m(m)).bounds
            base_m[p.key] = m
            items.append((p.key, x1 - x0, y1 - y0 + LABEL_H, not p.engrave))
        inner = SHEET_MM - 2 * MARGIN + GAP
        for key, (x, y, rot) in pack(items, inner, inner).items():
            m = base_m[key]
            if rot:
                m = compose((0, -1, 0, 1, 0, 0), m)
            p = next(q for q in pieces if q.key == key)
            bx0, by0, _, _ = affinity.affine_transform(p.shape, shapely_m(m)).bounds
            ox, oy = origins[sheet]
            placement[key] = compose((1, 0, ox + MARGIN + x - bx0, 0, 1, oy + MARGIN + y - by0), m)
    return placement, origins


_SANS = None


def label_path(text, x, y, size, anchor="start"):
    global _SANS
    _SANS = _SANS or Font(FONT_SANS)
    p = _SANS.path(text, size)
    x0, _, x1, _ = p.bounds()
    dx = {"start": -x0, "middle": -(x0 + x1) / 2, "end": -x1}[anchor]
    return p.transformed((1, 0, x + dx, 0, 1, y)).merged()


def write_cut(pieces, path, sheet_only=None):
    """All sheets on one canvas, or (sheet_only=n) a single 12 x 12 in sheet."""
    placement, origins = layout(pieces)
    if sheet_only:
        ox, oy = origins[sheet_only]
        shift = (1, 0, -ox, 0, 1, -oy)
        placement = {k: compose(shift, m) for k, m in placement.items()}
        origins = {sheet_only: (0.0, 0.0)}
        pieces = [p for p in pieces if p.sheet == sheet_only]
        W = H = SHEET_MM
    else:
        W, H = 10 + 2 * SHEET_MM + 20 + 10, 22 + 2 * SHEET_MM + 28 + 10
    eng, sco, cut, gd = [], [], [], []
    used = {s: [1e9, 1e9, 0, 0] for s in origins}
    for p in pieces:
        m = placement[p.key]
        if p.engrave:
            eng.append(f'<path id="engrave-{p.key}" d="{"".join(engrave_d(e, m) for e in p.engrave)}"/>')
        if p.score:
            sco.append(f'<path id="score-{p.key}" d="{"".join(line_d(l, m) for l in p.score)}"/>')
        cut.append(f'<path id="cut-{p.num:02d}-{p.key}" d="{poly_d(p.shape, m, holes_first=True)}"/>')
        x0, y0, x1, y1 = affinity.affine_transform(p.shape, shapely_m(m)).bounds
        gd.append(f'<path d="{label_path(str(p.num), x0, y1 + LABEL_H - 0.6, 3.2).d()}"/>')
        u = used[p.sheet]
        used[p.sheet] = [min(u[0], x0), min(u[1], y0), max(u[2], x1), max(u[3], y1 + LABEL_H)]
    names = {"natural": "NATURAL BASSWOOD", "dark": "DARK STAIN", "medium": "MEDIUM STAIN"}
    for sheet, (ox, oy) in origins.items():
        gd.append(f'<rect x="{ox}" y="{oy}" width="{SHEET_MM}" height="{SHEET_MM}" fill="none" '
                  f'stroke="#00A000" stroke-width="0.2" stroke-dasharray="4 2"/>')
        u = used[sheet]
        note = f"SHEET {sheet} - {names[SHEETS[sheet]]} - 3 mm - 12 x 12 in"
        if sheet == 4:
            note += f"  (uses only {u[2] - ox:.0f} x {u[3] - oy:.0f} mm - a scrap works)"
        if not sheet_only:
            gd.append(f'<path d="{label_path(note, ox, oy - 5, 5.0).d()}"/>')
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
        f'width="{W:.1f}mm" height="{H:.1f}mm" viewBox="0 0 {W:.1f} {H:.1f}">',
        f'<title>Flight helmet retirement plaque - 3 mm basswood laser cut file'
        f'{f" - sheet {sheet_only} ({SHEETS[sheet_only]})" if sheet_only else ""}</title>',
        '<desc>Units are millimetres. Black fill = ENGRAVE, blue #0000FF = SCORE, red #FF0000 = CUT, '
        'green #00A000 = GUIDES (sheet outlines and part numbers, set to no output). '
        'Run order: engrave, score, cut.</desc>',
        '<g id="ENGRAVE" inkscape:groupmode="layer" inkscape:label="ENGRAVE (black fill)" '
        'fill="#000000" stroke="none" fill-rule="nonzero">', *eng, '</g>',
        '<g id="SCORE" inkscape:groupmode="layer" inkscape:label="SCORE (blue)" '
        'fill="none" stroke="#0000FF" stroke-width="0.1" stroke-linecap="round">', *sco, '</g>',
        '<g id="CUT" inkscape:groupmode="layer" inkscape:label="CUT (red)" '
        'fill="none" stroke="#FF0000" stroke-width="0.1">', *cut, '</g>',
        '<g id="GUIDES" inkscape:groupmode="layer" inkscape:label="GUIDES - do not output" '
        'fill="#00A000" stroke="none">', *gd, '</g>',
        '</svg>',
    ]
    with open(path, "w") as f:
        f.write("\n".join(out) + "\n")


LEVELS = {0: "stand", 1: "1 (back)", 2: "2", 3: "3", 4: "4", 5: "5 (top)"}
STEPS = [
    (1, "Step 1 - back plate"),
    (2, "Step 2 - dark rim on the back plate"),
    (3, "Step 3 - shell face, mask, strap, hose"),
    (4, "Step 4 - visor base, edge roll, hardware"),
    (5, "Step 5 - visor cover and valve cap"),
]
INK = "#3a2a20"
SANS = 'font-family="Helvetica, Arial, sans-serif"'


def _layer_svg(pieces, m, levels, faded=()):
    out = []
    for level in levels:
        group = [q for q in pieces if q.level == level]
        op = ' opacity="0.35"' if level in faded else ""
        out.append(f'<g filter="url(#lift)"{op}>')
        for p in group:
            fill, edge, _ = STAINS[p.stain]
            out.append(f'<path d="{poly_d(p.shape, m)}" fill="{fill}" fill-rule="evenodd" '
                       f'stroke="{edge}" stroke-width="0.25"/>')
        out.append('</g>')
        if level in faded:
            continue
        for p in group:
            ink = "#5b3519" if p.stain == "natural" else ("#2a1a10" if p.stain == "medium" else "#1d1612")
            if p.engrave:
                out.append(f'<path d="{"".join(engrave_d(e, m) for e in p.engrave)}" fill="{ink}"/>')
            if p.score:
                out.append(f'<path d="{"".join(line_d(l, m) for l in p.score)}" fill="none" '
                           f'stroke="{ink}" stroke-width="0.3" stroke-linecap="round"/>')
    return out


def _badge(x, y, n, r=2.2):
    return (f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="#ffffff" stroke="{INK}" stroke-width="0.25"/>'
            f'<text x="{x:.2f}" y="{y + r * 0.45:.2f}" {SANS} font-size="{r * 1.25:.2f}" text-anchor="middle" '
            f'font-weight="bold" fill="{INK}">{n}</text>')


def write_preview(pieces, path):
    from shapely.ops import polylabel
    plate = [p for p in pieces if p.level > 0]
    base = next(p for p in pieces if p.key == "base").shape
    x0, y0, x1, y1 = base.bounds
    pad, list_w = 8.0, 118.0
    PW, PH = (x1 - x0) * DU, (y1 - y0) * DU
    m = (DU, 0, -x0 * DU + pad, 0, DU, -y0 * DU + pad + 12)
    W = pad + PW + 10 + list_w
    k = 0.47
    cell_w, cell_h = (W - 2 * pad) / 3, PH * k + 12
    top_h = PH + pad + 12 + 10
    H = top_h + 2 * cell_h + 14 + pad
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}mm" height="{H:.1f}mm" '
           f'viewBox="0 0 {W:.2f} {H:.2f}">',
           '<title>Flight helmet retirement plaque - assembled preview and glue-up guide</title>',
           '<defs><filter id="lift" x="-10%" y="-10%" width="120%" height="120%">'
           '<feGaussianBlur in="SourceAlpha" stdDeviation="0.6"/><feOffset dx="0.5" dy="0.8" result="b"/>'
           '<feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>'
           '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>'
           '</filter></defs>',
           f'<rect width="{W:.2f}" height="{H:.2f}" fill="#ffffff"/>',
           f'<text x="{pad}" y="{pad + 4}" {SANS} font-size="6" font-weight="bold" fill="{INK}">'
           f'Flight helmet retirement plaque - layered 3 mm basswood</text>',
           f'<text x="{pad}" y="{pad + 10}" {SANS} font-size="3.4" fill="{INK}">'
           f'Finished size {PW:.0f} x {PH:.0f} mm ({PW / 25.4:.1f} x {PH / 25.4:.1f} in), 5 layers deep '
           f'(15 mm) plus easel stand</text>']
    out += _layer_svg(plate, m, (1, 2, 3, 4, 5))

    # parts list
    kx, y = pad + PW + 10, pad + 20
    out.append(f'<text x="{kx}" y="{y}" {SANS} font-size="4.2" font-weight="bold" fill="{INK}">Parts</text>')
    y += 6
    cols = (0, 6, 52, 82, 103)
    for i, head in enumerate(("#", "Part", "Layer", "Stain", "Sheet")):
        out.append(f'<text x="{kx + cols[i] + (5 if i == 0 else 0)}" y="{y}" {SANS} font-size="3" '
                   f'font-weight="bold" fill="#7a6a5a"{" text-anchor=\"end\"" if i == 0 else ""}>{head}</text>')
    y += 5
    for p in pieces:
        fill, edge, _ = STAINS[p.stain]
        cells = (str(p.num), p.label, LEVELS[p.level], p.stain, str(p.sheet))
        for i, c in enumerate(cells):
            anchor = ' text-anchor="end"' if i == 0 else ""
            out.append(f'<text x="{kx + cols[i] + (5 if i == 0 else 0)}" y="{y}" {SANS} font-size="3" '
                       f'fill="{INK}"{anchor}>{c}</text>')
        out.append(f'<rect x="{kx + cols[3] - 4.2}" y="{y - 2.6}" width="3" height="3" fill="{fill}" '
                   f'stroke="{edge}" stroke-width="0.3"/>')
        y += 4.6
    y += 4
    notes = ["Glue each layer with thin wood glue; clamp", "flat between steps. Pieces on the same",
             "layer butt together like a jigsaw.", "", "Stand: push leg 20 through foot 21",
             "(cross-lap), glue the leg tab into the slot", "in the back of part 1. Leans back 15 deg."]
    for line in notes:
        out.append(f'<text x="{kx}" y="{y}" {SANS} font-size="3" fill="{INK}">{line}</text>')
        y += 4.2

    # glue-up steps
    for i, (lvl, title) in enumerate(STEPS + [(0, "Stand - leg 20 + foot 21")]):
        cx0 = pad + (i % 3) * cell_w
        cy0 = top_h + (i // 3) * (cell_h + 7)
        out.append(f'<text x="{cx0}" y="{cy0 + 4}" {SANS} font-size="3.6" font-weight="bold" '
                   f'fill="{INK}">{title}</text>')
        if lvl == 0:
            out += _stand_diagram(pieces, cx0, cy0 + 8, cell_w, cell_h - 8)
            continue
        mm = (DU * k, 0, -x0 * DU * k + cx0 + (cell_w - PW * k) / 2, 0, DU * k, -y0 * DU * k + cy0 + 8)
        out += _layer_svg(plate, mm, tuple(range(1, lvl + 1)), faded=tuple(range(1, lvl)))
        for p in [q for q in plate if q.level == lvl]:
            c = polylabel(largest(p.shape), tolerance=1.0)
            bx, by = _aff(mm, (c.x, c.y))
            if p.key in ("base", "shell"):
                bx, by = _aff(mm, (448, 420))
            out.append(_badge(bx, by, p.num, 2.0 if lvl == 4 else 2.6))
    out.append('</svg>')
    with open(path, "w") as f:
        f.write("\n".join(out) + "\n")


def _stand_diagram(pieces, x, y, w, h):
    """Side view: plaque on the table, leg behind it, foot crossing the leg."""
    leg = next(p for p in pieces if p.key == "leg").shape
    plate_h = next(p for p in pieces if p.key == "base").shape.bounds
    tall = (plate_h[3] - plate_h[1]) * DU
    k = (h - 6) / tall
    a = math.radians(LEAN)
    ox, oy = x + w * 0.62, y + h - 2          # front-bottom of the leg / back face of the plaque
    m = (DU * k, 0, ox, 0, DU * k, oy)        # leg is drawn in its own profile coordinates
    depth = 5 * THICK * k

    def plane(s, off=0.0):
        return (ox - s * k * math.sin(a) + off * math.cos(a), oy - s * k * math.cos(a) + off * math.sin(a))

    slab = [plane(0), plane(tall), plane(tall, depth), plane(0, depth)]
    nat, edge, _ = STAINS["natural"]
    out = [f'<line x1="{x}" y1="{oy:.2f}" x2="{x + w - 4}" y2="{oy:.2f}" stroke="#9a8a7a" stroke-width="0.4"/>',
           f'<path d="{poly_d(leg, m)}" fill="{nat}" stroke="{edge}" stroke-width="0.3"/>',
           '<path d="M' + "L".join(f"{px:.2f},{py:.2f}" for px, py in slab) + 'Z" '
           f'fill="{nat}" fill-opacity="0.85" stroke="{edge}" stroke-width="0.3"/>']
    fx = ox + (-80 + 12) * k
    out.append(f'<rect x="{fx - THICK * k / 2:.2f}" y="{oy - 14 * k:.2f}" width="{THICK * k:.2f}" '
               f'height="{14 * k:.2f}" fill="{edge}"/>')
    out.append(_badge(ox - 38 * k, oy - 30 * k, 20, 2.6))
    out.append(_badge(fx, oy - 14 * k - 4, 21, 2.6))
    tx, ty = plane(tall * 0.7, depth)
    out.append(f'<text x="{tx + 3:.2f}" y="{ty:.2f}" {SANS} font-size="2.8" fill="{INK}">plaque</text>')
    out.append(f'<text x="{x + w - 4:.2f}" y="{oy + 4:.2f}" {SANS} font-size="2.6" text-anchor="end" '
               f'fill="#7a6a5a">{LEAN:.0f} deg lean</text>')
    return out


if __name__ == "__main__":
    ps = number_pieces(build())
    check(ps)
    write_cut(ps, os.path.join(HERE, "helmet-plaque-cut.svg"))
    os.makedirs(os.path.join(HERE, "sheets"), exist_ok=True)
    for n, stain in SHEETS.items():
        write_cut(ps, os.path.join(HERE, "sheets", f"sheet-{n}-{stain}.svg"), sheet_only=n)
    write_preview(ps, os.path.join(HERE, "helmet-plaque-preview.svg"))
    for p in ps:
        b = p.shape.bounds
        print(f"{p.num:2d} {p.key:12s} L{p.level} {p.stain:8s} sheet {p.sheet}  "
              f"{(b[2] - b[0]) * DU:6.1f} x {(b[3] - b[1]) * DU:6.1f} mm")
