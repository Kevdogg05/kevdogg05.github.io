"""AFE retirement plaque - "Last to Let You Down".

A parachute canopy (alternating basswood / hickory gores) whose suspension lines run down behind the
HGU-55/P helmet + MBU-20/P mask (reused from ../../hgu55-mbu20-plaque/src), above a retirement nameplate.
Materials: gloss black acrylic (backer, trim, mask rubber, hardware caps), gold mirror acrylic (visor),
3 mm hickory and 3 mm basswood.  Five 3 mm levels.

    python3 afe_plaque.py --svg ../afe_retirement_plaque.svg [--report report.json]
"""
import os
import sys
import json
import argparse
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
from shapely import affinity
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'hgu55-mbu20-plaque', 'src'))
import plaque                                                           # noqa: E402
from plaque import bez, stroke, circ, buf, smooth, polys, chamfer_rect, fillet   # noqa: E402
from fitcurve import ring_to_segments, segments_to_d, polyline_to_d     # noqa: E402
from export import merge_lines                                         # noqa: E402

SCALE = 0.88               # finished ~230 x 397 mm (9.1 x 15.6 in)
REVEAL = 4.0
GAP = 3.2                  # panel gaps before SCALE (2.8 mm finished)
FONTS = '/usr/share/fonts/truetype/liberation/'

MATERIALS = {               # id -> (label, preview colour)
    'black_acrylic':       ('3 mm gloss black acrylic (opaque)', '#202124'),
    'gold_mirror_acrylic': ('3 mm gold mirror acrylic', '#d4a72c'),
    'hickory':             ('3 mm hickory', '#b98a5a'),
    'basswood':            ('3 mm basswood', '#ead7b5'),
}
LAYERS = [
    ('L1', 'layer1_backer',  'Layer 1 - Backer (black acrylic, engraved nameplate)'),
    ('L2', 'layer2_main',    'Layer 2 - Canopy + lines, helmet shell, visor, mask rubber, nameplate frame'),
    ('L3', 'layer3_accents', 'Layer 3 - Hickory gores, motto band, apex vent, visor housing, mask hard shell'),
    ('L4', 'layer4_details', 'Layer 4 - Visor knob, friction screws, valve, bayonet straps, connectors'),
    ('L5', 'layer5_caps',    'Layer 5 - Black acrylic caps'),
]

NAMEPLATE = dict(x0=-112, x1=112, y0=240, y1=314, band=7.0, ch=12.0)
MOTTO = 'LAST TO LET YOU DOWN'
NAME_LINES = [   # (text, font, cap height mm before SCALE, tracking em, gap after)
    ('MSGT JORDAN A. DOE', 'LiberationSerif-Bold.ttf', 9.6, 0.06, 5.2),
    ('AIRCREW FLIGHT EQUIPMENT', 'LiberationSans-Bold.ttf', 5.0, 0.22, 4.6),
    ('IN RECOGNITION OF 20 YEARS OF DEDICATED SERVICE', 'LiberationSans-Regular.ttf', 3.6, 0.10, 3.2),
    ('UNITED STATES AIR FORCE  ·  2006 – 2026', 'LiberationSans-Regular.ttf', 3.6, 0.10, 0),
]


# ------------------------------------------------------------------ text -> outlines
class _FlatPen(BasePen):
    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.rings, self.cur = [], []

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        self.cur.extend(bez(self.cur[-1], p1, p2, p3)[1:].tolist())

    def _qCurveToOne(self, p1, p2):
        p0 = np.array(self.cur[-1]); p1 = np.array(p1); p2 = np.array(p2)
        t = np.linspace(0, 1, 10)[1:, None]
        self.cur.extend(((1-t)**2*p0 + 2*(1-t)*t*p1 + t**2*p2).tolist())

    def _closePath(self):
        if len(self.cur) > 2:
            self.rings.append(self.cur)
        self.cur = []

    _endPath = _closePath


_FONT_CACHE = {}


