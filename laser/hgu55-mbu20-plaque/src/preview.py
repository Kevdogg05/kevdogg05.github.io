"""Shaded previews (PNG source SVGs) - not cut files."""
import sys
import numpy as np
from plaque import build, polys
from export import scaled, SCALE, LAYERS, PITCH, PANEL

TONES = ['#c39c6b', '#d8b584', '#e3c393', '#ecd0a3', '#f4ddb6']

def ring_d(coords):
    c = np.asarray(coords)
    return 'M' + 'L'.join(f"{x:.2f},{y:.2f}" for x, y in c[:-1]) + 'Z'

def poly_d(g):
    out = []
    for p in polys(g):
        out.append(ring_d(p.exterior.coords))
        out += [ring_d(r.coords) for r in p.interiors]
    return ''.join(out)

def line_paths(G, key, color, w):
    s = []
    for g in G.get('score', {}).get(key, []):
        for ln in getattr(g, 'geoms', [g]):
            c = np.asarray(ln.coords)
            if len(c) > 1:
                s.append('<path d="M' + 'L'.join(f"{x:.2f},{y:.2f}" for x, y in c) +
                         f'" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')
    return s

def assembled_svg(G, engrave=True):
    minx, miny, maxx, maxy = G['L1'].bounds
    pad = 14
    W, H = maxx-minx+2*pad, maxy-miny+2*pad
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx-pad} {miny-pad} {W} {H}">',
         '<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%">'
         '<feDropShadow dx="0.8" dy="1.3" stdDeviation="0.8" flood-color="#2a1a08" flood-opacity="0.55"/></filter>'
         '<filter id="sh0" x="-20%" y="-20%" width="140%" height="140%">'
         '<feDropShadow dx="2.2" dy="3.2" stdDeviation="2.6" flood-color="#000" flood-opacity="0.45"/></filter>'
         '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7780"/>'
         '<stop offset="1" stop-color="#4c565e"/></linearGradient></defs>',
         f'<rect x="{minx-pad}" y="{miny-pad}" width="{W}" height="{H}" fill="url(#wall)"/>']
    for i, (k, _, _) in enumerate(LAYERS):
        s.append(f'<path d="{poly_d(G[k])}" fill="{TONES[i]}" fill-rule="evenodd" stroke="#8a6a44" '
                 f'stroke-width="0.15" filter="url(#{"sh0" if i == 0 else "sh"})"/>')
        s += line_paths(G, k, '#86643c', 0.3)
        if k == 'L1' and engrave:
            b = G['frame_in'].bounds; cx = (b[0]+b[2])/2; cy = (b[1]+b[3])/2
            s.append(f'<text x="{cx}" y="{cy-1.5}" text-anchor="middle" font-family="Georgia, serif" '
                     f'font-size="11" letter-spacing="1.5" fill="#6e4a24" fill-opacity="0.85">YOUR NAME</text>')
            s.append(f'<text x="{cx}" y="{cy+9}" text-anchor="middle" font-family="Georgia, serif" '
                     f'font-size="5.2" letter-spacing="0.8" fill="#6e4a24" fill-opacity="0.8">'
                     'CUSTOM MESSAGE HERE</text>')
    s.append('</svg>')
    return '\n'.join(s)

def sheet_svg(G):
    minx, miny, maxx, maxy = G['L1'].bounds
    total = PITCH*(len(LAYERS)-1) + PANEL
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -22 {total} {PANEL+22}">',
         f'<rect x="0" y="-22" width="{total}" height="{PANEL+22}" fill="#fff"/>']
    for i, (k, gid, label) in enumerate(LAYERS):
        ox = i*PITCH + PANEL/2 - (minx+maxx)/2; oy = PANEL/2 - (miny+maxy)/2
        s.append(f'<rect x="{i*PITCH}" y="0" width="{PANEL}" height="{PANEL}" fill="#faf6ee" stroke="#ccc" stroke-dasharray="3 2" stroke-width="0.5"/>')
        s.append(f'<text x="{i*PITCH+PANEL/2}" y="-8" text-anchor="middle" font-family="Helvetica, Arial" font-size="11" fill="#333">'
                 f'{gid}  ({len(polys(G[k]))} part{"s" if len(polys(G[k])) > 1 else ""})</text>')
        s.append(f'<g transform="translate({ox} {oy})"><path d="{poly_d(G[k])}" fill="{TONES[i]}" fill-rule="evenodd" stroke="#e00" stroke-width="0.45"/>')
        s += line_paths(G, k, '#000', 0.35)
        s.append('</g>')
    s.append('</svg>')
    return '\n'.join(s)

if __name__ == '__main__':
    G = scaled(build(), SCALE)
    open(sys.argv[1], 'w').write(assembled_svg(G))
    open(sys.argv[2], 'w').write(sheet_svg(G))
