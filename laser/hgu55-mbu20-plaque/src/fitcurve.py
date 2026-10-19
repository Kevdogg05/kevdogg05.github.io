"""Polyline -> cubic Bezier fitting (Schneider, Graphics Gems 1990) + ring splitting at corners."""
import numpy as np

def _norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v

def _bez(b, t):
    t = np.asarray(t)[:, None]
    return ((1-t)**3)*b[0] + 3*((1-t)**2)*t*b[1] + 3*(1-t)*(t**2)*b[2] + (t**3)*b[3]

def _chord_u(d):
    seg = np.linalg.norm(np.diff(d, axis=0), axis=1)
    u = np.concatenate([[0], np.cumsum(seg)])
    return u / u[-1] if u[-1] > 0 else u

def _gen(d, u, t1, t2):
    p0, p3 = d[0], d[-1]
    b0 = (1-u)**3; b1 = 3*u*(1-u)**2; b2 = 3*u**2*(1-u); b3 = u**3
    A1 = t1[None, :]*b1[:, None]; A2 = t2[None, :]*b2[:, None]
    C00 = np.sum(A1*A1); C01 = np.sum(A1*A2); C11 = np.sum(A2*A2)
    tmp = d - (p0*(b0+b1)[:, None] + p3*(b2+b3)[:, None])
    X0 = np.sum(A1*tmp); X1 = np.sum(A2*tmp)
    det = C00*C11 - C01*C01
    seg = np.linalg.norm(p3-p0)
    if abs(det) > 1e-12:
        a1 = (X0*C11 - X1*C01)/det; a2 = (C00*X1 - C01*X0)/det
    else:
        a1 = a2 = seg/3
    eps = 1e-6*seg
    if a1 < eps or a2 < eps:
        a1 = a2 = seg/3
    return np.array([p0, p0+t1*a1, p3+t2*a2, p3])

def _maxerr(d, b, u):
    e = np.linalg.norm(_bez(b, u) - d, axis=1)
    i = int(np.argmax(e[1:-1])) + 1 if len(d) > 2 else 0
    return e[i], i

def _reparam(d, u, b):
    q = _bez(b, u)
    q1b = np.array([3*(b[1]-b[0]), 3*(b[2]-b[1]), 3*(b[3]-b[2])])
    q2b = np.array([2*(q1b[1]-q1b[0]), 2*(q1b[2]-q1b[1])])
    t = u[:, None]
    q1 = ((1-t)**2)*q1b[0] + 2*(1-t)*t*q1b[1] + (t**2)*q1b[2]
    q2 = (1-t)*q2b[0] + t*q2b[1]
    num = np.sum((q-d)*q1, axis=1)
    den = np.sum(q1*q1, axis=1) + np.sum((q-d)*q2, axis=1)
    nu = np.where(np.abs(den) > 1e-12, u - num/np.where(np.abs(den) > 1e-12, den, 1), u)
    nu = np.clip(nu, 0, 1)
    nu[0], nu[-1] = 0, 1
    return np.maximum.accumulate(nu)

def fit_cubic(d, t1, t2, err, depth=0):
    if len(d) == 2 or depth > 40:
        dist = np.linalg.norm(d[-1]-d[0])/3
        return [np.array([d[0], d[0]+t1*dist, d[-1]+t2*dist, d[-1]])]
    u = _chord_u(d)
    b = _gen(d, u, t1, t2)
    e, s = _maxerr(d, b, u)
    if e < err:
        return [b]
    if e < err*6:
        for _ in range(12):
            u = _reparam(d, u, b)
            b = _gen(d, u, t1, t2)
            e, s = _maxerr(d, b, u)
            if e < err:
                return [b]
    s = max(1, min(len(d)-2, s))
    tc = _norm(d[s-1] - d[s+1])
    return fit_cubic(d[:s+1], t1, tc, err, depth+1) + fit_cubic(d[s:], -tc, t2, err, depth+1)

def _is_line(d, tol):
    p0, p1 = d[0], d[-1]
    v = p1 - p0; L = np.linalg.norm(v)
    if L < 1e-9:
        return True
    n = np.array([-v[1], v[0]])/L
    return np.max(np.abs((d-p0) @ n)) < tol

def _end_tangent(d, forward=True, look=0.6):
    # tangent from first point toward a point ~look mm along the run
    if not forward:
        d = d[::-1]
    acc = 0
    for i in range(1, len(d)):
        acc += np.linalg.norm(d[i]-d[i-1])
        if acc >= look:
            return _norm(d[i]-d[0])
    return _norm(d[-1]-d[0])

def _turn(pts):
    prev = pts - np.roll(pts, 1, axis=0)
    nxt = np.roll(pts, -1, axis=0) - pts
    return np.degrees(np.abs(np.arctan2(prev[:, 0]*nxt[:, 1]-prev[:, 1]*nxt[:, 0], np.sum(prev*nxt, axis=1))))