def glyph_run(text, font, cap, tracking=0.0):
    """list of (glyph polygon at baseline origin, advance), units mm, y down."""
    if font not in _FONT_CACHE:
        _FONT_CACHE[font] = TTFont(FONTS + font)
    f = _FONT_CACHE[font]
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    s = cap / f['OS/2'].sCapHeight
    out = []
    for ch in text:
        name = cmap.get(ord(ch), '.notdef')
        pen = _FlatPen(gs)
        gs[name].draw(pen)
        g = Polygon()
        for r in pen.rings:
            g = g.symmetric_difference(Polygon(r).buffer(0))
        g = affinity.scale(g, s, -s, origin=(0, 0))
        out.append((g, gs[name].width*s + tracking*cap/0.7))
    if out:
        out[-1] = (out[-1][0], out[-1][1] - tracking*cap/0.7)
    return out


def text_line(text, font, cap, tracking, cx, baseline):
    run = glyph_run(text, font, cap, tracking)
    width = sum(a for _, a in run)
    x, geoms = cx - width/2, []
    for g, adv in run:
        geoms.append(affinity.translate(g, x, baseline))
        x += adv
    return unary_union(geoms), width


def text_on_path(text, font, cap, tracking, path):
    """centre the text along `path` (Nx2), glyphs upright to the local tangent, centred on the path."""
    run = glyph_run(text, font, cap, tracking)
    width = sum(a for _, a in run)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.r_[0, np.cumsum(seg)]
    pos, geoms = (s[-1] - width) / 2, []
    for g, adv in run:
        sc = pos + adv/2
        k = min(max(int(np.searchsorted(s, sc)), 1), len(path)-1)
        a = (sc - s[k-1]) / max(seg[k-1], 1e-9)
        pt = path[k-1] + a*(path[k] - path[k-1])
        ang = np.degrees(np.arctan2(*(path[k] - path[k-1])[::-1]))
        gg = affinity.translate(g, -adv/2, cap/2)
        gg = affinity.rotate(gg, ang, origin=(0, 0))
        geoms.append(affinity.translate(gg, pt[0], pt[1]))
        pos += adv
    return unary_union(geoms)


# ------------------------------------------------------------------ canopy
Y_APEX, Z_SKIRT, KDIP = -134.0, 104.0, 0.05
SEAMS = np.radians([-90, -64.286, -38.571, -12.857, 12.857, 38.571, 64.286, 90])   # 7 visible gores
ATTACH = SEAMS                                       # scallops run between seams
LINE_SEAMS = SEAMS[1:-1]                             # suspension lines hang from the 6 interior seams
HICKORY_GORES = (1, 3, 5)                            # gore index (between SEAMS[i] and SEAMS[i+1])
PROFILE = np.vstack([bez((0, 0), (55, 0), (112, 20), (120, 62)),
                     bez((120, 62), (123, 84), (116, 98), (108, 104))[1:]])   # (rho, z) apex -> skirt
RHO_S = PROFILE[-1, 0]


def proj(rho, z, phi):
    """canopy surface point -> plaque coords (front view, skirt curving down slightly toward the viewer)."""
    return rho*np.sin(phi), Y_APEX + z + KDIP*rho*np.cos(phi)*(z/Z_SKIRT)**2


def skirt_y(phi, scallop=3.0):
    y = Y_APEX + Z_SKIRT + KDIP*RHO_S*np.cos(phi)
    i = np.clip(np.searchsorted(ATTACH, phi) - 1, 0, len(ATTACH)-2)
    f = (phi - ATTACH[i]) / (ATTACH[i+1] - ATTACH[i])
    inner = (i > 0) & (i < len(ATTACH) - 2)          # outer gores meet the silhouette without a scallop
    return y - scallop*np.sin(np.pi*np.clip(f, 0, 1))*inner


def meridian(phi):
    x, y = proj(PROFILE[:, 0], PROFILE[:, 1], phi)
    return np.c_[x, y]


def canopy_outline():
    right = meridian(np.pi/2)
    ph = np.linspace(np.pi/2, -np.pi/2, 361)
    skirt = np.c_[RHO_S*np.sin(ph), skirt_y(ph)]
    left = meridian(-np.pi/2)[::-1]
    return Polygon(np.vstack([right, skirt[1:-1], left[:-1]])).buffer(0)


def gore(phi_a, phi_b):
    ph = np.linspace(phi_a, phi_b, 120)
    bottom = np.c_[RHO_S*np.sin(ph), skirt_y(ph)]
    return Polygon(np.vstack([meridian(phi_a), bottom[1:-1], meridian(phi_b)[::-1][:-1]])).buffer(0)


