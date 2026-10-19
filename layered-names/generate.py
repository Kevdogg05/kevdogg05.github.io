#!/usr/bin/env python3
"""Layered floral name sign generator (3D shadow-box style).

Builds three cut layers for a name, all sharing the same outer silhouette:

  1. base   - solid backing (blue)
  2. floral - papercut roses / leaves / butterflies, one connected piece (white)
  3. frame  - letter outlines that sit on top (gold); cut 2-3 for extra depth

Usage:  python3 generate.py SYNNAI SEHAVYNN [--cap 75] [--out .]
Requires: pip install shapely fonttools
"""
import argparse
import math
import os
import urllib.request

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.ops import nearest_points, unary_union
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "ArchivoBlack-Regular.ttf")
FONT_URL = ("https://raw.githubusercontent.com/google/fonts/main/"
            "ofl/archivoblack/ArchivoBlack-Regular.ttf")

COLORS = {"base": "#1d6f8c", "floral": "#f7f7f2", "frame": "#d8b45c"}
COLOR_NAMES = {"base": "blue", "floral": "white", "frame": "gold"}

# The pattern is laid out at a 90 mm letter height and then scaled to --cap.
# Layout sizes (design mm, scale with the letters):
P = dict(
    frame=4.5,      # width of the gold letter outline
    overlap=10.0,   # how far each letter tucks over the previous one
    bounce=3.0,     # alternate letters are nudged up/down by this much
)
DESIGN_CAP = 90.0
# Cutting limits (real mm at the final size, so they stay cuttable at any --cap):
CUT = dict(
    stroke=1.2,     # papercut line width
    fine=1.0,       # thinner detail lines (antennae)
    tuck=0.8,       # floral cut-outs run this far under the frame (hides misalignment)
    min_hole=1.0,   # cut-outs narrower than this are filled in
    min_area=1.5,   # cut-outs smaller than this (mm^2) are filled in
)


# --------------------------------------------------------------------------- geometry helpers

def polys(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if hasattr(g, "geoms"):
        return [p for x in g.geoms for p in polys(x)]
    return []


def opening(g, r):
    """Remove parts of g thinner than 2r (never grows g: mitre joins can overshoot)."""
    return g.buffer(-r, join_style="mitre").buffer(r, join_style="mitre").intersection(g)


def line(pts):
    return LineString([tuple(p) for p in pts])


def thick(lines, w):
    return unary_union([l.buffer(w / 2, quad_segs=6) for l in lines])


def catmull_closed(pts, n=12):
    pts = np.asarray(pts, float)
    out = []
    k = len(pts)
    for i in range(k):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % k], pts[(i + 2) % k]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def quad(p0, p1, p2, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2 = map(np.asarray, (p0, p1, p2))
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2


def place(g, cx, cy, ang):
    return affinity.translate(affinity.rotate(g, ang, origin=(0, 0), use_radians=True), cx, cy)


class Motif:
    """A drawable element: `white` is the papercut material, `foot` the area it hides beneath it."""

    def __init__(self, white, foot, z):
        self.white, self.foot, self.z = white, foot, z

    def moved(self, cx, cy, ang):
        return Motif(place(self.white, cx, cy, ang),
                     place(self.foot, cx, cy, ang) if self.foot is not None else None, self.z)


# --------------------------------------------------------------------------- font

class FlattenPen(BasePen):
    def __init__(self, glyph_set, steps=16):
        super().__init__(glyph_set)
        self.contours, self.cur, self.steps = [], None, steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, self.steps + 1)[1:]:
            m = 1 - t
            self.cur.append(tuple(m ** 3 * np.array(p0) + 3 * m * m * t * np.array(p1)
                                  + 3 * m * t * t * np.array(p2) + t ** 3 * np.array(p3)))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, self.steps + 1)[1:]:
            m = 1 - t
            self.cur.append(tuple(m * m * np.array(p0) + 2 * m * t * np.array(p1) + t * t * np.array(p2)))

    def _closePath(self):
        if self.cur and len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


def load_font():
    if not os.path.exists(FONT_PATH):
        os.makedirs(os.path.dirname(FONT_PATH), exist_ok=True)
        urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    return TTFont(FONT_PATH)


