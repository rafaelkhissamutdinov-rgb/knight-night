# Подогнать настроения Лики под оригинал: размер и положение лица, тон кожи.
# Исходные настроения (кадры с листа) лежат в git-истории — до v0.32; этот скрипт уже применён, повторно на готовые файлы не запускать.
import sys, numpy as np
from PIL import Image
P = '/home/user/knight-night/assets/portraits/'
OUT = sys.argv[1]  # куда сохранить; исходники настроений — из git-истории (до v0.32), оригинал — lika.png
def skin_mask(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    return (al > 200) & (r > 140) & (r > g + 12) & (g > b) & (r - b > 40)
def bbox(m):
    ys, xs = np.nonzero(m)
    # отсечь выбросы: 2-й и 98-й перцентили
    return np.percentile(xs, 2), np.percentile(xs, 98), np.percentile(ys, 2), np.percentile(ys, 98)
orig = np.array(Image.open(P + 'lika.png').convert('RGBA'))
om = skin_mask(orig)
ox0, ox1, oy0, oy1 = bbox(om)
oskin = orig[om][:, :3].astype(float)
print('orig skin box', ox0, ox1, oy0, oy1)
for n in ['happy', 'sly', 'surprised', 'sulky', 'serious', 'worried', 'angry']:
    im = Image.open(P + f'lika-{n}.png').convert('RGBA')
    a = np.array(im)
    m = skin_mask(a)
    x0, x1, y0, y1 = bbox(m)
    k = (ox1 - ox0) / (x1 - x0)
    W = round(im.width * k); H = round(im.height * k)
    sm = im.resize((W, H), Image.NEAREST if k > 1 else Image.LANCZOS)
    # цвет кожи: сдвиг среднего и разброса к оригиналу (только на пикселях кожи)
    b = np.array(sm).astype(float)
    mk = skin_mask(b.astype(np.uint8))
    s = b[mk][:, :3]
    if len(s):
        adj = (s - s.mean(0)) / (s.std(0) + 1e-6) * oskin.std(0) + oskin.mean(0)
        b[mk, :3] = np.clip(s * 0.35 + adj * 0.65, 0, 255)
    sm = Image.fromarray(b.astype(np.uint8))
    # совместить центр лица по x и верх лица по y
    cx = (x0 + x1) / 2 * k; ty = y0 * k
    dx = round((ox0 + ox1) / 2 - cx); dy = round(oy0 - ty)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    canvas.alpha_composite(sm, (dx, dy)) if dx >= 0 and dy >= 0 else canvas.paste(sm, (dx, dy), sm)
    # голова из настроения поверх оригинала: плечи, пальто и боковые пряди — всегда оригинальные
    c = np.array(canvas).astype(float)
    left, right = dx, dx + W
    fade = np.ones((256, 256))
    for x in range(256):
        d = min(x - left, right - 1 - x)
        fade[:, x] *= np.clip(d / 14, 0, 1)
    neck = int(oy1) + 4   # низ лица в оригинале; ниже — пальто оригинала
    for y in range(256):
        fade[y, :] *= np.clip((neck + 16 - y) / 16, 0, 1)
    al = c[..., 3] / 255 * fade
    base = orig.astype(float)
    out = base.copy()
    out[..., :3] = base[..., :3] * (1 - al[..., None]) + c[..., :3] * al[..., None]
    out[..., 3] = np.maximum(base[..., 3], c[..., 3] * fade)
    c = out
    Image.fromarray(c.astype(np.uint8)).save(f'{OUT}/lika-{n}.png')
    print(n, 'k=%.2f' % k, dx, dy)
