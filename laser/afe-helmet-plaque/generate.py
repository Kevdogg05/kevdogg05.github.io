#!/usr/bin/env python3
"""
Layered "Thank You for Your Service" AFE helmet plaque
=====================================================

Generates laser-ready SVG cut sheets (xTool S1 / any laser) for 3 mm basswood
plywood, plus a rendered preview and an assembly guide.

    pip install shapely uharfbuzz numpy pillow
    python3 generate.py

Edit the CUSTOMIZE block below to change the names/text, then re-run.
All dimensions are in millimetres.
"""
import math
import re
from pathlib import Path

import numpy as np
import shapely
import uharfbuzz as hb
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely import affinity
from shapely.geometry import (GeometryCollection, LineString, MultiLineString,
                              MultiPolygon, Point, Polygon, box)
from shapely.ops import unary_union

# ---------------------------------------------------------------- CUSTOMIZE --
NAME = "MSgt Renholm"
SUBTITLE = "Aircrew Flight Equipment"
BANNER = "Thank You for Your Service"

PLAQUE = 286.0          # backer is PLAQUE x PLAQUE (fits a 12"x12" / 300x300 sheet)
FIELD_INSET = 11.0      # dark backer border that shows around the light field
SHEET = 300.0           # stock size used for nesting (300 x 300 mm)
SHEET_MARGIN = 4.0
PART_GAP = 2.5          # spacing between nested parts
THICK = 3.0             # material thickness (for the stack height note only)
# ------------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
OUT = HERE / "files"
FONT = HERE / "fonts" / "Cinzel-VF.ttf"

TONES = {
    "A": ("Dark Walnut", (58, 37, 22)),
    "B": ("Natural + clear coat", (232, 206, 160)),
    "C": ("Golden Pecan / Early American", (170, 116, 62)),
}

CUT = "#FF0000"
SCORE = "#0000FF"
ENGRAVE = "#000000"


# ============================================================== geometry utils
_TOK = re.compile(r"[MLCQZHVmlcqzhv]|-?\d*\.?\d+(?:[eE]-?\d+)?")


def _cubic(p0, p1, p2, p3, step):
    est = (math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3))
    n = max(6, int(est / step))
    t = np.linspace(0, 1, n + 1)[1:, None]
    p0, p1, p2, p3 = (np.array(p) for p in (p0, p1, p2, p3))
    pts = ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
    return [tuple(p) for p in pts]


def _quad(p0, p1, p2, step):
    est = math.dist(p0, p1) + math.dist(p1, p2)
    n = max(4, int(est / step))
    t = np.linspace(0, 1, n + 1)[1:, None]
    p0, p1, p2 = (np.array(p) for p in (p0, p1, p2))
    pts = ((1 - t) ** 2) * p0 + 2 * (1 - t) * t * p1 + t * t * p2
    return [tuple(p) for p in pts]


def path_points(d, step=0.25):
    """Flatten an absolute-coordinate SVG path (M L H V C Q Z) to point lists."""
    toks = _TOK.findall(d)
    subpaths, cur, i, cmd = [], [], 0, None
    pos = (0.0, 0.0)

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    subpaths.append((cur, True))
                cur = []
                continue
        if cmd == "M":
            if cur:
                subpaths.append((cur, False))
            pos = (num(), num())
            cur = [pos]
            cmd = "L"
        elif cmd == "L":
            pos = (num(), num())
            cur.append(pos)
        elif cmd == "H":
            pos = (num(), pos[1])
            cur.append(pos)
        elif cmd == "V":
            pos = (pos[0], num())
            cur.append(pos)
        elif cmd == "C":
            p1, p2, p3 = (num(), num()), (num(), num()), (num(), num())
            cur += _cubic(pos, p1, p2, p3, step)
            pos = p3
        elif cmd == "Q":
            p1, p2 = (num(), num()), (num(), num())
            cur += _quad(pos, p1, p2, step)
            pos = p2
        else:
            raise ValueError(f"unsupported path command {cmd}")
    if cur:
        subpaths.append((cur, False))
    return subpaths


def shape(d):
    polys = [Polygon(pts).buffer(0) for pts, _ in path_points(d) if len(pts) > 2]
    return unary_union(polys)


def line(d):
    return LineString(path_points(d)[0][0])


def circle(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=48)


def smooth(g, r):
    """Round off sharp concave/convex corners by r."""
    return g.buffer(r, quad_segs=24).buffer(-2 * r, quad_segs=24).buffer(r, quad_segs=24)