def glyph(font, ch, cap):
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    pen = FlattenPen(gs)
    gs[name].draw(pen)
    outers, holes = [], []
    for c in pen.contours:
        poly = Polygon(c)
        # TrueType: outer contours run clockwise, counters counter-clockwise
        (holes if poly.exterior.is_ccw else outers).append(poly.buffer(0))
    shape = unary_union(outers).difference(unary_union(holes))
    s = cap / font["OS/2"].sCapHeight
    return affinity.scale(shape, s, -s, origin=(0, 0))  # y down, baseline at y = 0


# --------------------------------------------------------------------------- letters

def row_extents(shape, ys):
    out = []
    for y in ys:
        seg = shape.intersection(LineString([(-1e5, y), (1e5, y)]))
        out.append(None if seg.is_empty else (seg.bounds[0], seg.bounds[2]))
    return out


def build_letters(font, word, cap):
    fw = P["frame"]
    letters = []  # (glyph, outer)
    ys = np.linspace(-cap * 1.3, cap * 0.4, 260)
    left = None
    for i, ch in enumerate(word):
        g = glyph(font, ch, cap)
        dy = 0 if P["bounce"] == 0 else (P["bounce"] if i % 2 else -P["bounce"])
        g = affinity.translate(g, 0, dy)
        outer = g.buffer(fw / 2, join_style="mitre", mitre_limit=3)
        if left is not None:
            a, b = row_extents(left, ys), row_extents(outer, ys)
            gaps = [bb[0] - aa[1] for aa, bb in zip(a, b) if aa and bb]
            dx = -P["overlap"] - min(gaps)
            g = affinity.translate(g, dx, 0)
            outer = affinity.translate(outer, dx, 0)
        letters.append((g, outer))
        left = outer if left is None else left.union(outer)
    return letters


def build_regions(letters):
    fw = P["frame"]
    outers = [o for _, o in letters]
    sil = unary_union(outers)
    vis = []
    for i, (g, _) in enumerate(letters):
        inner = g.buffer(-fw / 2, join_style="mitre", mitre_limit=3)
        above = unary_union(outers[i + 1:]) if i + 1 < len(outers) else None
        v = inner.difference(above) if above is not None else inner
        vis.append(opening(v, 1.0))
    region = unary_union(vis)
    frame = opening(sil.difference(region), 0.6)
    return sil, region, frame, vis


# --------------------------------------------------------------------------- motifs (local coords, centred on 0,0)

def rose(R, rng):
    """Top-down papercut rose: rings of overlapping petals around a spiral bud."""
    w = P["stroke"]
    nr = 2 if R < 13 else 3
    rc = R * (0.36 if nr == 2 else 0.28)
    white, foot = Polygon(), Polygon()
    off = rng.uniform(0, 2 * math.pi)
    for k in reversed(range(nr)):  # outermost ring first, inner rings overlap it
        ro = rc + (R - rc) * (k + 1) / nr
        rb = rc * 0.45
        m = 5 + k
        span = 2 * math.pi / m * 1.4
        off += math.pi / m
        for j in range(m):
            a = off + j * 2 * math.pi / m + rng.uniform(-0.08, 0.08)
            t = np.linspace(0, 1, 44)
            r_top = ro * (rng.uniform(0.97, 1.0) if k == nr - 1 else rng.uniform(0.94, 1.04))
            rho = rb + (r_top - rb) * np.sin(math.pi * t) ** 0.45
            ang = a - span / 2 + span * t
            arc = np.c_[rho * np.cos(ang), rho * np.sin(ang)]
            petal = Polygon(np.vstack([[0, 0], arc])).buffer(0)
            white = white.difference(petal).union(line(arc).buffer(w / 2, quad_segs=6))
            foot = foot.union(petal)
    # spiral bud in the middle
    r0 = 0.8
    pitch = max(2.4, P["stroke"] * 2.2)
    turns = max(1.0, (rc - r0) / pitch)
    th = np.linspace(0, 2 * math.pi * turns, int(70 * turns)) + off
    rr = r0 + (rc - r0) * (th - off) / (th[-1] - off)
    bud = Point(0, 0).buffer(rc)
    white = white.difference(bud).union(line(np.c_[rr * np.cos(th), rr * np.sin(th)]).buffer(w / 2, quad_segs=6))
    white = white.union(bud.exterior.buffer(w / 2, quad_segs=6))
    return Motif(white, foot.union(bud), 2)


