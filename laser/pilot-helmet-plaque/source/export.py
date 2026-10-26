"""Export xTool S1 cut files (SVG, mm), previews and the assembly guide."""
import os, sys, math, zipfile, shutil
import numpy as np
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union
from shapely import affinity
from PIL import Image, ImageDraw, ImageFont

import design as D
import build
from build import polys, lines, S
import render

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
MARGIN = 5.0          # mm around the plaque on each layer file
SLOT_CLEAR = 0.15     # mm each side of the 3 mm tab
TAB_H = 8.6           # mm (slot depth is 3 layers = 9 mm)

CUT, SCORE, GUIDE, ENGRAVE = '#FF0000', '#0000FF', '#00E000', '#000000'

LAYER_INFO = {
    1: ('backer', 'Backer / outline', 'Black stain or paint (the outline)'),
    2: ('shadow', 'Shadow layer', 'Dark walnut (shows in the visor opening and every gap)'),
    3: ('shell-and-vest', 'Helmet shell + flight vest', 'Natural or light honey'),
    4: ('housing-straps-mask', 'Visor housing, straps, ear cup, mask seal, NVG housing, hose, pouches',
        'Natural; NVG housing in dark walnut'),
    5: ('nvg-tubes-mask-shell', 'NVG tubes, mount shroud & bracket, mask shell, buckles',
        'Natural; NVG tubes + eyecup in dark walnut/espresso'),
    6: ('lenses-mount-valve', 'Objective lenses, NVG mount + tilt arm, knob, nose plate, valve, mask buckle',
        'Natural (lightest pieces on top)'),
}
DARK_PIECES = {'NVG housing', 'eyecup', 'NVG tube L', 'NVG tube R'}

# ------------------------------------------------------------------ geometry
G = build.compute_layers()

# flat bottom edge of the backer -> tab
edge = G[1].intersection(LineString([(-5000, D.BOTTOM - 0.5), (5000, D.BOTTOM - 0.5)]))
ex0, _, ex1, _ = edge.bounds
edge_c = (ex0 + ex1) / 2 * S                      # mm
edge_w = (ex1 - ex0) * S
TAB_W = round(min(110.0, edge_w - 50), 0)
tab = box((edge_c - TAB_W / 2) / S, D.BOTTOM - 2, (edge_c + TAB_W / 2) / S, D.BOTTOM + TAB_H / S)
G[1] = unary_union([G[1], tab])

V = build.visible(G)
sc, fl = build.clip_details(G, V)
guides = {n: [p.buffer(-0.8 / S, join_style=1).boundary for p in polys(G[n + 1])] if n < D.NL else []
          for n in G}

minx, miny, maxx, maxy = G[1].bounds
OX, OY = minx * S - MARGIN, miny * S - MARGIN   # mm origin shared by every plaque layer
DOC_W = round((maxx - minx) * S + 2 * MARGIN, 2)
DOC_H = round((maxy - miny) * S + 2 * MARGIN, 2)


def to_mm(g):
    return affinity.affine_transform(g, [S, 0, 0, S, -OX, -OY])


# ------------------------------------------------------------------ SVG writer
def ring_d(coords):
    pts = list(coords)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' Z'


def line_d(coords):
    return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in coords)


