"""HGU-55/P helmet + MBU-20/P mask stacked plaque — parametric geometry, checks, SVG export."""
import json
import numpy as np
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

QS = 32
RES = 0.25

def buf(g, r, **kw):
    return g.buffer(r, quad_segs=QS, **kw)

def bez(p0, p1, p2, p3):
    p0, p1, p2, p3 = map(lambda p: np.array(p, float), (p0, p1, p2, p3))
    L = np.linalg.norm(p1-p0)+np.linalg.norm(p2-p1)+np.linalg.norm(p3-p2)
    n = max(8, int(L/RES))
    t = np.linspace(0, 1, n+1)[:, None]
    return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3

class Pen:
    def __init__(self, start):
        self.pts = [np.array(start, float)]
    def C(self, c1, c2, p):
        self.pts.extend(bez(self.pts[-1], c1, c2, p)[1:]); return self
    def L(self, p):
        self.pts.append(np.array(p, float)); return self
    def arr(self):
        return np.array(self.pts)

def mirrored(half):
    """half: points from the axis (x=0) down the right side back to the axis."""
    half = np.asarray(half, float)
    left = half[::-1].copy(); left[:, 0] *= -1
    return Polygon(np.vstack([half, left[1:-1]])).buffer(0)

def mirror(g):
    return unary_union([g, affinity.scale(g, -1, 1, origin=(0, 0))])

def stroke(pts, w, cap='round'):
    return LineString(pts).buffer(w/2, quad_segs=QS, cap_style=cap, join_style='round')

def rrect(cx, cy, w, h, r):
    return box(cx-w/2+r, cy-h/2+r, cx+w/2-r, cy+h/2-r).buffer(r, quad_segs=QS)

def circ(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=QS*2)

def chamfer_rect(x0, y0, x1, y1, c, r=2.0):
    p = Polygon([(x0+c, y0), (x1-c, y0), (x1, y0+c), (x1, y1-c), (x1-c, y1),
                 (x0+c, y1), (x0, y1-c), (x0, y0+c)])
    return buf(buf(p, -r), r)

def smooth(g, r):
    """round concave then convex corners by r (cosmetic, keeps >2r features)."""
    if r <= 0:
        return g
    g = buf(buf(g, r), -r)
    return buf(buf(g, -r), r)

def polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon) and p.area > 1e-6]

# ------------------------------------------------------------------ design
P = dict(
    reveal=4.0,      # base-layer shadow-line around everything
    gap=3.0,         # panel gaps (lens edge / mask) showing the base
)

def fillet(g, r, region):
    """local closing: fill concave wedges sharper than radius r, only inside `region`."""
    closed = buf(buf(g, r), -r)
    return unary_union([g, closed.intersection(region)])

def portion(curve, s0, s1):
    seg = np.linalg.norm(np.diff(curve, axis=0), axis=1); s = np.r_[0, np.cumsum(seg)]
    if s0 < 0:
        s0 = s[-1] + s0
    if s1 < 0:
        s1 = s[-1] + s1
    return curve[(s >= s0) & (s <= s1)]