def leaf_shape(L, W, bend):
    t = np.linspace(0, 1, 50)
    half = 0.5 * W * np.sin(math.pi * t ** 0.8) ** 0.85
    mid = bend * L * t ** 2
    up = np.c_[L * t, mid + half]
    lo = np.c_[L * t, mid - half]
    return t, half, mid, up, lo


def leaf(L, W, style, rng, stem=0.15):
    w, f = P["stroke"], P["fine"]
    bend = rng.uniform(-0.12, 0.12)
    t, half, mid, up, lo = leaf_shape(L, W, bend)
    poly = Polygon(np.vstack([up, lo[::-1]])).buffer(0)
    ring = line(np.vstack([up, lo[::-1], up[:1]]))
    ts = np.linspace(-stem, 0.9, 40)
    midrib = line(np.c_[L * ts, bend * L * np.clip(ts, 0, None) ** 2])
    hf = lambda tt: np.interp(tt, t, half)
    mf = lambda tt: np.interp(tt, t, mid)
    if style == "solid":
        # filled leaf with vein slots cut into it
        slots = [line(np.c_[L * np.linspace(0.12, 0.8, 20), mf(np.linspace(0.12, 0.8, 20))])]
        nv = 3 if L < 18 else 4
        for k in range(nv):
            tk = 0.2 + 0.55 * k / max(1, nv - 1)
            t1 = tk + 0.17
            for sgn in (-1, 1):
                a = np.array([L * (tk + 0.03), mf(tk + 0.03) + sgn * 1.4])
                b = np.array([L * t1, mf(t1) + sgn * max(0.5, hf(t1) - 1.9)])
                slots.append(line([a, b]))
        white = poly.difference(thick(slots, max(P["min_hole"] * 1.4, W * 0.07)))
        white = max(polys(white), key=lambda p: p.area)
        if stem > 0:
            white = white.union(line(np.c_[L * np.linspace(-stem, 0.05, 6), np.zeros(6)]).buffer(w / 2))
        return Motif(white, poly, 0)
    lines = [ring, midrib]
    if style == "veined":
        nv = 4 if L < 20 else 5
        for k in range(nv):
            tk = 0.14 + 0.62 * k / (nv - 1)
            t1 = min(0.97, tk + 0.17)
            for sgn in (-1, 1):
                lines.append(line([(L * tk, mf(tk)), (L * t1, mf(t1) + sgn * hf(t1) * 1.05)]))
        white = thick(lines[:2], w).union(thick(lines[2:], f))
    else:  # outline
        inner = poly.buffer(-max(1.6, W * 0.16))
        lines += [l for l in [inner.exterior] if inner.geom_type == "Polygon"]
        white = thick(lines, w)
        if inner.geom_type == "Polygon":
            white = white.union(line(np.c_[L * np.linspace(0.05, 0.95, 30), mf(np.linspace(0.05, 0.95, 30))]).buffer(w / 2))
    return Motif(white, poly, 0)


FOREWING = [(0.03, -0.04), (0.12, -0.28), (0.30, -0.50), (0.50, -0.63), (0.66, -0.60),
            (0.68, -0.42), (0.58, -0.22), (0.38, -0.07), (0.14, 0.02)]
HINDWING = [(0.04, 0.03), (0.26, 0.02), (0.46, 0.12), (0.53, 0.30), (0.45, 0.48),
            (0.28, 0.58), (0.14, 0.52), (0.06, 0.32)]


