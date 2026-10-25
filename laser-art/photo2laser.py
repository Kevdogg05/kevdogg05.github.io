#!/usr/bin/env python3
"""
photo2laser.py - turn a photo into a two-tone "light wood on dark wood" laser design.

Style target: a light veneer top layer (maple/beech/basswood) glued on a dark
backer (walnut).  Dark areas of the artwork are cut out of the top layer so the
walnut shows through; fine detail is scored (low power vector line) into the
light layer.

Pipeline
  1. subject isolation (rembg)                         -> alpha mask
  2. tone normalisation (CLAHE on L channel)           -> local contrast, not absolute brightness
  3. XDoG (Winnemoeller 2012) ink stylisation          -> dark/light + line detail in one pass
  4. manufacturability filter in millimetres            -> remove slivers, tiny islands, hairline gaps
  5. split into CUT (thick dark regions) and SCORE (thin dark detail)
  6. potrace vectorisation                              -> layered SVG at true physical size
  7. wood-texture preview render                        -> PNG mock-up

Usage:
  python3 photo2laser.py photo.jpg --out outdir --height-mm 300 --level 2
  levels: 1 = detailed, 2 = medium, 3 = simple, 4 = silhouette
"""
import argparse, os, math
import numpy as np
import cv2
from PIL import Image, ImageOps
import potrace  # pip install potracer

# ------------------------------------------------------------------ presets
# All sizes are in millimetres so they stay valid whatever the panel size is.
LEVELS = {
    # sigma  = XDoG base blur (mm). bigger = bolder, fewer lines
    # eps    = threshold. more negative = more white (light wood), less detail
    # p      = sharpening strength (edge emphasis)
    # min_light_mm = thinnest light-wood sliver that may survive
    # min_cut_mm   = dark features thinner than this become SCORE lines instead of cuts
    # min_island_mm2 = dark or light blobs smaller than this are deleted
    1: dict(smooth_mm=0.6, name="detailed",   sigma=0.35, eps=-0.02, p=18, min_light_mm=0.8, min_cut_mm=1.2, min_island_mm2=3,  keep_score=True),
    2: dict(smooth_mm=0.9, name="medium",     sigma=0.55, eps=-0.03, p=22, min_light_mm=1.0, min_cut_mm=1.6, min_island_mm2=6,  keep_score=True),
    3: dict(smooth_mm=1.4, name="simple",     sigma=0.90, eps=-0.04, p=26, min_light_mm=1.5, min_cut_mm=2.2, min_island_mm2=12, keep_score=False),
    4: dict(smooth_mm=2.2, name="silhouette", sigma=1.60, eps=-0.05, p=30, min_light_mm=2.0, min_cut_mm=3.0, min_island_mm2=25, keep_score=False),
}

# ------------------------------------------------------------------ helpers
def load_subject(path, cache=None):
    """Return RGB uint8 image and alpha mask (0..255) with the background removed."""
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if cache and os.path.exists(cache):
        cut = Image.open(cache).convert("RGBA")
    else:
        from rembg import remove, new_session
        cut = remove(im, session=new_session("isnet-general-use"))
        if cache:
            cut.save(cache)
    rgb = np.array(cut.convert("RGB"))
    alpha = np.array(cut.split()[-1])
    return rgb, alpha


YUNET_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

def detect_faces(rgb, model_path=None, score=0.5):
    """YuNet face detector (OpenCV DNN). Returns list of (x,y,w,h) sorted largest first."""
    model_path = model_path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "yunet.onnx")
    if not os.path.exists(model_path):
        import urllib.request
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        urllib.request.urlretrieve(YUNET_URL, model_path)
    det = cv2.FaceDetectorYN.create(model_path, "", (320, 320), score, 0.3, 5000)
    h, w = rgb.shape[:2]
    s = 1200.0 / max(h, w)
    small = cv2.resize(rgb[:, :, ::-1], (int(w * s), int(h * s)))
    det.setInputSize((small.shape[1], small.shape[0]))
    _, faces = det.detect(small)
    if faces is None:
        return []
    out = [tuple(int(v / s) for v in f[:4]) for f in faces]
    return sorted(out, key=lambda f: -f[2] * f[3])


