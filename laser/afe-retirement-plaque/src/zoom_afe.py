"""zoomed material view with cut outlines: python3 zoom_afe.py out.svg x0 y0 w h  (finished mm)"""
import sys
from afe_plaque import build, scaled, LAYERS, MATERIALS
from preview_afe import poly_d
D = scaled(build())
x0, y0, w, h = map(float, sys.argv[2:6])
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {w} {h}"><rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#fff"/>']
for L, _, _ in LAYERS:
    for m, g in D['layers'][L].items():
        s.append(f'<path d="{poly_d(g)}" fill="{MATERIALS[m][1]}" fill-opacity="0.75" fill-rule="evenodd" stroke="#f00" stroke-width="{w/900:.3f}"/>')
s.append('</svg>')
open(sys.argv[1], 'w').write(''.join(s))