def svg_doc(w, h, title, cut=(), score=(), guide=(), engrave=()):
    """All geometry in mm. cut/engrave: polygons; score/guide: lines."""
    o = [f'<?xml version="1.0" encoding="UTF-8"?>',
         f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="{w:.2f}mm" height="{h:.2f}mm" '
         f'viewBox="0 0 {w:.2f} {h:.2f}">',
         f'<title>{title}</title>',
         '<!-- RED #FF0000 = CUT | BLUE #0000FF = SCORE | BLACK FILL = ENGRAVE | GREEN #00E000 = optional '
         'placement guide (light score, hidden under the next layer) -->']
    if engrave:
        o.append('<g id="ENGRAVE" fill="#000000" fill-rule="evenodd" stroke="none">')
        for p in engrave:
            d = ' '.join(ring_d(r.coords) for r in [p.exterior] + list(p.interiors))
            o.append(f'<path d="{d}"/>')
        o.append('</g>')
    if score:
        o.append(f'<g id="SCORE" fill="none" stroke="{SCORE}" stroke-width="0.1">')
        for l in score:
            o.append(f'<path d="{line_d(l.coords)}"/>')
        o.append('</g>')
    if guide:
        o.append(f'<g id="GUIDE" fill="none" stroke="{GUIDE}" stroke-width="0.1">')
        for l in guide:
            o.append(f'<path d="{line_d(l.coords)}"/>')
        o.append('</g>')
    if cut:
        o.append(f'<g id="CUT" fill="none" stroke="{CUT}" stroke-width="0.1">')
        # holes first, then small pieces before big ones so nothing shifts mid-job
        for p in sorted(cut, key=lambda p: p.area):
            for r in p.interiors:
                o.append(f'<path d="{ring_d(r.coords)}"/>')
        for p in sorted(cut, key=lambda p: p.area):
            o.append(f'<path d="{ring_d(p.exterior.coords)}"/>')
        o.append('</g>')
    o.append('</svg>')
    return '\n'.join(o) + '\n'


def simp(g, tol_mm=0.02):
    return g.simplify(tol_mm, preserve_topology=True)


def flat_lines(gs):
    out = []
    for g in gs:
        out += lines(g)
    return out


files = []
for n in range(1, D.NL + 1):
    slug, title, _ = LAYER_INFO[n]
    cut = [simp(to_mm(p)) for p in polys(G[n])]
    score = [simp(to_mm(l)) for l in sc[n]]
    eng = [simp(to_mm(p)) for p in fl[n]]
    gd = [simp(to_mm(l)) for l in flat_lines(guides[n])]
    name = f'L{n}_{slug}.svg'
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(svg_doc(DOC_W, DOC_H, f'Pilot helmet plaque - layer {n} of {D.NL}: {title}', cut, score, gd, eng))
    files.append(name)

# ------------------------------------------------------------------ base (mm, viewed from above, FRONT edge at bottom)
STACK = D.NL * 3.0
BLOCK_W = round(edge_w + 6)
BLOCK_D = 48.0
PL1 = (BLOCK_W + 16, BLOCK_D + 16)
PL2 = (BLOCK_W + 8, BLOCK_D + 8)
slot_front = (BLOCK_D - STACK) / 2 + (STACK - 3.0)     # backer sits at the back of the stack
slot_w = TAB_W + 2 * SLOT_CLEAR
slot_h = 3.0 + 2 * SLOT_CLEAR
NAME_W, NAME_H = BLOCK_W - 40, 12.0


def rect_piece(w, h, r, cx, cy):
    return box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2).buffer(-r).buffer(r, 16)


def block_piece(cx, cy, slotted):
    p = rect_piece(BLOCK_W, BLOCK_D, 2, cx, cy)
    if slotted:
        # block front edge = larger y; slot measured from the front
        s = box(cx - slot_w / 2, cy + BLOCK_D / 2 - slot_front - 3.0 - SLOT_CLEAR,
                cx + slot_w / 2, cy + BLOCK_D / 2 - slot_front + SLOT_CLEAR)
        p = p.difference(s)
    return p


GAP = 4.0
SHEET = 300.0


def layout(pieces):
    """pieces: list of (label, w, h, builder(cx, cy) -> (cut polys, scores, guides)). Stacks vertically."""
    y = MARGIN
    cut, sco, gd = [], [], []
    wmax = max(w for _, w, _, _ in pieces)
    for label, w, h, fn in pieces:
        cx, cy = MARGIN + wmax / 2, y + h / 2
        c, s, g = fn(cx, cy)
        cut += c; sco += s; gd += g
        y += h + GAP
    return cut, sco, gd, wmax + 2 * MARGIN, y - GAP + MARGIN


def plinth1(cx, cy):
    p = rect_piece(*PL1, 3, cx, cy)
    g = rect_piece(*PL2, 3, cx, cy).buffer(-0.8).boundary
    return [p], [], [g]


