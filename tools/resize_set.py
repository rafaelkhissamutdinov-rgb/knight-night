# Рост персонажа под рыцаря (v0.70, замечание владельца: «рыцарь-карлик, все выше него»).
# Уменьшает каждый кадр набора вокруг стоп (center, foot): холст тот же, точки кисти пересчитываются.
# Цвет — сглаживание и возврат к палитре оригинала (пиксели остаются чёткими), нормали — ближайший пиксель.
#   python3 tools/resize_set.py <набор> <множитель> [--from <другой набор>]   (--from: взять кадры другого набора)
# Повторно к тому же набору не применять — множитель считается от текущего размера.
import sys, os, json, argparse
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('set'); ap.add_argument('k', type=float); ap.add_argument('--from', dest='src')
a = ap.parse_args()
src = a.src or a.set
SD = os.path.join(ROOT, 'assets', 'sprites', src); OD = os.path.join(ROOT, 'assets', 'sprites', a.set)
m = json.load(open(os.path.join(SD, src + '.json')))
S, cols, order = m['size'], m['sheet']['cols'], m['sheet']['order']
cx, fy = m['center'], m['foot']
k = a.k

def shrink(im, normal=False):
    bb = im.getbbox()
    if not bb: return im
    w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
    if normal: small = im.resize((w, h), Image.NEAREST)
    else:
        sm = im.resize((w, h), Image.LANCZOS)
        alpha = sm.getchannel('A').point(lambda v: 255 if v > 110 else 0)
        pal = im.convert('RGB').quantize(colors=64)
        small = sm.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA'); small.putalpha(alpha)
    out = Image.new('RGBA', im.size)
    out.alpha_composite(small, (round(cx - cx * k), round(fy + 1 - (fy + 1) * k)))   # стопы и середина — на месте
    return out

os.makedirs(OD, exist_ok=True)
for suf, normal in (('', False), ('_n', True)):
    p = os.path.join(SD, src + suf + '.png')
    if not os.path.exists(p): continue
    sh = Image.open(p).convert('RGBA'); out = Image.new('RGBA', sh.size)
    for i in range(len(order)):
        box = ((i % cols) * S, (i // cols) * S, (i % cols + 1) * S, (i // cols + 1) * S)
        out.paste(shrink(sh.crop(box), normal), box[:2])
    out.save(os.path.join(OD, a.set + suf + '.png'), optimize=True)
for f in m['frames'].values():
    for key in ('wrist', 'back'):
        if key in f: f[key] = [round(cx + (f[key][0] - cx) * k, 1), round(fy + (f[key][1] - fy) * k, 1)]
m['scaled'] = round(m.get('scaled', 1) * k, 3)
json.dump(m, open(os.path.join(OD, a.set + '.json'), 'w'), ensure_ascii=False, indent=0)
print(a.set, 'из', src, '×', k)