def below_curve(fx, xs=np.linspace(-150, 150, 301), bottom=400.0):
    ys = np.array([fx(x) for x in xs])
    return Polygon(np.vstack([np.c_[xs, ys], [(xs[-1], bottom), (xs[0], bottom)]])).buffer(0)


def skirt_base(x):
    """skirt line without scallops, as a function of x."""
    return Y_APEX + Z_SKIRT + KDIP*RHO_S*np.cos(np.arcsin(np.clip(x/RHO_S, -1, 1)))


def band_top(x):
    return skirt_base(x) - 19.5


def band_bottom(x):
    return skirt_base(x) - 4.6          # clears the scallop peaks; the scalloped hem shows below the band


def clean_split(mats, order=('gold_mirror_acrylic', 'black_acrylic', 'basswood', 'hickory')):
    """tidy a layer split into materials: every part gets the same 0.8 mm corner rounding as the rest of
    the design, thin wedges where the split cut through a fillet are removed, fragments under 10 mm2
    join the neighbour they share most edge with, and parts never overlap (earlier in `order` wins)."""
    mats = {m: smooth(g, 0.8) for m, g in mats.items()}
    taken = None
    for m in order:                                    # resolve overlaps from the corner closing
        if m in mats:
            if taken is not None:
                mats[m] = mats[m].difference(taken)
            taken = mats[m] if taken is None else unary_union([taken, mats[m]])
    for m in list(mats):                               # drop wedges (> 0.6 mm2, thinner than 3.6 mm)
        g = mats[m]
        others = unary_union([h for n, h in mats.items() if n != m])
        bits = [q for q in polys(g.difference(buf(buf(g, -1.8), 1.8)))
                if q.area > 0.6 and q.boundary.intersection(buf(others, 0.05)).length > 0.3]
        if bits:
            mats[m] = g.difference(unary_union(bits))
    for m in list(mats):                               # small fragments -> neighbour
        for q in polys(mats[m]):
            if q.area >= 10.0:
                continue
            share = {n: q.boundary.intersection(buf(h, 0.05)).length for n, h in mats.items() if n != m}
            best = max(share, key=share.get) if share else None
            mats[m] = mats[m].difference(q)
            if best and share[best] > 0.3:
                mats[best] = unary_union([mats[best], q])
    out, taken = {}, None
    for m in [m for m in order if m in mats] + [m for m in mats if m not in order]:
        g = shapely.set_precision(buf(buf(mats[m], -0.01), 0.01), 0.001)
        out[m] = g if taken is None else g.difference(taken)
        taken = out[m] if taken is None else unary_union([taken, out[m]])
    return {m: out[m] for m in mats}


