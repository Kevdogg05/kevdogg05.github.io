"""Build plaque layers from design.py, export xTool-ready SVGs and previews."""
import math, os, sys, json
import numpy as np
from shapely.geometry import (Polygon, MultiPolygon, LineString, MultiLineString, GeometryCollection,
                              box, Point)
from shapely.ops import unary_union
from shapely import affinity
from PIL import Image, ImageDraw, ImageFilter

import design as D

S = 0.33                  # mm per reference pixel
BORDER = 3.0 / S          # backer border (px)
MAT = 3.0                 # material thickness mm
OPEN_R = 0.9 / S          # remove features thinner than ~1.8 mm (big layers)
OPEN_R_SMALL = 1.25 / S   # ...and thinner than ~2.5 mm on the small top pieces
HUGE = box(-5000, -5000, 5000, D.BOTTOM)


def polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for p in g.geoms:
            out += polys(p)
        return out
    return []


def lines(g):
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if hasattr(g, 'geoms'):
        out = []
        for p in g.geoms:
            out += lines(p)
        return out
    return []


def drop_small_holes(g, min_area):
    out = []
    for p in polys(g):
        out.append(Polygon(p.exterior, [i for i in p.interiors if Polygon(i).area >= min_area]))
    return unary_union(out)


def drop_small(g, min_area):
    return unary_union([p for p in polys(g) if p.area >= min_area])


def compute_layers():
    G = {n: Polygon() for n in range(1, D.NL + 1)}
    for kind, g, level, gap in D.ops:
        if kind == 'set':
            if gap:
                ring = g.buffer(gap).difference(g)
                for n in range(level, D.NL + 1):
                    G[n] = G[n].difference(ring)
            for n in range(1, D.NL + 1):
                G[n] = G[n].union(g) if n <= level else G[n].difference(g)
        else:
            for n in range(level + 1, D.NL + 1):
                G[n] = G[n].difference(g)
    # L2 = closed silhouette (one solid piece); backer = L2 grown by the border
    L2 = G[2].buffer(10, join_style=1).buffer(-10, join_style=1)
    L2 = Polygon(max(polys(L2), key=lambda p: p.area).exterior)
    L2 = L2.intersection(HUGE)
    # flatten the bottom so the whole stack stands square on the base
    strip = L2.intersection(box(-5000, D.BOTTOM - 40, 5000, D.BOTTOM))
    sx0, _, sx1, _ = strip.bounds
    foot = unary_union([strip, box(sx0 + 4, D.BOTTOM - 2, sx1 - 4, D.BOTTOM)]).convex_hull
    L2 = unary_union([L2, foot.intersection(HUGE)])
    L1 = L2.buffer(BORDER + 6, join_style=1).buffer(-6, join_style=1).intersection(HUGE)
    L1 = Polygon(max(polys(L1), key=lambda p: p.area).exterior)
    G[1], G[2] = L1, L2
    for n in range(3, D.NL + 1):
        g = G[n].intersection(HUGE)
        r = OPEN_R if n <= 3 else OPEN_R_SMALL
        g = g.buffer(-r, join_style=1).buffer(r, join_style=1)
        g = drop_small_holes(g, (2.0 / S) ** 2)
        g = drop_small(g, (3.0 / S) ** 2)
        G[n] = g.intersection(G[n - 1])
    return G


def visible(G):
    V = {}
    for n in range(1, D.NL + 1):
        V[n] = G[n].difference(G[n + 1]) if n < D.NL else G[n]
    return V


def clip_details(G, V):
    sc = {n: [] for n in G}
    fl = {n: [] for n in G}
    for g, n in D.scores:
        region = V[n].buffer(-0.45 / S)
        for l in lines(g.intersection(region)):
            if l.length * S >= 0.8:
                sc[n].append(l)
    for g, n in D.fills:
        region = V[n].buffer(-0.35 / S)
        for p in polys(g.intersection(region)):
            if p.area * S * S >= 0.5:
                fl[n].append(p)
    return sc, fl


if __name__ == '__main__':
    G = compute_layers()
    V = visible(G)
    sc, fl = clip_details(G, V)
    for n in G:
        print(n, 'pieces', len(polys(G[n])), 'bounds mm', [round(v * S, 1) for v in G[n].bounds],
              'scores', len(sc[n]), 'fills', len(fl[n]))