def crop_bust(rgb, alpha, face, head_frac=0.34):
    """Crop head-and-shoulders so the face is ~head_frac of the crop height (the reference art
    has the head ~1/3 of the panel).  Width = 0.78 * height, portrait."""
    x, y, w, h = face
    H = int(h / head_frac); W = int(H * 0.78)
    cx, cy = x + w // 2, y + int(h * 0.55)
    y0 = max(0, cy - int(H * 0.42)); x0 = max(0, cx - W // 2)
    y1 = min(alpha.shape[0], y0 + H); x1 = min(alpha.shape[1], x0 + W)
    return rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]


def crop_to_subject(rgb, alpha, pad_frac=0.04):
    ys, xs = np.where(alpha > 128)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    ph, pw = int((y1 - y0) * pad_frac), int((x1 - x0) * pad_frac)
    y0, y1 = max(0, y0 - ph), min(alpha.shape[0], y1 + ph)
    x0, x1 = max(0, x0 - pw), min(alpha.shape[1], x1 + pw)
    return rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]


def clean_alpha(alpha, px_per_mm):
    """Keep only the big connected subject blobs, close holes, feather edges."""
    m = (alpha > 128).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep = np.zeros(n, bool)
        keep[1:] = areas > 0.02 * areas.max()
        m = keep[lab].astype(np.uint8)
    k = int(max(3, 1.5 * px_per_mm)) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return m


def xdog(gray01, sigma_px, k=1.6, p=20.0, eps=-0.03, phi=200.0):
    """Winnemoeller XDoG. Returns float image in 0..1 (1 = light wood)."""
    g1 = cv2.GaussianBlur(gray01, (0, 0), sigma_px)
    g2 = cv2.GaussianBlur(gray01, (0, 0), sigma_px * k)
    s = (1 + p) * g1 - p * g2
    out = np.where(s >= eps + 0.5, 1.0, 1.0 + np.tanh(phi * (s - (eps + 0.5))))
    # the +0.5 offset: s is centred around the grey value, so the threshold is
    # expressed relative to mid-grey, which is what makes dark skin render as
    # light wood with dark shadow lines instead of a solid block.
    return np.clip(out, 0, 1)


def normalise_tone(rgb, mask, px_per_mm, smooth_mm):
    """CLAHE on lightness so each face/garment is judged by local contrast."""
    # flatten texture (shirt prints, tulle, fur) into flat colour regions first.
    # spatial radius ~ smooth_mm so the amount of abstraction is tied to physical size.
    sp = int(max(3, smooth_mm * px_per_mm)); sr = 22
    flat = cv2.pyrMeanShiftFiltering(np.ascontiguousarray(rgb), sp, sr, maxLevel=1)
    lab = cv2.cvtColor(flat, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0]
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    L2 = clahe.apply(L)
    # light denoise so skin pores / fabric weave don't turn into noise lines
    L2 = cv2.bilateralFilter(L2, 9, 40, 9)
    g = L2.astype(np.float32) / 255.0
    # stretch inside the subject only
    vals = g[mask > 0]
    lo, hi = np.percentile(vals, 1), np.percentile(vals, 99)
    g = np.clip((g - lo) / max(1e-6, hi - lo), 0, 1)
    return g


def ellipse(d_px):
    d = max(1, int(round(d_px))) | 1
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d))


def remove_small(mask, min_area_px):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    keep = np.ones(n, bool)
    keep[0] = False
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= min_area_px
    return keep[lab].astype(np.uint8)


def inner_mask_for(mask, px_per_mm):
    return cv2.erode(mask, ellipse(0.3 * px_per_mm))