def wing(pts, s, n_veins):
    """Solid wing with window-like panels cut between the veins."""
    w = P["stroke"]
    outline = catmull_closed(np.array(pts) * s, 10)
    poly = Polygon(outline).buffer(0)
    root = np.array(pts[0]) * s
    idx = np.linspace(0, len(outline), n_veins + 2)[1:-1].astype(int)
    veins = [line([root, root + 1.1 * (outline[i] - root)]) for i in idx]
    panels = poly.buffer(-max(w * 1.15, 0.05 * s))
    panels = panels.difference(Point(*root).buffer(0.13 * s)).difference(thick(veins, w))
    if s >= 26:  # bigger wings get a second row of panels along the edge
        edge = poly.buffer(-max(w * 1.15, 0.05 * s)).buffer(-max(2.6, 0.1 * s))
        panels = panels.difference(edge.exterior.buffer(w / 2)) if edge.geom_type == "Polygon" else panels
    panels = [p for p in polys(panels) if p.area > 3]
    return poly.difference(unary_union(panels)), poly


def butterfly(s, rng):
    parts, foots = [], []
    for pts, nv in ((FOREWING, 3 if s > 24 else 2), (HINDWING, 2 if s > 24 else 1)):
        wt, wp = wing(pts, s, nv)
        for sx in (1, -1):
            parts.append(affinity.scale(wt, sx, 1, origin=(0, 0)))
            foots.append(affinity.scale(wp, sx, 1, origin=(0, 0)))
    body = affinity.scale(Point(0, 0.12 * s).buffer(1), max(1.2, 0.04 * s), 0.32 * s)
    head = Point(0, -0.2 * s).buffer(max(1.4, 0.06 * s))
    ants = []
    for sx in (1, -1):
        ants.append(line(quad((0, -0.22 * s), (sx * 0.06 * s, -0.5 * s), (sx * 0.24 * s, -0.62 * s))))
    tips = [Point(sx * 0.24 * s, -0.62 * s).buffer(max(1.1, 0.035 * s)) for sx in (1, -1)]
    white = unary_union(parts + [body, head, thick(ants, P["fine"])] + tips)
    foot = unary_union(foots + [body, head])
    return Motif(white, foot, 1)


def sprig(L, rng):
    w, f = P["stroke"], P["fine"]
    bend = rng.uniform(-0.25, 0.25) * L
    stem = quad((0, 0), (L / 2, bend), (L, 0), 30)
    lines, dots = [line(stem)], []
    rb = max(1.5, 0.075 * L)
    n = 4 if L > 14 else 3
    for k in range(n):
        tk = 0.3 + 0.6 * k / (n - 1)
        i = int(tk * (len(stem) - 1))
        p = stem[i]
        d = stem[min(i + 1, len(stem) - 1)] - stem[i - 1]
        d /= np.linalg.norm(d)
        sgn = 1 if k % 2 else -1
        nrm = np.array([-d[1], d[0]]) * sgn
        q = p + (0.55 * d + 0.85 * nrm) * 0.24 * L
        lines.append(line([p, q]))
        dots.append(Point(*q).buffer(rb))
    dots.append(Point(*stem[-1]).buffer(rb))
    white = thick(lines[:1], w).union(thick(lines[1:], f)).union(unary_union(dots))
    return Motif(white, None, 1)


def blossom(r, rng):
    w = P["stroke"]
    n = 5
    lines, petals = [], []
    rc = max(1.4, 0.22 * r)
    for k in range(n):
        a = 2 * math.pi * k / n
        e = affinity.scale(Point(0, 0).buffer(1), 0.5 * r, 0.3 * r)
        e = affinity.translate(e, 0.5 * r + rc * 0.6, 0)
        e = affinity.rotate(e, a, origin=(0, 0), use_radians=True)
        petals.append(e)
        lines.append(e.exterior)
    foot = unary_union(petals + [Point(0, 0).buffer(rc)])
    white = thick(lines, w).union(Point(0, 0).buffer(rc))
    return Motif(white, foot, 1)


# --------------------------------------------------------------------------- composition

def grid_points(region, step):
    x0, y0, x1, y1 = region.bounds
    xs, ys = np.meshgrid(np.arange(x0, x1, step), np.arange(y0, y1, step))
    pts = shapely.points(xs.ravel(), ys.ravel())
    return pts[shapely.contains(region, pts)]


