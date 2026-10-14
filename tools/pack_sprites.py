# Набор кадров → лист спрайтов (v0.64): assets/sprites/<набор>/<набор>.png (кадры 64×64 сеткой по 16 в ряд)
# и <набор>_n.png (нормали), порядок кадров — "sheet" в <набор>.json. Отдельные PNG кадров после упаковки удаляются.
# Лист удобно править в Aseprite / Piskel (сетка 64×64). Запуск: python3 tools/pack_sprites.py [набор ...] (без имён — все).
import sys, os, json, glob
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sprites')
COLS = 16

def pack(name):
    d = os.path.join(ROOT, name); jp = os.path.join(d, name + '.json')
    m = json.load(open(jp))
    order = m.get('sheet', {}).get('order') or [*m['frames'].keys(), 'front', 'back']
    if m.get('sheet') and not os.path.exists(os.path.join(d, order[0] + '.png')):
        print(name, 'уже упакован'); return
    size = m['size']; rows = (len(order) + COLS - 1) // COLS
    for sub, suffix in (('', ''), ('n', '_n')):
        sheet = Image.new('RGBA', (COLS * size, rows * size))
        for i, n in enumerate(order):
            p = os.path.join(d, sub, n + '.png')
            if os.path.exists(p): sheet.paste(Image.open(p).convert('RGBA'), ((i % COLS) * size, (i // COLS) * size))
        sheet.save(os.path.join(d, name + suffix + '.png'), optimize=True)
    m['sheet'] = {'cols': COLS, 'order': order}
    json.dump(m, open(jp, 'w'), ensure_ascii=False, indent=0)
    for n in order:
        for p in (os.path.join(d, n + '.png'), os.path.join(d, 'n', n + '.png')):
            if os.path.exists(p): os.remove(p)
    if os.path.isdir(os.path.join(d, 'n')) and not os.listdir(os.path.join(d, 'n')): os.rmdir(os.path.join(d, 'n'))
    print(name, len(order), 'кадров')

if __name__ == '__main__':
    names = sys.argv[1:] or [os.path.basename(p) for p in sorted(glob.glob(os.path.join(ROOT, '*'))) if os.path.isdir(p)]
    for n in names:
        if os.path.exists(os.path.join(ROOT, n, n + '.json')): pack(n)
