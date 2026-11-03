#!/usr/bin/env python3
"""HGU-55/P low-profile battery pack: Velcro placement jigs (STL generator).

Writes printable STL files into ./stl next to this script:

  hgu55-rear-pile-jig-universal.stl   flat, flexible; fits Medium, Large and X-Large
  hgu55-rear-pile-jig-{M,L,XL}.stl    pre-curved to the estimated shell of each size
  hgu55-cord-pile-stencil.stl         window for the two 1 x 1-1/2 in cord tie-down patches
  hgu55-battery-hook-template.stl     centres the 3-3/4 x 2 in hook strip on the battery pack

Every distance that places tape is measured along the helmet surface, the
way a tape measure laid on the shell reads it. The rear jig is drawn flat in
surface coordinates (u across, v up from the edge roll, w out of the shell)
and, for the pre-curved versions, wrapped onto a model of the rear of the
shell, so the window stays 4 in wide and 1-1/2 in above the edge roll on a
curved helmet.

Requirements: Python 3.9+, numpy, manifold3d; matplotlib for the engraved
labels (optional; without it the parts are made without lettering).

  pip install numpy manifold3d matplotlib
  python3 generate.py                              # every part, default sizes
  python3 generate.py --custom 104 150 -8          # one extra jig for a measured helmet

See README.md for how to measure a helmet's curvature.
"""

import argparse
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, FillRule, JoinType, OpType

IN = 25.4

# Tape sizes and placement (inches converted to mm).
PILE_W, PILE_H = 4 * IN, 2 * IN        # pile patch on the back of the helmet
PILE_GAP = 1.5 * IN                    # top of the edge roll to the bottom of the patch
HOOK_W, HOOK_H = 3.75 * IN, 2 * IN     # hook strip on the back of the battery pack
CORD_W, CORD_H = 1.5 * IN, 1 * IN      # cord tie-down pile patches (two)

# Shell model for the pre-curved jigs: a surface of revolution fitted to the
# rear of the shell. rh = horizontal radius at the edge roll, rv = vertical
# (front-to-back profile) radius, lean = tilt of the shell from vertical at the
# edge roll in degrees (negative = shell flares outward going up, i.e. the
# lower back tucks in toward the nape). These are estimates; see README.md.
SIZES = {
    "M": dict(rh=100.0, rv=145.0, lean=-8.0),
    "L": dict(rh=103.0, rv=150.0, lean=-8.0),
    "XL": dict(rh=106.0, rv=155.0, lean=-8.0),
}

# Rear jig layout (mm)
CLEARANCE = 0.75      # per side, so tape cut a hair oversize still drops in
WALL = 2.0            # stencil thickness; thin enough to flex onto the shell
POST_W = 14.0         # posts either side of the window
POST_RISE = 8.0       # posts stand this far above the top of the patch
WING = 12.0           # band extends this far past each post
DATUM_HALF = 45.0     # bottom edge seats on the edge roll only within +/- this
DATUM_RELIEF = 0.1    # then rises this much per mm, clearing an edge roll that sweeps up
RAIL_T, RAIL_H = 1.5, 4.0   # thicker datum rail on the outer face at the bottom edge
ENGRAVE = 0.6         # lettering depth

FONT = dict(family="DejaVu Sans", weight="bold")

HERE = os.path.dirname(os.path.abspath(__file__))


# ----------------------------------------------------------------- 2-D helpers

def rect(x0, y0, x1, y1):
    (x0, x1), (y0, y1) = sorted((x0, x1)), sorted((y0, y1))
    return CrossSection([[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]])


def poly(points):
    return CrossSection([points], FillRule.NonZero)


def circle(x, y, r):
    return CrossSection.circle(r, 48).translate((x, y))


def union(parts):
    return CrossSection.batch_boolean(parts, OpType.Add)


def opening(cs, r):
    """Round convex corners only."""
    return cs.offset(-r, JoinType.Miter).offset(r, JoinType.Round, circular_segments=32)


def closing(cs, r):
    """Fillet concave corners only."""
    return cs.offset(r, JoinType.Round, circular_segments=32).offset(-r, JoinType.Miter)


def text(s, x, y, size, anchor="middle"):
    """Lettering as a CrossSection, centred on (x, y) by its cap height."""
    try:
        from matplotlib.font_manager import FontProperties
        from matplotlib.textpath import TextPath
    except ImportError:
        return CrossSection()
    path = TextPath((0, 0), s, size=size, prop=FontProperties(**FONT))
    polys = [p[:-1] for p in path.to_polygons() if len(p) > 3]
    if not polys:
        return CrossSection()
    cs = CrossSection([[tuple(pt) for pt in p] for p in polys], FillRule.EvenOdd)
    (x0, y0), (x1, y1) = np.array(cs.bounds()).reshape(2, 2)
    cap = size * 0.73
    dx = {"middle": -(x0 + x1) / 2, "start": -x0, "end": -x1}[anchor]
    return cs.translate((x + dx, y - cap / 2))