def compose(region, vis, rng):
    motifs, roses, leaf_feet = [], [], []  # roses: (x, y, R)

    # --- a few butterflies in the roomiest spots (junctions, corners), drawn on top
    pts = grid_points(region, 1.5)
    xy = shapely.get_coordinates(pts)
    d = shapely.distance(region.boundary, pts)
    bflies = []  # (x, y, clearance)
    for _ in range(max(1, round(len(vis) / 3))):
        i = int(np.argmax(d * rng.uniform(0.9, 1.0, len(d))))
        if d[i] < 8:
            break
        s = float(np.clip(d[i] * 1.6, 15, 19))
        m = butterfly(s, rng).moved(xy[i, 0], xy[i, 1], rng.uniform(-0.25, 0.25))
        m.z = 3
        motifs.append(m)
        leaf_feet.append(m.foot)
        bflies.append((xy[i, 0], xy[i, 1], 0.55 * s))
        d[np.hypot(xy[:, 0] - xy[i, 0], xy[:, 1] - xy[i, 1]) < 110] = 0

    # --- roses, letter by letter, in the thickest parts
    for v in vis:
        if v.is_empty:
            continue
        pts = grid_points(v, 1.5)
        if len(pts) == 0:
            continue
        d = shapely.distance(v.boundary, pts)
        xy = shapely.get_coordinates(pts)
        n = max(1, int(round(v.area / 950)))
        ok = np.ones(len(pts), bool)
        for (x, y, c) in bflies:
            ok &= np.hypot(xy[:, 0] - x, xy[:, 1] - y) > c + 7
        for _ in range(n):
            for (x, y, R) in roses:
                ok &= np.hypot(xy[:, 0] - x, xy[:, 1] - y) > (R + 11) * 0.95
            if not ok.any():
                break
            score = np.where(ok, d * rng.uniform(0.75, 1.0, len(d)), -1)
            i = int(np.argmax(score))
            if d[i] < 3.5:
                break
            R = float(np.clip(d[i] * rng.uniform(1.3, 1.6), 11.0, 19.0))
            roses.append((xy[i, 0], xy[i, 1], R))
    for (x, y, R) in roses:
        motifs.append(rose(R, rng).moved(x, y, rng.uniform(0, 2 * math.pi)))
    rose_feet = unary_union([m.foot for m in motifs if m.z == 2])

    # --- leaves tucked behind each rose, pointing into open space
    for (x, y, R) in roses:
        L = R * rng.uniform(1.0, 1.25)
        Wd = L * rng.uniform(0.42, 0.5)
        _, _, _, up, lo = leaf_shape(L, Wd, 0)
        base_leaf = Polygon(np.vstack([up, lo[::-1]]))
        cands = []
        for a in np.linspace(0, 2 * math.pi, 24, endpoint=False):
            bx, by = x + 0.78 * R * math.cos(a), y + 0.78 * R * math.sin(a)
            shape = place(base_leaf, bx, by, a)
            vis_area = shape.intersection(region).difference(rose_feet).area / shape.area
            crowd = sum(shape.intersection(f).area for f in leaf_feet) / shape.area
            cands.append((vis_area - crowd, a, bx, by))
        cands.sort(reverse=True)
        chosen = []
        for sc, a, bx, by in cands:
            if sc < 0.28 or len(chosen) >= rng.integers(2, 4):
                continue
            if any(abs((a - c + math.pi) % (2 * math.pi) - math.pi) < 1.0 for c in chosen):
                continue
            chosen.append(a)
            style = rng.choice(["veined", "veined", "solid", "outline"])
            m = leaf(L, Wd, style, rng).moved(bx, by, a)
            motifs.append(m)
            leaf_feet.append(m.foot)

    # --- fill remaining open space with small roses, blossoms, berry sprigs and leaf pairs
    covered = unary_union([m.foot if m.foot is not None else m.white for m in motifs])
    pts = grid_points(region, 1.2)
    xy = shapely.get_coordinates(pts)
    for _ in range(400):
        empty = region.difference(covered.buffer(0.6))
        inside = shapely.contains(empty, pts)
        if not inside.any():
            break
        d = np.where(inside, shapely.distance(empty.boundary, pts), 0)
        i = int(np.argmax(d * rng.uniform(0.9, 1.0, len(d))))
        di = d[i]
        x, y = xy[i]
        if di < 3.4:
            break
        ang = rng.uniform(0, 2 * math.pi)
        if di >= 6.5:
            m = rose(di * 1.12, rng).moved(x, y, ang)
        elif di >= 4.5:
            kind = rng.choice(["blossom", "sprig", "leafpair"])
            if kind == "blossom":
                m = blossom(di * 1.08, rng).moved(x, y, ang)
            elif kind == "sprig":
                L = di * 2.1
                m = sprig(L, rng).moved(x - L / 2 * math.cos(ang), y - L / 2 * math.sin(ang), ang)
            else:
                L = di * 1.25
                a = leaf(L, L * 0.45, "veined", rng, stem=0.0).moved(x, y, ang)
                b = leaf(L, L * 0.45, "outline", rng, stem=0.0).moved(x, y, ang + math.pi)
                m = Motif(a.white.union(b.white), a.foot.union(b.foot), 1)
        else:
            if rng.random() < 0.5:
                m = blossom(di * 1.1, rng).moved(x, y, ang)
            else:
                L = di * 2.0
                m = sprig(L, rng).moved(x - L / 2 * math.cos(ang), y - L / 2 * math.sin(ang), ang)
        motifs.append(m)
        covered = covered.union(m.foot if m.foot is not None else m.white.buffer(1.0))

    # painter's algorithm: later motifs hide what is beneath their footprint
    white = Polygon()
    for m in sorted(motifs, key=lambda m: m.z):
        if m.foot is not None:
            white = white.difference(m.foot)
        white = white.union(m.white)
    return white


