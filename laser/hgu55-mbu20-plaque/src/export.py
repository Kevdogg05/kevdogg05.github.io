"""Export the stacked plaque: laser cut SVG (+ assembled / per-layer previews)."""
import argparse, json
import numpy as np
from shapely.geometry import LineString, Point
from shapely import affinity
from plaque import build, check, polys
from fitcurve import ring_to_segments, segments_to_d, polyline_to_d

CUT_TOL = 0.05          # max Bezier deviation from the exact geometry (mm), well under kerf
SCALE = 0.96            # final size: ~200 x 284 mm (7.9 x 11.2 in)
PANEL = 300.0           # each layer sits in its own 300 x 300 mm sheet window
PITCH = 310.0
LAYERS = [
    ('L1', 'layer1_base',    'Layer 1 - Base / backdrop (engraving surface)'),
    ('L2', 'layer2_shell',   'Layer 2 - Helmet shell, visor lens, mask body, hose, nameplate frame'),
    ('L3', 'layer3_accents', 'Layer 3 - Visor housing, mask hard shell, bayonet receivers, hose'),
    ('L4', 'layer4_details', 'Layer 4 - Visor knob, friction screws, valve, bayonet straps, connectors'),
    ('L5', 'layer5_caps',    'Layer 5 - Knob grip, valve cap, connector latch'),
]

def scaled(G, s):
    out = dict(G)
    for k in ('L1', 'L2', 'L3', 'L4', 'L5'):
        out[k] = affinity.scale(G[k], s, s, origin=(0, 0))
    out['score'] = {k: [affinity.scale(g, s, s, origin=(0, 0)) for g in v] for k, v in G['score'].items()}
    out['frame_in'] = affinity.scale(G['frame_in'], s, s, origin=(0, 0))
    return out

def ghosts(G):
    """hidden alignment marks: outline of layer n inset 1.5 mm, scored on layer n-1."""
    names = ['L1', 'L2', 'L3', 'L4', 'L5']
    res = {}
    for lo, hi in zip(names[1:-1], names[2:]):      # L2 needs none: the 4 mm reveal is its guide
        inner = G[hi].buffer(-1.5, quad_segs=32)
        res[lo] = [inner.boundary.intersection(G[lo].buffer(-0.5, quad_segs=32))]
    return res

def lines_of(g):
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    out = []
    for q in getattr(g, 'geoms', []):
        out += lines_of(q)
    return out

def merge_lines(gs):
    from shapely.ops import linemerge, unary_union
    u = unary_union([g for g in gs if not g.is_empty])
    if u.is_empty:
        return []
    m = linemerge(lines_of(u)) if not isinstance(u, LineString) else u
    return [l for l in lines_of(m) if l.length > 1.0]

def sample_segs(segs, n=24):
    pts = []
    for s in segs:
        if s[0] == 'L':
            pts += [s[1], s[2]]
        else:
            b = s[1]; t = np.linspace(0, 1, n)[:, None]
            pts += list((1-t)**3*b[0] + 3*(1-t)**2*t*b[1] + 3*(1-t)*t**2*b[2] + t**3*b[3])
    return np.array(pts)