def polys(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for gg in g.geoms:
            out += polys(gg)
        return out
    return []


def lines(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, (MultiLineString, GeometryCollection)):
        out = []
        for gg in g.geoms:
            out += lines(gg)
        return out
    if isinstance(g, Polygon):
        return [LineString(g.exterior.coords)] + [LineString(r.coords) for r in g.interiors]
    if isinstance(g, MultiPolygon):
        out = []
        for gg in g.geoms:
            out += lines(gg)
        return out
    return []


def star(cx, cy, r, inner=0.382, rot=-90):
    pts = []
    for k in range(10):
        rr = r if k % 2 == 0 else r * inner
        a = math.radians(rot + k * 36)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return Polygon(pts)


def band_on_line(ln, width, clip=None):
    g = ln.buffer(width / 2, cap_style="flat", quad_segs=24)
    return g.intersection(clip) if clip is not None else g


def rrect(cx, cy, w, h, r, angle=0):
    g = box(cx - w / 2 + r, cy - h / 2 + r, cx + w / 2 - r, cy + h / 2 - r).buffer(r, quad_segs=24)
    return affinity.rotate(g, angle, origin=(cx, cy))


def notched_square(x0, y0, size, r):
    g = box(x0, y0, x0 + size, y0 + size)
    for cx, cy in [(x0, y0), (x0 + size, y0), (x0, y0 + size), (x0 + size, y0 + size)]:
        g = g.difference(circle(cx, cy, r))
    return g


# ===================================================================== text
class _FlatPen:
    def __init__(self, step):
        self.step, self.contours, self.cur = step, [], []

    def moveTo(self, p):
        self.cur = [p]

    def lineTo(self, p):
        self.cur.append(p)

    def curveTo(self, p1, p2, p3):
        self.cur += _cubic(self.cur[-1], p1, p2, p3, self.step)

    def qCurveTo(self, p1, p2):
        self.cur += _quad(self.cur[-1], p1, p2, self.step)

    def closePath(self):
        if len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = []

    endPath = closePath


class Typeface:
    def __init__(self, path, weight):
        blob = hb.Blob.from_file_path(str(path))
        self.face = hb.Face(blob)
        self.font = hb.Font(self.face)
        self.font.set_variations({"wght": weight})
        self.upem = self.face.upem
        self.cap = self._cap_height()
        self._cache = {}

    def _cap_height(self):
        gid = self.font.get_nominal_glyph(ord("H"))
        ext = self.font.get_glyph_extents(gid)
        return ext.y_bearing

    def glyph(self, gid):
        if gid in self._cache:
            return self._cache[gid]
        pen = _FlatPen(step=self.upem / 160)
        self.font.draw_glyph_with_pen(gid, pen)
        cs = [Polygon(c) for c in pen.contours]
        cs = [c for c in cs if c.is_valid or c.buffer(0).area > 0]
        if not cs:
            self._cache[gid] = None
            return None
        # nonzero fill: contours wound like the largest one fill, the rest cut
        big = max(cs, key=lambda c: abs(c.area))
        ccw = big.exterior.is_ccw
        fill = unary_union([c.buffer(0) for c in cs if c.exterior.is_ccw == ccw])
        hole = unary_union([c.buffer(0) for c in cs if c.exterior.is_ccw != ccw])
        g = fill.difference(hole)
        g = affinity.scale(g, 1, -1, origin=(0, 0))  # font y-up -> svg y-down
        self._cache[gid] = g
        return g

    def layout(self, text, cap_mm, tracking=0.0):
        """Return [(glyph_geom_mm, x_offset_mm, advance_mm)] on a y=0 baseline."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.font, buf, {"kern": True, "liga": True})
        k = cap_mm / self.cap
        out, x = [], 0.0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            g = self.glyph(info.codepoint)
            adv = pos.x_advance * k + tracking * cap_mm
            if g is not None:
                g = affinity.scale(g, k, k, origin=(0, 0))
                g = affinity.translate(g, x + pos.x_offset * k, -pos.y_offset * k)
            out.append((g, x, adv))
            x += adv
        width = x - tracking * cap_mm
        return out, width


def text_line(tf, text, cap, cx, baseline, tracking=0.0):
    glyphs, width = tf.layout(text, cap, tracking)
    gs = [g for g, _, _ in glyphs if g is not None]
    return affinity.translate(unary_union(gs), cx - width / 2, baseline)


def text_arc(tf, text, cap, center, radius, top=True, tracking=0.0):
    """Text centred on an arc. top=True: reads over the top of the circle
    (frown, baseline radius `radius`); top=False: under the bottom (smile)."""
    glyphs, width = tf.layout(text, cap, tracking)
    cx, cy = center
    out = []
    for g, x, adv in glyphs:
        if g is None:
            continue
        mid = x + adv / 2 - width / 2
        g0 = affinity.translate(g, -(x + adv / 2), 0)       # glyph centred on origin
        if top:
            th = -math.pi / 2 + mid / radius
            rot = math.degrees(th) + 90
        else:
            th = math.pi / 2 - mid / radius
            rot = math.degrees(th) - 90
        px, py = cx + radius * math.cos(th), cy + radius * math.sin(th)
        g1 = affinity.rotate(g0, rot, origin=(0, 0))
        out.append(affinity.translate(g1, px, py))
    return unary_union(out)


# ==================================================================== parts
class Part:
    def __init__(self, name, z, geom, tone, engrave=None, score=None, visible_lines=None):
        self.name = name
        self.z = z
        self.geom = geom
        self.tone = tone
        self.engrave = engrave          # geometry (filled engraving)
        self.score = score              # extra decorative score lines (visible)
        self.guides = None              # hidden glue-guide score lines
        self.label = None               # hidden part label engraving
        self.pid = None
        self.sheet = None
        self.kind = re.sub(r" \d+( \(back\))?$", r"\1", name) if name.startswith(("Hose ring", "Wall bumper")) else name

    def __repr__(self):
        return f"<{self.pid or self.name} z{self.z}>"


def build_design():
    tf_bold = Typeface(FONT, 700)
    tf_semi = Typeface(FONT, 600)
    parts = []

    # ---------------------------------------------------------- plaque
    backer = notched_square(0, 0, PLAQUE, 14)
    field = notched_square(FIELD_INSET, FIELD_INSET, PLAQUE - 2 * FIELD_INSET, 10)
    border = field.buffer(-5.0, join_style="mitre").difference(field.buffer(-6.1, join_style="mitre"))
    border = border.union(field.buffer(-7.6, join_style="mitre").difference(field.buffer(-8.05, join_style="mitre")))
    fx0, fx1 = FIELD_INSET + 19, PLAQUE - FIELD_INSET - 19
    corner_stars = unary_union([star(x, fx0, 4.2) for x in (fx0, fx1)])

    parts.append(Part("Backer", 1, backer, "A"))
    parts.append(Part("Field panel", 2, field, "B", engrave=border.union(corner_stars)))

    # ---------------------------------------------------------- helmet (drawn in "H" units, then placed)
    S = 0.9
    TX = PLAQUE / 2 - 143.5 * S
    TY = 25.0 - 13.0 * S

    def P(g):
        return affinity.translate(affinity.scale(g, S, S, origin=(0, 0)), TX, TY)

    shell = shape(
        "M 222,92 C 204,98 186,108 175,123 C 166,136 162,150 162,166 "
        "C 162,182 167,194 167,204 C 167,212 161,218 151,219 C 135,221 121,216 109,210 "
        "C 97,204 85,204 73,203 C 59,201 49,190 45,174 C 39,150 40,118 49,92 "
        "C 59,64 81,40 111,28 C 141,16 181,16 207,28 C 227,38 239,58 239,80 "
        "C 239,86 233,91 222,92 Z")
    housing = shape(
        "M 60,76 C 53,68 52,59 58,52 C 74,35 104,20 140,16 C 178,12 216,25 236,49 "
        "C 244,61 246,77 243,90 C 242,96 237,99 231,99 C 202,96 170,92 140,89 "
        "C 110,86 80,85 60,76 Z")
    far_rim = shape(
        "M 226,95 C 237,110 242,132 239,152 C 237,166 231,176 223,183 L 211,178 "
        "C 218,166 222,150 223,133 C 223,117 220,105 213,95 Z")
    far_rim_inner = shape(
        "M 218,98 C 226,112 230,131 229,149 C 228,161 223,171 217,177 L 212,175 "
        "C 217,164 220,150 220,133 C 220,118 217,107 211,98 Z")
    edge_line = line(
        "M 226,86 C 204,98 186,108 175,123 C 166,136 162,150 162,166 "
        "C 162,182 167,194 167,204 C 167,212 161,218 151,219 C 135,221 121,216 109,210 "
        "C 97,204 85,204 73,203 C 61,201 52,193 47,181")
    face_void = shape("M 168,92 L 232,92 L 240,150 L 226,192 L 176,200 L 164,160 Z")

    mask = shape(
        "M 186,120 C 196,116 206,121 214,131 C 222,141 230,155 236,168 "
        "C 241,179 240,191 232,198 C 222,206 206,208 194,206 C 184,204 177,198 175,188 "
        "C 172,172 172,150 176,136 C 178,128 181,123 186,120 Z")
    mask_back = line("M 192,112 C 182,128 178,150 179,170 C 180,186 184,198 192,212")
    mask_shell = mask.buffer(-1.7, quad_segs=24).difference(mask_back.buffer(5.0, quad_segs=24))
    mask_shell = max(polys(mask_shell), key=lambda g: g.area)
    valve = circle(222, 182, 10.0)
    valve_cap = circle(222, 182, 5.6)
    mic = circle(201, 137, 4.8)

    hose_c = line("M 204,205 C 206,220 199,231 182,235 C 166,239 148,236 132,230")
    hose_base = hose_c.buffer(7.6, cap_style="flat", quad_segs=24)
    hose_conn = rrect(204.5, 207.5, 19, 9, 2.5, angle=6)
    p_end = hose_c.coords[-1]
    p_pre = hose_c.interpolate(hose_c.length - 1.0).coords[0]
    a_end = math.degrees(math.atan2(p_end[1] - p_pre[1], p_end[0] - p_pre[0]))
    hose_end = rrect(p_end[0], p_end[1], 9, 17.4, 2.2, angle=a_end)

    receiver = rrect(153, 157, 14, 21, 3.5, angle=-14)
    arm = band_on_line(line("M 184,168 C 172,170 162,166 153,157 L 150.5,154.5"), 5.5)
    screw = circle(153, 157, 2.6)
    ear = affinity.rotate(affinity.scale(circle(114, 160, 1), 19, 23), -12, origin=(114, 160))
    ear_disc = circle(114, 160, 12.2)

    # transform helmet geometry onto the plaque
    shell, housing, far_rim, far_rim_inner, face_void = map(P, (shell, housing, far_rim, far_rim_inner, face_void))
    mask, mask_shell, valve, valve_cap, mic = map(P, (mask, mask_shell, valve, valve_cap, mic))
    hose_c, hose_base, hose_conn, receiver, arm, screw = map(P, (hose_c, hose_base, hose_conn, receiver, arm, screw))
    hose_end = P(hose_end)
    edge_line = P(edge_line)
    ear, ear_disc = P(ear), P(ear_disc)

    edge_roll = band_on_line(edge_line, 2 * 6.0 * S).intersection(shell)
    edge_roll = smooth(edge_roll, 0.6)
    housing_base = housing.buffer(1.8, quad_segs=24)
    dome1 = shell.buffer(-4.5 * S, quad_segs=24).difference(edge_roll)
    dome1 = smooth(dome1, 0.8)
    # crown: a crescent following the back of the shell (reads as dome curvature)
    inner = shell.buffer(-11 * S, quad_segs=24)
    dome2 = inner.difference(affinity.translate(inner, 30 * S, -2 * S))
    dome2 = dome2.difference(edge_roll.buffer(3.5)).difference(housing_base.buffer(0.05)).difference(ear.buffer(4.0))
    dome2 = dome2.intersection(box(0, 0, ear.centroid.x + 4, PLAQUE))
    dome2 = polys(smooth(dome2, 1.2).buffer(-2.6).buffer(2.6))
    dome2 = max(dome2, key=lambda g: g.area)
    contours = unary_union([shell.buffer(-d * S).exterior for d in (16.5, 21.5)])
    contours = contours.intersection(dome2.buffer(-2.2))

    far_rim = far_rim.union(far_rim_inner.buffer(0.6)).difference(shell)
    far_rim_inner = far_rim_inner.difference(housing_base)

    lens = affinity.translate(housing, 0, 6.5 * S).difference(housing)
    lens = lens.intersection(box(P(Point(84, 0)).x, 0, PLAQUE, PLAQUE))
    lens = max(polys(smooth(lens, 0.6)), key=lambda g: g.area)
    lens = lens.difference(Point(lens.bounds[0], lens.bounds[3]).buffer(1.0))

    # housing end cap & front visor lock
    hb_ = housing.bounds
    cap_clip = box(hb_[0] - 5, hb_[1] - 5, hb_[0] + 15 * S, hb_[3] + 5)
    end_cap = housing.buffer(-1.6).intersection(cap_clip)
    end_cap = smooth(end_cap, 0.8)
    knob = circle(*P(Point(233, 86)).coords[0], 4.4)

    # hose rings
    rings = []
    L = hose_c.length
    pitch, ring_w = 5.0, 3.0
    n = int((L - 14) / pitch)
    start = (L - (n - 1) * pitch) / 2 + 2
    for k in range(n):
        d = start + k * pitch
        p = hose_c.interpolate(d)
        p2 = hose_c.interpolate(min(L, d + 0.5))
        p1 = hose_c.interpolate(max(0, d - 0.5))
        ang = math.degrees(math.atan2(p2.y - p1.y, p2.x - p1.x))
        rings.append(rrect(p.x, p.y, ring_w, 15.2 * S + 1.4, 1.0, angle=ang))

    # ------------------------------------------------------------- engraving / text on housing
    hc = housing.centroid
    name_geo = text_arc(tf_bold, NAME, 8.6, (hc.x + 2, hc.y + 132), 132 + 3.0 - 2.0, top=True, tracking=0.04)
    sub_geo = text_arc(tf_semi, SUBTITLE.upper(), 3.5, (hc.x + 2, hc.y + 132), 132 - 11.5, top=True, tracking=0.16)
    # little rule with a star between the two lines
    rb = (hc.x + 2, hc.y + 132)
    r_rule = 132 - 6.2
    rule_parts = []
    for side in (-1, 1):
        a0 = -math.pi / 2 + side * 5.0 / r_rule
        a1 = -math.pi / 2 + side * 34.0 / r_rule
        arc = LineString([(rb[0] + r_rule * math.cos(a), rb[1] + r_rule * math.sin(a))
                          for a in np.linspace(a0, a1, 60)])
        rule_parts.append(arc.buffer(0.32, cap_style="round"))
    rule_parts.append(star(rb[0], rb[1] - r_rule, 2.6))
    pinstripe = housing.buffer(-2.4).difference(housing.buffer(-2.9))
    pinstripe = pinstripe.difference(end_cap.buffer(1.4))
    housing_eng = unary_union([name_geo, sub_geo, pinstripe] + rule_parts)

    valve_grille = unary_union([
        rrect(valve_cap.centroid.x, valve_cap.centroid.y + dy, 6.2, 0.75, 0.37) for dy in (-2.0, 0, 2.0)])
    knob_eng = circle(*knob.centroid.coords[0], 2.6).difference(circle(*knob.centroid.coords[0], 1.9))
    screw_eng = rrect(screw.centroid.x, screw.centroid.y, 3.2, 0.7, 0.3, angle=35)
    cap_eng = circle(*end_cap.centroid.coords[0], 3.2).difference(circle(*end_cap.centroid.coords[0], 2.5))

    # ------------------------------------------------------------- banner
    bc = (PLAQUE / 2, -662.0)
    R1, H = 902.0, 20.0
    half = 86.0
    def arc_pts(r, a0, a1, n=120):
        return [(bc[0] + r * math.cos(a), bc[1] + r * math.sin(a)) for a in np.linspace(a0, a1, n)]
    a_half = math.asin(half / R1)
    am = math.pi / 2
    front = Polygon(arc_pts(R1, am + a_half, am - a_half) + arc_pts(R1 + H, am - a_half, am + a_half))
    # tails (folded behind the front)
    tails = []
    folds = []
    for side in (-1, 1):
        a_in = am - side * math.asin((half - 12) / R1)
        a_out = am - side * math.asin((half + 23) / R1)
        drop = 6.5
        r_top, r_bot = R1 + drop, R1 + H + drop
        p_in_top = (bc[0] + r_top * math.cos(a_in), bc[1] + r_top * math.sin(a_in))
        p_in_bot = (bc[0] + r_bot * math.cos(a_in), bc[1] + r_bot * math.sin(a_in))
        p_out_top = (bc[0] + r_top * math.cos(a_out), bc[1] + r_top * math.sin(a_out))
        p_out_bot = (bc[0] + r_bot * math.cos(a_out), bc[1] + r_bot * math.sin(a_out))
        rm = (r_top + r_bot) / 2
        a_notch = am - side * math.asin((half + 15) / R1)
        p_notch = (bc[0] + rm * math.cos(a_notch), bc[1] + rm * math.sin(a_notch))
        tail = Polygon([p_in_top, p_out_top, p_notch, p_out_bot, p_in_bot])
        tails.append(tail)
        # fold triangle (engraved dark) - the visible strip between front end and tail
        a_end = am - side * a_half
        e_bot = (bc[0] + (R1 + H) * math.cos(a_end), bc[1] + (R1 + H) * math.sin(a_end))
        e_top_drop = (bc[0] + r_top * math.cos(a_end), bc[1] + r_top * math.sin(a_end))
        a_fold = am - side * math.asin((half + 6.5) / R1)
        f_bot = (bc[0] + r_bot * math.cos(a_fold), bc[1] + r_bot * math.sin(a_fold))
        folds.append(Polygon([e_top_drop, e_bot, f_bot]).buffer(0))
    tails_g = unary_union(tails)
    tails_vis_fold = unary_union(folds).intersection(tails_g).difference(front)
    banner_text = text_arc(tf_bold, BANNER.upper(), 5.2, bc, R1 + H / 2 + 5.2 / 2, top=False, tracking=0.12)
    bstars = []
    for side in (-1, 1):
        a = am - side * math.asin((half - 7.5) / R1)
        rr = R1 + H / 2
        bstars.append(star(bc[0] + rr * math.cos(a), bc[1] + rr * math.sin(a), 3.0,
                           rot=-90 + side * math.degrees(a - am) * -1))
    banner_lines = []
    for r in (R1 + 2.2, R1 + H - 2.2):
        arc = LineString(arc_pts(r, am + a_half - 2.5 / R1, am - a_half + 2.5 / R1))
        banner_lines.append(arc.buffer(0.22))
    banner_eng = unary_union([banner_text] + bstars + banner_lines)

    # ------------------------------------------------------------- shadow silhouettes
    helmet_all = unary_union([shell, housing_base, far_rim, face_void, mask, hose_base, hose_end, hose_conn] + rings + [receiver])
    silhouette = smooth(helmet_all.buffer(3.4, quad_segs=24), 2.5)
    silhouette = polys(silhouette)
    silhouette = max(silhouette, key=lambda g: g.area)
    silhouette = Polygon(silhouette.exterior)
    banner_shadow = smooth(unary_union([front, tails_g]).buffer(2.4, quad_segs=24), 0.6)

    # ------------------------------------------------------------- assemble part list
    parts.append(Part("Helmet shadow outline", 3, silhouette, "A"))
    parts.append(Part("Banner shadow outline", 3, banner_shadow, "A"))

    parts.append(Part("Shell", 4, shell, "B"))
    parts.append(Part("Far-side rim", 4, far_rim, "B"))
    parts.append(Part("Hose", 4, hose_base, "C"))
    parts.append(Part("Banner tail L", 4, tails[0], "C", engrave=folds[0].intersection(tails[0]).difference(front)))
    parts.append(Part("Banner tail R", 4, tails[1], "C", engrave=folds[1].intersection(tails[1]).difference(front)))

    parts.append(Part("Shell dome", 5, dome1, "B"))
    parts.append(Part("Edge roll trim", 5, edge_roll, "C"))
    parts.append(Part("Far-side liner", 5, far_rim_inner, "C"))
    parts.append(Part("Visor lens edge", 5, lens, "C"))
    parts.append(Part("Mask seal", 5, mask, "C"))
    for k, rg in enumerate(rings):
        parts.append(Part(f"Hose ring {k + 1}", 5, rg, "B"))
    parts.append(Part("Banner", 5, front, "B", engrave=banner_eng))

    parts.append(Part("Shell crown", 6, dome2, "B", score=contours))
    parts.append(Part("Visor housing rim", 6, housing_base, "C"))
    parts.append(Part("Mask shell", 6, mask_shell, "B"))
    parts.append(Part("Bayonet receiver", 6, receiver, "C"))
    parts.append(Part("Ear cup", 6, ear, "C",
                      engrave=ear.buffer(-2.2).difference(ear.buffer(-2.7))))
    parts.append(Part("Hose connector", 6, hose_conn, "C"))
    parts.append(Part("Hose end fitting", 6, hose_end, "C"))

    parts.append(Part("Visor housing", 7, housing, "B", engrave=housing_eng))
    parts.append(Part("Exhalation valve", 7, valve, "C"))
    parts.append(Part("Mic boss", 7, mic, "C", engrave=circle(*mic.centroid.coords[0], 2.2).difference(circle(*mic.centroid.coords[0], 1.6))))
    parts.append(Part("Bayonet arm", 7, arm, "B"))
    ec = ear_disc.centroid
    ear_dots = unary_union([circle(ec.x + 8.2 * math.cos(a), ec.y + 8.2 * math.sin(a), 0.85)
                            for a in np.radians([45, 135, 225, 315])])
    parts.append(Part("Ear cup cover", 7, ear_disc, "B",
                      engrave=ear_dots))

    parts.append(Part("Visor end cap", 8, end_cap, "C", engrave=cap_eng))
    parts.append(Part("Visor lock knob", 8, knob, "C", engrave=knob_eng))
    parts.append(Part("Valve cover", 8, valve_cap, "B", engrave=valve_grille))
    parts.append(Part("Receiver screw", 8, screw, "B", engrave=screw_eng))

    # ---------------------------------------------------------- hanging hardware (back side)
    plate = rrect(0, 0, 56, 36, 6)
    keyhole = circle(0, 6, 5.0).union(box(-2.3, -7, 2.3, 6)).union(circle(0, -7, 2.3))
    pocket = LineString([(0, 6), (0, -8)]).buffer(5.5, quad_segs=24)
    parts.append(Part("Keyhole plate (back)", 0, plate.difference(keyhole), "A"))
    parts.append(Part("Keyhole spacer (back)", 0, plate.difference(pocket), "A"))
    for k in range(4):
        parts.append(Part(f"Wall bumper {k + 1} (back)", 0, circle(0, 0, 10), "A"))

    return parts


# ============================================================ stack checks
def resolve_overlaps(parts):
    """Parts on the same layer must not overlap: later parts win."""
    by_z = {}
    for p in parts:
        by_z.setdefault(p.z, []).append(p)
    for z, ps in by_z.items():
        if z == 0:          # back-side hardware is not part of the front stack
            continue
        for i, p in enumerate(ps):
            later = unary_union([q.geom for q in ps[i + 1:]]) if i + 1 < len(ps) else None
            if later is not None and p.geom.intersects(later):
                g = p.geom.difference(later.buffer(0.05))
                p.geom = max(polys(g), key=lambda x: x.area) if polys(g) else g


def add_spacers(parts):
    """Every piece must sit on wood. Add hidden spacers (merged into a
    neighbour where possible) under unsupported regions."""
    zmax = max(p.z for p in parts)
    for z in range(zmax, 3, -1):
        upper = [p for p in parts if p.z == z]
        lower = [p for p in parts if p.z == z - 1]
        support = unary_union([p.geom for p in lower])
        need = []
        for p in upper:
            u = p.geom.difference(support)
            u = u.buffer(-1.6).buffer(1.6)          # ignore slivers / tiny overhangs
            if u.area > 2.0:
                need.append(u)
        if not need:
            continue
        spacer = unary_union(need).buffer(0.0)
        # keep the spacer hidden: inside the union of everything above it
        above = unary_union([p.geom for p in upper]).buffer(-0.4)
        spacer = spacer.intersection(above).difference(support.buffer(0.05))
        for sp in polys(spacer):
            if sp.area < 4.0:
                continue
            touching = [q for q in lower if q.geom.buffer(0.3).intersects(sp)]
            if touching:
                best = max(touching, key=lambda q: q.geom.buffer(0.3).intersection(sp).area)
                merged = best.geom.union(sp.buffer(0.06)).buffer(0)
                # close the little notches where spacer meets outline, drop slivers
                merged = merged.buffer(1.0, quad_segs=12).buffer(-1.0, quad_segs=12)
                merged = merged.buffer(-0.8, quad_segs=12).buffer(0.8, quad_segs=12)
                others = unary_union([q.geom for q in lower if q is not best])
                if not others.is_empty:
                    merged = merged.difference(others.buffer(0.05))
                merged = max(polys(merged), key=lambda g: g.area)
                best.geom = merged
            else:
                parts.append(Part("Hidden spacer", z - 1, sp, "A"))


def support_report(parts):
    rep = []
    for p in parts:
        if p.z <= 1:
            continue
        sup = unary_union([q.geom for q in parts if q.z == p.z - 1])
        frac = p.geom.intersection(sup).area / p.geom.area
        rep.append((p, frac))
    return rep


def add_guides(parts):
    """Score the outline of each piece (inset 0.8 mm, so it hides) onto the piece below."""
    for q in parts:
        if q.z == 0:
            continue
        above = [p for p in parts if p.z == q.z + 1]
        segs = []
        for p in above:
            inner = p.geom.buffer(-0.8, quad_segs=16)
            if inner.is_empty:
                inner = p.geom.buffer(-0.4, quad_segs=16)
            ring = unary_union(lines(inner))
            seg = ring.intersection(q.geom.buffer(-0.6))
            segs += [s for s in lines(seg) if s.length > 1.5]
        q.guides = unary_union(segs) if segs else None


def assign_ids(parts):
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    by_z = {}
    for p in sorted(parts, key=lambda p: (p.z, -p.geom.area)):
        by_z.setdefault(p.z, []).append(p)
    for z, ps in by_z.items():
        kinds = []
        for p in ps:
            if p.kind not in kinds:
                kinds.append(p.kind)
        for p in ps:
            i = kinds.index(p.kind)
            p.pid = f"{z}{letters[i]}" if i < len(letters) else f"{z}-{i}"


def add_hidden_labels(parts, tf):
    for q in parts:
        if q.z <= 2:
            continue
        above = unary_union([p.geom for p in parts if p.z > q.z])
        covered = q.geom.intersection(above).buffer(-1.0)
        if covered.is_empty:
            continue
        best = None
        for c in polys(covered):
            mic = shapely.maximum_inscribed_circle(c, 0.2)
            r = mic.length
            if best is None or r > best[1]:
                best = (Point(mic.coords[0]), r)
        if best is None or best[1] < 2.6:
            continue
        pt, r = best
        cap = min(3.2, r * 0.75)
        if len(q.pid) > 2:
            cap = min(cap, r * 0.6)
        g = text_line(tf, q.pid, cap, pt.x, pt.y + cap / 2, tracking=0.05)
        if g.within(covered.buffer(0.5)):
            q.label = g


# ================================================================== nesting
def _try_place(sh, p):
    """First-fit (top-to-bottom, left-to-right) placement of p on sheet sh."""
    W = SHEET
    occ = sh["occ"]
    occp = shapely.prepared.prep(occ) if occ is not None else None
    big = p.geom.area > 1500
    rots = [0] if p.z <= 2 else ([0, 180] if big else [0, 90, 180, 270])   # keep grain on big parts
    best = None
    for rot in rots:
        g = affinity.rotate(p.geom, rot, origin="centroid") if rot else p.geom
        minx, miny, maxx, maxy = g.bounds
        if maxx - minx > W - 2 * SHEET_MARGIN or maxy - miny > W - 2 * SHEET_MARGIN:
            continue
        gb = g.buffer(PART_GAP / 2, quad_segs=6)
        step = 1.5 if p.geom.area < 600 else (2.0 if p.geom.area < 3000 else 3.0)
        ys = np.arange(SHEET_MARGIN - miny, W - SHEET_MARGIN - maxy + 0.01, step)
        xs = np.arange(SHEET_MARGIN - minx, W - SHEET_MARGIN - maxx + 0.01, step)
        found = None
        for dy in ys:
            if best is not None and dy + maxy >= best[0]:
                break
            for dx in xs:
                cand = affinity.translate(gb, dx, dy)
                if occp is None or not occp.intersects(cand):
                    found = (dy + maxy, dx, dy, rot)
                    break
            if found:
                break
        if found and (best is None or found[0] < best[0]):
            best = found
    if best is None:
        return False
    _, dx, dy, rot = best
    place = (rot, p.geom.centroid, dx, dy)
    gs = place_geom(p.geom, place).buffer(PART_GAP / 2, quad_segs=6)
    sh["parts"].append((p, place))
    sh["occ"] = gs if sh["occ"] is None else sh["occ"].union(gs)
    return True


def nest(parts):
    """Nest parts onto 300x300 sheets, one stain colour per sheet so a whole
    sheet can be stained/finished together. Back-side parts fill leftover gaps."""
    sheets = []
    front = [p for p in parts if p.z > 0]
    back = [p for p in parts if p.z == 0]
    for tone in TONES:
        group = sorted([p for p in front if p.tone == tone], key=lambda p: -p.geom.area)
        mine = []
        for p in group:
            for sh in mine:
                if _try_place(sh, p):
                    break
            else:
                sh = {"parts": [], "occ": None, "tone": tone}
                if not _try_place(sh, p):
                    raise RuntimeError(f"part {p} does not fit a sheet")
                mine.append(sh)
        sheets += mine
    for p in sorted(back, key=lambda p: -p.geom.area):
        for sh in sorted(sheets, key=lambda s: s["occ"].area):
            if _try_place(sh, p):
                break
        else:
            sh = {"parts": [], "occ": None, "tone": p.tone}
            _try_place(sh, p)
            sheets.append(sh)
    for i, sh in enumerate(sheets):
        sh["idx"] = i + 1
        for p, _ in sh["parts"]:
            p.sheet = i + 1
    return sheets


def place_geom(g, place):
    rot, c, dx, dy = place
    if g is None or g.is_empty:
        return g
    if rot:
        g = affinity.rotate(g, rot, origin=c)
    return affinity.translate(g, dx, dy)


# ===================================================================== svg out
def _fmt(v):
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def ring_d(coords, close=True):
    coords = list(coords)
    if close and len(coords) > 1 and coords[0] == coords[-1]:
        coords = coords[:-1]
    s = "M" + " L".join(f"{_fmt(x)},{_fmt(y)}" for x, y in coords)
    return s + (" Z" if close else "")


def poly_d(g):
    out = []
    for p in polys(g):
        p = p.simplify(0.015, preserve_topology=True)
        out.append(ring_d(p.exterior.coords))
        out += [ring_d(r.coords) for r in p.interiors]
    return " ".join(out)


def lines_d(g):
    out = []
    for ln in lines(g):
        ln = ln.simplify(0.015)
        closed = ln.coords[0] == ln.coords[-1]
        out.append(ring_d(ln.coords, close=closed))
    return " ".join(out)


def svg_doc(w, h, body, title):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{_fmt(w)}mm" height="{_fmt(h)}mm" '
            f'viewBox="0 0 {_fmt(w)} {_fmt(h)}">\n<title>{title}</title>\n{body}</svg>\n')


def sheet_svg(sh, idx, total):
    eng, sco, cut_in, cut_out = [], [], [], []
    for p, place in sh["parts"]:
        e = unary_union([g for g in (p.engrave, p.label) if g is not None and not g.is_empty]) \
            if (p.engrave is not None or p.label is not None) else None
        if e is not None and not e.is_empty:
            e = place_geom(e.intersection(p.geom.buffer(-0.2)), place)
            eng.append(poly_d(e))
        sl = [g for g in (p.score, p.guides) if g is not None and not g.is_empty]
        if sl:
            s = place_geom(unary_union(sl).intersection(p.geom.buffer(-0.3)), place)
            if lines_d(s):
                sco.append(lines_d(s))
        g = place_geom(p.geom, place)
        for pg in polys(g):
            pg = pg.simplify(0.015, preserve_topology=True)
            cut_in += [ring_d(r.coords) for r in pg.interiors]
            cut_out.append(ring_d(pg.exterior.coords))
    body = ""
    if any(eng):
        body += f'<g id="ENGRAVE" fill="{ENGRAVE}" stroke="none" fill-rule="evenodd">\n'
        body += "".join(f'<path d="{d}"/>\n' for d in eng if d)
        body += "</g>\n"
    if any(sco):
        body += f'<g id="SCORE" fill="none" stroke="{SCORE}" stroke-width="0.1">\n'
        body += "".join(f'<path d="{d}"/>\n' for d in sco if d)
        body += "</g>\n"
    body += f'<g id="CUT" fill="none" stroke="{CUT}" stroke-width="0.1">\n'
    if cut_in:
        body += f'<path id="cut-inner" d="{" ".join(cut_in)}"/>\n'
    body += "".join(f'<path d="{d}"/>\n' for d in cut_out)
    body += "</g>\n"
    return svg_doc(SHEET, SHEET, body, f"Sheet {idx} of {total} - 3mm basswood")


def assembled_svg(parts):
    body = ""
    for z in sorted({p.z for p in parts}):
        body += f'<g id="layer-{z}">\n'
        for p in [q for q in parts if q.z == z]:
            r, g, b = TONES[p.tone][1]
            body += (f'<path id="{p.pid}" d="{poly_d(p.geom)}" fill="rgb({r},{g},{b})" '
                     f'stroke="#2a1a10" stroke-width="0.25" fill-rule="evenodd"/>\n')
            if p.engrave is not None and not p.engrave.is_empty:
                body += f'<path d="{poly_d(p.engrave)}" fill="#3b2412" fill-rule="evenodd"/>\n'
            if p.score is not None and not p.score.is_empty:
                body += f'<path d="{lines_d(p.score)}" fill="none" stroke="#6b4a2c" stroke-width="0.25"/>\n'
        body += "</g>\n"
    return svg_doc(PLAQUE, PLAQUE, body, "Assembled design (reference only - do not cut)")


# ================================================================= rendering
PX = 5.0     # pixels per mm for previews


def _mask(geom, size, px, offset=(0, 0)):
    im = Image.new("L", size, 0)
    d = ImageDraw.Draw(im)
    for p in polys(geom):
        ext = [((x + offset[0]) * px, (y + offset[1]) * px) for x, y in p.exterior.coords]
        d.polygon(ext, fill=255)
        for r in p.interiors:
            d.polygon([((x + offset[0]) * px, (y + offset[1]) * px) for x, y in r.coords], fill=0)
    return im


def _wood(size, base, seed, stretch=1.0):
    rng = np.random.default_rng(seed)
    w, h = size
    y = np.arange(h)[:, None].astype(np.float32)
    x = np.arange(w)[None, :].astype(np.float32)
    n1 = rng.normal(0, 1, (h // 8 + 2, w // 64 + 2)).astype(np.float32)
    n1 = np.array(Image.fromarray(((n1 - n1.min()) / (np.ptp(n1) + 1e-6) * 255).astype(np.uint8))
                  .resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    grain = np.sin((y / (3.2 * stretch) + n1 * 9.0) * 1.0) * 0.5 + 0.5
    fine = rng.normal(0, 1, (h, w)).astype(np.float32)
    fine = np.array(Image.fromarray(np.clip(fine * 40 + 128, 0, 255).astype(np.uint8))
                    .resize((w // 6 + 1, h), Image.BILINEAR).resize((w, h), Image.BILINEAR)).astype(np.float32) / 255
    k = 1 - 0.07 * grain - 0.05 * (fine - 0.5) - 0.04 * n1
    arr = np.stack([np.clip(np.array(base[i], np.float32) * k, 0, 255) for i in range(3)], -1)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def render(parts, path, upto=None, highlight=None, labels=False, scale=PX, flat=False):
    pad = 14
    size = (int((PLAQUE + 2 * pad) * scale), int((PLAQUE + 2 * pad) * scale))
    off = (pad, pad)
    canvas = Image.new("RGB", size, (236, 233, 227))
    wall = np.array(canvas).astype(np.float32)
    canvas = Image.fromarray(wall.astype(np.uint8))
    zs = sorted({p.z for p in parts})
    if upto is not None:
        zs = [z for z in zs if z <= upto]
    woods = {k: _wood(size, v[1], i + 3) for i, (k, v) in enumerate(TONES.items())}
    burn = (52, 30, 16)
    for z in zs:
        lay = [p for p in parts if p.z == z]
        lay_mask = _mask(unary_union([p.geom for p in lay]), size, scale, off)
        # drop shadow cast by this layer on everything below
        sh = lay_mask.filter(ImageFilter.GaussianBlur(scale * (2.6 if z == 1 else 1.3)))
        sh = Image.fromarray(np.roll(np.roll(np.array(sh), int(scale * 1.1), 1), int(scale * 1.6), 0))
        shf = np.array(sh).astype(np.float32) / 255 * (0.55 if z > 1 else 0.35)
        arr = np.array(canvas).astype(np.float32) * (1 - shf[..., None])
        canvas = Image.fromarray(arr.astype(np.uint8))
        for p in lay:
            m = _mask(p.geom, size, scale, off)
            if flat:
                col = TONES[p.tone][1]
                if highlight is not None and p.z != highlight:
                    col = tuple(int(c * 0.55 + 236 * 0.45) for c in col)
                fill = Image.new("RGB", size, col)
            else:
                fill = woods[p.tone]
            canvas.paste(fill, (0, 0), m)
            # laser-charred edge + soft top-left highlight
            edge = np.array(m.filter(ImageFilter.MaxFilter(3))).astype(np.float32) - np.array(
                m.filter(ImageFilter.MinFilter(3))).astype(np.float32)
            edge = np.clip(edge / 255 * np.array(m).astype(np.float32) / 255, 0, 1)
            hl = np.array(m).astype(np.float32) - np.roll(np.roll(np.array(m), 2, 0), 2, 1).astype(np.float32)
            hl = np.clip(hl / 255, 0, 1)
            arr = np.array(canvas).astype(np.float32)
            arr = arr * (1 - 0.75 * edge[..., None]) + np.array(burn, np.float32) * 0.75 * edge[..., None]
            if not flat:
                arr = arr + 28 * hl[..., None]
            if p.engrave is not None and not p.engrave.is_empty:
                em = np.array(_mask(p.engrave.intersection(p.geom), size, scale, off).filter(
                    ImageFilter.GaussianBlur(0.4))).astype(np.float32) / 255
                arr = arr * (1 - 0.82 * em[..., None]) + np.array(burn, np.float32) * 0.82 * em[..., None]
            if p.score is not None and not p.score.is_empty:
                sm = _mask(p.score.buffer(0.12), size, scale, off)
                smf = np.array(sm).astype(np.float32) / 255 * 0.55
                arr = arr * (1 - smf[..., None]) + np.array(burn, np.float32) * smf[..., None]
            canvas = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        if labels:
            pass
    if labels:
        d = ImageDraw.Draw(canvas)
        try:
            fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(scale * 3.4))
        except OSError:
            fnt = ImageFont.load_default()
        for p in parts:
            if upto is not None and p.z > upto:
                continue
            if highlight is not None and p.z != highlight:
                continue
            c = p.geom.representative_point()
            x, y = (c.x + off[0]) * scale, (c.y + off[1]) * scale
            d.text((x, y), p.pid, fill=(180, 0, 0), font=fnt, anchor="mm", stroke_width=2,
                   stroke_fill=(255, 255, 255))
    canvas.save(path)
    return canvas


# ============================================================ assembly guide
LETTER = (1650, 1275)       # 11 x 8.5 in at 150 dpi
DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJAVU_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _font(sz, bold=False):
    try:
        return ImageFont.truetype(DEJAVU_B if bold else DEJAVU, sz)
    except OSError:
        return ImageFont.load_default()


def _page(title):
    pg = Image.new("RGB", LETTER, "white")
    d = ImageDraw.Draw(pg)
    d.text((60, 40), title, fill=(30, 30, 30), font=_font(38, True))
    d.line([(60, 95), (LETTER[0] - 60, 95)], fill=(180, 160, 130), width=3)
    return pg, d


def _flat_view(parts, size_px, upto, current):
    """Flat-colour diagram of the stack up to layer `upto`, current layer labelled."""
    sc = size_px / PLAQUE
    im = Image.new("RGB", (size_px, size_px), "white")
    d = ImageDraw.Draw(im)
    for z in sorted({p.z for p in parts if 0 < p.z <= upto}):
        for p in [q for q in parts if q.z == z]:
            col = TONES[p.tone][1]
            if z != current:
                col = tuple(int(c * 0.35 + 255 * 0.65) for c in col)
            for pg in polys(p.geom):
                d.polygon([(x * sc, y * sc) for x, y in pg.exterior.coords], fill=col,
                          outline=(40, 25, 15) if z == current else (170, 160, 150))
                for r in pg.interiors:
                    d.polygon([(x * sc, y * sc) for x, y in r.coords], fill="white")
    fnt = _font(max(12, int(sc * 3.3)), True)
    seen = set()
    for p in [q for q in parts if q.z == current]:
        if p.pid in seen:
            continue
        seen.add(p.pid)
        c = p.geom.representative_point() if p.geom.area > 60 else p.geom.centroid
        d.text((c.x * sc, c.y * sc), p.pid, fill=(190, 0, 0), font=fnt, anchor="mm",
               stroke_width=3, stroke_fill="white")
    return im


def _sheet_view(sh, size_px):
    sc = size_px / SHEET
    im = Image.new("RGB", (size_px, size_px), (250, 246, 238))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, size_px - 1, size_px - 1], outline=(120, 120, 120), width=2)
    fnt = _font(max(11, int(sc * 3.6)), True)
    for p, place in sh["parts"]:
        g = place_geom(p.geom, place)
        col = TONES[p.tone][1] if p.z > 0 else (200, 200, 200)
        for pg in polys(g):
            d.polygon([(x * sc, y * sc) for x, y in pg.exterior.coords], fill=col, outline=(200, 0, 0))
            for r in pg.interiors:
                d.polygon([(x * sc, y * sc) for x, y in r.coords], fill=(250, 246, 238), outline=(200, 0, 0))
        c = g.representative_point() if g.area > 60 else g.centroid
        d.text((c.x * sc, c.y * sc), p.pid, fill=(20, 20, 120), font=fnt, anchor="mm",
               stroke_width=3, stroke_fill="white")
    return im


def assembly_guide(parts, sheets, preview_img, path):
    pages = []
    zmax = max(p.z for p in parts)

    # --- cover
    pg, d = _page(f"Layered AFE Helmet Plaque  -  {NAME}")
    pv = preview_img.copy()
    pv.thumbnail((880, 880))
    pg.paste(pv, (60, 120))
    x0, y = 990, 130
    d.text((x0, y), "Stack (back to front)", fill=(30, 30, 30), font=_font(28, True))
    y += 46
    names = {}
    for p in parts:
        if p.z > 0:
            names.setdefault(p.z, []).append(p.kind)
    for z in range(1, zmax + 1):
        txt = ", ".join(sorted(set(n for n in names[z])))
        d.text((x0, y), f"Layer {z}", fill=(150, 30, 30), font=_font(20, True))
        lines_ = _wrap(txt, 52)
        for ln in lines_:
            d.text((x0 + 95, y), ln, fill=(40, 40, 40), font=_font(18))
            y += 24
        y += 6
    y += 14
    d.text((x0, y), "Stain colours", fill=(30, 30, 30), font=_font(28, True))
    y += 44
    for k, (nm, col) in TONES.items():
        d.rectangle([x0, y, x0 + 40, y + 28], fill=col, outline=(60, 60, 60))
        d.text((x0 + 55, y + 2), f"{k}  {nm}", fill=(40, 40, 40), font=_font(20))
        y += 40
    y += 10
    total_h = zmax * THICK
    d.text((x0, y), f"{len([p for p in parts if p.z > 0])} front pieces + {len([p for p in parts if p.z == 0])} back pieces", fill=(40, 40, 40), font=_font(20))
    y += 28
    d.text((x0, y), f"{len(sheets)} sheets of 3 mm basswood, 300 x 300 mm", fill=(40, 40, 40), font=_font(20))
    y += 28
    d.text((x0, y), f"Finished size {PLAQUE:.0f} x {PLAQUE:.0f} mm, ~{total_h:.0f} mm deep", fill=(40, 40, 40), font=_font(20))

    y = 1030
    d.text((60, y), "xTool S1 starting points for 3 mm basswood plywood (always run a material test first)",
           fill=(30, 30, 30), font=_font(24, True))
    y += 40
    rows = [("Colour", "Operation", "S1 20 W", "S1 40 W"),
            ("Black fill", "Engrave (text, border)", "30% / 200 mm/s / 0.08 mm", "18% / 300 mm/s / 0.08 mm"),
            ("Blue line", "Score (glue guides)", "12% / 120 mm/s / 1 pass", "6% / 150 mm/s / 1 pass"),
            ("Red line", "Cut", "100% / 8-10 mm/s / 1 pass", "100% / 18-22 mm/s / 1 pass")]
    cols = [60, 260, 640, 1040]
    for k, r in enumerate(rows):
        for c, txt in zip(cols, r):
            d.text((c, y), txt, fill=(150, 30, 30) if k == 0 else (40, 40, 40), font=_font(20, k == 0))
        y += 30
    d.text((60, y + 6), "Air assist ON for cutting. Engrave and score run before the cut (XCS default). "
           "Masking the top face keeps smoke stains off.", fill=(90, 90, 90), font=_font(18))
    pages.append(pg)

    # --- glue-up steps, two per page
    steps = list(range(2, zmax + 1))
    for i in range(0, len(steps), 2):
        pg, d = _page("Glue-up  -  follow the scored outlines on the layer below")
        for j, z in enumerate(steps[i:i + 2]):
            im = _flat_view(parts, 700, z, z)
            ox = 60 + j * 790
            pg.paste(im, (ox, 160))
            d.text((ox, 115), f"Step {z - 1}:  add layer {z}", fill=(150, 30, 30), font=_font(28, True))
            ids = ", ".join(sorted({f"{p.pid} {p.kind}" + (" x%d" % sum(1 for q in parts if q.pid == p.pid) if sum(1 for q in parts if q.pid == p.pid) > 1 else "")
                                    for p in parts if p.z == z}))
            for k, ln in enumerate(_wrap("Pieces: " + ids, 70)):
                d.text((ox, 880 + k * 26), ln, fill=(40, 40, 40), font=_font(19))
        pages.append(pg)

    # --- back hardware
    pg, d = _page("Back side  -  keyhole hanger and wall bumpers")
    tips = [
        "1. Glue the keyhole SPACER (the piece with the long rounded pocket) to the back of the",
        "   backer, centred left-to-right, with its top edge ~20 mm below the top edge.",
        "2. Glue the keyhole PLATE on top of it, keyhole lined up with the pocket, wide hole at the bottom.",
        "3. Stack the four bumper discs into two pairs and glue one pair in each bottom corner",
        "   (~20 mm in from the edges) so the plaque hangs flat.",
        "4. Hang on a #8 pan-head screw left ~6 mm proud of the wall.",
    ]
    for k, t in enumerate(tips):
        d.text((60, 130 + k * 34), t, fill=(40, 40, 40), font=_font(22))
    sc = 4.0
    bx, by = 60, 380
    im = Image.new("RGB", (int(PLAQUE * sc / 2.2), int(PLAQUE * sc / 2.2)), "white")
    s2 = sc / 2.2
    dd = ImageDraw.Draw(im)
    bk = [p for p in parts if p.z == 1][0]
    dd.polygon([(x * s2, y_ * s2) for x, y_ in bk.geom.exterior.coords], fill=(120, 90, 60), outline="black")
    for p in [q for q in parts if q.z == 0]:
        if "spacer" in p.name.lower() or "plate" in p.name.lower():
            g = affinity.translate(p.geom, PLAQUE / 2, 20 + 18)
            for pg_ in polys(g):
                dd.polygon([(x * s2, y_ * s2) for x, y_ in pg_.exterior.coords], fill=(230, 210, 170), outline="black")
                for r in pg_.interiors:
                    dd.polygon([(x * s2, y_ * s2) for x, y_ in r.coords], fill=(120, 90, 60), outline="black")
    for cx in (30, PLAQUE - 30):
        g = circle(cx, PLAQUE - 30, 10)
        dd.polygon([(x * s2, y_ * s2) for x, y_ in g.exterior.coords], fill=(230, 210, 170), outline="black")
    pg.paste(im, (bx, by))
    d.text((bx, by + im.size[1] + 10), "View from the BACK", fill=(80, 80, 80), font=_font(20, True))
    pages.append(pg)

    # --- sheet maps, two per page
    for i in range(0, len(sheets), 2):
        pg, d = _page("Cut sheets  -  part IDs (larger pieces also have it engraved on a hidden spot)")
        for j, sh in enumerate(sheets[i:i + 2]):
            im = _sheet_view(sh, 700)
            ox = 60 + j * 790
            pg.paste(im, (ox, 160))
            tone = TONES[sh["tone"]][0]
            d.text((ox, 115), f"Sheet {sh['idx']}  -  stain: {tone}", fill=(150, 30, 30), font=_font(26, True))
        pages.append(pg)

    pages[0].save(path, save_all=True, append_images=pages[1:], resolution=150)


def _wrap(text, width):
    out, cur = [], ""
    for w in text.split(" "):
        if len(cur) + len(w) + 1 > width and cur:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        out.append(cur)
    return out


# ===================================================================== main
def main():
    OUT.mkdir(exist_ok=True)
    sheet_dir = OUT / "cut-sheets"
    sheet_dir.mkdir(exist_ok=True)
    for f in sheet_dir.glob("*.svg"):
        f.unlink()

    parts = build_design()
    resolve_overlaps(parts)
    add_spacers(parts)
    assign_ids(parts)
    for p, frac in support_report(parts):
        if frac < 0.85 and p.z > 0:
            print(f"  low support: {p.pid:4s} {p.name:28s} {frac:5.0%}")
    add_guides(parts)
    add_hidden_labels(parts, Typeface(FONT, 700))

    sheets = nest(parts)
    for sh in sheets:
        tone = TONES[sh["tone"]][0].split(" ")[0].split("/")[0].lower()
        fn = sheet_dir / f"sheet-{sh['idx']:02d}-{tone}.svg"
        fn.write_text(sheet_svg(sh, sh["idx"], len(sheets)))
        sh["file"] = fn.name

    (OUT / "plaque-assembled-reference.svg").write_text(assembled_svg([p for p in parts if p.z > 0]))
    front = [p for p in parts if p.z > 0]
    img = render(front, OUT / "preview.png")
    assembly_guide(parts, sheets, img, OUT / "assembly-guide.pdf")

    rows = ["id,name,qty,layer,stain,sheet,width_mm,height_mm"]
    done = set()
    for p in sorted(parts, key=lambda p: (p.z if p.z > 0 else 99, p.pid)):
        if p.pid in done:
            continue
        done.add(p.pid)
        same = [q for q in parts if q.pid == p.pid]
        x0, y0, x1, y1 = p.geom.bounds
        sh_ids = "/".join(str(s) for s in sorted({q.sheet for q in same}))
        rows.append(f'{p.pid},"{p.kind}",{len(same)},{p.z if p.z > 0 else "back"},{TONES[p.tone][0]},'
                    f'{sh_ids},{x1 - x0:.1f},{y1 - y0:.1f}')
    (OUT / "parts-list.csv").write_text("\n".join(rows) + "\n")

    print(f"{len(parts)} pieces on {len(sheets)} sheets:")
    for sh in sheets:
        used = sum(p.geom.area for p, _ in sh["parts"]) / (SHEET * SHEET)
        print(f"  {sh['file']:28s} {len(sh['parts']):3d} pieces  {used:5.1%} used")
    return parts, sheets


if __name__ == "__main__":
    main()