def connect(white, rng):
    """Bridge any floating islands to the main piece with short curved stems."""
    pieces = sorted(polys(white), key=lambda p: -p.area)
    main, rest = pieces[0], pieces[1:]
    bridges = 0
    while rest:
        dists = [main.distance(p) for p in rest]
        i = int(np.argmin(dists))
        isl = rest.pop(i)
        a, b = nearest_points(isl, main)
        a, b = np.array(a.coords[0]), np.array(b.coords[0])
        v = b - a
        n = np.linalg.norm(v)
        if n > 1e-6:
            u = v / n
            a2, b2 = a - u * 0.6, b + u * 0.6
            ctrl = (a2 + b2) / 2 + np.array([-u[1], u[0]]) * n * rng.uniform(-0.25, 0.25)
            br = line(quad(a2, ctrl, b2, 16)).buffer(P["stroke"] / 2, quad_segs=6)
            bridges += 1
        else:  # touching at a single point: weld it
            br = Point(*a).buffer(P["stroke"])
        main = unary_union([main, isl, br])
        if main.geom_type != "Polygon":
            ps = sorted(polys(main), key=lambda p: -p.area)
            main, rest = ps[0], rest + ps[1:]
    return main, bridges


def clean_holes(sil, white):
    holes = sil.difference(white)
    holes = opening(holes, P["min_hole"] / 2)
    holes = MultiPolygon([p for p in polys(holes) if p.area >= P["min_area"]])
    return sil.difference(holes)


def floral_layer(sil, region, vis, rng):
    motif = compose(region, vis, rng)
    zone = region.buffer(P["tuck"], join_style="mitre").intersection(sil)
    white = sil.difference(zone).union(motif.intersection(zone))
    white = clean_holes(sil, white)
    white, bridges = connect(white, rng)
    white = clean_holes(sil, white)
    return white, bridges


# --------------------------------------------------------------------------- SVG output

def path_d(geom, ox, oy, tol=0.03):
    out = []
    for p in polys(geom.simplify(tol)):
        p = shapely.geometry.polygon.orient(p, 1.0)
        for ring in [p.exterior] + list(p.interiors):
            c = np.asarray(ring.coords)[:-1]
            if len(c) < 3:
                continue
            c = c + [ox, oy]
            out.append("M" + " ".join(f"{x:.2f},{y:.2f}" for x, y in c) + "Z")
    return "".join(out)


def svg_doc(w, h, body, title):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
            f'width="{w:.2f}mm" height="{h:.2f}mm" viewBox="0 0 {w:.2f} {h:.2f}">\n'
            f'<title>{title}</title>\n{body}\n</svg>\n')


