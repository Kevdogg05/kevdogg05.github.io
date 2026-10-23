"""Generates level-up-shelf.svg: a flat-pack, pixel-art wall shelf for toys.

Every part is a flat 3 mm plate, so the SVG can be extruded to 3 mm in a
slicer (or cut from 3 mm sheet on a laser) and the parts slot together.

    pip install shapely
    python3 make_shelf.py            # checks the fit, then writes the SVG

Assembled coordinates: x runs along the wall, y is up (0 = top of the shelf)
and z' is the distance out from the front face of the back panel.
"""
from pathlib import Path

from shapely import affinity
from shapely.geometry import Point, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

T = 3.0            # plate thickness = extrude height in the slicer
CLR = 0.4          # total play in every slot (0.2 mm each side)
S = T + CLR        # slot width
TAB = T - 0.2      # tab length, so tabs never poke out of the far side
P = 6.0            # big pixel
Q = 3.0            # small pixel, for the icons

W = 180.0          # shelf width
D = 72.0           # shelf depth
XB = (40.0, 140.0) # centre lines of the two brackets
RAIL_Z = D - 9.0   # back face of the grass rail
BR = 7             # bracket size in big pixels (42 x 42 mm)
ISLAND_ROWS = 8    # back panel depth below the shelf, in big pixels

SHELF_TABS = [(10.0, 30.0), (52.0, 72.0), (80.0, 100.0), (108.0, 128.0), (150.0, 170.0)]
RAIL_TABS = [(14.0, 34.0), (54.0, 74.0), (106.0, 126.0), (146.0, 166.0)]
BR_TOP_TAB = (0.0, 20.0)        # along z'
BR_BACK_TAB = (-27.0, -9.0)     # along y
KEYHOLES = [(18.0, 12.0), (162.0, 12.0)]

# Scenery above the shelf, 30 x 15 big pixels; the bottom row sits on the shelf.
BACKDROP = [
    "..............................",
    "..............................",
    "#.#.#.#.......................",  # castle battlements
    "#######.......................",
    "#######.......................",
    "#######...##########..........",  # the hill with three hearts
    "#######..############.........",
    "#######.##############........",
    "#######.##############..######",  # block under the goal flag
    "#######################.######",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
]

PENNANT = [
    ".......###",
    ".....#####",
    "...#######",
    ".#########",
    ".#########",
    "...#######",
    ".....#####",
    ".......###",
]

BALL = [
    ".##.",
    "####",
    "####",
    ".##.",
]

HEART = [
    ".##.##.",
    "#######",
    "#######",
    ".#####.",
    "..###..",
    "...#...",
]

WINDOW = [
    "..##..",
    ".####.",
    "######",
    "######",
    "######",
    "######",
]

COIN = [
    ".##.",
    "####",
    "####",
    "####",
    "####",
    ".##.",
]

# Bush heights along the top of the rail, in small pixels above a 12 mm base.
GRASS = "01222100122221001210012222210012221001210012222100122210"


def mask(rows, px, x0=0.0, y0=0.0):
    """ASCII art to a polygon. Rows are listed top to bottom; y points up."""
    cells = []
    for i, row in enumerate(rows):
        r = len(rows) - 1 - i
        for c, ch in enumerate(row):
            if ch == "#":
                cells.append(box(x0 + c * px, y0 + r * px, x0 + (c + 1) * px, y0 + (r + 1) * px))
    return unary_union(cells)


def keyhole(x, y):
    """Head goes in the round hole, then the shelf drops 10 mm onto the screw."""
    return unary_union([
        Point(x, y).buffer(5.0, 12),
        box(x - 2.25, y, x + 2.25, y + 10.0),
        Point(x, y + 10.0).buffer(2.25, 12),
    ])


def back_panel():
    scenery = unary_union([
        mask(BACKDROP, P),
        box(159.0, 42.0, 165.0, 78.0),      # flag pole
        mask(BALL, Q, 156.0, 78.0),
        mask(PENNANT, Q, 129.0, 52.0),
    ])
    # floating-island underside, stepping in one pixel per row
    island = [box(max(0, k - 3) * P, -k * P, W - max(0, k - 3) * P, -(k - 1) * P)
              for k in range(1, ISLAND_ROWS + 1)]
    holes = [box(a - CLR / 2, -T - CLR / 2, b + CLR / 2, CLR / 2) for a, b in SHELF_TABS]
    holes += [box(x - S / 2, BR_BACK_TAB[0] - CLR / 2, x + S / 2, BR_BACK_TAB[1] + CLR / 2) for x in XB]
    holes += [keyhole(x, y) for x, y in KEYHOLES]
    holes += [mask(HEART, Q, cx - 10.5, 30.0) for cx in (66.0, 90.0, 114.0)]
    holes += [mask(COIN, Q, cx - 6.0, -33.0) for cx in (66.0, 90.0, 114.0)]
    holes.append(mask(WINDOW, Q, 12.0, 48.0))
    return unary_union([scenery] + island).difference(unary_union(holes))


def shelf():
    corners = unary_union([box(0, D - P, P, D), box(W - P, D - P, W, D)])
    plate = box(0, 0, W, D).difference(corners)
    tabs = [box(a, -TAB, b, 0) for a, b in SHELF_TABS]
    # notches open at the back, so the shelf slides in over the bracket tabs
    holes = [box(x - S / 2, -1.0, x + S / 2, BR_TOP_TAB[1] + CLR / 2) for x in XB]
    holes += [box(a - CLR / 2, RAIL_Z - CLR / 2, b + CLR / 2, RAIL_Z + T + CLR / 2) for a, b in RAIL_TABS]
    return unary_union([plate] + tabs).difference(unary_union(holes))


