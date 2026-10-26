"""Pilot helmet layered plaque: components in reference-image pixel space.

Painter's model: components are painted back-to-front; each sets the surface
height (layer number) inside its shape. A `gap` carves a thin ring around the
component down one level so same-height neighbours get a dark separation line.
"""
from shapely.geometry import box, MultiLineString, LineString
from shapely.ops import unary_union
from geom import *

BOTTOM = 712          # px: flat bottom edge that stands on the base
NL = 6                # plaque layers (1 = backer)

ops = []      # (kind, geom, level, gap)
scores = []   # (geom, level)  vector score lines
fills = []    # (geom, level)  filled raster-engrave areas
labels = {}   # name -> (geom, level) for the assembly guide


def paint(g, level, gap=0, name=None):
    ops.append(('set', g, level, gap))
    if name:
        labels[name] = (g, level)


def carve(g, level):
    ops.append(('carve', g, level, 0))


def score(g, level):
    scores.append((g, level))


def fill(g, level):
    fills.append((g, level))


def stitch(pts, level, dash=6, gap=4):
    score(dashed(path(pts), dash, gap), level)


# ---------------------------------------------------------------- torso / flight vest
torso = poly([(97, BOTTOM, 'c'), (96, 650), (100, 592), (109, 542), (120, 502), (134, 474), (158, 454),
              (192, 446), (240, 468), (300, 516), (360, 556), (404, 596), (414, BOTTOM, 'c')])
paint(torso, 3, name='vest')
score(LineString([(117, 625), (115, 704)]), 3)                  # side seam
stitch([(108, 640), (109, 704)], 3, 5, 4)
score(path([(178, 470), (186, 520), (196, 566)]), 3)            # collar seam

harness = band([(158, 452), (151, 560), (148, BOTTOM + 10)], 25)
paint(harness, 4, gap=3, name='harness')
stitch([(149, 470), (143, 560), (141, 706)], 4)
stitch([(167, 470), (160, 560), (157, 706)], 4)
chest = band([(90, 590), (180, 586), (272, 600)], 18).intersection(torso)
paint(chest, 4, gap=3, name='chest strap')
stitch([(102, 584), (180, 580), (268, 592)], 4, 5, 4)
stitch([(102, 597), (180, 593), (266, 607)], 4, 5, 4)
buckle_v = rrect(151, 590, 36, 28, 4)
paint(buckle_v, 5, gap=2, name='harness buckle')
score(outline(buckle_v, 5), 5)
fill(rrect(151, 590, 18, 7, 2), 5)

for i, p in enumerate([rbox(182, 604, 250, BOTTOM + 10, 7), rbox(258, 630, 322, BOTTOM + 10, 7),
                       rbox(330, 642, 380, BOTTOM + 10, 7)]):
    paint(p, 4, gap=3, name=f'pouch {i + 1}')
    x0, y0, x1, y1 = p.bounds
    flap = rbox(x0 + 4, y0 + 4, x1 - 4, y0 + 30, 5)
    score(flap.boundary, 4)
    fill(rrect((x0 + x1) / 2, y0 + 30, 12, 6, 2), 4)
    score(dashed(LineString([(x0 + 7, y0 + 40), (x0 + 7, BOTTOM - 4)]), 5, 4), 4)
    score(dashed(LineString([(x1 - 7, y0 + 40), (x1 - 7, BOTTOM - 4)]), 5, 4), 4)

# ---------------------------------------------------------------- helmet dome
dome = poly([(150, 335), (157, 252), (180, 180), (215, 122), (262, 76), (322, 44), (392, 30), (458, 36),
             (518, 56), (562, 90), (590, 135), (603, 195), (606, 280), (590, 380), (540, 500), (460, 575),
             (390, 600), (332, 592), (276, 568), (226, 532), (187, 484), (162, 414)])
paint(dome, 3, gap=5, name='helmet shell')
score(outline(dome, 12), 3)                                     # rim line
# back-liner panel lines
score(path([(206, 112), (216, 170), (224, 232), (234, 292), (244, 350)]), 3)
score(path([(236, 92), (246, 150), (254, 212), (262, 272), (272, 330)]), 3)
liner_pad = poly([(254, 168), (276, 160), (286, 230), (292, 300), (270, 306), (262, 236)])
score(liner_pad.boundary, 3)
# top vents / clips
for (cx, cy, w, h, a) in [(286, 74, 18, 40, -30), (352, 58, 34, 15, -18), (438, 44, 32, 13, 4)]:
    v = rrect(cx, cy, w, h, 6, a)
    score(v.boundary, 3)
    fill(v.buffer(-4), 3)
