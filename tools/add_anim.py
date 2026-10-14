# Добавить анимацию из .pixellab_work/anim_<набор>/ в лист набора (v0.70): кадры <ключ>_0…N, нормали, anims[ключ].
#   python3 tools/add_anim.py <набор> <ключ> <анимация> <номера кадров через запятую или a-b>
# Холст генерации: стопы на C-9, середина по x = C/2 (tools/pixellab_anim.py). Оружие на этих кадрах нарисовано —
# в игре своё (кодом) на время приёма прячется.
import sys, os, json, io, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
set_, key, act, spec = sys.argv[1:5]
idx = []
for part in spec.split(','):
    if '-' in part: a, b = map(int, part.split('-')); idx += list(range(a, b + 1))
    else: idx.append(int(part))
SD = os.path.join(ROOT, 'assets', 'sprites', set_)
m = json.load(open(os.path.join(SD, set_ + '.json')))
S, cols, order = m['size'], m['sheet']['cols'], m['sheet']['order']
sheets = {s: Image.open(os.path.join(SD, set_ + s + '.png')).convert('RGBA') for s in ('', '_n') if os.path.exists(os.path.join(SD, set_ + s + '.png'))}
frames = {n: {s: sh.crop(((i % cols) * S, (i // cols) * S, (i % cols + 1) * S, (i // cols + 1) * S)) for s, sh in sheets.items()} for i, n in enumerate(order)}
for n in [n for n in list(frames) if n.startswith(key + '_')]: frames.pop(n); m['frames'].pop(n, None)
AD = os.path.join(ROOT, '.pixellab_work', 'anim_' + set_)
new = []
for j, i in enumerate(idx):
    im = Image.open(os.path.join(AD, f'{act}_{i:02d}.png')).convert('RGBA')
    C = im.width
    ox, oy = C // 2 - m['center'], C - 9 - m['foot']
    c = Image.new('RGBA', (S, S)); c.alpha_composite(im, (-ox, -oy))
    n = f'{key}_{j}'; frames[n] = {'': c}; m['frames'][n] = {}; new.append(n)
m.setdefault('anims', {})[key] = len(idx)
# нормали новых кадров (полоса)
if '_n' in sheets:
    for g0 in range(0, len(new), 16):
        g = new[g0:g0 + 16]
        strip = Image.new('RGBA', (S * len(g), S))
        for i, n in enumerate(g): strip.alpha_composite(frames[n][''], (S * i, 0))
        buf = io.BytesIO(); strip.save(buf, 'PNG')
        p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': len(g), 'convention': 'opengl'},
                os.path.join(AD, f'n_{key}_{g0}'))
        o = Image.open(p[0]).convert('RGBA')
        for i, n in enumerate(g): frames[n]['_n'] = o.crop((S * i, 0, S * i + S, S))
order = list(frames)
rows = (len(order) + cols - 1) // cols
for s in sheets:
    out = Image.new('RGBA', (cols * S, rows * S))
    for i, n in enumerate(order):
        if s in frames[n]: out.paste(frames[n][s], ((i % cols) * S, (i // cols) * S))
    out.save(os.path.join(SD, set_ + s + '.png'), optimize=True)
m['sheet'] = {'cols': cols, 'order': order}
json.dump(m, open(os.path.join(SD, set_ + '.json'), 'w'), ensure_ascii=False, indent=0)
print(set_, key, len(idx), 'кадров; всего', len(order))