def plinth2(cx, cy):
    p = rect_piece(*PL2, 3, cx, cy)
    g = rect_piece(BLOCK_W, BLOCK_D, 2, cx, cy).buffer(-0.8).boundary
    return [p], [], [g]


def solid(cx, cy):
    return [block_piece(cx, cy, False)], [], []


def slotted(cx, cy):
    return [block_piece(cx, cy, True)], [], []


def top_slotted(cx, cy):
    p = block_piece(cx, cy, True)
    # light guide showing where the front of the plaque stack lands
    fy = cy + BLOCK_D / 2 - (BLOCK_D - STACK) / 2
    g = LineString([(cx - edge_w / 2, fy - 0.8), (cx + edge_w / 2, fy - 0.8)])
    return [p], [], [g]


def nameplate(cx, cy):
    p = rect_piece(NAME_W, NAME_H, 1.5, cx, cy)
    return [p], [p.buffer(-1.6, join_style=1).boundary], []


base_a = [('B1 plinth', PL1[0], PL1[1], plinth1), ('B2 plinth step', PL2[0], PL2[1], plinth2),
          ('B3 block', BLOCK_W, BLOCK_D, solid), ('B4 block', BLOCK_W, BLOCK_D, solid)]
base_b = [('B5 block', BLOCK_W, BLOCK_D, solid), ('B6 block (slot)', BLOCK_W, BLOCK_D, slotted),
          ('B7 block (slot)', BLOCK_W, BLOCK_D, slotted), ('B8 block top (slot)', BLOCK_W, BLOCK_D, top_slotted),
          ('Nameplate', NAME_W, NAME_H, nameplate)]
for name, pcs, title in [('B-A_stand_plinth-and-block.svg', base_a, 'Stand sheet A: B1-B4'),
                         ('B-B_stand_slotted-block-and-nameplate.svg', base_b, 'Stand sheet B: B5-B8 + nameplate')]:
    c, s, g, w, h = layout(pcs)
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(svg_doc(w, h, 'Pilot helmet plaque - ' + title, c, s, g, []))
    files.append(name)
    print(name, round(w, 1), 'x', round(h, 1), 'mm')

print('plaque doc', DOC_W, 'x', DOC_H, 'mm; backer bottom edge', round(edge_w, 1), 'mm; tab', TAB_W,
      '; block', BLOCK_W, 'x', BLOCK_D)

# ------------------------------------------------------------------ previews
PPU = 2.4   # preview pixels per reference px  (~7.3 px/mm)


def base_front_px():
    """Front elevation of the stand, in reference-px space, under the plaque."""
    cxp = edge_c / S
    y0 = D.BOTTOM
    blk = box(cxp - BLOCK_W / 2 / S, y0, cxp + BLOCK_W / 2 / S, y0 + 18 / S)
    p2 = box(cxp - PL2[0] / 2 / S, y0 + 18 / S, cxp + PL2[0] / 2 / S, y0 + 21 / S)
    p1 = box(cxp - PL1[0] / 2 / S, y0 + 21 / S, cxp + PL1[0] / 2 / S, y0 + 24 / S)
    npl = box(cxp - NAME_W / 2 / S, y0 + 3 / S, cxp + NAME_W / 2 / S, y0 + 15 / S)
    return p1, p2, blk, npl


def draw_base(img, tf, ppu):
    d = ImageDraw.Draw(img)
    p1, p2, blk, npl = base_front_px()
    for g, col in [(p1, (78, 50, 30)), (p2, (92, 60, 36)), (blk, (104, 68, 42)), (npl, (120, 82, 50))]:
        pts = [tf(x, y) for x, y in g.exterior.coords]
        d.polygon(pts, fill=col, outline=(45, 28, 16))
    for i in range(1, 6):     # lamination lines on the block face
        y = D.BOTTOM + i * 3 / S
        x0, _, x1, _ = blk.bounds
        a, b = tf(x0, y), tf(x1, y)
        d.line([a, b], fill=(88, 57, 34), width=1)
    x0, y0, x1, y1 = npl.bounds
    d.rectangle([tf(x0 + 1.6 / S, y0 + 1.6 / S), tf(x1 - 1.6 / S, y1 - 1.6 / S)], outline=(70, 44, 26), width=2)


