# Фон комнаты из PixelLab (v0.64): кусок стены с полом 640×360 (экран целиком, 1 px картинки = 1 px экрана),
# бесшовный по горизонтали — длинная комната собирается из повторов и вариантов.
# Шаги:  base <имя> "<описание>"            — кусок по образцу компоновки (стена до y=236, ниже пол)
#        seam <имя>                          — шов: сдвиг на полкуска, середина перерисовывается (inpaint)
#        variant <имя> <номер> "<что добавить>" — вариант: меняется середина, края те же (стыкуется с любым)
# Итог — assets/backgrounds/<имя>/<имя>_<n>.png. Ключ — PIXELLAB_API_KEY.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, FLOOR = 640, 360, 236   # FLOOR = CONFIG.floorTop × 2
STYLE = ('2D side-view pixel art game background, high quality detailed pixel art like Blasphemous or Dead Cells, '
         'evenly and softly lit (no light sources, no torches, no strong shadows: lighting is added by the game), '
         'back wall seen straight on, the wall meets the floor at a straight horizontal line at 65% of the height, '
         'below it a flat stone floor seen slightly from above; no characters, no text')

def out_dir(name):
    d = os.path.join(ROOT, 'assets', 'backgrounds', name); os.makedirs(d, exist_ok=True); return d

