# Нормали стен из самих кусков (v0.69): яркость кирпича — высота, швы — впадины; уклоны высоты → нормали.
# Живой свет тогда высвечивает рельеф кладки у факела. (Метод PixelLab для стен не годится — наклоняет кусок целиком.)
#   python3 tools/wall_normals.py   → assets/backgrounds/<набор>/n/<кусок>.png
import os, glob
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = 2.6   # сила рельефа
for s in ('dungeon', 'castle', 'shop'):
    for f in sorted(glob.glob(os.path.join(ROOT, 'assets', 'backgrounds', s, '*.png'))):
        im = Image.open(f).convert('RGB')
        h = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
        dx = np.zeros_like(h); dy = np.zeros_like(h)
        dx[:, 1:-1] = (h[:, 2:] - h[:, :-2]) / 2
        dy[1:-1, :] = (h[2:, :] - h[:-2, :]) / 2
        n = np.dstack([-dx * K, dy * K, np.ones_like(h)])   # opengl: зелёный — вверх (y картинки — вниз)
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        out = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
        a = np.full(h.shape + (1,), 255, np.uint8)
        os.makedirs(os.path.join(os.path.dirname(f), 'n'), exist_ok=True)
        Image.fromarray(np.dstack([out, a]), 'RGBA').save(os.path.join(os.path.dirname(f), 'n', os.path.basename(f)))
        print(s, os.path.basename(f))