bx0, by0, bx1, by1 = G[1].bounds
pb = base_front_px()[0].bounds
full = (min(bx0, pb[0]) - 10, by0 - 10, max(bx1, pb[2]) + 10, pb[3] + 6)
# hide the tab in the front view (it sits inside the slot)
G_view = dict(G)
G_view[1] = G[1].intersection(box(-5000, -5000, 5000, D.BOTTOM))
def dark_overrides():
    out = {}
    for n in (4, 5):
        dk = [p for p in polys(G[n])
              if [k for k, (g, l) in D.labels.items() if l == n and g.intersection(p).area > 0.2 * g.area
                  and k in DARK_PIECES]]
        out[n] = [(dk, (96, 64, 40) if n == 4 else (112, 76, 48))]
    return out


img = render.render_stack(G_view, sc, fl, full, PPU, pad=30,
                          extra=lambda im, tf: draw_base(im, tf, PPU), overrides=dark_overrides())
img.save(os.path.join(OUT, 'preview_assembled.png'))
plaque_only = render.render_stack(G_view, sc, fl, (bx0 - 10, by0 - 10, bx1 + 10, by1 + 10), PPU, pad=30)

# per-layer flat renders with piece numbers
FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
FONT_R = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'


def piece_names(n, p):
    if n <= 3:
        return [LAYER_INFO[n][1]]
    hits = [(k, l) for k, (g, l) in D.labels.items() if l >= n and g.intersection(p).area > 0.2 * g.area]
    own = [k for k, l in hits if l == n]
    under = [k for k, l in hits if l > n]
    if own:
        return own
    return ['base under ' + ', '.join(under)]


pieces = {}
for n in range(1, D.NL + 1):
    ps = sorted(polys(G[n]), key=lambda p: (round(p.centroid.y / 60), p.centroid.x))
    pieces[n] = [(f'{n}-{i + 1}', p, piece_names(n, p)) for i, p in enumerate(ps)]

VIEW = (bx0 - 10, by0 - 10, bx1 + 10, by1 + 10)


def layer_image(n, ppu, tag_px):
    im = render.render_stack({n: G[n]}, {n: sc[n]}, {n: fl[n]}, VIEW, ppu, pad=16, shadow=False, grain=False,
                             stain={n: render.STAIN[n] if n > 1 else (70, 60, 55)})
    d = ImageDraw.Draw(im)
    tf = lambda x, y: ((x - VIEW[0]) * ppu + 16, (y - VIEW[1]) * ppu + 16)
    if n > 1:   # outline of the layer underneath, for context
        for p in polys(G[n - 1]):
            d.line([tf(x, y) for x, y in p.exterior.coords], fill=(165, 165, 165), width=max(1, int(ppu)))
    if n >= 4 and tag_px:
        f = ImageFont.truetype(FONT, tag_px)
        for pid, p, names in pieces[n]:
            q = p.representative_point()
            x, y = tf(q.x, q.y)
            tw = d.textlength(pid, font=f)
            h = tag_px * 0.62
            d.rounded_rectangle([x - tw / 2 - 6, y - h, x + tw / 2 + 6, y + h], 7, fill=(200, 30, 30))
            d.text((x - tw / 2, y - tag_px * 0.58), pid, font=f, fill='white')
    return im


layer_imgs = {n: layer_image(n, 1.4, 22) for n in range(1, D.NL + 1)}
layer_big = {n: layer_image(n, 2.6, 34) for n in range(4, D.NL + 1)}

# ------------------------------------------------------------------ PDF guide
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
PW, PH = letter
pdf = canvas.Canvas(os.path.join(OUT, 'Assembly_Guide.pdf'), pagesize=letter)
pdf.setTitle('Pilot Helmet Layered Plaque - xTool S1 Assembly Guide')