def build():
    G = {}
    gap = P['gap']
    # ---------------- HGU-55/P shell (front view) ----------------
    p = Pen((0, 0))
    p.C((56, 0), (100, 43), (100, 97))          # dome
    p.C((100, 124), (99, 150), (96, 168))       # side / earcup
    p.C((94, 179), (88, 185), (80, 185))        # leg bottom (edge roll)
    p.C((73, 185), (67, 182), (65, 177))
    p.L((0, 177))
    helmet_full = mirrored(p.arr())

    # leg inner (face-opening) edge, extended down
    pin = Pen((77, 96)).L((74, 112)).C((69, 135), (64, 158), (65, 177)).L((65, 260)).arr()
    lft = pin[::-1].copy(); lft[:, 0] *= -1
    inner_region = Polygon(np.vstack([pin, lft])).buffer(0)
    # edge-roll path: inner edge below the strap, round the leg bottom to the outer corner
    roll = Pen((66.2, 160)).C((65.2, 168), (64.6, 174), (65, 177))
    roll.C((67, 182), (73, 185), (80, 185)).C((88, 185), (94, 179), (96, 168))
    roll_path = roll.arr()

    # ---------------- visor housing (L3) ----------------
    h = Pen((0, 38))
    h.C((40, 38), (80, 50), (95, 81))           # crown edge sweeping to the temple
    h.C((99.2, 91), (99.2, 104), (94, 112.5))   # pivot lobe
    h.C((90, 118), (82.5, 118), (79.5, 111.5))
    h.C((70, 94), (40, 77.5), (0, 77))          # brow edge
    housing = mirrored(h.arr())
    brow = Pen((79.5, 111.5)).C((70, 94), (40, 77.5), (0, 77)).arr()

    # visor lens lower edge (gull-wing: nose notch, cheeks, rising to the pivots)
    lens = Pen((0, 126))
    lens.C((12, 126), (27, 138), (45, 138.5))
    lens.C((57, 139), (66, 135), (72, 130))
    lens.C((80, 124), (87, 117), (90.5, 108))
    lens.C((92.3, 103), (92.4, 98), (91, 93))
    lens_r = lens.arr()
    lens_l = lens_r[::-1].copy(); lens_l[:, 0] *= -1
    below_lens = Polygon(np.vstack([lens_l[:-1], lens_r,
                                    [(140, 93), (140, 320), (-140, 320), (-140, 93)]])).buffer(0)
    cheek = below_lens.intersection(inner_region)

    # lens-over-leg shadow slot; stops where its round end just tucks under the housing lobe
    i0 = int(np.argmin(np.abs(lens_r[:, 0] - 20.0)))   # whole lens edge: one continuous visible curve
    inside = buf(housing, -gap/2)
    i1 = next(i for i in range(i0, len(lens_r)) if inside.contains(Point(*lens_r[i])))
    slots = mirror(stroke(lens_r[i0:i1+1], gap))

    # ---------------- MBU-20/P mask ----------------
    m = Pen((0, 107))
    m.C((6, 107), (11, 109), (14.5, 113))        # nose bridge
    m.C((23, 123), (36, 139), (42.5, 150))       # flank, flaring to the cheek corner
    m.C((45.5, 155.5), (46, 162), (44.5, 169))   # cheek corner (bayonet attach)
    m.C((42, 183), (35, 197), (24, 205.5))       # jaw
    m.C((15, 211.5), (7, 212.5), (0, 212.5))     # chin
    facepiece = mirrored(m.arr())

    # rigid hard shell: inset from the silicone facepiece, rubber shows more at the nose bridge
    hs = buf(facepiece, -4.6)
    nose_cut = buf(Polygon([(-60, 0), (60, 0), (60, 112), (0, 117.5), (-60, 112)]), 0)
    hard_shell = smooth(hs.difference(nose_cut), 2.5)

    # bayonet strap path (offset / dog-leg), mask pivot -> receiver
    strap_path = [(33.5, 158.5), (49, 157), (57.5, 152.5), (78, 149)]
    strap_l2 = mirror(stroke(strap_path, 13))
    strap_l3 = mirror(stroke(strap_path, 9.5))
    strap_l4 = mirror(stroke(strap_path, 5.0))
    rc = (80.5, 149)
    receiver = mirror(affinity.rotate(rrect(*rc, 14, 25, 3.5), -6, origin=rc))
    bayonet = mirror(affinity.rotate(rrect(*rc, 8.5, 14, 2.2), -6, origin=rc))
    pivot = mirror(circ(33.5, 158.5, 4.6))

    knob_track = stroke([(0, 47), (0, 59)], 4.5)
    housing_l3 = housing.difference(knob_track)
    knob = rrect(0, 68, 18, 11, 3.5)
    knob_cap = rrect(0, 68, 10.5, 5, 2.0)
    friction = mirror(circ(90.5, 100, 4.4))

    # ---------------- valve / hose / cord ----------------
    vc = (0, 182)
    valve = circ(*vc, 16.5)
    arcs = []
    for a0 in (45, 135, 225, 315):
        th = np.radians(np.linspace(a0-23, a0+23, 40))
        arcs.append(stroke(np.c_[vc[0]+10.6*np.cos(th), vc[1]+10.6*np.sin(th)], 3.0))
    valve_cap = circ(*vc, 6.6)

    hx, hy = 18.0, 244.0                                   # hose terminal on the nameplate
    hose_c = np.vstack([[(0, 200)], bez((0, 208), (0, 227), (hx, 225), (hx, hy))])
    hose_l2 = stroke(hose_c, 24, cap='flat')
    hose_l3 = stroke(hose_c, 19, cap='flat')
    seg = np.linalg.norm(np.diff(hose_c, axis=0), axis=1); s = np.r_[0, np.cumsum(seg)]
    cuff_l3 = rrect(0, 205.5, 24, 12, 3)
    term_body = rrect(hx, 239.5, 30, 11, 3)
    # corrugation: score lines across the hose every 3.2 mm (black, optional)
    ribs = []
    for sv in np.arange(1.6, s[-1], 3.2):
        k = int(np.searchsorted(s, sv)); k = min(max(k, 1), len(hose_c)-2)
        c = hose_c[k]; t = hose_c[k+1]-hose_c[k-1]; t /= np.linalg.norm(t)
        nrm = np.array([-t[1], t[0]])
        ribs.append(LineString([c - nrm*8.0, c + nrm*8.0]))
    collar = rrect(0, 206, 20, 8.5, 2.5)
    neck = rrect(0, 199, 12, 8, 2)
    valve_l4 = unary_union([valve, neck, collar]).difference(unary_union(arcs))

    # mic cord: leaves its grommet on the hard shell and drops to its own plug on the nameplate
    cord_c = bez((-22, 192.5), (-23.5, 214), (-20.5, 226), (-24, 244))
    cord_l2 = stroke(cord_c, 4.5)
    cord_grommet = circ(-22, 192.5, 4.2)

    # ---------------- nameplate (engraving zone on the base) ----------------
    NP = dict(x0=-100, x1=100, y0=240, y1=288, band=6.0, ch=10.0)
    frame_out = chamfer_rect(NP['x0'], NP['y0'], NP['x1'], NP['y1'], NP['ch'], 2.5)
    frame_in = chamfer_rect(NP['x0']+NP['band'], NP['y0']+NP['band'], NP['x1']-NP['band'],
                            NP['y1']-NP['band'], NP['ch']-NP['band']*0.414, 1.5)
    frame = frame_out.difference(frame_in)
    dock_l2 = rrect(hx, 238.5, 38, 14, 4)
    term_l3 = term_body
    term_l4 = rrect(hx, 239.5, 21, 6.5, 2.2)
    term_l5 = circ(hx, 239.5, 2.6)
    cdock_l2 = rrect(-24, 239.5, 12, 11, 3.5)
    cplug_l3 = rrect(-24, 240.5, 8.5, 7, 2.2)

    # comm-lead entry / strain relief at the left earcup
    comm_l3 = stroke([(-83, 170), (-83, 177)], 10.5)
    comm_l4 = circ(-83, 170.5, 3.2)

    # ---------------- assemble layers ----------------
    helmet_l2 = helmet_full.difference(cheek).difference(slots).difference(buf(facepiece, gap))
    L2 = unary_union([helmet_l2, facepiece, strap_l2, hose_l2, cord_l2, frame, dock_l2, cdock_l2])
    L2 = fillet(L2, 2.0, unary_union([circ(18, 208, 7), circ(-15, 210, 6), circ(21, 232, 5), circ(13, 205, 5)]))
    L2 = smooth(L2, 0.8)

    L3 = unary_union([housing_l3, hard_shell, strap_l3, receiver, cuff_l3, hose_l3, term_l3, comm_l3,
                      cplug_l3])
    L3 = smooth(L3, 0.6)

    L4 = unary_union([knob, friction, valve_l4, strap_l4, bayonet, pivot,
                      cord_grommet, term_l4, comm_l4])
    L4 = smooth(L4, 0.5)

    L5 = unary_union([knob_cap, valve_cap, term_l5])

    tablet = chamfer_rect(NP['x0']-P['reveal'], NP['y0']-P['reveal'], NP['x1']+P['reveal'],
                          NP['y1']+P['reveal'], NP['ch']+P['reveal']*0.414, 2.5+P['reveal'])
    L1 = unary_union([buf(L2, P['reveal']), tablet])
    L1 = smooth(L1, 2.0)
    L1 = unary_union([Polygon(q.exterior) for q in polys(L1)])   # solid: no holes

    # ---------------- optional score details (black) ----------------
    vis2 = L2.difference(buf(L3, 1.0))
    roll_line = mirror(LineString(roll_path).offset_curve(-3.5)).intersection(buf(vis2, -1.0))
    lip = LineString(np.vstack([brow, (brow[::-1] * [-1, 1])[1:]]))   # right lobe -> left lobe
    lip_line = lip.offset_curve(3.5)
    vis3 = L3.difference(buf(L4, 1.5))
    lip_line = lip_line.intersection(buf(vis3, -1.2))

    rim_line = buf(hard_shell, -3.2).boundary.intersection(buf(vis3, -1.0))
    rivets = [circ(sx*84, sy, 1.4).boundary for sx in (-1, 1) for sy in (NP['y0']+3, NP['y1']-3)]
    rivet_line = unary_union(rivets).intersection(buf(L2.difference(buf(L3, 1.0)), -0.5))
    rib_zone = hose_l3.difference(buf(unary_union([cuff_l3, term_body]), 2.5))
    rib_line = unary_union(ribs).intersection(buf(rib_zone, -1.5)).intersection(buf(vis3, -1.0))
    G.update(L1=L1, L2=L2, L3=L3, L4=L4, L5=L5, frame_in=frame_in, housing=housing,
             NP=NP, score={'L2': [roll_line, rivet_line], 'L3': [lip_line, rib_line, rim_line]})
    return G

