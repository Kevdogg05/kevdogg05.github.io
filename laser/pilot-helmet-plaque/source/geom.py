"""Geometry helpers: smooth splines, shapes, bands, dashed lines."""
import math
import numpy as np
from shapely.geometry import Polygon, LineString, Point, MultiLineString, box
from shapely.ops import unary_union, substring
from shapely import affinity


def _cr_segment(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n, endpoint=False)[:, None]
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def spline(pts, closed=True, n=14):
    """Catmull-Rom spline through pts. A point given as (x, y, 'c') is a sharp corner."""
    P = [np.array(p[:2], float) for p in pts]
    C = [len(p) > 2 and p[2] == 'c' for p in pts]
    m = len(P)
    out = []
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        i1, i2 = i, (i + 1) % m
        p1, p2 = P[i1], P[i2]
        if C[i1] or (not closed and i1 == 0):
            p0 = 2 * p1 - p2
        else:
            p0 = P[(i1 - 1) % m]
        if C[i2] or (not closed and i2 == m - 1):
            p3 = 2 * p2 - p1
        else:
            p3 = P[(i2 + 1) % m]
        seg_n = max(2, int(n * min(3.0, np.linalg.norm(p2 - p1) / 25.0 + 0.4)))
        out.append(_cr_segment(p0, p1, p2, p3, seg_n))
    arr = np.vstack(out)
    if not closed:
        arr = np.vstack([arr, P[-1]])
    return arr


def poly(pts):
    return Polygon(spline(pts, True)).buffer(0)


def ellipse(cx, cy, rx, ry, angle=0, n=120):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    g = Polygon(np.c_[cx + rx * np.cos(t), cy + ry * np.sin(t)])
    return affinity.rotate(g, angle, origin=(cx, cy)) if angle else g


def circle(cx, cy, r):
    return Point(cx, cy).buffer(r, 64)


def rbox(x0, y0, x1, y1, r=0, angle=0):
    b = box(x0, y0, x1, y1)
    if r:
        b = b.buffer(-r).buffer(r, 16)
    return affinity.rotate(b, angle, origin='centroid') if angle else b


def rrect(cx, cy, w, h, r=0, angle=0):
    return rbox(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, r, angle)


def path(pts, smooth=True):
    return LineString(spline(pts, False) if smooth and len(pts) > 2 else [p[:2] for p in pts])


def band(pts, w, cap='flat', smooth=True):
    cs = {'flat': 2, 'round': 1, 'square': 3}[cap]
    return path(pts, smooth).buffer(w / 2, cap_style=cs, join_style=1)


def arc(cx, cy, rx, ry, a0, a1, angle=0, n=60):
    t = np.radians(np.linspace(a0, a1, n))
    g = LineString(np.c_[cx + rx * np.cos(t), cy + ry * np.sin(t)])
    return affinity.rotate(g, angle, origin=(cx, cy)) if angle else g


def outline(g, inset=0):
    if inset:
        g = g.buffer(-inset, join_style=1)
    return g.boundary


def dashed(line, dash=6, gap=4):
    L = line.length
    segs, s = [], 0.0
    while s < L:
        segs.append(substring(line, s, min(L, s + dash)))
        s += dash + gap
    return MultiLineString([g for g in segs if g.length > 0.5])


def ribs(centerline, width, spacing, margin=3, start=0, end=None):
    """Short lines perpendicular to a centerline (corrugated hose)."""
    L = centerline.length
    end = L if end is None else end
    out = []
    s = start
    while s <= end:
        p = centerline.interpolate(s)
        q = centerline.interpolate(min(L, s + 0.5))
        r = centerline.interpolate(max(0, s - 0.5))
        dx, dy = q.x - r.x, q.y - r.y
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        h = width / 2 - margin
        out.append(LineString([(p.x - nx * h, p.y - ny * h), (p.x + nx * h, p.y + ny * h)]))
        s += spacing
    return MultiLineString(out)


def hatch(region, angle, spacing, offset=0):
    """Parallel lines across a region."""
    minx, miny, maxx, maxy = region.bounds
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    R = math.hypot(maxx - minx, maxy - miny)
    lines = []
    k = -R + offset
    while k <= R:
        lines.append(LineString([(cx - R, cy + k), (cx + R, cy + k)]))
        k += spacing
    ml = affinity.rotate(MultiLineString(lines), angle, origin=(cx, cy))
    return ml.intersection(region)
