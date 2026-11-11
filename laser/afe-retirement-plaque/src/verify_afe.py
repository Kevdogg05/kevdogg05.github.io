"""Independent check of the exported AFE cut file: parse every part back from the SVG, rebuild it,
and re-run the fabrication checks per material and per layer.

    python3 verify_afe.py ../afe_retirement_plaque.svg
"""
import sys
import numpy as np
import xml.etree.ElementTree as ET
from svgpathtools import parse_path
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import affinity

NS = {'s': 'http://www.w3.org/2000/svg'}
PITCH = 270.0


def polys(g):
    return [g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']


def part(d):
    rings = []
    for sub in parse_path(d).continuous_subpaths():
        pts = [(z.real, z.imag) for seg in sub for z in (seg.point(t) for t in np.linspace(0, 1, 16, endpoint=False))]
        rings.append(Polygon(pts).buffer(0))
    rings.sort(key=lambda r: -r.area)
    g = rings[0]
    for r in rings[1:]:
        g = g.difference(r) if g.contains(r.representative_point()) else unary_union([g, r])
    return g


svg = ET.parse(sys.argv[1]).getroot()
print('root', svg.get('width'), svg.get('height'), svg.get('viewBox'))
layers, colours, engr, count = [], set(), {}, {}
for i, g in enumerate(svg.findall('s:g', NS)):
    gid = g.get('id')
    mats = {}
    for sg in g.findall('s:g', NS):
        sid = sg.get('id')
        colours.add((sid.split(gid + '_')[1].rsplit('_', 1)[-1] if sid.endswith(('_cut', '_engrave')) else sid.split('_')[-1],
                     sg.get('stroke'), sg.get('fill')))
        if sid.endswith('_cut'):
            m = sid[len(gid) + 1:-4]
            ps = [affinity.translate(part(p.get('d')), -PITCH*i, 0) for p in sg.findall('s:path', NS)]
            mats[m] = ps
            count[(gid, m)] = len(ps)
        elif sid.endswith('_engrave'):
            engr[gid] = sum(len(p.get('d')) for p in sg.findall('s:path', NS))
    layers.append((gid, mats))
print('group types / colours:', sorted(colours))
print('engrave groups:', {k: f'{v} chars of path data' for k, v in engr.items()})
prev = None
for gid, mats in layers:
    union = unary_union([q for ps in mats.values() for q in ps])
    thin = sum(1 for ps in mats.values() for g in ps
               for q in polys(g.difference(g.buffer(-1.75).buffer(1.75))) if q.area > 0.6)
    gaps = sum(1 for q in polys(union.buffer(1.3).buffer(-1.3).difference(union)) if q.area > 0.6)
    allp = [q.buffer(-0.05) for ps in mats.values() for q in ps]     # 0.05 mm curve-fit tolerance
    overlap = sum(q.area for a in range(len(allp)) for b in range(a+1, len(allp))
                  for q in polys(allp[a].intersection(allp[b])) if q.area > 0.01)
    line = f"{gid:15s} " + ', '.join(f"{m} x{len(ps)}" for m, ps in mats.items())
    line += f" | thin<3.5mm={thin} gaps<2.6mm={gaps} overlap(>0.05mm)={overlap:.2f}mm2"
    if prev is not None:
        over = [q for q in polys(union.difference(prev)) if q.area > 0.05]
        line += f" unsupported={sum(q.area for q in over):.1f}mm2"
    print(line)
    prev = union
b = unary_union([q for ps in layers[0][1].values() for q in ps]).bounds
print(f"finished size {b[2]-b[0]:.1f} x {b[3]-b[1]:.1f} mm = {(b[2]-b[0])/25.4:.2f} x {(b[3]-b[1])/25.4:.2f} in")