def rail():
    base = box(P, 0, W - P, 12.0)
    bushes = [box(P + i * Q, 12.0, P + (i + 1) * Q, 12.0 + int(h) * Q) for i, h in enumerate(GRASS) if h != "0"]
    tabs = [box(a, -TAB, b, 0) for a, b in RAIL_TABS]
    return unary_union([base] + bushes + tabs)


def bracket():
    """Pixel staircase under the shelf, drawn in (z', y)."""
    steps = [box(0, -T - (i + 1) * P, (BR - i) * P, -T - i * P) for i in range(BR)]
    top_tab = box(BR_TOP_TAB[0], -T, BR_TOP_TAB[1], -T + TAB)
    back_tab = box(-TAB, BR_BACK_TAB[0], 0, BR_BACK_TAB[1])
    return unary_union(steps + [top_tab, back_tab])


def check_fit(panel, plate, grass, stairs):
    """Every tab must land in a hole, and every part must be one solid piece."""
    clash = []
    for a, b in SHELF_TABS:
        clash.append(panel.intersection(box(a, -T, b, 0)))
    slot_band = box(0, BR_BACK_TAB[0] - CLR / 2, W, BR_BACK_TAB[1] + CLR / 2)
    for x in XB:
        clash.append(panel.intersection(box(x - T / 2, BR_BACK_TAB[0], x + T / 2, BR_BACK_TAB[1])))
        # the shelf slides back over the bracket's top tab: its path must be clear
        clash.append(plate.intersection(box(x - T / 2, -TAB - 1, x + T / 2, BR_TOP_TAB[1])))
        # the bracket's back edge must press on the panel all the way down
        edge = box(x - T / 2, -T - BR * P, x + T / 2, -T)
        assert edge.difference(slot_band).difference(panel).area < 1e-9, "bracket hangs past the panel"
    for a, b in RAIL_TABS:
        clash.append(plate.intersection(box(a, RAIL_Z, b, RAIL_Z + T)))
    assert all(c.area < 1e-9 for c in clash), "a tab hits solid material"
    for part in (panel, plate, grass, stairs):
        assert part.geom_type == "Polygon" and part.is_valid, "part split into pieces"


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def path_data(geom):
    # outer edge one way round, holes the other, so holes stay holes under
    # either SVG fill rule
    geom = orient(geom.simplify(0.001), sign=1.0)
    d = []
    for ring in [geom.exterior, *geom.interiors]:
        pts = [f"{fmt(x)},{fmt(y)}" for x, y in ring.coords[:-1]]
        d.append(f"M{pts[0]}L{' '.join(pts[1:])}Z")
    return "".join(d)


def place(geom, x, y, flip=True):
    """Move a part so the top-left of its bounding box sits at (x, y) on the sheet."""
    if flip:
        geom = affinity.scale(geom, 1, -1, origin=(0, 0))
    minx, miny = geom.bounds[:2]
    return affinity.translate(geom, x - minx, y - miny)


def main():
    panel, plate, grass, stairs = back_panel(), shelf(), rail(), bracket()
    check_fit(panel, plate, grass, stairs)

    margin, gap = 3.0, 4.0
    sheet = [("back-panel", "#4da3ff", place(panel, margin, margin))]
    below = sheet[0][2].bounds[3] + gap
    right = sheet[0][2].bounds[2] + gap
    sheet.append(("bracket-left", "#ff5c8a", place(stairs, right, margin)))
    sheet.append(("bracket-right", "#ff5c8a", place(stairs, right, sheet[-1][2].bounds[3] + gap)))
    sheet.append(("shelf", "#ffab40", place(plate, margin, below, flip=False)))
    sheet.append(("grass-rail", "#4cc552", place(grass, margin + P, sheet[-1][2].bounds[3] + gap)))

    shapes = [g for _, _, g in sheet]
    for i, a in enumerate(shapes):
        for b in shapes[i + 1:]:
            assert a.distance(b) >= gap - 1e-6, "parts too close on the sheet"
    width = fmt(max(g.bounds[2] for g in shapes) + margin)
    height = fmt(max(g.bounds[3] for g in shapes) + margin)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}mm" height="{height}mm" viewBox="0 0 {width} {height}">',
        "  <title>Level-Up Toy Shelf: 5 flat parts, extrude to 3 mm</title>",
        "  <desc>Pixel-art wall shelf. Import into a slicer, set the depth (height) to exactly 3 mm, "
        "split to objects and print flat with no supports. Or laser-cut from 3 mm sheet. "
        f"Slots are {fmt(S)} mm wide for 3 mm parts. Built by make_shelf.py.</desc>",
    ]
    for name, color, geom in sheet:
        lines.append(f'  <path id="{name}" fill="{color}" fill-rule="evenodd" d="{path_data(geom)}"/>')
    lines.append("</svg>")
    out = Path(__file__).with_name("level-up-shelf.svg")
    out.write_text("\n".join(lines) + "\n")

    area = sum(g.area for g in shapes)
    edge = sum(g.exterior.length + sum(r.length for r in g.interiors) for g in shapes)
    # 2 walls of 0.45 mm, 1.6 mm of top + bottom skin, 15 % infill in between
    walls = edge * 0.9
    volume = walls * T + (area - walls) * (1.6 + (T - 1.6) * 0.15)
    print(f"wrote {out.name}: {width} x {height} mm sheet")
    print(f"parts cover {area / 100:.0f} cm2, about {volume / 1000 * 1.24:.0f} g of PLA")


if __name__ == "__main__":
    main()
