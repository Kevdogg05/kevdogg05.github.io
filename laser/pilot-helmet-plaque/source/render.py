"""Raster previews of the stacked plaque."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from build import polys, lines

STAIN = {1: (38, 26, 20), 2: (92, 58, 34), 3: (200, 156, 104), 4: (216, 176, 124), 5: (228, 192, 140), 6: (238, 206, 156)}
EDGE = (70, 42, 22)
LINE = (88, 54, 28)
FILL = (52, 32, 18)


def _mask(geoms, size, tf):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for p in geoms:
        d.polygon([tf(x, y) for x, y in p.exterior.coords], fill=255)
        for i in p.interiors:
            d.polygon([tf(x, y) for x, y in i.coords], fill=0)
    return m


def render_stack(layers, sc, fl, bounds, ppu, pad=20, stain=STAIN, shadow=True, grain=True, extra=None,
                 overrides=None):
    """layers: {n: geom}. ppu: pixels per geometry unit."""
    minx, miny, maxx, maxy = bounds
    W = int((maxx - minx) * ppu + 2 * pad)
    H = int((maxy - miny) * ppu + 2 * pad)
    tf = lambda x, y: ((x - minx) * ppu + pad, (y - miny) * ppu + pad)
    img = Image.new('RGB', (W, H), (246, 244, 240))
    rng = np.random.default_rng(3)
    for n in sorted(layers):
        g = polys(layers[n])
        m = _mask(g, (W, H), tf)
        if shadow:
            off = int(max(2, ppu * 3.5))
            sh = m.filter(ImageFilter.GaussianBlur(ppu * 2.2))
            sh = ImageChops.offset(sh, off // 2, off)
            sh = sh.point(lambda v: int(v * 0.55))
            img.paste((10, 6, 2), (0, 0), sh)
        col = Image.new('RGB', (W, H), stain[n])
        if grain:
            noise = rng.normal(0, 1, (H // 6 + 1, W // 2 + 1)).astype(np.float32)
            noise = np.array(Image.fromarray(noise).resize((W, H), Image.BILINEAR))
            arr = np.array(col).astype(np.float32) * (1 + 0.035 * noise[..., None])
            col = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        img.paste(col, (0, 0), m)
        for geoms, rgb in (overrides or {}).get(n, []):
            om = _mask(geoms, (W, H), tf)
            arr = np.array(col).astype(np.float32) * (np.array(rgb, np.float32) / np.array(stain[n], np.float32))
            img.paste(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)), (0, 0), om)
        d = ImageDraw.Draw(img)
        ew = max(1, int(round(ppu * 0.6)))
        for p in g:
            for ring in [p.exterior] + list(p.interiors):
                d.line([tf(x, y) for x, y in ring.coords], fill=EDGE, width=ew)
        lw = max(1, int(round(ppu * 0.9)))
        for l in sc.get(n, []):
            d.line([tf(x, y) for x, y in l.coords], fill=LINE, width=lw)
        fm = _mask(fl.get(n, []), (W, H), tf)
        img.paste(FILL, (0, 0), fm)
    if extra:
        extra(img, tf)
    return img