def layer_el(lid, label, geom, color, ox, oy):
    return (f'<g id="{lid}" inkscape:groupmode="layer" inkscape:label="{label}">'
            f'<path fill="{color}" fill-rule="evenodd" stroke="none" d="{path_d(geom, ox, oy)}"/></g>')


def build(word, cap, out_dir, seed):
    k = cap / DESIGN_CAP
    for key, v in CUT.items():
        P[key] = v / (k * k if key == "min_area" else k)
    rng = np.random.default_rng(seed)
    font = load_font()
    letters = build_letters(font, word, DESIGN_CAP)
    sil, region, frame, vis = build_regions(letters)
    white, bridges = floral_layer(sil, region, vis, rng)
    sil, white, frame = (affinity.scale(g, k, k, origin=(0, 0)) for g in (sil, white, frame))

    margin = 2.0
    x0, y0, x1, y1 = sil.bounds
    ox, oy = margin - x0, margin - y0
    W, H = x1 - x0 + 2 * margin, y1 - y0 + 2 * margin
    layers = [("layer1-base", "Layer 1 - base (bottom)", sil, "base"),
              ("layer2-floral", "Layer 2 - floral papercut (middle)", white, "floral"),
              ("layer3-frame", "Layer 3 - frame (top, cut 2-3)", frame, "frame")]
    os.makedirs(out_dir, exist_ok=True)
    files = []
    for lid, label, geom, ck in layers:
        fn = os.path.join(out_dir, f"{word}-{lid}-{COLOR_NAMES[ck]}.svg")
        with open(fn, "w") as fh:
            fh.write(svg_doc(W, H, layer_el(lid, label, geom, COLORS[ck], ox, oy),
                             f"{word} {label}"))
        files.append(fn)
    allfn = os.path.join(out_dir, f"{word}-all-layers.svg")
    with open(allfn, "w") as fh:
        body = "\n".join(layer_el(lid, label, geom, COLORS[ck], ox, oy)
                         for lid, label, geom, ck in layers)
        fh.write(svg_doc(W, H, body, f"{word} layered name - all layers"))
    files.append(allfn)

    # assembled mock-up with soft shadows (for viewing only - not a cut file)
    pad = 6.0
    defs = ('<defs><filter id="sh" x="-5%" y="-20%" width="110%" height="140%">'
            '<feDropShadow dx="0.5" dy="0.7" stdDeviation="0.5" flood-color="#000" flood-opacity="0.55"/>'
            '</filter><filter id="sh2" x="-5%" y="-20%" width="110%" height="140%">'
            '<feDropShadow dx="0.9" dy="1.3" stdDeviation="0.9" flood-color="#000" flood-opacity="0.6"/>'
            '</filter></defs>')
    shp = lambda geom, color, f: (f'<path fill="{color}" fill-rule="evenodd" filter="url(#{f})" '
                                  f'd="{path_d(geom, ox + pad, oy + pad)}"/>')
    body = (defs + '<rect width="100%" height="100%" fill="#b08d68"/>'
            + shp(sil, COLORS["base"], "sh2") + shp(white, COLORS["floral"], "sh")
            + shp(frame, COLORS["frame"], "sh2") + shp(frame, COLORS["frame"], "sh"))
    pvfn = os.path.join(out_dir, f"{word}-preview.svg")
    with open(pvfn, "w") as fh:
        fh.write(svg_doc(W + 2 * pad, H + 2 * pad, body, f"{word} layered name - preview (not for cutting)"))
    files.append(pvfn)

    stats = {
        "size_mm": (round(W, 1), round(H, 1)),
        "size_in": (round(W / 25.4, 2), round(H / 25.4, 2)),
        "pieces": {ck: len(polys(geom)) for _, _, geom, ck in layers},
        "floral_cutouts": sum(len(p.interiors) for p in polys(white)),
        "bridges": bridges,
    }
    return files, stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="+")
    ap.add_argument("--cap", type=float, default=75.0, help="letter height in mm (default 75)")
    ap.add_argument("--out", default=HERE)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    for nm in a.names:
        nm = nm.upper()
        files, stats = build(nm, a.cap, os.path.join(a.out, nm), a.seed)
        print(nm, stats)
        for f in files:
            print("  ", os.path.relpath(f))