def manufacturable(dark, px_per_mm, P):
    """dark: uint8 1 = walnut shows (cut away light layer).  Enforce physical limits."""
    light = 1 - dark
    # 1. light-wood slivers thinner than min_light_mm would snap / burn away -> absorb into dark
    light = cv2.morphologyEx(light, cv2.MORPH_OPEN, ellipse(P["min_light_mm"] * px_per_mm))
    dark = 1 - light
    # 2. split dark into CUT (thick) and SCORE (thin)
    cut = cv2.morphologyEx(dark, cv2.MORPH_OPEN, ellipse(P["min_cut_mm"] * px_per_mm))
    thin = cv2.bitwise_and(dark, 1 - cut)
    # 3. kill tiny islands in both tones
    a = P["min_island_mm2"] * px_per_mm ** 2
    cut = remove_small(cut, a)
    light_islands_ok = remove_small(1 - cut, a)   # light islands too small to glue/weed
    cut = 1 - light_islands_ok
    # 4. smooth cut outline (slight close+open at sub-mm) so potrace gives clean curves
    cut = cv2.morphologyEx(cut, cv2.MORPH_CLOSE, ellipse(0.4 * px_per_mm))
    cut = cv2.medianBlur((cut * 255).astype(np.uint8), 5) // 255
    # score lines: thin dark detail, but drop crumbs and anything already inside a cut
    score = cv2.bitwise_and(thin, 1 - cv2.dilate(cut, ellipse(0.6 * px_per_mm)))
    score = remove_small(score, 1.5 * px_per_mm ** 2)
    if not P["keep_score"]:
        score[:] = 0
    return cut.astype(np.uint8), score.astype(np.uint8)


def trace(mask, px_per_mm, turdsize_mm2=0.5, alphamax=1.0, opttol=0.2):
    """potrace a 0/1 mask -> list of SVG path 'd' strings in millimetres."""
    bmp = potrace.Bitmap(mask.astype(bool))
    path = bmp.trace(turdsize=int(turdsize_mm2 * px_per_mm ** 2), alphamax=alphamax,
                     opticurve=True, opttolerance=opttol)
    s = 1.0 / px_per_mm
    d = []
    for curve in path:
        x, y = curve.start_point.x, curve.start_point.y
        parts = [f"M{x*s:.3f},{y*s:.3f}"]
        for seg in curve:
            if seg.is_corner:
                cx, cy = seg.c.x, seg.c.y
                ex, ey = seg.end_point.x, seg.end_point.y
                parts.append(f"L{cx*s:.3f},{cy*s:.3f}L{ex*s:.3f},{ey*s:.3f}")
            else:
                c1x, c1y = seg.c1.x, seg.c1.y; c2x, c2y = seg.c2.x, seg.c2.y; ex, ey = seg.end_point.x, seg.end_point.y
                parts.append(f"C{c1x*s:.3f},{c1y*s:.3f} {c2x*s:.3f},{c2y*s:.3f} {ex*s:.3f},{ey*s:.3f}")
        parts.append("Z")
        d.append("".join(parts))
    return d


