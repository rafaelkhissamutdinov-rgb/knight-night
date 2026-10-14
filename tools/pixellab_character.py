# Полный набор спрайтов персонажа из PixelLab (v0.64): персонаж сбоку без оружия → 37 поз по скелету (src/poses.js) →
# ходьба → точка кисти на каждом кадре → карты нормалей. Итог — assets/sprites/<set>/ (+ <set>.json), как у Найта.
# Запуск: python3 tools/pixellab_character.py <set> "<описание>" [--size 64]
# Ключ — PIXELLAB_API_KEY (или файл .pixellab_key). Цена ≈ 20 генераций.
import sys, os, json, math, subprocess, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('set'); ap.add_argument('desc'); ap.add_argument('--size', type=int, default=64)
ap.add_argument('--walk', default='walk')
a = ap.parse_args()
OUT = os.path.join(ROOT, 'assets', 'sprites', a.set); os.makedirs(OUT + '/n', exist_ok=True)
WORK = os.path.join(ROOT, '.pixellab_work', a.set); os.makedirs(WORK, exist_ok=True)
S = float(a.size)

def wait(job):
    for _ in range(120):
        s = req('GET', f'/background-jobs/{job}')
        if s['status'] in ('completed', 'failed'): return s
        time.sleep(8)
    raise SystemExit('timeout ' + job)

# 1. персонаж (вид сбоку, 8 сторон), если ещё нет
cj = os.path.join(WORK, 'character.json')
if not os.path.exists(cj):
    r = req('POST', '/create-character-v3', {'description': a.desc, 'image_size': {'width': a.size, 'height': a.size}, 'view': 'side',
                                               'n_directions': 8, 'outline': 'single color black outline', 'detail': 'medium detail', 'no_background': True})
    s = wait(r['background_job_id']); json.dump(s, open(cj, 'w'))
ch = json.load(open(cj))['last_response']
cid = ch['character_id']
for d in ('east', 'south', 'north'):
    p = os.path.join(WORK, d + '.png')
    if not os.path.exists(p): subprocess.run(['curl', '-sS', '-o', p, ch['storage_urls'][d]], check=True)
Image.open(os.path.join(WORK, 'south.png')).save(os.path.join(OUT, 'front.png'))
Image.open(os.path.join(WORK, 'north.png')).save(os.path.join(OUT, 'back.png'))

# 2. скелет вида сбоку → позы игры
east = os.path.join(WORK, 'east.png')
img, _ = b64img(east)
sk = req('POST', '/estimate-skeleton', {'image': img})
base = {k['label']: [k['x'] * S, k['y'] * S] for k in sk['keypoints']}
P = json.loads(subprocess.run(['node', '-e', "import('" + ROOT + "/src/poses.js').then(m=>console.log(JSON.stringify(m.POSES)))"], capture_output=True, text=True).stdout)
names = [k for k in P if not k.startswith('aim_')] if 'archer' not in a.set.lower() and 'crossbow' not in a.set.lower() else list(P)
SH, EL, WR = base['RIGHT SHOULDER'], base['RIGHT ELBOW'], base['RIGHT ARM']
UA, FA = math.dist(SH, EL), math.dist(EL, WR)
K = 1.75 * S / 64
UPPER = ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR', 'NECK', 'LEFT SHOULDER', 'RIGHT SHOULDER', 'LEFT ELBOW', 'LEFT ARM']
def ik(s, h, ua, fa):
    dx, dy = h[0] - s[0], h[1] - s[1]; d = min(math.hypot(dx, dy), (ua + fa) * 0.98); d = max(d, abs(ua - fa) + 0.5)
    ang = math.atan2(dy, dx); ca = max(-1, min(1, (ua * ua + d * d - fa * fa) / (2 * ua * d)))
    c = [(s[0] + ua * math.cos(e), s[1] + ua * math.sin(e)) for e in (ang + math.acos(ca), ang - math.acos(ca))]
    return max(c, key=lambda q: q[1]), (s[0] + d * math.cos(ang), s[1] + d * math.sin(ang))
def skel(p):
    pts = {k: list(v) for k, v in base.items()}
    lean = p.get('lean', 0) * K * 0.8; crouch = p.get('crouch', 0) * K
    for k in pts:
        if k in UPPER: pts[k][0] += lean; pts[k][1] += crouch
        if k in ('LEFT HIP', 'RIGHT HIP'): pts[k][1] += crouch; pts[k][0] += lean * 0.3
        if k in ('LEFT KNEE', 'RIGHT KNEE'): pts[k][1] += crouch * 0.5; pts[k][0] += crouch * 0.45
    s = pts['RIGHT SHOULDER']
    el, wr = ik(s, (s[0] + p['hx'] * K, s[1] + p['hy'] * K), UA, FA)
    pts['RIGHT ELBOW'], pts['RIGHT ARM'] = list(el), list(wr)
    return [{'x': min(.999, max(.001, x / S)), 'y': min(.999, max(.001, y / S)), 'label': k, 'z_index': 2 if k in ('RIGHT ELBOW', 'RIGHT ARM') else 0} for k, (x, y) in pts.items()], wr
