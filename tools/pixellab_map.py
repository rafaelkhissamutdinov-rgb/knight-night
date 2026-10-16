# Карта замка (v0.93, владелец: «карту улучшить визуально, попросить PixelLab проработать»): значки для карты
# (место отдыха, лавка, сундук, босс, задание, лестница, заперто, «ты здесь», роза ветров) и пергамент с рамкой.
# Запуск: python3 tools/pixellab_map.py [имя ...]           → варианты в .pixellab_work/map/<имя>_NN.png + лист
#         python3 tools/pixellab_map.py pick <имя> <номер>   → assets/ui/map_<имя>.png
# Ключ — PIXELLAB_API_KEY.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'map'); os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'ui')
ICON = ('tiny pixel art map marker icon drawn in dark brown and red ink on an old parchment map, medieval cartography style, '
        'single symbol centered, bold readable silhouette, limited palette of sepia, dark brown, deep red and a little gold, transparent background')
ITEMS = {
    'rest': (32, 'a small campfire with three flames, a place to rest'),
    'shop': (32, 'a small coin pouch with a gold coin, a merchant shop'),
    'chest': (32, 'a wooden treasure chest with iron bands and a lock, front view'),
    'boss': (32, 'a menacing skull with a crown, danger, boss lair'),
    'quest': (32, 'a bold exclamation mark on a small scroll, a quest objective'),
    'stairs': (32, 'a small staircase going up, stairs between floors'),
    'lock': (32, 'a small closed padlock, a locked door'),
    'you': (32, 'a knight helmet with a red feather plume, you are here marker'),
    'compass': (64, 'an ornate compass rose with north arrow, medieval map decoration'),
    'parchment': ((320, 176), 'an empty old parchment map sheet with a decorative dark wooden and brass frame border, ornamented corners, '
                  'stains and worn edges, the center left blank for drawing, top-down flat view, no text'),
}

if len(sys.argv) > 1 and sys.argv[1] == 'pick':
    im = Image.open(os.path.join(WORK, f'{sys.argv[2]}_{int(sys.argv[3]):02d}.png')).convert('RGBA')
    im.save(os.path.join(OUT, 'map_' + sys.argv[2] + '.png')); print('ok')
else:
    names = sys.argv[1:] or list(ITEMS)
    for n in names:
        size, desc = ITEMS[n]
        w, h = size if isinstance(size, tuple) else (size, size)
        # все значки — один вид: круглый пергаментный жетон с тёмным ободком (как лучший вариант костра)
        style = (ICON + ', inside a small round parchment badge with a dark brown ring') if n not in ('parchment', 'compass') else \
                'detailed pixel art, warm sepia and brown palette, dark fantasy RPG UI' if n == 'parchment' else ICON
        paths = run('/generate-image-v2', {'description': desc + '. ' + style, 'image_size': {'width': w, 'height': h}, 'no_background': n != 'parchment'},
                    os.path.join(WORK, n))
        sheet(paths, os.path.join(WORK, n + '_sheet.png'), scale=4 if w <= 64 else 2, cols=8 if w <= 64 else 2)
        print(n, len(paths), flush=True)
    print('balance', req('GET', '/balance')['subscription']['generations'])
