"""Photoreal-ish render of the stained, assembled plaque, straight from the cut geometry.

Height-field renderer: every layer is a 3 mm slab, the plaque stands off the wall on its hanger,
shadows are ray-marched toward the light, laser-cut walls are charred, and each layer gets its
own procedural basswood grain and stain. Slight oblique camera so the stacked edges show.

    python3 render_photo.py out.png [--visor]      # --visor = optional raster "smoked visor"
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from plaque import build, polys
from export import scaled, SCALE

RES = 0.1                  # mm per pixel while rendering
STANDOFF = 4.0             # gap between wall and back of the plaque (sawtooth hanger), mm
LAYER_T = 3.0
OBLIQUE = (0.10, 0.17)     # image shift per mm of height (camera slightly up-left)
LIGHT = np.array([-0.52, -0.74, 0.90])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
VIEW = np.array([-0.10, -0.17, 1.0]); VIEW = VIEW / np.linalg.norm(VIEW)

# graduated stain: darkest at the back, lightening toward the viewer (sRGB-ish albedo, 0..1)
STAINS = {
    'L1': (0.235, 0.145, 0.090),   # dark walnut
    'L2': (0.500, 0.310, 0.175),   # early american
    'L3': (0.700, 0.480, 0.265),   # golden oak
    'L4': (0.840, 0.665, 0.450),   # natural + amber satin poly
    'L5': (0.880, 0.735, 0.540),   # natural
}
CHAR = np.array([0.150, 0.095, 0.060])
ENGRAVE = np.array([0.610, 0.420, 0.250])
SMOKE = np.array([0.205, 0.140, 0.105])
WALL = np.array([0.800, 0.775, 0.735])


def low_noise(shape, sigma_mm, seed, down=8):
    """smooth N(0,1) noise, generated small and upsampled."""
    h, w = shape[0]//down + 3, shape[1]//down + 3
    r = np.random.default_rng(seed).standard_normal((h, w)).astype(np.float32)
    n = ndi.gaussian_filter(r, sigma_mm/(RES*down), mode='wrap')
    n = ndi.zoom(n, down, order=1)[:shape[0], :shape[1]]
    return (n - n.mean()) / (n.std() + 1e-6)


def shift(a, dx, dy):
    out = np.zeros_like(a)
    H, W = a.shape[:2]
    ys, yd = (slice(0, H-dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H+dy))
    xs, xd = (slice(0, W-dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W+dx))
    out[yd, xd] = a[ys, xs]
    return out


class Canvas:
    def __init__(self, G, margin=(28, 26, 34, 34)):
        minx, miny, maxx, maxy = G['L1'].bounds
        self.x0, self.y0 = minx - margin[0], miny - margin[1]
        self.W = int(round((maxx - minx + margin[0] + margin[2]) / RES))
        self.H = int(round((maxy - miny + margin[1] + margin[3]) / RES))

    def px(self, coords, ss):
        return [((x - self.x0)/RES*ss, (y - self.y0)/RES*ss) for x, y in coords]

    def raster(self, geom, ss=2):
        img = Image.new('L', (self.W*ss, self.H*ss), 0)
        d = ImageDraw.Draw(img)
        for p in polys(geom):
            d.polygon(self.px(p.exterior.coords, ss), fill=255)
            for r in p.interiors:
                d.polygon(self.px(r.coords, ss), fill=0)
        return np.asarray(img.resize((self.W, self.H), Image.BOX), np.float32) / 255

    def lines(self, geoms, width_mm, ss=2):
        img = Image.new('L', (self.W*ss, self.H*ss), 0)
        d = ImageDraw.Draw(img)
        w = max(1, int(round(width_mm/RES*ss)))
        for g in geoms:
            for ln in getattr(g, 'geoms', [g]):
                c = list(ln.coords)
                if len(c) > 1:
                    d.line(self.px(c, ss), fill=255, width=w, joint='curve')
        return np.asarray(img.resize((self.W, self.H), Image.BOX), np.float32) / 255

    def text(self, G, lines, ss=2):
        b = G['frame_in'].bounds
        cx = (b[0]+b[2])/2
        img = Image.new('L', (self.W*ss, self.H*ss), 0)
        d = ImageDraw.Draw(img)
        y = b[1] + (b[3]-b[1]) * 0.20
        for txt, font, cap_mm, gap_mm in lines:
            f = ImageFont.truetype(font, int(cap_mm/0.70/RES*ss))
            x0, y0 = self.px([(cx, y)], ss)[0]
            d.text((x0, y0), txt, font=f, fill=255, anchor='mt')
            y += cap_mm + gap_mm
        return np.asarray(img.resize((self.W, self.H), Image.BOX), np.float32) / 255


def wood(shape, yy, xx, seed, stain):
    """procedural basswood: straight vertical grain, faint latewood lines, fibres, blotch."""
    rng = np.random.default_rng(seed)
    warp = 0.7*low_noise(shape, 28.0, seed+1) + 0.18*low_noise(shape, 5.0, seed+2)
    period = 3.2 + 2.0*rng.random()
    phase = 2*np.pi*(xx + warp + rng.random()*50)/period + 0.5*low_noise(shape, 20.0, seed+3)
    rings = (0.5 + 0.5*np.sin(phase))**10
    fib = ndi.gaussian_filter(rng.standard_normal(shape).astype(np.float32), (80.0, 1.2))
    fib /= fib.std() + 1e-6
    blotch = low_noise(shape, 7.0, seed+4)
    dark = 1.0 - float(np.mean(stain))           # darker stains raise grain contrast
    k = 1.0 - (0.05 + 0.12*dark)*rings - 0.045*fib + (0.015 + 0.03*dark)*blotch
    return np.clip(np.asarray(stain, np.float32)[None, None, :] * k[..., None], 0, 1)


def normals_from(h):
    gy, gx = np.gradient(h, RES)
    n = np.dstack([-gx, -gy, np.ones_like(h)])
    return n / np.linalg.norm(n, axis=2, keepdims=True)


def render(visor=False, seed=11):
    G = scaled(build(), SCALE)
    C = Canvas(G)
    shape = (C.H, C.W)
    yy, xx = np.mgrid[0:C.H, 0:C.W].astype(np.float32) * RES
    keys = ['L1', 'L2', 'L3', 'L4', 'L5']
    soft = {k: C.raster(G[k]) for k in keys}
    hard = {k: (soft[k] > 0.5).astype(np.float32) for k in keys}
    top = {k: STANDOFF + LAYER_T*(i+1) for i, k in enumerate(keys)}

    # engraving + score lines
    eng = C.text(G, [('CAPT. JORDAN DOE', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf', 8.5, 4.2),
                     ('“VIPER”  ·  2006 – 2026', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf', 4.6, 0)])
    eng *= C.raster(G['frame_in'].buffer(-2.0))
    scores = {k: C.lines(G['score'].get(k, []), 0.22) for k in keys}
    smoke = C.raster(G['lens']) if visor else np.zeros(shape, np.float32)

    # height map (plan view)
    Hm = np.zeros(shape, np.float32)
    for k in keys:
        Hm = np.where(hard[k] > 0, top[k], Hm)
    Hm -= 0.35*eng*hard['L1'] + 0.12*smoke + 0.08*sum(scores.values())

    # ray-marched shadow toward the light (horizon test)
    d = LIGHT[:2] / np.linalg.norm(LIGHT[:2])
    tanE = LIGHT[2] / np.linalg.norm(LIGHT[:2])
    horizon = np.full(shape, -1e9, np.float32)
    kmax = int(np.ceil(Hm.max() / (tanE*RES))) + 2
    for kk in range(1, kmax):
        dx, dy = int(round(-d[0]*kk)), int(round(-d[1]*kk))      # sample toward the light
        horizon = np.maximum(horizon, shift(Hm, dx, dy) - kk*RES*tanE)
    occ = np.clip((horizon - Hm) / 0.12, 0, 1)
    on_wall = Hm <= 0.01
    sh_layers = ndi.gaussian_filter(occ, 3.5)
    sh_wall = ndi.gaussian_filter(occ, 26.0)
    shadow = np.where(on_wall, sh_wall, sh_layers)

    ao = 1.0 - np.clip(0.09*(ndi.gaussian_filter(Hm, 14.0) - Hm), 0, 0.40)
    plaque = hard['L1']
    ao_wall = 1.0 - 0.38*ndi.gaussian_filter(plaque, 55.0)

    def shade(albedo, n, sh, amb_ao, gloss):
        dif = np.clip(np.tensordot(n, LIGHT, axes=([2], [0])), 0, 1)
        hv = (LIGHT + VIEW); hv = hv / np.linalg.norm(hv)
        spec = np.clip(np.tensordot(n, hv, axes=([2], [0])), 0, 1)**28 * gloss
        lit = 0.32*amb_ao + 0.85*dif*(1 - 0.88*sh)
        return albedo*lit[..., None] + (spec*(1 - sh))[..., None]*0.9

    # ---- wall (plan view, z = 0)
    wall_alb = WALL[None, None, :] * (1 + 0.012*ndi.gaussian_filter(np.random.default_rng(seed).standard_normal(shape).astype(np.float32), 2.0)[..., None]*8
                                      + 0.02*low_noise(shape, 12.0, seed+9)[..., None])
    grad = 1.04 - 0.16*(xx/xx.max()) - 0.12*(yy/yy.max())
    flat = np.dstack([np.zeros(shape), np.zeros(shape), np.ones(shape)]).astype(np.float32)
    canvas = shade(wall_alb, flat, shadow, ao_wall, 0.0) * grad[..., None]

    # ---- layers, painter's order with charred side walls
    a, b = OBLIQUE
    for i, k in enumerate(keys):
        zb, zt = top[k] - LAYER_T, top[k]
        # side walls (laser-charred), darker toward the back
        nsteps = int(np.ceil(max(a, b)*LAYER_T/RES)) + 1
        for s in range(nsteps):
            z = zb + (zt - zb)*s/max(nsteps-1, 1)
            al = shift(soft[k], int(round(a*z/RES)), int(round(b*z/RES)))[..., None]
            col = CHAR * (0.55 + 0.45*(z - zb)/LAYER_T)
            canvas = canvas*(1 - al) + col[None, None, :]*al
        # top face
        alb = wood(shape, yy, xx, seed + 37*i, STAINS[k])
        dist = ndi.distance_transform_edt(hard[k]) * RES
        halo = np.exp(-dist/0.22)[..., None]
        alb = alb*(1 - 0.62*halo) + CHAR[None, None, :]*0.62*halo
        sc = scores[k][..., None]
        alb = alb*(1 - 0.75*sc) + (CHAR*0.8)[None, None, :]*0.75*sc
        if k == 'L1':
            e = eng[..., None]
            tex = 1 + 0.10*low_noise(shape, 0.25, seed+77)[..., None]
            alb = alb*(1 - e) + (ENGRAVE*tex)*e
        if k == 'L2' and visor:
            # raster burn: grain still reads through (latewood burns less), faint scan banding
            m = smoke[..., None]
            grain = (alb / np.asarray(STAINS[k], np.float32)[None, None, :]).mean(axis=2, keepdims=True)
            band = 1 + 0.025*np.sin(2*np.pi*yy/0.9)[..., None]
            burnt = SMOKE[None, None, :] * grain**1.8 * band * (1 + 0.04*low_noise(shape, 0.5, seed+5)[..., None])
            alb = alb*(1 - m) + burnt*m
        bevel = ndi.gaussian_filter(hard[k], 2.0) * 0.45
        n = normals_from(bevel - (0.35*eng if k == 'L1' else 0) - 0.08*scores[k])
        col = shade(alb, n, shadow, ao, 0.06 + 0.03*i)
        dx, dy = int(round(a*zt/RES)), int(round(b*zt/RES))
        al = shift(soft[k], dx, dy)[..., None]
        canvas = canvas*(1 - al) + shift(col, dx, dy)*al

    img = np.clip(canvas, 0, 1)
    # photographic finish: soft vignette + fine grain
    vy, vx = (yy/yy.max() - 0.45), (xx/xx.max() - 0.48)
    img *= (1 - 0.22*(vx**2 + vy**2)*2.2)[..., None]
    img += np.random.default_rng(seed+99).normal(0, 0.006, img.shape).astype(np.float32)
    img = np.clip(img, 0, 1) ** (1/1.06)
    return Image.fromarray((img*255 + 0.5).astype(np.uint8))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--visor', action='store_true')
    ap.add_argument('--width', type=int, default=1500)
    ap.add_argument('--detail', help='also save a native-resolution close-up of the mask')
    a = ap.parse_args()
    im = render(visor=a.visor)
    if a.detail:
        W, H = im.size
        im.crop((int(W*0.27), int(H*0.36), int(W*0.73), int(H*0.71))).save(a.detail, quality=93)
    h = int(im.height * a.width / im.width)
    im.resize((a.width, h), Image.LANCZOS).save(a.out, quality=93)