first = [{'x': v[0] / S, 'y': v[1] / S, 'label': k} for k, v in base.items()]
todo = [n for n in names if not os.path.exists(os.path.join(OUT, f'pose_{n}.png'))]
intended = {}
def pose_batch(batch):
    b = batch + [batch[-1]] * max(0, 3 - len(batch))
    kps = []
    for n in b:
        k, w = skel(P[n]); kps.append(k); intended['pose_' + n] = w
    r = req('POST', '/animate-with-skeleton-v3', {'description': a.desc, 'action': 'fighting poses', 'direction': 'east', 'view': 'side',
                                                  'first_frame': img, 'first_frame_keypoints': first, 'keypoints': kps, 'no_background': True})
    s = wait(r['background_job_id'])
    for n, im in zip(b, find_images(s.get('last_response', {}))):
        Image.open(io.BytesIO(base64.b64decode(im.split(',')[-1]))).save(os.path.join(OUT, f'pose_{n}.png'))
for n in names: intended['pose_' + n] = skel(P[n])[1]

# 3. ходьба (шаблон, вид сбоку)
def walk():
    if os.path.exists(os.path.join(OUT, 'walk_0.png')): return
    r = req('POST', '/animate-character', {'character_id': cid, 'template_animation_id': a.walk, 'directions': ['east'], 'mode': 'template'})
    s = wait(r['background_job_ids'][0])
    urls = (s['last_response'].get('storage_urls') or {}).get('frames') or []
    for i, u in enumerate(urls): subprocess.run(['curl', '-sS', '-o', os.path.join(OUT, f'walk_{i}.png'), u], check=True)

with ThreadPoolExecutor(2) as ex:
    futs = [ex.submit(pose_batch, todo[i:i + 15]) for i in range(0, len(todo), 15)] + [ex.submit(walk)]
    for f in futs: f.result()

# 4. точка кисти на каждом кадре (для поз — та рука, что ближе к задуманной)
frames = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.png') and f[:-4] not in ('front', 'back'))
def est(n):
    im, _ = b64img(os.path.join(OUT, n + '.png'))
    k = {x['label']: (x['x'] * S, x['y'] * S) for x in req('POST', '/estimate-skeleton', {'image': im})['keypoints']}
    want = intended.get(n)
    if want:
        best = min((k['RIGHT ARM'], k['LEFT ARM']), key=lambda c: math.dist(c, want))
        w = best if math.dist(best, want) <= 10 * S / 64 else want
    else: w = k['RIGHT ARM']
    return n, [round(w[0], 1), round(w[1], 1)]
with ThreadPoolExecutor(3) as ex: wrists = dict(ex.map(est, frames))
walkN = len([f for f in frames if f.startswith('walk_')])
foot = max(base['LEFT LEG'][1], base['RIGHT LEG'][1])
json.dump({'size': a.size, 'foot': round(foot), 'center': round((base['LEFT HIP'][0] + base['RIGHT HIP'][0]) / 2),
           'anims': {'walk': walkN}, 'frames': {n: {'wrist': w} for n, w in wrists.items()}},
          open(os.path.join(OUT, a.set + '.json'), 'w'), ensure_ascii=False, indent=0)

# 5. карты нормалей (полосы до 32 кадров)
alln = frames + ['front', 'back']
def nm(g):
    strip = Image.new('RGBA', (a.size * len(g), a.size))
    for i, n in enumerate(g): strip.paste(Image.open(os.path.join(OUT, n + '.png')).convert('RGBA'), (a.size * i, 0))
    buf = io.BytesIO(); strip.save(buf, 'PNG')
    p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': len(g), 'convention': 'opengl'}, os.path.join(WORK, 'nstrip_' + g[0]))
    o = Image.open(p[0]).convert('RGBA')
    for i, n in enumerate(g): o.crop((a.size * i, 0, a.size * i + a.size, a.size)).save(os.path.join(OUT, 'n', n + '.png'))
with ThreadPoolExecutor(2) as ex: list(ex.map(nm, [alln[i:i + 32] for i in range(0, len(alln), 32)]))
print(a.set, 'frames', len(frames), 'walk', walkN, 'balance', req('GET', '/balance')['subscription']['generations'])