def wrap(c, text, x, y, width, size=9.5, lead=None, font='DV', indent=0):
    lead = lead or size * 1.38
    c.setFont(font, size)
    line = ''
    first = True
    for wd in text.split(' '):
        trial = (line + ' ' + wd).strip()
        w = width - (0 if first else indent)
        if line and c.stringWidth(trial, font, size) > w:
            c.drawString(x + (0 if first else indent), y, line)
            y -= lead
            line, first = wd, False
        else:
            line = trial
    if line:
        c.drawString(x + (0 if first else indent), y, line)
        y -= lead
    return y


def block(c, x, y, width, items, size=9.5):
    """items: '## heading', '**bold line', or plain paragraphs (wrapped)."""
    for it in items:
        if it.startswith('## '):
            y -= 5
            c.setFont('DVB', size + 2.5)
            c.drawString(x, y, it[3:])
            y -= size * 1.9
        elif it.startswith('**'):
            y = wrap(c, it[2:], x, y, width, size, font='DVB')
        else:
            y = wrap(c, it, x, y, width, size, indent=12 if it[:2].strip().rstrip('.').isdigit() else 0)
    return y


def img_fit(c, im, x, y, w, h):
    iw, ih = im.size
    k = min(w / iw, h / ih)
    c.drawImage(ImageReader(im), x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k)


def header(c, title, sub=None):
    c.setFont('DVB', 17)
    c.drawString(0.6 * inch, PH - 0.75 * inch, title)
    if sub:
        c.setFont('DV', 9.5)
        c.drawString(0.6 * inch, PH - 0.98 * inch, sub)


def footer(c, page):
    c.setFont('DV', 7.5)
    c.setFillGray(0.45)
    c.drawRightString(PW - 0.6 * inch, 0.4 * inch, f'Pilot helmet layered plaque - xTool S1 - page {page}')
    c.setFillGray(0)


total_h = 24 + (by1 - by0) * S
total_w = max((bx1 - bx0) * S, PL1[0])
page = 1

# page 1: overview
header(pdf, 'Pilot Helmet Layered Plaque',
       'xTool S1 cut files  |  6 plaque layers + 8-layer stand  |  3 mm basswood / birch ply')
img_fit(pdf, img, 0.45 * inch, 2.75 * inch, 4.6 * inch, 7.0 * inch)
block(pdf, 5.25 * inch, PH - 1.45 * inch, 2.7 * inch, [
    '## Finished size',
    f'Plaque {(bx1 - bx0) * S:.0f} x {(by1 - by0) * S:.0f} mm, {D.NL * 3} mm thick',
    f'On stand {total_w:.0f} W x {total_h:.0f} H mm (about {total_w / 25.4:.1f} x {total_h / 25.4:.1f} in)',
    f'Stand footprint {PL1[0]:.0f} x {PL1[1]:.0f} mm',
    '## Material',
    '3 mm basswood or birch ply.',
    'Plaque: 6 sheets, 12 x 12 in (each layer file is about 225 x 247 mm).',
    'Stand: 2 sheets, 12 x 12 in.',
    'Wood glue, stain / paint, 220 grit sandpaper, tweezers.',
    '## Colour code in every SVG',
    '**RED  =  Cut',
    '**BLUE  =  Score',
    '**BLACK fill  =  Engrave',
    '**GREEN  =  placement guide (optional)',
    'Green guides sit 0.8 mm inside where the next layer goes, so they end up hidden. '
    'Score them lightly, or delete them if you prefer to align by eye.',
])
block(pdf, 0.6 * inch, 2.45 * inch, PW - 1.2 * inch, [
    '## xTool Creative Space (XCS) workflow',
    '1. Import one SVG at a time. Files are in millimetres at true size - do not rescale the backer or stand, '
    'or the tab and slot will not match. To make it bigger or smaller, scale all six plaque layers by the same '
    'percentage and resize the stand slot to the new tab width.',
    '2. Ungroup, then set the process by colour: red = Cut, blue = Score, black = Engrave (fill), green = Score '
    'at low power (or delete). Start from the XCS material preset for 3 mm basswood and run a small test cut first.',
    '3. All plaque files share the same canvas and origin, so every piece is already in its assembled position.',
    '4. The stand slot is 3.3 mm wide for 3.0 mm stock. Measure your sheet; sand the tab if the fit is tight.',
], size=9)
footer(pdf, page); pdf.showPage(); page += 1