def build_cut_svg(G, fit_report):
    minx, miny, maxx, maxy = G['L1'].bounds
    W, H = maxx-minx, maxy-miny
    gh = ghosts(G)
    out = []
    total_w = PITCH*(len(LAYERS)-1) + PANEL
    out.append('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
    out.append('<!--\n'
               '  HGU-55/P flight helmet + MBU-20/P oxygen mask - 5-layer stacked plaque\n'
               '  Material: 3 mm basswood, 5 layers (15 mm total relief)\n'
               f'  Finished size: {W:.1f} x {H:.1f} mm ({W/25.4:.2f} x {H/25.4:.2f} in)\n'
               '  Units: 1 user unit = 1 mm.  Each layer is drawn in its own 300 x 300 mm window,\n'
               f'  windows {PITCH:.0f} mm apart along X. Same position inside every window = perfect registration.\n'
               '  RED  #FF0000  = vector CUT (through)\n'
               '  BLACK #000000 = optional vector SCORE: decorative panel lines + hidden glue-alignment ghosts\n'
               '                 (ghosts sit 1.5 mm inside the outline of the piece that is glued on top)\n'
               '  Engraving zone (Layer 1, nameplate window, leave blank): see id="layer1_base" comment.\n'
               '-->')
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
               f'version="1.1" width="{total_w:.0f}mm" height="{PANEL:.0f}mm" viewBox="0 0 {total_w:.0f} {PANEL:.0f}">')
    out.append('  <title>HGU-55/P + MBU-20/P stacked basswood plaque - laser cut layers</title>')
    worst = 0.0
    for i, (key, gid, label) in enumerate(LAYERS):
        ox = i*PITCH + PANEL/2 - (minx+maxx)/2
        oy = PANEL/2 - (miny+maxy)/2
        geo = affinity.translate(G[key], ox, oy)
        out.append(f'  <g id="{gid}" inkscape:groupmode="layer" inkscape:label="{label}">')
        if key == 'L1':
            fb = affinity.translate(G['frame_in'], ox, oy).bounds
            out.append(f'    <!-- ENGRAVING ZONE: exposed base inside the nameplate frame, x {fb[0]:.1f}-{fb[2]:.1f}, '
                       f'y {fb[1]:.1f}-{fb[3]:.1f} mm ({fb[2]-fb[0]:.0f} x {fb[3]-fb[1]:.0f} mm). '
                       f'Keep text >= 3 mm inside that window. -->')
        out.append(f'    <g id="{gid}_cut" fill="none" stroke="#FF0000" stroke-width="0.1">')
        for j, p in enumerate(sorted(polys(geo), key=lambda q: -q.area)):
            ds = []
            for ring in [p.exterior] + list(p.interiors):
                segs = ring_to_segments(np.asarray(ring.coords), err=CUT_TOL)
                smp = sample_segs(segs)
                rl = LineString(np.asarray(ring.coords))
                worst = max(worst, max(rl.distance(Point(*q)) for q in smp[::3]))
                ds.append(segments_to_d(segs))
            out.append(f'      <path id="{gid}_part{j+1:02d}" d="{"".join(ds)}"/>')
        out.append('    </g>')
        dec = [affinity.translate(g, ox, oy) for g in G['score'].get(key, [])]
        ali = [affinity.translate(g, ox, oy) for g in gh.get(key, [])]
        if dec:
            out.append(f'    <g id="{gid}_score_detail" fill="none" stroke="#000000" stroke-width="0.1">')
            for ln in merge_lines(dec):
                out.append(f'      <path d="{polyline_to_d(np.asarray(ln.coords))}"/>')
            out.append('    </g>')
        if ali:
            out.append(f'    <g id="{gid}_score_align" fill="none" stroke="#000000" stroke-width="0.1">')
            for ln in merge_lines(ali):
                c = np.asarray(ln.coords)
                if ln.is_ring:
                    out.append(f'      <path d="{segments_to_d(ring_to_segments(c, err=0.15))}"/>')
                else:
                    out.append(f'      <path d="{polyline_to_d(c, err=0.15)}"/>')
            out.append('    </g>')
        out.append('  </g>')
    out.append('</svg>')
    fit_report['max_fit_deviation_mm'] = round(worst, 4)
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--svg', required=True)
    ap.add_argument('--report')
    a = ap.parse_args()
    G = scaled(build(), SCALE)
    rep = check(G)
    svg = build_cut_svg(G, rep)
    open(a.svg, 'w').write(svg)
    if a.report:
        open(a.report, 'w').write(json.dumps(rep, indent=1))
    print(json.dumps({k: rep[k] for k in ('overall_mm', 'overall_in', 'max_fit_deviation_mm')}))
    for k in ('L1', 'L2', 'L3', 'L4', 'L5'):
        print(k, rep[k])
    print('bytes', len(svg))
