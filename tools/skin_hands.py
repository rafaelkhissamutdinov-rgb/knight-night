# Кулак на каждом кадре скина по скелету PixelLab (v0.83, владелец: «меч летает — пусть держит в руке, в любом скине»).
# Перенос костюма (knight_leather, knight_marauder) сдвигает руки — точка кисти от латного Найта на них не попадает.
# /estimate-skeleton (≈ 0,05 генерации за кадр) даёт локти и кисти; берём кисть, ближнюю к задуманной (wrist в json),
# и сдвигаем на 1,5 px по направлению локоть → кисть — в середину кулака. Результат — fist в <набор>.json.
#   python3 tools/skin_hands.py knight knight_leather knight_marauder
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'hands'); os.makedirs(W, exist_ok=True)
base = json.load(open(os.path.join(ROOT, 'assets/sprites/knight/knight.json')))

for name in sys.argv[1:]:
    D = os.path.join(ROOT, 'assets', 'sprites', name)
    m = json.load(open(os.path.join(D, name + '.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(D, name + '.png')).convert('RGBA')
    cache_f = os.path.join(W, name + '.json')
    cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
    todo = [(i, n) for i, n in enumerate(O) if (m['frames'].get(n) or {}).get('wrist') and n not in cache]
    def est(a):
        i, n = a
        f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S))
        p = os.path.join(W, f'{name}_{n}.png'); f.save(p)
        im, _ = b64img(p)
        try: k = {x['label']: (x['x'] * S, x['y'] * S) for x in req('POST', '/estimate-skeleton', {'image': im})['keypoints']}
        except SystemExit as e: print('сбой', n, str(e)[:100], flush=True); return n, None
        return n, {kk: k[kk] for kk in ('LEFT ARM', 'RIGHT ARM', 'LEFT ELBOW', 'RIGHT ELBOW') if kk in k}
    with ThreadPoolExecutor(6) as ex:
        for n, k in ex.map(est, todo):
            if k: cache[n] = k
    json.dump(cache, open(cache_f, 'w'))
    alpha = sh.getchannel('A').load()
    n_set = 0
    for i, n in enumerate(O):
        fr = m['frames'].get(n)
        k = cache.get(n)
        if not fr or not fr.get('wrist') or not k: continue
        want = (base['frames'].get(n) or fr)['wrist']
        side = min(('LEFT', 'RIGHT'), key=lambda s: math.dist(k[s + ' ARM'], want))
        hx, hy = k[side + ' ARM']; ex_, ey = k[side + ' ELBOW']
        if math.dist((hx, hy), want) > 12: hx, hy = fr['wrist']; ex_, ey = hx - 1, hy   # скелет промахнулся — как было
        dx, dy = hx - ex_, hy - ey; L = math.hypot(dx, dy) or 1
        fx, fy = hx + dx / L * 1.5, hy + dy / L * 1.5
        ox, oy = (i % C) * S, (i // C) * S
        if not (0 <= fx < S and 0 <= fy < S) or alpha[ox + int(fx), oy + int(fy)] < 60: fx, fy = hx, hy   # кулак — на рисунке
        fr['fist'] = [round(fx, 1), round(fy, 1)]; n_set += 1
    multiline = open(os.path.join(D, name + '.json')).read(3).startswith('{\n')
    json.dump(m, open(os.path.join(D, name + '.json'), 'w'), ensure_ascii=False, indent=0 if multiline else None)
    print(name, n_set, flush=True)
print(req('GET', '/balance')['subscription']['generations'])