def wood(h, w, base, grain, seed, stretch=18):
    """Cheap procedural wood texture."""
    rng = np.random.default_rng(seed)
    n = rng.random((h // stretch + 2, w // 2 + 2)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    n = cv2.GaussianBlur(n, (0, 0), 1.2)
    n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    img = np.array(base, np.float32)[None, None, :] * (1 - grain) + np.array(base, np.float32)[None, None, :] * grain * (0.6 + 0.8 * n[..., None])
    return np.clip(img, 0, 255).astype(np.uint8)


def render_preview(cut, score, px_per_mm, frame_mm, panel_h_px, panel_w_px, off):
    """Mock-up: maple top layer with walnut showing through cuts, scored lines darker."""
    H, W = panel_h_px, panel_w_px
    maple = wood(H, W, (226, 205, 165), 0.35, 1)
    walnut = wood(H, W, (82, 48, 30), 0.5, 2)
    full_cut = np.zeros((H, W), np.uint8)
    full_score = np.zeros((H, W), np.uint8)
    y, x = off
    full_cut[y:y + cut.shape[0], x:x + cut.shape[1]] = cut
    full_score[y:y + score.shape[0], x:x + score.shape[1]] = score
    f = int(frame_mm * px_per_mm)
    window = np.zeros((H, W), np.uint8); window[f:H - f, f:W - f] = 1
    full_cut = full_cut & window
    out = maple.copy()
    # soft shadow at cut edges to suggest depth (light layer sits ~1mm proud)
    edge = cv2.dilate(full_cut, ellipse(0.5 * px_per_mm)) - full_cut
    out[full_cut == 1] = walnut[full_cut == 1]
    out[edge == 1] = (out[edge == 1] * 0.78).astype(np.uint8)
    sc = full_score == 1
    out[sc] = (out[sc] * 0.42).astype(np.uint8)
    return out


# ------------------------------------------------------------------ STL export
def _polys_of(geom):
    """Flatten any shapely geometry to a list of Polygons (drops lines/points)."""
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if hasattr(geom, "geoms"):
        return [p for g in geom.geoms for p in _polys_of(g)]
    return []


def mask_to_polygons(mask, px_per_mm, tol_mm=0.06):
    """0/1 mask -> list of shapely Polygons (with holes), in millimetres."""
    from shapely.geometry import Polygon
    from shapely.validation import make_valid
    from shapely.ops import unary_union
    m = (mask > 0).astype(np.uint8)
    contours, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hier is None:
        return []
    hier = hier[0]
    eps = tol_mm * px_per_mm
    rings = [cv2.approxPolyDP(c, eps, True).reshape(-1, 2) / px_per_mm for c in contours]
    polys = []
    for i, (nxt, prv, child, parent) in enumerate(hier):
        if parent != -1 or len(rings[i]) < 3:
            continue
        holes = []
        c = child
        while c != -1:
            if len(rings[c]) >= 3:
                holes.append(rings[c])
            c = hier[c][0]
        p = Polygon(rings[i], holes)
        if not p.is_valid:
            p = make_valid(p)          # may return a GeometryCollection with line slivers
        polys += _polys_of(p)
    return _polys_of(unary_union(polys))


_TRI_WORKER = r"""
import sys, pickle, trimesh
g, h = pickle.load(sys.stdin.buffer)
m = trimesh.creation.extrude_polygon(g, h, engine="triangle")
pickle.dump((m.vertices, m.faces), sys.stdout.buffer)
"""


def _extrude_triangle_subprocess(g, height, timeout=60):
    """The 'triangle' C library gives the best (watertight) results on polygons with many
    holes, but segfaults on some inputs.  Run it in a child process so a crash just means
    'no result' instead of taking the whole run down."""
    import pickle, subprocess, sys, trimesh
    try:
        r = subprocess.run([sys.executable, "-c", _TRI_WORKER], input=pickle.dumps((g, height)),
                           capture_output=True, timeout=timeout)
        if r.returncode != 0 or not r.stdout:
            return None
        v, f = pickle.loads(r.stdout)
        return trimesh.Trimesh(v, f, process=True)
    except Exception:
        return None


def extrude(polys, height, z0, min_area=1e-3):
    import trimesh
    out = []
    for p in polys:
        geoms = p.geoms if p.geom_type == "MultiPolygon" else [p]
        for g in geoms:
            if g.geom_type != "Polygon" or g.area < min_area:
                continue
            # snap to a 0.01 mm grid and re-validate: the triangle library segfaults on
            # duplicate / collinear vertices, and earcut leaves gaps on polygons with many holes.
            from shapely import set_precision
            g = set_precision(g, 0.01).buffer(0)
            if g.is_empty or g.geom_type != "Polygon":
                parts = _polys_of(g)
                if not parts:
                    continue
                g = max(parts, key=lambda q: q.area)
            m = trimesh.creation.extrude_polygon(g, height)              # earcut
            if not m.is_watertight:
                m2 = _extrude_triangle_subprocess(g, height)
                if m2 is not None and m2.is_watertight:
                    m = m2
                else:
                    trimesh.repair.fill_holes(m)
            m.apply_translation((0, 0, z0))
            out.append(m)
    return out


def write_stl(path, cut, score, px_per_mm, frame_mm, W, H, off,
              base_mm=3.0, light_mm=1.5, groove_mm=0.6, split=False):
    """Two-tone relief as STL.
    z 0..base_mm            dark base plate (whole panel)
    z base..base+light_mm   light layer: panel minus the dark (cut) regions inside the window
    score lines             grooves groove_mm deep in the light layer
    With split=True also writes <path>_base.stl and <path>_top.stl for two-colour printing.
    """
    import trimesh
    from shapely.geometry import box
    panel_w, panel_h = W / px_per_mm, H / px_per_mm
    # full-panel masks
    dark_full = np.zeros((H, W), np.uint8); score_full = np.zeros((H, W), np.uint8)
    y, x = off
    dark_full[y:y + cut.shape[0], x:x + cut.shape[1]] = cut
    score_full[y:y + score.shape[0], x:x + score.shape[1]] = score
    f = int(frame_mm * px_per_mm)
    window = np.zeros((H, W), np.uint8); window[f:H - f, f:W - f] = 1
    dark_full &= window
    light_full = 1 - dark_full
    score_full &= light_full
    light_solid = light_full & (1 - score_full)        # full height
    light_grooved = light_full & score_full             # reduced height
    # STL y axis points up; image rows point down -> flip rows so the print isn't mirrored
    light_solid, light_grooved = light_solid[::-1], light_grooved[::-1]

    base = trimesh.creation.box((panel_w, panel_h, base_mm))
    base.apply_translation((panel_w / 2, panel_h / 2, base_mm / 2))
    top = extrude(mask_to_polygons(light_solid, px_per_mm), light_mm, base_mm)
    top += extrude(mask_to_polygons(light_grooved, px_per_mm), light_mm - groove_mm, base_mm)
    top_mesh = trimesh.util.concatenate(top)
    whole = trimesh.util.concatenate([base, top_mesh])
    whole.export(path)
    if split:
        root = path[:-4] if path.lower().endswith(".stl") else path
        base.export(root + "_base.stl")
        top_mesh.export(root + "_top.stl")
    return dict(stl=path, triangles=len(whole.faces), size_mm=(round(panel_w, 1), round(panel_h, 1), base_mm + light_mm),
                top_bodies=len(top), top_watertight=all(m.is_watertight for m in top))


# ------------------------------------------------------------------ main
def run(photo, out, height_mm=300, frame_mm=12, level=2, px_per_mm=8.0, cache=None, bust=None, tag="", face_aware=True, stl=False):
    os.makedirs(out, exist_ok=True)
    P = LEVELS[level]
    rgb, alpha = load_subject(photo, cache)
    if bust is not None:
        faces = detect_faces(rgb)
        if not faces:
            raise SystemExit("no face found for --bust")
        faces_lr = sorted(faces, key=lambda f: f[0])  # left to right
        rgb, alpha = crop_bust(rgb, alpha, faces_lr[bust])
        # keep only this person: head ellipse + shoulders trapezoid (neighbours in a group
        # photo would otherwise leak into the crop).  Heuristic, no instance segmentation.
        fx, fy, fw, fh = detect_faces(rgb)[0] if detect_faces(rgb) else (0, 0, rgb.shape[1], rgb.shape[0])
        body = np.zeros(alpha.shape, np.uint8)
        cx = fx + fw // 2
        cv2.ellipse(body, (cx, fy + fh // 2), (int(fw * 1.25), int(fh * 1.45)), 0, 0, 360, 1, -1)
        neck_y = fy + int(fh * 1.15); H = alpha.shape[0]
        poly = np.array([[cx - int(fw * 0.7), neck_y], [cx + int(fw * 0.7), neck_y],
                         [cx + int(fw * 2.6), H], [cx - int(fw * 2.6), H]], np.int32)
        cv2.fillPoly(body, [poly], 1)
        body = cv2.GaussianBlur(body.astype(np.float32), (0, 0), fw * 0.08)
        alpha = (alpha * body).astype(np.uint8)
        # in a bust crop the body runs off the bottom edge: keep that bottom edge open
        alpha = alpha.copy(); alpha[-2:, :] = alpha[-3:-2, :]
    else:
        rgb, alpha = crop_to_subject(rgb, alpha)

    # resample so that the subject height maps to the requested panel window height
    art_h_mm = height_mm - 2 * frame_mm
    scale = art_h_mm * px_per_mm / rgb.shape[0]
    rgb = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(alpha, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_AREA)
    mask = clean_alpha(alpha, px_per_mm)

    g = normalise_tone(rgb, mask, px_per_mm, P["smooth_mm"])
    ink = xdog(g, P["sigma"] * px_per_mm, p=P["p"], eps=P["eps"])
    dark = (ink < 0.5).astype(np.uint8)

    # ---- face-aware detail: faces keep this level's detail, everything else gets the
    # next-simpler level (an illustrator draws the face, and only blocks in the body).
    faces_here = detect_faces(rgb) if face_aware else []
    if faces_here and level < 4:
        Q = LEVELS[min(4, level + 1)]
        g2 = normalise_tone(rgb, mask, px_per_mm, Q["smooth_mm"])
        dark_body = (xdog(g2, Q["sigma"] * px_per_mm, p=Q["p"], eps=Q["eps"]) < 0.5).astype(np.uint8)
        # body: fill small dark specks (prints, fabric texture) so garments read as flat light wood
        body_light = 1 - dark_body
        body_light = cv2.morphologyEx(body_light, cv2.MORPH_CLOSE, ellipse(1.2 * px_per_mm))
        dark_body = 1 - remove_small(body_light, 40 * px_per_mm ** 2)          # tiny light specks -> dark
        dark_body = remove_small(dark_body, 30 * px_per_mm ** 2)              # tiny dark specks -> light
        # soft weight = 1 inside the (enlarged) face boxes, 0 elsewhere
        wgt = np.zeros(dark.shape, np.float32)
        for (x, y, w, h) in faces_here:
            cx, cy = x + w / 2, y + h * 0.5
            cv2.ellipse(wgt, (int(cx), int(cy)), (int(w * 0.95), int(h * 1.15)), 0, 0, 360, 1.0, -1)
        wgt = cv2.GaussianBlur(wgt, (0, 0), 1.5 * px_per_mm)
        dark = np.where(wgt > 0.5, dark, dark_body).astype(np.uint8)
        # hair: dark stuff touching the top half of the face ellipse becomes a solid block
        hair_seed = np.zeros_like(dark)
        for (x, y, w, h) in faces_here:
            cv2.ellipse(hair_seed, (int(x + w / 2), int(y + h * 0.1)), (int(w * 0.9), int(h * 0.7)), 0, 180, 360, 1, -1)
        n, lab = cv2.connectedComponents(dark, connectivity=8)
        touch = np.unique(lab[(hair_seed == 1) & (dark == 1)])
        hair = np.isin(lab, touch[touch > 0]).astype(np.uint8) & inner_mask_for(mask, px_per_mm)
        hair = cv2.morphologyEx(hair, cv2.MORPH_CLOSE, ellipse(2.0 * px_per_mm))
        hair &= (wgt < 0.5).astype(np.uint8) | hair_seed  # never paint over the face itself
        dark = np.maximum(dark, hair)
    # outside the subject is always dark walnut (background), so the figure reads as a light shape.
    # Erode the mask slightly so the subject outline is a clean cut, not a fuzzy fringe.
    inner = cv2.erode(mask, ellipse(0.3 * px_per_mm))
    dark = np.where(inner == 1, dark, 1).astype(np.uint8)

    cut, score = manufacturable(dark, px_per_mm, P)

    # panel geometry: art centred horizontally inside the window
    art_w_mm = cut.shape[1] / px_per_mm
    width_mm = art_w_mm + 2 * frame_mm
    W, H = int(round(width_mm * px_per_mm)), int(round(height_mm * px_per_mm))
    off = (int(frame_mm * px_per_mm), int(frame_mm * px_per_mm))

    cut_d = trace(cut, px_per_mm)
    score_d = trace(score, px_per_mm, turdsize_mm2=0.3) if score.any() else []
    # translate paths into panel coordinates
    tx = f'transform="translate({frame_mm:.2f},{frame_mm:.2f})"'
    svg_path = os.path.join(out, f"design{tag}_L{level}_{P['name']}.svg")
    write_svg_translated(svg_path, width_mm, height_mm, cut_d, score_d, frame_mm, tx)

    prev = render_preview(cut, score, px_per_mm, frame_mm, H, W, off)
    Image.fromarray(prev).save(os.path.join(out, f"preview{tag}_L{level}_{P['name']}.png"))
    Image.fromarray((1 - cut) * 255).save(os.path.join(out, f"mask{tag}_cut_L{level}.png"))
    if score.any():
        Image.fromarray((1 - score) * 255).save(os.path.join(out, f"mask{tag}_score_L{level}.png"))

    if stl:
        st = write_stl(os.path.join(out, f"relief{tag}_L{level}_{P['name']}.stl"), cut, score, px_per_mm,
                       frame_mm, W, H, off, split=True)
        print(st)

    n_cut = len(cut_d); n_score = len(score_d)
    stats = dict(level=level, name=P["name"], panel_mm=(round(width_mm, 1), height_mm),
                 cut_paths=n_cut, score_paths=n_score,
                 light_islands=int(cv2.connectedComponentsWithStats((1 - cut).astype(np.uint8))[0] - 1))
    print(stats)
    return stats


def write_svg_translated(path, w_mm, h_mm, cut_d, score_d, frame_mm, tx):
    cut_path = "".join(cut_d); score_path = "".join(score_d)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
        f'width="{w_mm:.2f}mm" height="{h_mm:.2f}mm" viewBox="0 0 {w_mm:.2f} {h_mm:.2f}">',
        f'<g inkscape:label="3 outer cut (black)" inkscape:groupmode="layer">'
        f'<rect x="0.1" y="0.1" width="{w_mm-0.2:.2f}" height="{h_mm-0.2:.2f}" fill="none" stroke="#000000" stroke-width="0.1"/></g>',
        f'<g inkscape:label="1 window + art cut (red, light layer only)" inkscape:groupmode="layer">'
        f'<rect x="{frame_mm:.2f}" y="{frame_mm:.2f}" width="{w_mm-2*frame_mm:.2f}" height="{h_mm-2*frame_mm:.2f}" fill="none" stroke="#ff0000" stroke-width="0.1"/>'
        f'<path {tx} d="{cut_path}" fill="none" stroke="#ff0000" stroke-width="0.1" fill-rule="evenodd"/></g>',
    ]
    if score_path:
        parts.append(f'<g inkscape:label="2 score / engrave (blue, light layer)" inkscape:groupmode="layer">'
                     f'<path {tx} d="{score_path}" fill="#0000ff" stroke="none" fill-rule="evenodd"/></g>')
    parts.append("</svg>")
    with open(path, "w") as f:
        f.write("\n".join(parts))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("photo")
    ap.add_argument("--out", default="out")
    ap.add_argument("--height-mm", type=float, default=300)
    ap.add_argument("--frame-mm", type=float, default=12)
    ap.add_argument("--level", type=int, default=0, help="1-4, 0 = all")
    ap.add_argument("--px-per-mm", type=float, default=8.0)
    ap.add_argument("--cache", default=None, help="cache file for the background-removed PNG")
    ap.add_argument("--bust", type=int, default=None, help="head-and-shoulders crop of face N (0 = leftmost)")
    ap.add_argument("--tag", default="", help="suffix for output file names")
    ap.add_argument("--no-face-aware", action="store_true", help="same detail everywhere (no face detection)")
    ap.add_argument("--stl", action="store_true", help="also export a 3D-printable two-tone relief (STL)")
    a = ap.parse_args()
    levels = [a.level] if a.level else [1, 2, 3, 4]
    for L in levels:
        run(a.photo, a.out, a.height_mm, a.frame_mm, L, a.px_per_mm, a.cache, a.bust, a.tag, not a.no_face_aware, a.stl)
