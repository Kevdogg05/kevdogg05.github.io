"""Photoreal-ish render of the assembled AFE plaque from the cut geometry (not a photo).

Height-field renderer shared with the helmet plaque (../../hgu55-mbu20-plaque/src/render_photo.py), with
material models: natural basswood, hickory (cream sapwood + brown heartwood streaks), gloss black acrylic
(softbox reflection, frosted-white engraving, polished edges) and gold mirror acrylic.

    python3 render_afe.py out.jpg [--width 1600] [--detail closeup.jpg@0.22,0.38,0.78,0.72 ...]
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from afe_plaque import build, scaled, LAYERS        # also puts ../../hgu55-mbu20-plaque/src on sys.path
from render_photo import low_noise, shift, Canvas, normals_from, wood, RES, LIGHT, VIEW, OBLIQUE, CHAR

STANDOFF, LAYER_T = 4.0, 3.0
BASSWOOD = (0.865, 0.745, 0.565)
HICKORY_SAP, HICKORY_HEART = np.array([0.835, 0.690, 0.490]), np.array([0.560, 0.370, 0.215])
BLACK = np.array([0.020, 0.020, 0.023])
FROST = np.array([0.80, 0.80, 0.79])
GOLD = np.array([1.00, 0.76, 0.34])
WALL = np.array([0.835, 0.815, 0.780])


def hickory(shape, yy, xx, seed):
    """hickory veneer: cream sapwood with long brown heartwood streaks, crisp latewood lines, pores."""
    rng = np.random.default_rng(seed)
    H, W = shape
    rows = H // 100 + 3                                               # one row per 10 mm along the grain
    field = ndi.gaussian_filter(rng.standard_normal((rows, W)).astype(np.float32), (2.5, 22.0), mode='wrap')
    field = ndi.zoom(field, (100, 1), order=1)[:H, :W]                # streaks 3-8 cm long, ~2-6 mm wide
    warp = 0.6*low_noise(shape, 25.0, seed+1) + 0.15*low_noise(shape, 4.0, seed+2)
    field = ndi.map_coordinates(field, [np.mgrid[0:H, 0:W][0], np.clip(np.mgrid[0:H, 0:W][1] + warp/RES, 0, W-1)],
                                order=1)                              # streaks follow the grain wiggle
    streak = (field - field.mean()) / (field.std() + 1e-6)
    heart = 1/(1 + np.exp(-(streak - 0.45)*3.2))
    phase = 2*np.pi*(xx + warp + rng.random()*50)/(2.2 + rng.random()) + 0.5*low_noise(shape, 18.0, seed+3)
    rings = (0.5 + 0.5*np.sin(phase))**8
    pores = ndi.gaussian_filter(rng.standard_normal(shape).astype(np.float32), (12.0, 0.6))
    pores = np.clip(pores/pores.std() - 1.2, 0, None)
    base = HICKORY_SAP[None, None, :]*(1 - heart[..., None]) + HICKORY_HEART[None, None, :]*heart[..., None]
    k = 1 - 0.16*rings - 0.07*pores + 0.03*low_noise(shape, 6.0, seed+4)
    return np.clip(base*k[..., None], 0, 1)


def softbox(xx, yy, height):
    """reflection of a large window/softbox up-left, as seen in a flat glossy surface (parallax by height)."""
    u = (xx*0.62 + yy*0.78) / (xx.max()*0.62 + yy.max()*0.78) - 0.004*height
    return 0.03 + 0.50*np.exp(-((u - 0.27)/0.06)**2) + 0.22*np.exp(-((u - 0.52)/0.035)**2)


def render(seed=21):
    D = scaled(build())
    C = Canvas({'L1': D['layers']['L1']['black_acrylic']})
    shape = (C.H, C.W)
    yy, xx = np.mgrid[0:C.H, 0:C.W].astype(np.float32) * RES
    keys = [L for L, _, _ in LAYERS]
    top = {L: STANDOFF + LAYER_T*(i+1) for i, L in enumerate(keys)}
    soft = {(L, m): C.raster(g) for L in keys for m, g in D['layers'][L].items() if not g.is_empty}
    lay = {L: np.clip(sum(v for (l2, _), v in soft.items() if l2 == L), 0, 1) for L in keys}
    hard = {L: (lay[L] > 0.5).astype(np.float32) for L in keys}
    eng = {L: C.raster(g) for L, g in D['engrave'].items()}
    scores = {L: C.lines(D['score'].get(L, []), 0.22) for L in keys}

    Hm = np.zeros(shape, np.float32)
    for L in keys:
        Hm = np.where(hard[L] > 0, top[L], Hm)
    for L, e in eng.items():
        Hm -= 0.15*e*hard[L]

    d = LIGHT[:2]/np.linalg.norm(LIGHT[:2]); tanE = LIGHT[2]/np.linalg.norm(LIGHT[:2])
    horizon = np.full(shape, -1e9, np.float32)
    for kk in range(1, int(np.ceil(Hm.max()/(tanE*RES))) + 2):
        horizon = np.maximum(horizon, shift(Hm, int(round(-d[0]*kk)), int(round(-d[1]*kk))) - kk*RES*tanE)
    occ = np.clip((horizon - Hm)/0.12, 0, 1)
    shadow = np.where(Hm <= 0.01, ndi.gaussian_filter(occ, 26.0), ndi.gaussian_filter(occ, 3.5))
    ao = 1.0 - np.clip(0.09*(ndi.gaussian_filter(Hm, 14.0) - Hm), 0, 0.40)
    ao_wall = 1.0 - 0.38*ndi.gaussian_filter(hard['L1'], 55.0)
    hv = (LIGHT + VIEW); hv = hv/np.linalg.norm(hv)

    def lighting(n, sh, amb, gloss, power=28):
        dif = np.clip(np.tensordot(n, LIGHT, axes=([2], [0])), 0, 1)
        spec = np.clip(np.tensordot(n, hv, axes=([2], [0])), 0, 1)**power * gloss
        return 0.32*amb + 0.85*dif*(1 - 0.88*sh), spec*(1 - sh)

    # wall
    wall_alb = WALL[None, None, :]*(1 + 0.10*ndi.gaussian_filter(np.random.default_rng(seed).standard_normal(shape).astype(np.float32), 2.0)[..., None]
                                    + 0.02*low_noise(shape, 12.0, seed+9)[..., None])
    flat = np.dstack([np.zeros(shape), np.zeros(shape), np.ones(shape)]).astype(np.float32)
    lit, _ = lighting(flat, shadow, ao_wall, 0)
    canvas = wall_alb*lit[..., None] * (1.04 - 0.16*(xx/xx.max()) - 0.12*(yy/yy.max()))[..., None]

    a, b = OBLIQUE
    edge_col = {'basswood': CHAR, 'hickory': CHAR*0.9, 'black_acrylic': np.array([0.035, 0.035, 0.04]),
                'gold_mirror_acrylic': np.array([0.42, 0.35, 0.20])}
    for i, L in enumerate(keys):
        zb, zt = top[L] - LAYER_T, top[L]
        mats = [m for (l2, m) in soft if l2 == L]
        nsteps = int(np.ceil(max(a, b)*LAYER_T/RES)) + 1
        for s in range(nsteps):                              # side walls of every part in this layer
            z = zb + (zt - zb)*s/max(nsteps-1, 1)
            dx, dy = int(round(a*z/RES)), int(round(b*z/RES))
            for m in mats:
                al = shift(soft[(L, m)], dx, dy)[..., None]
                f = 0.55 + 0.45*(z - zb)/LAYER_T
                if m == 'black_acrylic' and s == nsteps - 1:
                    f = 3.5                                   # polished top edge catches the light
                canvas = canvas*(1 - al) + (edge_col[m]*f)[None, None, :]*al
        dx, dy = int(round(a*zt/RES)), int(round(b*zt/RES))
        for j, m in enumerate(mats):                         # top faces
            hm = (soft[(L, m)] > 0.5).astype(np.float32)
            e = eng.get(L, np.zeros(shape, np.float32))[..., None] * hm[..., None]
            sc = scores[L][..., None] * hm[..., None]
            if m in ('basswood', 'hickory'):
                alb = wood(shape, yy, xx, seed + 37*i + 5*j, BASSWOOD) if m == 'basswood' else hickory(shape, yy, xx, seed + 41*i + 7*j)
                dist = ndi.distance_transform_edt(hm)*RES
                halo = np.exp(-dist/0.22)[..., None]
                alb = alb*(1 - 0.62*halo) + CHAR*0.62*halo
                alb = alb*(1 - 0.75*sc) + CHAR*0.8*0.75*sc
                n = normals_from(ndi.gaussian_filter(hm, 2.0)*0.45 - 0.08*scores[L])
                lit, spec = lighting(n, shadow, ao, 0.07 + 0.03*i)
                col = alb*lit[..., None] + spec[..., None]*0.9
            elif m == 'black_acrylic':
                frost = FROST*(1 + 0.05*low_noise(shape, 0.3, seed+77)[..., None])
                alb = BLACK*(1 - e) + frost*e
                n = normals_from(ndi.gaussian_filter(hm, 1.2)*0.35 - 0.15*eng.get(L, 0)*hm)
                lit, spec = lighting(n, shadow, ao, 1.6, power=90)
                refl = softbox(xx, yy, zt)*(1 - 0.75*shadow)
                col = alb*lit[..., None] + ((refl + spec)*(1 - e[..., 0]))[..., None]*np.array([0.95, 0.96, 1.0])
            else:   # gold mirror acrylic
                n = normals_from(ndi.gaussian_filter(hm, 1.2)*0.35)
                lit, spec = lighting(n, shadow, ao, 1.4, power=80)
                sky = 0.55 - 0.35*(yy - yy.min())/np.ptp(yy)                 # mirror: bright above, darker below
                refl = (sky + 1.6*softbox(xx, yy, zt) + 0.18*low_noise(shape, 30.0, seed+6))*(1 - 0.6*shadow)
                col = GOLD[None, None, :]*(0.10*lit + refl)[..., None] + spec[..., None]*np.array([1.0, 0.92, 0.75])
            al = shift(soft[(L, m)], dx, dy)[..., None]
            canvas = canvas*(1 - al) + shift(np.clip(col, 0, 1.6), dx, dy)*al

    img = np.clip(canvas, 0, 1)
    vy, vx = (yy/yy.max() - 0.45), (xx/xx.max() - 0.48)
    img *= (1 - 0.22*(vx**2 + vy**2)*2.2)[..., None]
    img += np.random.default_rng(seed+99).normal(0, 0.006, img.shape).astype(np.float32)
    img = np.clip(img, 0, 1)**(1/1.06)
    return Image.fromarray((img*255 + 0.5).astype(np.uint8))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--width', type=int, default=1600)
    ap.add_argument('--detail', action='append', default=[],
                    help='native-resolution close-up, FILE@x0,y0,x1,y1 (fractions of the image); repeatable')
    a = ap.parse_args()
    im = render()
    W, H = im.size
    for spec in a.detail:
        path, box = spec.split('@')
        f = [float(v) for v in box.split(',')]
        im.crop((int(W*f[0]), int(H*f[1]), int(W*f[2]), int(H*f[3]))).save(path, quality=93)
    im.resize((a.width, int(im.height*a.width/im.width)), Image.LANCZOS).save(a.out, quality=93)