def guide(brick=(32, 16)):
    # образец компоновки и масштаба: стена из камней brick (рыцарь ≈ 64 px ростом), ниже линии — пол из плит
    im = Image.new('RGBA', (W, H), (40, 34, 52, 255))
    d = ImageDraw.Draw(im)
    bw, bh = brick
    for row in range(FLOOR // bh + 1):
        off = bw // 2 if row % 2 else 0
        for x in range(-off, W, bw):
            v = 70 + (hash((row, x)) % 18)
            d.rectangle([x + 1, row * bh + 1, x + bw - 2, min(FLOOR - 1, row * bh + bh - 2)], fill=(v, v - 8, v + 14, 255))
    y, row = FLOOR + 2, 0
    while y < H:
        h, w = 14 + row * 6, 48 + row * 12
        for x in range(-(w // 2 if row % 2 else 0), W, w): d.rectangle([x + 1, y, x + w - 2, y + h - 2], fill=(58, 54, 64, 255))
        y += h; row += 1
    d.line([0, FLOOR, W, FLOOR], fill=(20, 16, 28, 255), width=3)
    p = os.path.join(ROOT, '.pixellab_work', 'room_guide.png'); os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p)
    return p

def blank(im, x0, x1, y1=H):
    # полоса — средним цветом стены и пола (без деталей)
    for top, bot in ((0, min(FLOOR, y1)), (FLOOR, y1)):
        if bot <= top: continue
        c = im.crop((0, top, im.width, bot)).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
        ImageDraw.Draw(im).rectangle([x0, top, x1, bot - 1], fill=c + (255,))

def inpaint(img, mask, desc, prefix):
    a, sz = b64img(img); m, _ = b64img(mask)
    size = {'width': sz[0], 'height': sz[1]}
    return run('/inpaint-v3', {'description': desc, 'inpainting_image': {'image': a, 'size': size}, 'mask_image': {'image': m, 'size': size},
                               'no_background': False}, prefix)[0]

def base(name, desc, style=None, brick=(44, 22)):
    g, gs = b64img(guide(brick))
    body = {'description': desc + '. ' + STYLE, 'image_size': {'width': W, 'height': H}, 'no_background': False,
            'reference_images': [{'image': g, 'size': {'width': gs[0], 'height': gs[1]}, 'usage_description': 'only the approximate stone size and where the wall meets the floor; the real stones are uneven, textured, shaded, with chips, cracks and color variation'}]}
    if style:  # образец стиля: фактура камня, мох, цвет
        st, ss = b64img(style)
        body['style_image'] = {'image': st, 'size': {'width': ss[0], 'height': ss[1]}}
    p = run('/generate-image-v2', body, os.path.join(out_dir(name), 'raw'))[0]
    Image.open(p).convert('RGBA').save(os.path.join(out_dir(name), name + '_0.png'))
    print('base', p)

def seam(name, n=0, desc=None):
    # сдвиг на полкуска: стык оказывается в середине; середину (512×360 вокруг стыка, маска 112 px) перерисовать
    src = os.path.join(out_dir(name), f'{name}_{n}.png')
    im = Image.open(src).convert('RGBA')
    rolled = Image.new('RGBA', (W, H)); rolled.paste(im.crop((W // 2, 0, W, H)), (0, 0)); rolled.paste(im.crop((0, 0, W // 2, H)), (W // 2, 0))
    x0 = W // 2 - 256
    crop = rolled.crop((x0, 0, x0 + 512, H))
    mask = Image.new('RGBA', (512, H), (0, 0, 0, 255)); ImageDraw.Draw(mask).rectangle([256 - 56, 0, 256 + 56, H], fill=(255, 255, 255, 255))
    blank(crop, 256 - 56, 256 + 56)   # стык стереть: иначе модель оставляет старые пиксели
    w = os.path.join(ROOT, '.pixellab_work'); cp, mp = os.path.join(w, 'seam_c.png'), os.path.join(w, 'seam_m.png'); crop.save(cp); mask.save(mp)
    fixed = Image.open(inpaint(cp, mp, desc or 'continue the same stone wall and floor seamlessly, same style and lighting', os.path.join(w, 'seam_out'))).convert('RGBA')
    rolled.paste(fixed.resize((512, H)), (x0, 0))
    back = Image.new('RGBA', (W, H)); back.paste(rolled.crop((W // 2, 0, W, H)), (0, 0)); back.paste(rolled.crop((0, 0, W // 2, H)), (W // 2, 0))
    back.save(src); print('seam', src)

def match_color(new, old, box):
    # перерисованное место — к средней яркости и цвету стены вокруг (иначе видно прямоугольник)
    x0, y0, x1, y1 = box
    ring = [old.getpixel((x, y)) for x in range(max(0, x0 - 12), min(old.width, x1 + 12), 2) for y in range(max(0, y0 - 12), min(old.height, y1 + 12), 2)
            if not (x0 <= x < x1 and y0 <= y < y1)]
    inner = [new.getpixel((x, y)) for x in range(x0, x1, 2) for y in range(y0, y1, 2)]
    m = lambda px, c: sum(p[c] for p in px) / max(1, len(px))
    k = [m(ring, c) / max(1, m(inner, c)) for c in range(3)]
    px = new.load()
    for x in range(x0, x1):
        for y in range(y0, y1):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, round(r * k[0])), min(255, round(g * k[1])), min(255, round(b * k[2])), a)

def variant(name, n, desc, box=(200, 50, 440, 230)):
    # деталь в месте box (x0, y0, x1, y1 на куске 640×360): только оно перерисовывается — края и кладка вокруг прежние
    im = Image.open(os.path.join(out_dir(name), f'{name}_0.png')).convert('RGBA')
    x0 = W // 2 - 256
    crop = im.crop((x0, 0, x0 + 512, H))
    b = (box[0] - x0, box[1], box[2] - x0, box[3])
    mask = Image.new('RGBA', (512, H), (0, 0, 0, 255)); ImageDraw.Draw(mask).rectangle([b[0], b[1], b[2] - 1, b[3] - 1], fill=(255, 255, 255, 255))
    keep = crop.copy()
    ImageDraw.Draw(crop).rectangle([b[0], b[1], b[2] - 1, b[3] - 1], fill=crop.crop(b).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0)) + (255,))
    w = os.path.join(ROOT, '.pixellab_work'); cp, mp = os.path.join(w, 'var_c.png'), os.path.join(w, 'var_m.png'); crop.save(cp); mask.save(mp)
    fixed = Image.open(inpaint(cp, mp, desc + ', set into the same wall of small rough stones, same style, evenly lit', os.path.join(w, f'var_{name}_{n}'))).convert('RGBA').resize((512, H))
    match_color(fixed, keep, b)
    im.paste(fixed.crop(b), (box[0], box[1]))
    im.save(os.path.join(out_dir(name), f'{name}_{n}.png')); print('variant', n)

if __name__ == '__main__':
    cmd, name = sys.argv[1], sys.argv[2]
    if cmd == 'base': base(name, sys.argv[3], sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None, tuple(map(int, sys.argv[5].split('x'))) if len(sys.argv) > 5 else (44, 22))
    elif cmd == 'seam': seam(name)
    elif cmd == 'variant': variant(name, int(sys.argv[3]), sys.argv[4], *([tuple(map(int, sys.argv[5].split(',')))] if len(sys.argv) > 5 else []))
    print(req('GET', '/balance'))