# page 2: stack overview
header(pdf, 'Layer stack (back to front)', 'Glue each layer onto the one before it. Finish suggestions match the reference look.')
cols = 3
cw = (PW - 1.0 * inch) / cols
for i, n in enumerate(range(1, D.NL + 1)):
    r, c = divmod(i, cols)
    x = 0.5 * inch + c * cw
    ytop = PH - 1.15 * inch - r * 4.75 * inch
    img_fit(pdf, layer_imgs[n], x + 4, ytop - 3.15 * inch, cw - 8, 3.1 * inch)
    y = ytop - 3.35 * inch
    pdf.setFont('DVB', 10.5)
    pdf.drawString(x + 6, y, f'L{n}  {LAYER_INFO[n][0]}')
    y = wrap(pdf, LAYER_INFO[n][1], x + 6, y - 13, cw - 16, 7.8)
    y = wrap(pdf, 'Finish: ' + LAYER_INFO[n][2], x + 6, y - 2, cw - 16, 7.8, font='DVB')
pdf.setFont('DV', 8.5)
pdf.drawString(0.6 * inch, 0.6 * inch, 'Grey outline = edge of the layer underneath. Layers 4-6 have numbered piece maps on the next pages.')
footer(pdf, page); pdf.showPage(); page += 1

# pages: piece maps for the multi-piece layers
for n in range(4, D.NL + 1):
    header(pdf, f'Layer {n} pieces  ({len(pieces[n])} pieces)', LAYER_INFO[n][1])
    img_fit(pdf, layer_big[n], 0.6 * inch, 3.3 * inch, PW - 1.2 * inch, 6.55 * inch)
    y0 = 3.05 * inch
    colw = (PW - 1.2 * inch) / 2
    rows = (len(pieces[n]) + 1) // 2
    for i, (pid, p, names) in enumerate(pieces[n]):
        cc, rr = divmod(i, rows)
        b = p.bounds
        x = 0.6 * inch + cc * colw
        y = y0 - rr * 0.36 * inch
        dark = any(nm in DARK_PIECES for nm in names)
        pdf.setFont('DVB', 9.5)
        pdf.setFillColorRGB(0.78, 0.12, 0.12); pdf.drawString(x, y, pid); pdf.setFillGray(0)
        wrap(pdf, ', '.join(names) + f'  [{(b[2] - b[0]) * S:.0f} x {(b[3] - b[1]) * S:.0f} mm]'
             + ('  - dark stain' if dark else ''), x + 0.42 * inch, y, colw - 0.5 * inch, 8.4, lead=10.5)
    footer(pdf, page); pdf.showPage(); page += 1

# assembly + stand page
header(pdf, 'Assembly & stand')
y = block(pdf, 0.6 * inch, PH - 1.2 * inch, PW - 1.2 * inch, [
    '## Plaque',
    '1. Cut every layer. Lightly sand the top faces to remove smoke residue but keep the charred edges - they '
    'make the dark outlines. Stain or paint each layer before gluing (page 2).',
    '2. Glue L2 onto L1 so the black border shows evenly all round. The bottom edges line up flat.',
    '3. Glue L3 inside the green guide on L2, then keep going upward - every layer carries a green guide for '
    'the next one. For small pieces use a toothpick of glue in the centre and place with tweezers.',
    '4. Press the finished stack under a flat weight for 1-2 hours.',
    '## Stand',
    f'5. Glue B2 centred on B1 (green guide), then B3 to B8 squarely on top using the guide on B2. '
    f'The slot in B6-B8 sits {slot_front:.0f} mm from the FRONT edge (closer to the back) - keep the three slots lined up.',
    '6. Optional: add a name or callsign to the nameplate in XCS before cutting, then glue it centred on the '
    'front of the block.',
    '7. Push the plaque tab into the slot with a little glue. The bottom of the whole stack rests on the stand.',
], size=9.2)

