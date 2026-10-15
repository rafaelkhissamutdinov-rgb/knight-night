# Центр кулака на каждом кадре (владелец, 16.10: «меч летает — пусть рыцарь держит его именно в руке»).
# Точка wrist из PixelLab стоит на запястье; рукоять надо ставить в кулак — он дальше по руке на 2–3 px.
# Кулак = середина непрозрачных пикселей рядом с запястьем, лежащих дальше него от корпуса.
#   python3 tools/fist_points.py knight knight_leather knight_marauder   → fist в <набор>.json
import sys, os, json, math
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fist_of(f, wrist):
    a = f.getchannel('A').load(); W, H = f.size
    ys = [y for y in range(H) for x in range(W) if a[x, y] > 100]
    xs = [x for y in range(H) for x in range(W) if a[x, y] > 100]
    if not xs: return None
    # корпус — середина фигуры между плечами и поясом
    top, bot = min(ys), max(ys)
    band = [x for y in range(H) for x in range(W) if a[x, y] > 100 and top + (bot - top) * 0.25 <= y <= top + (bot - top) * 0.5]
    tx, ty = (sum(band) / len(band) if band else W / 2), top + (bot - top) * 0.38
    wx, wy = wrist
    dx, dy = wx - tx, wy - ty; n = math.hypot(dx, dy) or 1; dx, dy = dx / n, dy / n
    pts = [(x, y) for y in range(int(wy) - 5, int(wy) + 6) for x in range(int(wx) - 5, int(wx) + 6)
           if 0 <= x < W and 0 <= y < H and a[x, y] > 100 and math.hypot(x - wx, y - wy) <= 5 and (x - wx) * dx + (y - wy) * dy >= 0.5]
    if len(pts) < 4: return [round(wx, 1), round(wy, 1)]
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    return [round(cx + 0.5, 1), round(cy + 0.5, 1)]

for name in sys.argv[1:]:
    D = os.path.join(ROOT, 'assets', 'sprites', name)
    m = json.load(open(os.path.join(D, name + '.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(D, name + '.png')).convert('RGBA')
    n = 0
    for i, fname in enumerate(O):
        fr = m['frames'].get(fname)
        if not fr or not fr.get('wrist'): continue
        f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S))
        p = fist_of(f, fr['wrist'])
        if p: fr['fist'] = p; n += 1
    multiline = open(os.path.join(D, name + '.json')).read(3).startswith('{\n')   # формат файла не меняем
    json.dump(m, open(os.path.join(D, name + '.json'), 'w'), ensure_ascii=False, indent=0 if multiline else None)
    print(name, n)
