# Плавность и объём для готового набора персонажа (v0.67), как у Найта (v0.61):
#   turn_0…7    — разворот через вид спереди (а не мгновенное отражение «наклейки»);
#   walkS / walkN — шаги к камере и от неё (ходьба вглубь пола);
#   tw_…        — промежуточные позы между стойкой, замахом и ударом (в json — параметры позы);
#   нормали всех новых кадров (объём под живым светом).
# Запуск: python3 tools/pixellab_smooth.py <набор> "<описание как при создании>"   (≈12 генераций)
# Нужен .pixellab_work/<набор>/character.json (персонаж PixelLab из tools/pixellab_character.py).
import sys, os, json, math, subprocess, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('set'); ap.add_argument('desc')
ap.add_argument('--no-depth', action='store_true')
ap.add_argument('--redo', nargs='*', default=[])   # переделать: turn / walkS / walkN / tw   # парящим (призрак, босс) шаги вглубь не нужны
a = ap.parse_args()
OUT = os.path.join(ROOT, 'assets', 'sprites', a.set); WORK = os.path.join(ROOT, '.pixellab_work', a.set)
os.makedirs(OUT + '/n', exist_ok=True)
meta = json.load(open(os.path.join(OUT, a.set + '.json')))
S = float(meta['size']); size = meta['size']

def wait(job):
    for _ in range(150):
        s = req('GET', f'/background-jobs/{job}')
        if s['status'] in ('completed', 'failed'): return s
        time.sleep(8)
    raise SystemExit('timeout ' + job)

def frames_of(s):
    # кадры задания: base64 или ссылки на хранилище (их — через curl)
    imgs = [Image.open(io.BytesIO(base64.b64decode(b.split(',')[-1]))).convert('RGBA') for b in find_images(s.get('last_response', {}))]
    if imgs: return imgs
    urls = []
    def walk(o):
        if isinstance(o, dict): [walk(v) for v in o.values()]
        elif isinstance(o, list): [walk(v) for v in o]
        elif isinstance(o, str) and o.startswith('http') and '.png' in o: urls.append(o)
    walk(s.get('last_response', {}))
    out = []
    for i, u in enumerate(urls):
        p = os.path.join(WORK, f'_dl_{i}.png'); subprocess.run(['curl', '-sS', '-o', p, u], check=True); out.append(Image.open(p).convert('RGBA'))
    return out