def engrave(body, marks, top):
    """Cut the 2-D marks ENGRAVE deep into the face at z = top."""
    if marks.is_empty():
        return body
    return body - marks.extrude(ENGRAVE + 1).translate((0, 0, top - ENGRAVE))


# ------------------------------------------------------------- rear pile jig

def rear_jig_outline():
    """Flat outline in surface coordinates: u across (0 = rear centreline),
    v up from the top of the edge roll."""
    win = PILE_W / 2 + CLEARANCE
    half = win + POST_W + WING
    top = PILE_GAP + PILE_H + POST_RISE

    band = rect(-half, 0, half, PILE_GAP)
    posts = union([rect(s * win, PILE_GAP - 1, s * (win + POST_W), top) for s in (-1, 1)])
    # Order matters: fillet the post roots, re-cut the window so its corners
    # stay sharp (the tape's corners sit in them), then round the outside.
    shape = closing(band + posts, 4.0) - rect(-win, PILE_GAP, win, top + 10)
    shape = opening(shape, 2.5)

    # Relief holes so the tape's bottom corners seat fully.
    shape -= union([circle(s * win, PILE_GAP, 1.0) for s in (-1, 1)])
    # Datum: the bottom edge sits on the edge roll near the centreline and
    # rises gently past DATUM_HALF, so an edge roll that sweeps up toward the
    # ears can't hold the jig high.
    far = half + 2
    for s in (-1, 1):
        shape -= poly([(s * DATUM_HALF, -1), (s * far, -1),
                       (s * far, (far - DATUM_HALF) * DATUM_RELIEF), (s * DATUM_HALF, 0)])
    # Sighting notch on the rear centreline.
    shape -= poly([(-2.5, -1), (2.5, -1), (0, 2.5)])
    # Slots for a rubber band or strap around the front of the helmet.
    shape -= union([rect(s * (half - 7), 10, s * (half - 4), 28) for s in (-1, 1)])
    return shape


def rear_jig_marks(size_label):
    win = PILE_W / 2 + CLEARANCE
    marks = [
        rect(-0.5, 4.5, 0.5, PILE_GAP - 7),                        # centreline
        poly([(-2.6, PILE_GAP - 7.5), (2.6, PILE_GAP - 7.5), (0, PILE_GAP - 2)]),
    ]
    # Top-of-patch ticks on the posts (tape is 2 in tall).
    for s in (-1, 1):
        x0, x1 = sorted((s * (win + 0.8), s * (win + 6)))
        marks.append(rect(x0, PILE_GAP + PILE_H - 0.4, x1, PILE_GAP + PILE_H + 0.4))
    cx = 36.0
    marks += [
        text("HGU-55/P", -cx, 27, 6),
        text(size_label, -cx, 15, 6),
        text("PILE 2x4 IN", cx, 27, 6),
        text("1-1/2 IN UP", cx, 15, 6),
    ]
    return union(marks)


def rear_jig_flat(size_label):
    shape = rear_jig_outline()
    body = shape.extrude(WALL)
    # Datum rail: short blocks on the outer face along the seating length,
    # gapped so the band still bends easily around the shell.
    blocks = [rect(x, 0, x + 7, RAIL_H) for x in np.arange(-DATUM_HALF, DATUM_HALF - 6, 9.0)]
    rail = (union(blocks) ^ shape).extrude(RAIL_T).translate((0, 0, WALL))
    body = body + rail
    return engrave(body, rear_jig_marks(size_label), WALL)


def shell_map(rh, rv, lean):
    """(u, v, w) surface coordinates -> 3-D point on/off a surface of revolution.

    Axis is +z through the origin, the rear of the helmet faces -y, the top of
    the edge roll is at z = 0. v is arc length up the profile, u is arc length
    along the horizontal at that height, w is distance out along the normal.
    """
    p0 = math.radians(lean)

    def warp(pts):
        u, v, w = pts[:, 0], pts[:, 1], pts[:, 2]
        phi = p0 + v / rv
        r = rh + rv * (np.cos(phi) - math.cos(p0))
        z = rv * (np.sin(phi) - math.sin(p0))
        th = u / r
        n_r, n_z = np.cos(phi), np.sin(phi)
        x = (r + w * n_r) * np.sin(th)
        y = -(r + w * n_r) * np.cos(th)
        return np.column_stack([x, y, z + w * n_z])

    return warp


def rear_jig_curved(size_label, rh, rv, lean):
    flat = rear_jig_flat(size_label).refine_to_length(1.5)
    part = flat.warp_batch(shell_map(rh, rv, lean))
    # Printed standing on the datum edge: square the bottom off at z = 0 (the
    # inner edge of the datum, where the shell meets the edge roll).
    part = part.trim_by_plane((0, 0, 1), 0.0)
    return part


