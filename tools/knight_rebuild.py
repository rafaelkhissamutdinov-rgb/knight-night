# Лист Найта v0.69: кадры 96×96 (было 64 — бег и кувырок обрезались), новые анимации в его росте
# (tools/pixellab_knight_anim.py: бег, ходьба, разворот, кувырок, убирание в ножны), точка кисти и точка «за спиной»
# (куда крепится оружие в ножнах) на каждом кадре, карты нормалей новых кадров.
#   python3 tools/knight_rebuild.py           → assets/sprites/knight/knight.png, knight_n.png, knight.json
import sys, os, json, io, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SET = os.path.join(ROOT, 'assets', 'sprites', 'knight')
ANIM = os.path.join(ROOT, '.pixellab_work', 'knight_anim')
WORK = os.path.join(ROOT, '.pixellab_work', 'knight96'); os.makedirs(WORK + '/n', exist_ok=True)
NEW = 96
# анимация → (файлы генерации, номера кадров); холст генерации 128, стопы на y 119, бёдра по x 64
TAKE = {
    'run': ('runloop', range(0, 8)),
    'walk': ('walkloop', range(0, 8)),
    'turn': ('turn', range(1, 8)),
    'roll': ('roll', range(2, 12)),
    'sheathe': ('sheathe', range(6, 13)),   # в первых кадрах PixelLab дорисовал свой меч — берём, где рука уходит за спину
}

m = json.load(open(os.path.join(SET, 'knight.json')))
S, cols, order = m['size'], m['sheet']['cols'], m['sheet']['order']
pad = (NEW - S) // 2 if S < NEW else 0
sh = {s: Image.open(os.path.join(SET, f'knight{s}.png')).convert('RGBA') for s in ('', '_n')}
frames, normals = {}, {}
for i, n in enumerate(order):
    box = ((i % cols) * S, (i // cols) * S, (i % cols + 1) * S, (i // cols + 1) * S)
    for s, store in (('', frames), ('_n', normals)):
        c = Image.new('RGBA', (NEW, NEW)); c.alpha_composite(sh[s].crop(box), (pad, pad)); store[n] = c
meta = {k: v for k, v in m.items() if k not in ('sheet',)}
meta['size'] = NEW; meta['foot'] = m['foot'] + pad; meta['center'] = m['center'] + pad
meta['frames'] = {n: {**f, 'wrist': [f['wrist'][0] + pad, f['wrist'][1] + pad]} if 'wrist' in f else dict(f) for n, f in m['frames'].items()}

# новые анимации вместо прежних мелких
ox, oy = 64 - meta['center'], 119 - meta['foot']
added = []
for key, (src, idx) in TAKE.items():
    files = [os.path.join(ANIM, f'{src}_{i:02d}.png') for i in idx]
    if not all(os.path.exists(f) for f in files): print('нет кадров', key); continue
    for n in [n for n in list(frames) if n.startswith(key + '_')]:
        frames.pop(n); normals.pop(n, None); meta['frames'].pop(n, None)
    for j, f in enumerate(files):
        n = f'{key}_{j}'
        frames[n] = Image.open(f).convert('RGBA').crop((ox, oy, ox + NEW, oy + NEW)); added.append(n)
    meta['anims'][key] = len(files)

def est(n):
    buf = io.BytesIO(); frames[n].save(buf, 'PNG')
    k = {x['label']: (x['x'] * NEW, x['y'] * NEW) for x in req('POST', '/estimate-skeleton', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}})['keypoints']}
    return n, [round(k['RIGHT ARM'][0], 1), round(k['RIGHT ARM'][1], 1)]
with ThreadPoolExecutor(4) as ex:
    for n, w in ex.map(est, added): meta['frames'].setdefault(n, {})['wrist'] = w

# точка за спиной (крепление ножен): верх шлема → уровень плеч, задний край корпуса (кадр смотрит вправо)
for n, im in frames.items():
    a = im.getchannel('A'); px = a.load(); bb = im.getbbox()
    if not bb or n in ('front', 'back'): continue
    top = bb[1]; y = min(bb[3] - 1, top + 17)
    xs = [x for x in range(NEW) if px[x, y] > 100]
    if not xs: continue
    meta['frames'].setdefault(n, {})['back'] = [xs[0] + 3, y]

# нормали новых кадров (полосы по 16)
def nm(g):
    strip = Image.new('RGBA', (NEW * len(g), NEW))
    for i, n in enumerate(g): strip.alpha_composite(frames[n], (NEW * i, 0))
    buf = io.BytesIO(); strip.save(buf, 'PNG')
    p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': len(g), 'convention': 'opengl'}, os.path.join(WORK, 'nstrip_' + g[0]))
    o = Image.open(p[0]).convert('RGBA')
    for i, n in enumerate(g): normals[n] = o.crop((NEW * i, 0, NEW * i + NEW, NEW))
with ThreadPoolExecutor(2) as ex: list(ex.map(nm, [added[i:i + 16] for i in range(0, len(added), 16)]))

# лист
order = list(frames)
rows = (len(order) + cols - 1) // cols
for s, store in (('', frames), ('_n', normals)):
    out = Image.new('RGBA', (cols * NEW, rows * NEW))
    for i, n in enumerate(order):
        if n in store: out.paste(store[n], ((i % cols) * NEW, (i // cols) * NEW))
    out.save(os.path.join(SET, f'knight{s}.png'), optimize=True)
meta['sheet'] = {'cols': cols, 'order': order}
json.dump(meta, open(os.path.join(SET, 'knight.json'), 'w'), ensure_ascii=False, indent=0)
print('кадров', len(order), 'новых', len(added), meta['anims'], 'баланс', req('GET', '/balance')['subscription']['generations'])