REF = None   # рост персонажа в кадре вида сбоку (по east.png)
def fit(im, scale_to_ref=False):
    # кадр к размеру набора: если холст другой — персонажа к тому же росту, стопы — на линию стопы набора, по центру
    if im.size == (size, size) and not scale_to_ref: return im
    print('fit', im.size, im.getbbox())
    bb = im.getbbox()
    if not bb: return Image.new('RGBA', (size, size))
    fig = im.crop(bb)
    k = REF / fig.height if REF and scale_to_ref else size / im.width
    if abs(k - 1) > 0.05: fig = fig.resize((max(1, round(fig.width * k)), max(1, round(fig.height * k))), Image.NEAREST)
    c = Image.new('RGBA', (size, size))
    c.alpha_composite(fig, (max(0, meta['center'] - fig.width // 2), max(0, meta['foot'] + 1 - fig.height)))
    return c

# 0. лист → отдельные кадры (пересоберём в конце)
if 'sheet' in meta:
    cols, order = meta['sheet']['cols'], meta['sheet']['order']
    for sub, suf in (('', ''), ('n', '_n')):
        sh = Image.open(os.path.join(OUT, a.set + suf + '.png'))
        for i, n in enumerate(order):
            p = os.path.join(OUT, sub, n + '.png')
            if not os.path.exists(p): sh.crop(((i % cols) * size, (i // cols) * size, (i % cols + 1) * size, (i // cols + 1) * size)).save(p)
    del meta['sheet']
for key in a.redo:   # убрать прежние кадры — сгенерируются заново
    for n in [n for n in meta['frames'] if n.startswith(key + '_')]:
        meta['frames'].pop(n)
        for sub in ('', 'n'):
            p = os.path.join(OUT, sub, n + '.png')
            if os.path.exists(p): os.remove(p)
    meta.get('anims', {}).pop(key, None)

ch = json.load(open(os.path.join(WORK, 'character.json')))['last_response']
cid = ch['character_id']
west = os.path.join(WORK, 'west.png')
if not os.path.exists(west): subprocess.run(['curl', '-sS', '-o', west, ch['storage_urls']['west']], check=True)
new = []

# 1. разворот (8 кадров) и ходьба вглубь (шаблон, к камере и от неё)
def turn():
    if os.path.exists(os.path.join(OUT, 'turn_0.png')): return
    r = req('POST', '/animate-character', {'character_id': cid, 'mode': 'pixminimax', 'directions': ['east'], 'frame_count': 8, 'keep_first_frame': False,
        'action_description': 'turns around in place smoothly to face the opposite direction, rotating the body through the front view',
        'subject_description': a.desc[:300], 'initial_pose': 'standing upright facing right', 'end_frame': b64img(west)[0]})
    fr = frames_of(wait(r['background_job_ids'][0]))[:8]
    for i, im in enumerate(fr): fit(im, True).save(os.path.join(OUT, f'turn_{i}.png'))
def depth(d, key):
    if os.path.exists(os.path.join(OUT, f'{key}_0.png')): return
    r = req('POST', '/animate-character', {'character_id': cid, 'template_animation_id': 'walk', 'directions': [d], 'mode': 'template'})
    fr = frames_of(wait(r['background_job_ids'][0]))
    for i, im in enumerate(fr): fit(im).save(os.path.join(OUT, f'{key}_{i}.png'))

# 2. промежуточные позы — скелет как в tools/pixellab_character.py
east = os.path.join(WORK, 'east.png')
img, _ = b64img(east)
_bb = Image.open(east).convert('RGBA').getbbox(); REF = _bb[3] - _bb[1]
base = {k['label']: [k['x'] * S, k['y'] * S] for k in req('POST', '/estimate-skeleton', {'image': img})['keypoints']}
P = json.loads(subprocess.run(['node', '-e', "import('" + ROOT + "/src/poses.js').then(m=>console.log(JSON.stringify(m.POSES)))"], capture_output=True, text=True).stdout)
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
KEYS = ['hx', 'hy', 'angle', 'lean', 'crouch']
def lerp(x, y, k): return {key: P[x][key] + (P[y][key] - P[x][key]) * k for key in KEYS}
pairs = [('idle', g, 0.5) for g in ('guard_high', 'guard_mid', 'guard_low')]
for h in ('high', 'mid', 'low'):
    pairs += [('idle', f'windup_{h}', 0.5), (f'windup_{h}', f'strike_{h}', 0.33), (f'windup_{h}', f'strike_{h}', 0.66), (f'strike_{h}', 'idle', 0.5)]
for m in ('thrust', 'diagUp', 'diagDown'): pairs += [(f'windup_{m}', f'strike_{m}', 0.33), (f'windup_{m}', f'strike_{m}', 0.66)]
pairs += [('windup_whirl', 'strike_whirl', 0.5), ('idle', 'stagger', 0.5), ('idle', 'hurt', 0.5)]
items = [(f'tw_{x}__{y}_{int(k * 100)}', lerp(x, y, k)) for x, y, k in pairs]
tw_pose, tw_wrist = {}, {}
def tween_batch(batch):
    if all(os.path.exists(os.path.join(OUT, n + '.png')) for n, _ in batch): return
    b = batch + [batch[-1]] * max(0, 3 - len(batch))
    r = req('POST', '/animate-with-skeleton-v3', {'description': a.desc, 'action': 'fighting poses', 'direction': 'east', 'view': 'side',
        'first_frame': img, 'first_frame_keypoints': first, 'keypoints': [skel(p)[0] for _, p in b], 'no_background': True})
    for (n, _), im in zip(b, frames_of(wait(r['background_job_id']))): fit(im).save(os.path.join(OUT, n + '.png'))
for n, p in items: tw_pose[n] = {k: round(v, 2) for k, v in p.items()}; tw_wrist[n] = skel(p)[1]

with ThreadPoolExecutor(2) as ex:
    futs = [ex.submit(turn)] + ([] if a.no_depth else [ex.submit(depth, 'south', 'walkS'), ex.submit(depth, 'north', 'walkN')])
    futs += [ex.submit(tween_batch, items[i:i + 15]) for i in range(0, len(items), 15)]
    for f in futs: f.result()

# 3. кисть: у промежуточных — по скелету (уточнить оценкой), у поворота и ходьбы вглубь клинка не видно
def est(n):
    im, _ = b64img(os.path.join(OUT, n + '.png'))
    k = {x['label']: (x['x'] * S, x['y'] * S) for x in req('POST', '/estimate-skeleton', {'image': im})['keypoints']}
    want = tw_wrist[n]
    best = min((k['RIGHT ARM'], k['LEFT ARM']), key=lambda c: math.dist(c, want))
    w = best if math.dist(best, want) <= 10 * S / 64 else want
    return n, [round(w[0], 1), round(w[1], 1)]
tws = [n for n, _ in items if os.path.exists(os.path.join(OUT, n + '.png'))]
with ThreadPoolExecutor(3) as ex: wr = dict(ex.map(est, tws))
for n in tws: meta['frames'][n] = {'wrist': wr[n], 'pose': tw_pose[n]}
anims = meta.setdefault('anims', {})
for key in ('turn', 'walkS', 'walkN'):
    fs = sorted((f for f in os.listdir(OUT) if f.startswith(key + '_') and f.endswith('.png')), key=lambda f: int(f[len(key) + 1:-4]))
    if fs:
        anims[key] = len(fs)
        for f in fs: meta['frames'].setdefault(f[:-4], {})
json.dump(meta, open(os.path.join(OUT, a.set + '.json'), 'w'), ensure_ascii=False, indent=0)

# 4. нормали новых кадров
todo = [n for n in meta['frames'] if not os.path.exists(os.path.join(OUT, 'n', n + '.png'))]
def nm(g):
    strip = Image.new('RGBA', (size * len(g), size))
    for i, n in enumerate(g): strip.paste(Image.open(os.path.join(OUT, n + '.png')).convert('RGBA'), (size * i, 0))
    buf = io.BytesIO(); strip.save(buf, 'PNG')
    p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': len(g), 'convention': 'opengl'}, os.path.join(WORK, 'nstrip_' + g[0]))
    o = Image.open(p[0]).convert('RGBA')
    for i, n in enumerate(g): o.crop((size * i, 0, size * i + size, size)).save(os.path.join(OUT, 'n', n + '.png'))
with ThreadPoolExecutor(2) as ex: list(ex.map(nm, [todo[i:i + 32] for i in range(0, len(todo), 32)]))
print(a.set, 'smooth: +', len(tws), 'tw,', anims, 'balance', req('GET', '/balance')['subscription']['generations'])

# 5. обратно в лист
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'pack_sprites.py'), a.set], check=True)