# lower ear-shell seams
score(path([(196, 470), (236, 512), (290, 548), (334, 566)]), 3)
score(path([(188, 408), (196, 452)]), 3)

# ---------------------------------------------------------------- face / visor opening (recess)
face = poly([(338, 400), (352, 258), (420, 246), (600, 240), (628, 330), (622, 450), (600, 560),
             (540, 640), (452, 652), (382, 624), (338, 584)])
carve(face, 2)

# ---------------------------------------------------------------- visor housing (front shell)
housing = poly([(298, 112), (318, 90), (350, 76), (395, 69), (448, 66), (502, 71), (546, 89), (578, 121),
                (595, 165), (600, 250, 'c'), (470, 252), (386, 252), (370, 264), (367, 300),
                (369, 396, 'c'), (339, 398, 'c'), (332, 350), (319, 290), (302, 228), (293, 165)])
paint(housing, 4, gap=4, name='visor housing')
score(path([(322, 106), (372, 92), (432, 86), (480, 88)]), 4)    # visor track
score(path([(318, 120), (325, 180), (338, 240), (349, 300), (353, 370)]), 4)
for (x, y) in [(318, 166), (334, 236), (345, 312), (351, 368), (400, 112), (452, 108)]:
    fill(circle(x, y, 5.5), 4)

# ---------------------------------------------------------------- ear cup + straps
upper_strap = band([(130, 334), (198, 349), (268, 367), (334, 388)], 27)
paint(upper_strap, 4, gap=3, name='side strap')
stitch([(158, 330), (200, 340), (268, 357), (330, 377)], 4)
stitch([(152, 351), (196, 360), (264, 378), (326, 398)], 4)
strap_buckle = rbox(114, 309, 152, 365, 6)
paint(strap_buckle, 5, gap=3, name='strap buckle')
score(outline(strap_buckle, 5), 5)
fill(rbox(127, 322, 139, 352, 3), 5)

ear = circle(292, 432, 38)
paint(ear, 4, gap=3, name='ear cup')
fill(ear.buffer(-6).difference(ear.buffer(-10)), 4)
ear_cap = circle(292, 432, 27)
paint(ear_cap, 5, gap=0, name='ear cap')
score(hatch(circle(292, 432, 22), 45, 14, 7), 5)
score(hatch(circle(292, 432, 22), -45, 14, 7), 5)
fill(circle(292, 432, 3.5), 5)

chin = band([(296, 478), (343, 516), (390, 566), (424, 606)], 30)
paint(chin, 4, gap=3, name='chin strap')
stitch([(305, 470), (352, 508), (398, 556)], 4)
stitch([(287, 488), (334, 526), (380, 576)], 4)
mask_strap = band([(334, 452), (376, 461), (420, 470)], 22)
paint(mask_strap, 4, gap=3, name='mask strap')
stitch([(340, 446), (376, 452), (414, 460)], 4)

# ---------------------------------------------------------------- NVG body (behind tubes + mount)
nvg_body = poly([(436, 272), (500, 262), (560, 259), (604, 262), (642, 278), (692, 277), (714, 296),
                 (718, 324), (713, 352), (692, 368), (640, 368), (602, 356), (576, 370), (540, 393),
                 (482, 402), (446, 392), (432, 350), (430, 300)])
paint(nvg_body, 4, gap=4, name='NVG housing')

eyecup = unary_union([ellipse(452, 328, 12, 50), rbox(452, 278, 484, 378)])
paint(eyecup, 5, gap=3, name='eyecup')
score(ellipse(452, 328, 7, 40).boundary, 5)
score(arc(470, 328, 8, 50, -90, 90), 5)
tubeA = unary_union([rbox(496, 262, 598, 348, 4), ellipse(496, 305, 10, 43)])
paint(tubeA, 5, gap=3, name='NVG tube L')
for x in (520, 532, 552):
    score(arc(x, 305, 9, 43, -90, 90), 5)
fill(arc(526, 305, 9, 43, -80, 80).buffer(1.6), 5)
tubeB = unary_union([rbox(646, 280, 703, 364, 4), ellipse(646, 322, 9, 42)])
paint(tubeB, 5, gap=3, name='NVG tube R')
score(arc(664, 322, 8, 42, -90, 90), 5)
fill(arc(670, 322, 8, 42, -80, 80).buffer(1.6), 5)

# ---------------------------------------------------------------- hose
hose_c = path([(582, 548), (594, 592), (594, 638), (578, 670), (536, 684), (486, 684), (446, 680), (424, 676)])
hose = hose_c.buffer(28, cap_style=1, join_style=1)
paint(hose, 4, gap=3, name='O2 hose')
fill(ribs(hose_c, 56, 8, margin=4, start=26, end=hose_c.length - 30).buffer(1.1, cap_style=1), 4)
fitting = rbox(404, 646, 440, BOTTOM + 10, 6)
paint(fitting, 5, gap=2, name='hose fitting')
score(LineString([(410, 664), (434, 664)]), 5)
score(LineString([(410, 694), (434, 694)]), 5)
fill(rrect(422, 679, 14, 6, 2), 5)