# ------------------------------------------------------------------ checks
def check(G):
    rep = {}
    names = ['L1', 'L2', 'L3', 'L4', 'L5']
    for i, n in enumerate(names):
        g = G[n]
        ps = polys(g)
        r = {'pieces': len(ps), 'holes': sum(len(p.interiors) for p in ps),
             'area_mm2': round(g.area, 1), 'smallest_piece_mm2': round(min(p.area for p in ps), 1)}
        # thin features: material lost by opening with r=1.75 (=> features < 3.5 mm)
        op = buf(buf(g, -1.75), 1.75)
        thin = [q for q in polys(g.difference(op)) if q.area > 0.6]
        r['thin_<3.5mm'] = [(round(q.centroid.x, 1), round(q.centroid.y, 1), round(q.area, 2)) for q in thin]
        # narrow gaps (slots/space between pieces) < 2.6 mm
        cl = buf(buf(g, 1.3), -1.3)
        narrow = [q for q in polys(cl.difference(g)) if q.area > 0.6]
        r['gaps_<2.6mm'] = [(round(q.centroid.x, 1), round(q.centroid.y, 1), round(q.area, 2)) for q in narrow]
        if i > 0:
            below = G[names[i-1]]
            over = g.difference(below)
            r['overhang_mm2'] = round(over.area, 3)
            # support margin: how much of the piece is within 1 mm of the lower layer's edge
            r['overhang_if_1mm_shift'] = round(g.difference(buf(below, -1.0)).area, 1)
        rep[n] = r
    minx, miny, maxx, maxy = G['L1'].bounds
    rep['overall_mm'] = (round(maxx-minx, 1), round(maxy-miny, 1))
    rep['overall_in'] = (round((maxx-minx)/25.4, 2), round((maxy-miny)/25.4, 2))
    return rep

if __name__ == '__main__':
    G = build()
    print(json.dumps(check(G), indent=1))
