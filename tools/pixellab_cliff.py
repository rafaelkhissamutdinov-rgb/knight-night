# Обрыв балкона (v0.74): PixelLab дорисовывает по маске настоящую сцену (пол, перила, даль), чтобы скала срослась с ней.
# Вход: scene.png (640×360: дальний план + фон комнаты без обрыва, globalThis.knightNightNoCliff) и mask.png.
# Запуск: python3 tools/pixellab_cliff.py <scene.png> <out_prefix> [seed]
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

scene, out = sys.argv[1], sys.argv[2]
X0, Y0, S = 320, 40, 320          # кусок сцены у правого края: здесь кончается балкон
MX, MY = int(os.environ.get('MX', 205)), int(os.environ.get('MY', 150))   # маска: левый край и верх (в пикселях куска)
im = Image.open(scene).convert('RGBA').crop((X0, Y0, X0 + S, Y0 + S))
ctx = out + '_ctx.png'; im.save(ctx)
mask = Image.new('RGBA', (S, S), (0, 0, 0, 255)); px = mask.load()
for y in range(S):
    for x in range(S):
        # что дорисовать: правая часть от линии перил вниз; граница — наискось (обломки уходят вниз вправо)
        if y >= MY and x >= MX - (y - MY) * 0.12: px[x, y] = (255, 255, 255, 255)
mp = out + '_mask.png'; mask.save(mp)
img, sz = b64img(ctx); msk, _ = b64img(mp)
desc = os.environ.get('DESC') or ('the end of an old stone castle balcony is broken off: the stone floor slab and the stone balustrade crumble at the edge '
        'into jagged broken masonry blocks, the broken end rests on a massive rugged mountain rock cliff, the rock steps down '
        'in angular ledges and boulders toward the bottom right, a steep drop to a valley and dark pine forest far below, '
        'pixel art side view, light from the upper left: bright top faces of ledges, dark purple-brown crevices, same palette and '
        'pixel size as the surrounding image, no fog')
body = {'description': desc, 'inpainting_image': {'image': img, 'size': {'width': sz[0], 'height': sz[1]}},
        'mask_image': {'image': msk, 'size': {'width': sz[0], 'height': sz[1]}}}
if len(sys.argv) > 3: body['seed'] = int(sys.argv[3])
paths = run('/inpaint-v3', body, out)
print(paths)
