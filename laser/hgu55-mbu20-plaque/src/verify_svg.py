"""Independent check of the exported cut file: parse paths, rebuild parts, re-run fabrication checks."""
import sys, re, json
import numpy as np
import xml.etree.ElementTree as ET
from svgpathtools import parse_path
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
from shapely import affinity

NS = {'s': 'http://www.w3.org/2000/svg'}
svg = ET.parse(sys.argv[1]).getroot()
print('root', svg.get('width'), svg.get('height'), svg.get('viewBox'))
layers = {}
strokes = set()
for g in svg.findall('s:g', NS):
    gid = g.get('id')
    cut = g.find(f"s:g[@id='{gid}_cut']", NS)
    strokes.add(cut.get('stroke'))
    parts = []
    for p in cut.findall('s:path', NS):
        path = parse_path(p.get('d'))
        rings = []
        for sub in path.continuous_subpaths():
            pts = []
            for seg in sub:
                for t in np.linspace(0, 1, 16, endpoint=False):
                    z = seg.point(t); pts.append((z.real, z.imag))
            rings.append(Polygon(pts).buffer(0))
        rings.sort(key=lambda r: -r.area)
        part = rings[0]
        for r in rings[1:]:
            part = part.difference(r)
        parts.append(part)
    layers[gid] = parts
    for sg in g.findall('s:g', NS):
        if sg.get('id') != f'{gid}_cut':
            strokes.add(sg.get('stroke'))
print('stroke colours used:', sorted(strokes))
keys = list(layers)
geo = {}
for i, k in enumerate(keys):
    u = unary_union(layers[k])
    geo[k] = affinity.translate(u, -310.0*i, 0)
    print(f"{k:16s} parts={len(layers[k]):2d}  bbox={tuple(round(v,1) for v in geo[k].bounds)}")
def polys(g): return [g] if g.geom_type == 'Polygon' else list(g.geoms)
for i, k in enumerate(keys):
    g = geo[k]
    thin = [q for q in polys(g.difference(g.buffer(-1.75).buffer(1.75))) if q.area > 0.6]
    gaps = [q for q in polys(g.buffer(1.3).buffer(-1.3).difference(g)) if q.area > 0.6] if True else []
    line = f"{k:16s} thin<3.5mm={len(thin)} gaps<2.6mm={len(gaps)}"
    if i:
        line += f"  unsupported_by_layer_below={g.difference(geo[keys[i-1]]).area:.1f} mm2"
    # overlaps between parts in the same layer
    ps = layers[k]; ov = sum(ps[a].intersection(ps[b]).area for a in range(len(ps)) for b in range(a+1, len(ps)))
    line += f"  part_overlap={ov:.2f}"
    print(line)
minx, miny, maxx, maxy = geo[keys[0]].bounds
print(f"finished size {maxx-minx:.1f} x {maxy-miny:.1f} mm = {(maxx-minx)/25.4:.2f} x {(maxy-miny)/25.4:.2f} in")
