"""Flat material-coloured previews of the AFE plaque (assembled stack + per-layer sheet). Not cut files."""
import sys
import numpy as np
from afe_plaque import build, scaled, LAYERS, MATERIALS, PITCH, PANEL_W, PANEL_H
from plaque import polys


def ring_d(c):
    c = np.asarray(c)
    return 'M' + 'L'.join(f"{x:.2f},{y:.2f}" for x, y in c[:-1]) + 'Z'


def poly_d(g):
    return ''.join(ring_d(p.exterior.coords) + ''.join(ring_d(r.coords) for r in p.interiors) for p in polys(g))


def assembled(D):
    minx, miny, maxx, maxy = D['layers']['L1']['black_acrylic'].bounds
    pad = 14
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx-pad} {miny-pad} {maxx-minx+2*pad} {maxy-miny+2*pad}">',
         '<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0.8" dy="1.2" '
         'stdDeviation="0.8" flood-opacity="0.6"/></filter></defs>',
         f'<rect x="{minx-pad}" y="{miny-pad}" width="{maxx-minx+2*pad}" height="{maxy-miny+2*pad}" fill="#e8e4dc"/>']
    for L, _, _ in LAYERS:
        for m, g in D['layers'][L].items():
            s.append(f'<path d="{poly_d(g)}" fill="{MATERIALS[m][1]}" fill-rule="evenodd" stroke="#0004" '
                     f'stroke-width="0.15" filter="url(#sh)"/>')
        if L in D['engrave']:
            s.append(f'<path d="{poly_d(D["engrave"][L])}" fill="{"#c8c8c8" if L != "L2" else "#6b4a2b"}" fill-rule="evenodd"/>')
        for g in D['score'].get(L, []):
            for ln in getattr(g, 'geoms', [g]):
                c = np.asarray(ln.coords)
                if len(c) > 1:
                    s.append('<path d="M' + 'L'.join(f"{x:.2f},{y:.2f}" for x, y in c) + '" fill="none" stroke="#5a3b1e" stroke-width="0.3"/>')
    s.append('</svg>')
    return '\n'.join(s)


def sheet(D):
    minx, miny, maxx, maxy = D['layers']['L1']['black_acrylic'].bounds
    total = PITCH*(len(LAYERS)-1) + PANEL_W
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -26 {total} {PANEL_H+26}">',
         f'<rect x="0" y="-26" width="{total}" height="{PANEL_H+26}" fill="#fff"/>']
    for i, (L, gid, _) in enumerate(LAYERS):
        ox = i*PITCH + PANEL_W/2 - (minx+maxx)/2; oy = PANEL_H/2 - (miny+maxy)/2
        n = sum(len(polys(g)) for g in D['layers'][L].values())
        s.append(f'<rect x="{i*PITCH}" y="0" width="{PANEL_W}" height="{PANEL_H}" fill="#faf8f4" stroke="#ccc" stroke-dasharray="3 2"/>')
        s.append(f'<text x="{i*PITCH+PANEL_W/2}" y="-10" text-anchor="middle" font-family="Helvetica, Arial" font-size="12">{gid} ({n} parts)</text>')
        s.append(f'<g transform="translate({ox} {oy})">')
        for m, g in D['layers'][L].items():
            s.append(f'<path d="{poly_d(g)}" fill="{MATERIALS[m][1]}" fill-rule="evenodd" stroke="#e00" stroke-width="0.5"/>')
        if L in D['engrave']:
            s.append(f'<path d="{poly_d(D["engrave"][L])}" fill="#2b6bff" fill-rule="evenodd"/>')
        s.append('</g>')
    y = PANEL_H - 6
    s.append('</svg>')
    return '\n'.join(s)


if __name__ == '__main__':
    D = scaled(build())
    open(sys.argv[1], 'w').write(assembled(D))
    if len(sys.argv) > 2:
        open(sys.argv[2], 'w').write(sheet(D))