# --------------------------------------------------------- small flat parts

def window_frame(win_w, win_h, frame, wall, labels, corner_r=3.0):
    """Flat frame with a tape window, centre notches on all four outer edges."""
    ww, wh = win_w / 2 + CLEARANCE, win_h / 2 + CLEARANCE
    ow, oh = ww + frame, wh + frame
    shape = opening(rect(-ow, -oh, ow, oh), corner_r) - rect(-ww, -wh, ww, wh)
    shape -= union([circle(sx * ww, sy * wh, 0.9) for sx in (-1, 1) for sy in (-1, 1)])
    n = 1.6  # centre notches
    shape -= union([
        poly([(-n, -oh - 1), (n, -oh - 1), (0, -oh + n)]),
        poly([(-n, oh + 1), (0, oh - n), (n, oh + 1)]),
        poly([(-ow - 1, -n), (-ow + n, 0), (-ow - 1, n)]),
        poly([(ow + 1, -n), (ow + 1, n), (ow - n, 0)]),
    ])
    body = shape.extrude(wall)
    marks = [text(s, x, y, sz) for s, x, y, sz in labels(ww, wh, ow, oh)]
    # Short centre lines on each bar, for lining up with pencil marks.
    marks += [rect(-0.4, wh + 1, 0.4, oh - n - 0.8), rect(-0.4, -oh + n + 0.8, 0.4, -wh - 1)]
    marks += [rect(ww + 1, -0.4, ow - n - 0.8, 0.4), rect(-ow + n + 0.8, -0.4, -ww - 1, 0.4)]
    return engrave(body, union(marks), wall)


def cord_stencil():
    return window_frame(CORD_W, CORD_H, 8.0, 1.4, lambda ww, wh, ow, oh: [
        ("CORD PILE", -13, -(wh + oh) / 2, 3.2),
        ("1 x 1-1/2", 13, -(wh + oh) / 2, 3.2),
        ("HGU-55/P", -13, (wh + oh) / 2, 3.2),
        ("PILE", 13, (wh + oh) / 2, 3.2),
    ])


def battery_template():
    return window_frame(HOOK_W, HOOK_H, 9.0, 1.6, lambda ww, wh, ow, oh: [
        ("BATT PACK HOOK", -26, -(wh + oh) / 2, 4.2),
        ("3-3/4 x 2 IN", 26, -(wh + oh) / 2, 4.2),
        ("CENTER", -26, (wh + oh) / 2, 4.2),
        ("ON PACK", 26, (wh + oh) / 2, 4.2),
    ])


# ------------------------------------------------------------------- output

def write_stl(part, path):
    if part.status().name != "NoError":
        raise RuntimeError(f"{path}: {part.status()}")
    mesh = part.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
    t = np.asarray(mesh.tri_verts, dtype=np.int64)
    tri = v[t]
    nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    rec = np.zeros(len(t), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["n"], rec["v"] = nrm, tri
    with open(path, "wb") as f:
        name = os.path.basename(path).encode()[:80]
        f.write(name.ljust(80, b" "))
        f.write(struct.pack("<I", len(t)))
        f.write(rec.tobytes())
    (x0, y0, z0), (x1, y1, z1) = np.array(part.bounding_box()).reshape(2, 3)
    print(f"{os.path.relpath(path, HERE):44s} {x1 - x0:6.1f} x {y1 - y0:6.1f} x {z1 - z0:5.1f} mm"
          f"  {part.volume() / 1000:5.1f} cm3  {len(t):6d} tris")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default=os.path.join(HERE, "stl"), help="output folder")
    ap.add_argument("--custom", nargs=3, type=float, metavar=("RH", "RV", "LEAN"),
                    help="also make a pre-curved rear jig for a measured helmet "
                         "(radii in mm, lean in degrees; see README.md)")
    ap.add_argument("--only-custom", action="store_true", help="skip the standard parts")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    out = lambda name: os.path.join(args.out, name)

    if not args.only_custom:
        # Finely meshed so the project page can preview it bent onto a shell.
        write_stl(rear_jig_flat("ALL SIZES").refine_to_length(3.0), out("hgu55-rear-pile-jig-universal.stl"))
        for size, p in SIZES.items():
            write_stl(rear_jig_curved(f"SIZE {size}", **p), out(f"hgu55-rear-pile-jig-{size}.stl"))
        write_stl(cord_stencil(), out("hgu55-cord-pile-stencil.stl"))
        write_stl(battery_template(), out("hgu55-battery-hook-template.stl"))
    if args.custom:
        rh, rv, lean = args.custom
        write_stl(rear_jig_curved("CUSTOM", rh, rv, lean),
                  out(f"hgu55-rear-pile-jig-custom-rh{rh:g}-rv{rv:g}-lean{lean:g}.stl"))


if __name__ == "__main__":
    main()