# ------------------------------------------------------------------ build
def line_to(start, target, keepout, width=5.0):
    """suspension line from start toward target, stopped (round end) just clear of keepout."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if stroke([start, start + mid*(target - start)], width).intersects(keepout):
            hi = mid
        else:
            lo = mid
    return stroke([start, start + lo*(target - start)], width)


def build():
    saved_gap = plaque.P['gap']
    plaque.P['gap'] = GAP
    try:
        H = plaque.build(NP=NAMEPLATE)
    finally:
        plaque.P['gap'] = saved_gap
    parts = H['parts']

    # ---- canopy (L2 basswood) with the suspension lines hanging from its skirt (one part)
    canopy = canopy_outline()
    target = np.array([0.0, 75.0])                     # lines converge behind the helmet dome
    keepout = buf(H['L2'], GAP + 0.05)
    starts = [np.array([RHO_S*np.sin(ph)*0.985, skirt_y(ph) - 6.0]) for ph in LINE_SEAMS]
    lines = unary_union([line_to(p, target, keepout) for p in starts])
    junctions = unary_union([circ(p[0], p[1] + 6.0, 9) for p in starts])
    canopy_l2 = smooth(fillet(unary_union([canopy, lines]), 2.5, junctions), 0.6)

    # ---- L3 on the canopy: hickory gore overlays, black motto band, black apex vent ring
    band = canopy.buffer(-1.5).intersection(below_curve(band_top)).difference(below_curve(band_bottom))
    band = buf(buf(band, -2.2), 2.2)                   # rounded, never knife-edged, ends
    vent_c = (0.0, Y_APEX + 14.0)
    vent = circ(*vent_c, 9.0).difference(circ(*vent_c, 3.5))
    gore_keep = canopy.difference(below_curve(lambda x: band_top(x) - GAP)).difference(buf(vent, GAP))
    overlays = []
    for i in HICKORY_GORES:
        g = buf(gore(SEAMS[i], SEAMS[i+1]), -1.6).intersection(gore_keep)
        g = buf(buf(g, -2.6), 2.6)                      # tapers off where the gore gets too thin
        overlays += [q for q in polys(g) if q.area > 40]
    overlays = unary_union(overlays)

    # ---- helmet L2 split by material
    L2h = H['L2']
    # hickory docks take the hose / mic cord from a cut square to each, ~3 mm above the dock, so the
    # dock fillets stay whole and both sides of the joint get square corners
    hose_c = np.vstack([[(0, 200)], bez((0, 208), (0, 227), (18, 225), (18, 244))])
    k = int(np.argmin(np.abs(hose_c[:, 1] - 228.5)))
    t = hose_c[k+1] - hose_c[k-1]; t /= np.linalg.norm(t); nn = np.array([-t[1], t[0]])
    p = hose_c[k]
    hose_cut = Polygon([p + 30*nn, p + 30*nn + 40*t, p - 30*nn + 40*t, p - 30*nn])
    cord_cut = Polygon([(-34, 231.0), (-14, 231.0), (-14, 250), (-34, 250)])
    frame_zone = unary_union([buf(unary_union([parts['frame'], parts['dock_l2'], parts['cdock_l2']]), 0.6),
                              hose_cut, cord_cut])
    below_helmet = Polygon([(-200, 190), (200, 190), (200, 400), (-200, 400)])
    # strap bridge: black from the mask out to a cut square to the strap, short of the helmet leg
    d = np.array([20.5, -3.5]); d /= np.linalg.norm(d); n = np.array([-d[1], d[0]])
    c = np.array([61.5, 151.8])
    half = Polygon([c + 40*n, c + 40*n - 120*d, c - 40*n - 120*d, c - 40*n])
    strap_side = unary_union([half, affinity.scale(half, -1, 1, origin=(0, 0))])
    black_zone = unary_union([buf(parts['facepiece'], GAP - 0.3),                  # stays inside the gap ring
                              buf(parts['strap_l2'], 2.0).intersection(strap_side),
                              below_helmet]).difference(frame_zone)
    black_l2 = L2h.intersection(black_zone)                 # mask rubber, strap bridges, hose, mic cord
    gold_l2 = L2h.intersection(parts['lens_zone']).difference(black_zone)          # visor lens
    hickory_l2 = L2h.difference(black_l2).difference(gold_l2)                      # shell + nameplate frame

    layers = {
        'L2': clean_split({'basswood': canopy_l2, 'hickory': hickory_l2, 'black_acrylic': black_l2,
                              'gold_mirror_acrylic': gold_l2}),
        'L3': {'hickory': overlays, 'basswood': H['L3'], 'black_acrylic': unary_union([band, vent])},
        'L4': {'hickory': H['L4']},
        'L5': {'black_acrylic': H['L5']},
    }
    L2all = unary_union(list(layers['L2'].values()))
    fan = unary_union(polys(lines)).convex_hull
    np_ = NAMEPLATE
    tablet = chamfer_rect(np_['x0']-REVEAL, np_['y0']-REVEAL, np_['x1']+REVEAL, np_['y1']+REVEAL,
                          np_['ch']+REVEAL*0.414, 2.5+REVEAL)
    L1 = smooth(unary_union([buf(L2all, REVEAL), buf(fan, REVEAL), tablet]), 2.0)
    L1 = unary_union([Polygon(q.exterior) for q in polys(L1)])
    layers['L1'] = {'black_acrylic': L1}

    # ---- engraving: name block on the black backer, motto on the black band (both frost white)
    fb = H['frame_in'].bounds
    cx = (fb[0]+fb[2])/2
    block = sum(cap + after for _, _, cap, _, after in NAME_LINES)
    y = (fb[1]+fb[3])/2 - block/2
    name_geo = []
    for txt, font, cap, trk, after in NAME_LINES:
        y += cap
        g, w = text_line(txt, font, cap, trk, cx, y)
        assert w < (fb[2]-fb[0]) - 10, f'nameplate line too wide: {txt} ({w:.0f} mm)'
        name_geo.append(g)
        y += after
    name_geo = unary_union(name_geo)
    assert H['frame_in'].buffer(-3.0).contains(name_geo), 'nameplate text outside the window'
    xs = np.linspace(-112, 112, 200)
    mid = np.c_[xs, [(band_top(x) + band_bottom(x))/2 for x in xs]]
    motto = text_on_path(MOTTO, 'LiberationSans-Bold.ttf', 6.6, 0.30, mid)
    assert band.buffer(-1.5).contains(motto), 'motto does not fit the band'
    engrave = {'L1': name_geo, 'L3': motto}

    # ---- optional scores: gore seams converging on the apex (where no hickory gore borders them)
    seam_vis = canopy_l2.difference(buf(overlays, 2.0)).difference(buf(band, 1.0)).difference(buf(vent, 1.5))
    seam_lines = unary_union([LineString(meridian(ph)) for ph in SEAMS[1:-1]]).intersection(buf(seam_vis, -0.8))
    score = {'L2': H['score']['L2'] + [seam_lines], 'L3': H['score']['L3']}
    return dict(layers=layers, engrave=engrave, score=score, frame_in=H['frame_in'],
                band=band, nameplate=NAMEPLATE)


def scaled(D, s=SCALE):
    sc = lambda g: affinity.scale(g, s, s, origin=(0, 0))     # noqa: E731
    out = dict(D)
    out['layers'] = {L: {m: sc(g) for m, g in mats.items()} for L, mats in D['layers'].items()}
    out['engrave'] = {L: sc(g) for L, g in D['engrave'].items()}
    out['score'] = {L: [sc(g) for g in gs] for L, gs in D['score'].items()}
    out['frame_in'] = sc(D['frame_in'])
    return out


# ------------------------------------------------------------------ checks
def layer_union(D, L):
    return unary_union(list(D['layers'][L].values()))


def check(D):
    rep = {}
    names = ['L1', 'L2', 'L3', 'L4', 'L5']
    for i, L in enumerate(names):
        u = layer_union(D, L)
        r = {'parts': {m: len(polys(g)) for m, g in D['layers'][L].items()}}
        thin = []
        for m, g in D['layers'][L].items():          # per material: each part must stand on its own
            op = buf(buf(g, -1.75), 1.75)
            thin += [(m, round(q.centroid.x, 1), round(q.centroid.y, 1), round(q.area, 2))
                     for q in polys(g.difference(op)) if q.area > 0.6]
        r['thin_<3.5mm'] = thin
        cl = buf(buf(u, 1.3), -1.3)
        r['gaps_<2.6mm'] = [(round(q.centroid.x, 1), round(q.centroid.y, 1), round(q.area, 2))
                            for q in polys(cl.difference(u)) if q.area > 0.6]
        mats = list(D['layers'][L].values())
        r['material_overlap_mm2'] = round(sum(q.area for a in range(len(mats)) for b in range(a+1, len(mats))
                                              for q in polys(mats[a].intersection(mats[b])) if q.area > 0.05), 3)
        if i:   # ignore zero-width snapping slivers along shared material edges
            over = [q for q in polys(u.difference(layer_union(D, names[i-1]))) if q.area > 0.05]
            r['unsupported_mm2'] = round(sum(q.area for q in over), 2)
        rep[L] = r
    minx, miny, maxx, maxy = D['layers']['L1']['black_acrylic'].bounds
    rep['overall_mm'] = (round(maxx-minx, 1), round(maxy-miny, 1))
    rep['overall_in'] = (round((maxx-minx)/25.4, 2), round((maxy-miny)/25.4, 2))
    return rep


# ------------------------------------------------------------------ export
PANEL_W, PANEL_H, PITCH = 260.0, 420.0, 270.0


def path_d(geom, tol=0.04):
    ds = []
    for p in polys(geom):
        for ring in [p.exterior] + list(p.interiors):
            ds.append(segments_to_d(ring_to_segments(np.asarray(ring.coords), err=tol)))
    return ''.join(ds)


def export_svg(D):
    minx, miny, maxx, maxy = D['layers']['L1']['black_acrylic'].bounds
    W, H = maxx-minx, maxy-miny
    names = [L for L, _, _ in LAYERS]
    total_w = PITCH*(len(LAYERS)-1) + PANEL_W
    o = ['<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
         '<!--\n  AFE retirement plaque - "Last to Let You Down"  (parachute canopy + HGU-55/P helmet + MBU-20/P mask)\n'
         f'  Finished size: {W:.1f} x {H:.1f} mm ({W/25.4:.2f} x {H/25.4:.2f} in), 5 levels x 3 mm = 15 mm relief\n'
         '  Units: 1 user unit = 1 mm. Each layer sits in its own 260 x 420 mm window, windows 270 mm apart along X;\n'
         '  same position inside every window = registration. Inside each layer, parts are grouped by MATERIAL:\n'
         + ''.join(f'    *_{m}_cut  -> {lab}\n' for m, (lab, _) in MATERIALS.items()) +
         '  RED   #FF0000 stroke = cut through\n'
         '  BLUE  #0000FF fill   = engrave (raster). Placeholder text: edit or replace before engraving.\n'
         '  BLACK #000000 stroke = optional score: *_score_detail decorative lines, *_score_align glue guides\n'
         '                         (outline of the part that goes on top, 1.5 mm inside it, so it is hidden)\n'
         '  Peel acrylic masking only after cutting/engraving; engrave the black acrylic for frosted white text.\n-->',
         f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
         f'version="1.1" width="{total_w:.0f}mm" height="{PANEL_H:.0f}mm" viewBox="0 0 {total_w:.0f} {PANEL_H:.0f}">',
         '  <title>AFE retirement plaque - laser cut layers by material</title>']
    for i, (L, gid, label) in enumerate(LAYERS):
        ox = i*PITCH + PANEL_W/2 - (minx+maxx)/2
        oy = PANEL_H/2 - (miny+maxy)/2
        T = lambda g: affinity.translate(g, ox, oy)       # noqa: E731
        o.append(f'  <g id="{gid}" inkscape:groupmode="layer" inkscape:label="{label}">')
        for m, g in D['layers'][L].items():
            if g.is_empty:
                continue
            o.append(f'    <g id="{gid}_{m}_cut" fill="none" stroke="#FF0000" stroke-width="0.1">')
            for j, p in enumerate(sorted(polys(T(g)), key=lambda q: -q.area)):
                o.append(f'      <path id="{gid}_{m}_{j+1:02d}" d="{path_d(p)}"/>')
            o.append('    </g>')
        if L in D['engrave']:
            o.append(f'    <g id="{gid}_engrave" fill="#0000FF" stroke="none">')
            o.append(f'      <path d="{path_d(T(D["engrave"][L]), tol=0.02)}"/>')
            o.append('    </g>')
        if D['score'].get(L):
            o.append(f'    <g id="{gid}_score_detail" fill="none" stroke="#000000" stroke-width="0.1">')
            for ln in merge_lines([T(g) for g in D['score'][L]]):
                c = np.asarray(ln.coords)
                d = segments_to_d(ring_to_segments(c, err=0.05)) if ln.is_ring else polyline_to_d(c)
                o.append(f'      <path d="{d}"/>')
            o.append('    </g>')
        if i < len(names) - 1:
            above = layer_union(D, names[i+1])
            ghost = buf(above, -1.5).boundary.intersection(buf(layer_union(D, L), -0.5))
            lines = merge_lines([T(ghost)])
            if lines:
                o.append(f'    <g id="{gid}_score_align" fill="none" stroke="#000000" stroke-width="0.1">')
                for ln in lines:
                    c = np.asarray(ln.coords)
                    d = segments_to_d(ring_to_segments(c, err=0.15)) if ln.is_ring else polyline_to_d(c, err=0.15)
                    o.append(f'      <path d="{d}"/>')
                o.append('    </g>')
        o.append('  </g>')
    o.append('</svg>')
    return '\n'.join(o) + '\n'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--svg')
    ap.add_argument('--report')
    a = ap.parse_args()
    D = scaled(build())
    rep = check(D)
    print(json.dumps(rep, indent=1))
    if a.report:
        open(a.report, 'w').write(json.dumps(rep, indent=1))
    if a.svg:
        s = export_svg(D)
        open(a.svg, 'w').write(s)
        print('wrote', a.svg, len(s), 'bytes')