def clean_ring(pts, tol=0.006):
    """drop micro-vertices / back-and-forth spikes left by boolean + buffer ops."""
    from shapely.geometry import LinearRing
    pts = np.asarray(pts, float)
    if np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    for _ in range(50):
        a = _turn(pts)
        bad = np.where(a > 150)[0]
        if len(bad) == 0 or len(pts) < 8:
            break
        pts = np.delete(pts, bad[::2], axis=0)
    r = LinearRing(pts).simplify(tol)
    return np.asarray(r.coords)[:-1]

def ring_to_segments(ring, err=0.03, corner_deg=30.0, step=0.35):
    """ring: Nx2 closed (first==last or not). returns list of segments ('L',p0,p1) / ('C',b)."""
    pts = clean_ring(ring)
    if np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    # remove duplicates
    keep = [0]
    for i in range(1, len(pts)):
        if np.linalg.norm(pts[i]-pts[keep[-1]]) > 1e-6:
            keep.append(i)
    pts = pts[keep]
    n = len(pts)
    # corner detection on original vertices
    prev = pts - np.roll(pts, 1, axis=0)
    nxt = np.roll(pts, -1, axis=0) - pts
    ang = np.degrees(np.abs(np.arctan2(prev[:, 0]*nxt[:, 1]-prev[:, 1]*nxt[:, 0], np.sum(prev*nxt, axis=1))))
    corners = list(np.where(ang > corner_deg)[0])
    # densify helper
    def dens(seq):
        out = [seq[0]]
        for a, b in zip(seq[:-1], seq[1:]):
            L = np.linalg.norm(b-a)
            k = int(np.ceil(L/step))
            for j in range(1, k+1):
                out.append(a + (b-a)*j/k)
        return np.array(out)
    segs = []
    if not corners:
        closed = np.vstack([pts, pts[:1]])
        d = dens(closed)
        t = _norm(d[1] - d[-2])
        # split closed smooth ring into two halves for stable fitting
        m = len(d)//2
        tm = _norm(d[m+1]-d[m-1])
        for part, ta, tb in ((d[:m+1], t, -tm), (d[m:], tm, -t)):
            for b in fit_cubic(part, ta, tb, err):
                segs.append(('C', b))
        return segs
    order = corners + [corners[0] + n]
    for a, b in zip(order[:-1], order[1:]):
        idx = [i % n for i in range(a, b+1)]
        run = dens(pts[idx])
        if len(run) < 2:
            continue
        if _is_line(run, err*0.5):
            segs.append(('L', run[0], run[-1]))
            continue
        t1 = _end_tangent(run, True)
        t2 = _end_tangent(run, False)
        for bz in fit_cubic(run, t1, t2, err):
            segs.append(('C', bz))
    return segs

def fmt(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def _pair(x, y):
    a, b = fmt(x), fmt(y)
    return a + ('' if b.startswith('-') else ',') + b

def _rel(cur, pts):
    """relative coords, rounded on the absolute grid so errors never accumulate."""
    out = []
    for p in pts:
        q = np.round(np.asarray(p, float), 2)
        out.append(_pair(q[0]-cur[0], q[1]-cur[1]))
    return out

def segments_to_d(segs, close=True):
    if not segs:
        return ''
    first = segs[0][1][0] if segs[0][0] == 'C' else segs[0][1]
    cur = np.round(np.asarray(first, float), 2)
    out = [f"M{_pair(cur[0], cur[1])}"]
    for i, s in enumerate(segs):
        if s[0] == 'L':
            if close and i == len(segs)-1:
                break                      # Z closes it
            out.append("l" + _rel(cur, [s[2]])[0])
            cur = np.round(np.asarray(s[2], float), 2)
        else:
            b = s[1]
            out.append("c" + " ".join(_rel(cur, b[1:])))
            cur = np.round(np.asarray(b[3], float), 2)
    if close:
        out.append('z')
    return ''.join(out)

def segments_to_open_d(segs):
    d = segments_to_d(segs)
    return d[:-1]

def polyline_to_d(pts, err=0.03, corner_deg=30.0, step=0.35):
    """open polyline -> path d (no Z)"""
    from shapely.geometry import LineString
    pts = np.asarray(LineString(pts).simplify(0.006).coords)
    n = len(pts)
    prev = pts[1:-1]-pts[:-2]; nxt = pts[2:]-pts[1:-1]
    ang = np.degrees(np.abs(np.arctan2(prev[:, 0]*nxt[:, 1]-prev[:, 1]*nxt[:, 0], np.sum(prev*nxt, axis=1))))
    cut = [0] + list(np.where(ang > corner_deg)[0] + 1) + [n-1]
    segs = []
    for a, b in zip(cut[:-1], cut[1:]):
        seq = pts[a:b+1]
        dd = [seq[0]]
        for p, q in zip(seq[:-1], seq[1:]):
            L = np.linalg.norm(q-p); k = int(np.ceil(L/step))
            for j in range(1, k+1):
                dd.append(p+(q-p)*j/k)
        run = np.array(dd)
        if _is_line(run, err*0.5):
            segs.append(('L', run[0], run[-1]))
            continue
        for bz in fit_cubic(run, _end_tangent(run, True), _end_tangent(run, False), err):
            segs.append(('C', bz))
    return segments_to_d(segs, close=False)
