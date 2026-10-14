# Предмет или деталь комнаты из PixelLab (v0.64) в разрешении экрана (1 px = 1 px экрана, мир ×2): двери, окна, знамёна, бочки…
# Запуск: python3 tools/pixellab_object.py <имя> <ширина> <высота> "<описание>"   → варианты в .pixellab_work/obj/<имя>_NN.png + лист
#         python3 tools/pixellab_object.py pick <имя> <номер>                      → assets/objects/<имя>.png
# Ключ — PIXELLAB_API_KEY.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'obj'); os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'objects'); os.makedirs(OUT, exist_ok=True)
STYLE = ('pixel art game asset for a 2D side-view castle game, seen straight from the front, detailed high quality pixel art, '
         'muted dusky colors, evenly and softly lit (no strong light source), single color dark outline, transparent background')

if sys.argv[1] == 'pick':
    im = Image.open(os.path.join(WORK, f'{sys.argv[2]}_{int(sys.argv[3]):02d}.png')).convert('RGBA')
    out = sys.argv[4] if len(sys.argv) > 4 else sys.argv[2]   # вариант — под своим именем (decor_banner_1)
    im.crop(im.getbbox()).save(os.path.join(OUT, out + '.png'))  # без пустых полей: низ картинки = пол
    print('ok')
else:
    name, w, h, desc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    paths = run('/generate-image-v2', {'description': desc + '. ' + STYLE, 'image_size': {'width': w, 'height': h}, 'no_background': True},
                os.path.join(WORK, name))
    sheet(paths, os.path.join(WORK, name + '_sheet.png'), scale=2, cols=min(4, len(paths)) if len(paths) != 9 else 3)
    print(len(paths), req('GET', '/balance')['subscription']['generations'])
