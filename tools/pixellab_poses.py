# Позы игры (src/poses.js) → скелеты PixelLab для вида сбоку Найта №10; 3 пачки по ≤15 кадров (по 4 генерации).
import sys, os, json, copy, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
P = json.load(open('poses.json'))
skip = {'aim_high', 'aim_mid', 'aim_low', 'aim_arc'}          # позы лучника — не для рыцаря
names = [k for k in P if k not in skip]
S = 64.0
base = {k['label']: [k['x'] * S, k['y'] * S] for k in json.load(open('out/kn10_east_skel.json'))['keypoints']}
SH, EL, WR = base['RIGHT SHOULDER'], base['RIGHT ELBOW'], base['RIGHT ARM']
UA = math.dist(SH, EL); FA = math.dist(EL, WR)
K = 1.75                                                     # пиксели старой фигурки (≈28 px) → новые (≈49 px)
UPPER = ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR', 'NECK', 'LEFT SHOULDER', 'RIGHT SHOULDER', 'LEFT ELBOW', 'LEFT ARM']
def ik(s, h, a, b):
    dx, dy = h[0] - s[0], h[1] - s[1]; d = min(math.hypot(dx, dy), (a + b) * 0.98); d = max(d, abs(a - b) + 0.5)
    ang = math.atan2(dy, dx); ca = (a * a + d * d - b * b) / (2 * a * d); ca = max(-1, min(1, ca))
    # локоть ниже линии плечо–кисть (сгиб вниз/назад, как у человека)
    e1 = ang + math.acos(ca); e2 = ang - math.acos(ca)
    c1 = (s[0] + a * math.cos(e1), s[1] + a * math.sin(e1)); c2 = (s[0] + a * math.cos(e2), s[1] + a * math.sin(e2))
    el = c1 if c1[1] >= c2[1] else c2
    hx = s[0] + d * math.cos(ang); hy = s[1] + d * math.sin(ang)
    return el, (hx, hy)
def skel(p):
    pts = {k: list(v) for k, v in base.items()}
    lean = p.get('lean', 0) * K * 0.8; crouch = p.get('crouch', 0) * K
    for k in pts:
        if k in UPPER or k in ('RIGHT SHOULDER',): pts[k][0] += lean; pts[k][1] += crouch
        if k in ('LEFT HIP', 'RIGHT HIP'): pts[k][1] += crouch; pts[k][0] += lean * 0.3
        if k in ('LEFT KNEE', 'RIGHT KNEE'): pts[k][1] += crouch * 0.5; pts[k][0] += crouch * 0.45
    s = pts['RIGHT SHOULDER']
    target = (s[0] + p['hx'] * K, s[1] + p['hy'] * K)
    el, wr = ik(s, target, UA, FA)
    pts['RIGHT ELBOW'] = list(el); pts['RIGHT ARM'] = list(wr)
    out = []
    for k, (x, y) in pts.items():
        out.append({'x': min(0.999, max(0.001, x / S)), 'y': min(0.999, max(0.001, y / S)), 'label': k,
                    'z_index': 2 if k in ('RIGHT ELBOW', 'RIGHT ARM') else 0})
    return out, wr
first = [{'x': v[0] / S, 'y': v[1] / S, 'label': k} for k, v in base.items()]
img, _ = b64img('out/kn10_east.png')
wrists = {}
batches = [names[i:i + 15] for i in range(0, len(names), 15)]
jobs = []
for bi, batch in enumerate(batches):
    if len(batch) < 3: batch = batch + [batch[-1]] * (3 - len(batch))
    kps = []
    for n in batch:
        k, w = skel(P[n]); kps.append(k); wrists[n] = [w[0], w[1]]
    r = req('POST', '/animate-with-skeleton-v3', {
        'description': 'slender veteran knight in worn battered plate armor, closed great helm with a faded red plume, torn dark blue tabard, leather straps, empty hands (no weapon)',
        'action': 'sword fighting poses', 'direction': 'east', 'view': 'side', 'first_frame': img,
        'first_frame_keypoints': first, 'keypoints': kps, 'no_background': True})
    jobs.append({'job': r['background_job_id'], 'names': batch}); print(bi, r['background_job_id'], batch)
json.dump({'jobs': jobs, 'wrists': wrists}, open('out/kn10_poses_jobs.json', 'w'))