# ---------------------------------------------------------------- oxygen mask
mask = poly([(484, 404), (520, 395), (554, 402), (580, 428), (598, 466), (607, 516), (600, 564),
             (580, 602), (548, 630), (502, 642), (458, 636), (424, 614), (402, 580), (396, 540),
             (404, 500), (424, 462), (452, 428)])
paint(mask, 4, gap=4, name='mask seal')
mask_shell = mask.buffer(-9, join_style=1)
paint(mask_shell, 5, gap=0, name='mask shell')
score(outline(mask_shell, 7), 5)
score(path([(560, 470), (584, 500), (590, 540)]), 5)             # cheek seams
score(path([(420, 522), (430, 576), (450, 604)]), 5)
nose = poly([(528, 414), (547, 430), (557, 458), (554, 484), (531, 497), (507, 490), (500, 460), (510, 432)])
paint(nose, 6, gap=0, name='nose plate')
score(outline(nose, 5), 6)
valve = circle(478, 552, 40)
paint(valve, 6, gap=0, name='mic / valve')
score(circle(478, 552, 32).boundary, 6)
score(circle(474, 548, 16).boundary, 6)
for (x, y, r) in [(474, 548, 6), (499, 540, 3.5), (500, 566, 3.5), (470, 579, 3.5), (452, 534, 3.5)]:
    fill(circle(x, y, r), 6)
dbuckle = rbox(426, 444, 468, 502, 8)
paint(dbuckle, 6, gap=0, name='mask buckle')
fill(rbox(436, 455, 444, 491, 2), 6)
fill(poly([(450, 455, 'c'), (456, 455), (461, 465), (461, 481), (456, 491), (450, 491, 'c')]), 6)

# ---------------------------------------------------------------- NVG mount
shroud = poly([(462, 100), (490, 84), (530, 88), (566, 108), (590, 138), (594, 168), (578, 186),
               (530, 192), (482, 192), (458, 176), (451, 140)])
paint(shroud, 5, gap=3, name='mount shroud')
score(outline(shroud, 6), 5)
fill(rbox(500, 118, 548, 150, 7), 5)                            # receiver opening
for (x, y) in [(478, 110), (566, 126), (470, 168)]:
    fill(circle(x, y, 5), 5)
bracket = poly([(482, 254, 'c'), (600, 252), (634, 250), (668, 254), (678, 266), (676, 284, 'c'),
                (650, 286), (604, 276), (482, 274, 'c')])
paint(bracket, 5, gap=3, name='mount bracket')
score(LineString([(492, 264), (600, 263), (662, 268)]), 5)
fill(circle(648, 270, 5), 5)
mount = poly([(506, 162, 'c'), (566, 160, 'c'), (580, 172), (584, 246, 'c'), (500, 246, 'c'), (498, 204)])
arm = poly([(570, 188, 'c'), (640, 186), (662, 197), (674, 214), (670, 230), (656, 227), (642, 213),
            (570, 214, 'c')])
paint(unary_union([mount, arm]), 6, gap=0, name='mount + tilt arm')
score(outline(mount, 6).intersection(box(0, 0, 578, 999)), 6)
score(path([(586, 201), (642, 200), (660, 214)]), 6)
fill(circle(522, 184, 5), 6)
fill(circle(560, 226, 5), 6)
fill(rbox(512, 200, 548, 208, 3), 6)
knob = circle(466, 240, 16)
paint(knob, 6, gap=0, name='mount knob')
score(circle(466, 240, 10).boundary, 6)
fill(circle(466, 240, 4), 6)

# ---------------------------------------------------------------- NVG objective lenses (top)
objA = ellipse(598, 304, 25, 44)
paint(objA, 6, gap=0, name='lens L')
fill(ellipse(595, 304, 19, 37).difference(ellipse(592, 305, 13, 29)), 6)
score(ellipse(592, 305, 13, 29).boundary, 6)
score(arc(594, 290, 6, 12, 180, 270), 6)
objB = ellipse(704, 322, 24, 42)
paint(objB, 6, gap=0, name='lens R')
fill(ellipse(701, 322, 18, 35).difference(ellipse(698, 322, 12, 27)), 6)
score(ellipse(698, 322, 12, 27).boundary, 6)
score(arc(700, 308, 5, 11, 180, 270), 6)