sv = Image.new('RGB', (1500, 640), 'white')
d = ImageDraw.Draw(sv)
f = ImageFont.truetype(FONT_R, 24); fb = ImageFont.truetype(FONT, 26)
k = 1100 / PL1[0]
ox, oy = 30, 40


def R(x0, y0, x1, y1, **kw):
    d.rectangle([ox + x0 * k, oy + y0 * k, ox + x1 * k, oy + y1 * k], **kw)


R(0, 0, PL1[0], PL1[1], outline=(60, 60, 60), width=2, fill=(214, 186, 150))
R(4, 4, PL1[0] - 4, PL1[1] - 4, outline=(60, 60, 60), width=2, fill=(200, 168, 128))
bxs = (PL1[0] - BLOCK_W) / 2
R(bxs, 8, bxs + BLOCK_W, 8 + BLOCK_D, outline=(40, 40, 40), width=3, fill=(176, 136, 96))
sy0 = 8 + BLOCK_D - slot_front - 3.0 - SLOT_CLEAR
R(PL1[0] / 2 - slot_w / 2, sy0, PL1[0] / 2 + slot_w / 2, sy0 + slot_h, fill=(30, 20, 10))
fy = 8 + BLOCK_D - (BLOCK_D - STACK) / 2
R(PL1[0] / 2 - edge_w / 2, fy - STACK, PL1[0] / 2 + edge_w / 2, fy, outline=(200, 30, 30), width=3)
d.text((ox + PL1[0] / 2 * k - 40, oy + (PL1[1] + 3) * k), 'FRONT', font=fb, fill=(40, 40, 40))
d.text((ox + (PL1[0] + 4) * k, oy + (fy - STACK) * k), 'red box =\nplaque stack\n(18 mm deep)', font=f, fill=(200, 30, 30))
d.text((ox + (PL1[0] + 4) * k, oy + (sy0 - 14) * k), f'black = slot\n{slot_w:.1f} x {slot_h:.1f} mm', font=f, fill=(20, 20, 20))
d.text((ox, 4), 'Stand, top view', font=fb, fill=(40, 40, 40))
img_fit(pdf, sv, 0.6 * inch, y - 3.3 * inch, PW - 1.2 * inch, 3.1 * inch)
block(pdf, 0.6 * inch, y - 3.55 * inch, PW - 1.2 * inch, [
    '## Stand layers (bottom to top)',
    f'B1  plinth {PL1[0]:.0f} x {PL1[1]:.0f} mm  |  B2  plinth step {PL2[0]:.0f} x {PL2[1]:.0f} mm  |  '
    f'B3-B5  block {BLOCK_W:.0f} x {BLOCK_D:.0f} mm  |  B6-B8  block with {slot_w:.1f} x {slot_h:.1f} mm slot',
    f'Plaque tab {TAB_W:.0f} x {TAB_H} mm drops into the 9 mm deep slot. Nameplate {NAME_W:.0f} x {NAME_H:.0f} mm '
    f'fits the 18 mm tall block front. File B-A = B1-B4, file B-B = B5-B8 + nameplate (each fits a 12 x 12 in sheet). '
    'Dark walnut on the whole stand matches the reference.',
], size=9.2)
footer(pdf, page); pdf.showPage()
pdf.save()

# layer overview sheet PNG
ov_w = sum(layer_imgs[n].size[0] for n in (1, 2, 3)) + 40
ov_h = layer_imgs[1].size[1] * 2 + 120
ov = Image.new('RGB', (ov_w, ov_h), 'white')
dd = ImageDraw.Draw(ov)
fb = ImageFont.truetype(FONT, 30)
for i, n in enumerate(range(1, D.NL + 1)):
    r, c = divmod(i, 3)
    x = 10 + c * (layer_imgs[1].size[0] + 10)
    y = 10 + r * (layer_imgs[1].size[1] + 55)
    ov.paste(layer_imgs[n], (x, y + 45))
    dd.text((x + 8, y + 5), f'L{n} - {LAYER_INFO[n][0]}', font=fb, fill=(30, 30, 30))
ov.save(os.path.join(OUT, 'preview_layers.png'))
print('files:', files)
