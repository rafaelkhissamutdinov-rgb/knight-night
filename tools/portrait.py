"""Портрет для диалогов: вырезать персонажа из однотонного фона, подставить каменную кладку
в тёмной рамке (как у портретов рыцаря) и сохранить 256×256 JPG в assets/portraits/.

python3 tools/portrait.py исходник.png assets/portraits/имя.jpg [--crop x0 y0 x1 y1] [--tol 22]

Нужны Pillow, numpy, scipy. Фон исходника — однотонный (берётся цвет левого верхнего угла).
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def brick_background(size):
    """Кладка на сетке 128 клеток, увеличенная без сглаживания до size."""
    U = 128
    c = Image.new('RGB', (U, U), (46, 44, 65))
    d = ImageDraw.Draw(c)
    for y in range(0, U, 12):
        d.line([(0, y), (U, y)], fill=(36, 35, 50))
        off = 0 if (y // 12) % 2 else 10
        for x in range(off, U, 20):
            d.line([(x, y), (x, y + 11)], fill=(36, 35, 50))
    d.rectangle([3, 4, 124, 125], fill=(30, 30, 40))
    rows = [4, 19, 36, 50, 66, 81, 94, 108, 125]
    for i in range(len(rows) - 1):
        y0, y1 = rows[i] + 1, rows[i + 1]
        k = max(0, (y0 - 70) / 55)
        col = tuple(int(a * (1 - k * 0.22) + b * k * 0.22) for a, b in zip((128, 125, 120), (70, 70, 82)))
        d.rectangle([4, y0, 123, y1 - 1], fill=col)
        joint = tuple(max(0, v - 28) for v in col)
        d.line([(4, y1), (123, y1)], fill=joint)
        off = 12 if i % 2 else 25
        for x in range(off, 123, 27):
            d.line([(x, y0), (x, y1 - 1)], fill=joint)
            d.point([(x - 1, y1 - 1), (x + 1, y1 - 1)], fill=joint)
        d.line([(4, y0), (123, y0)], fill=tuple(min(255, v + 6) for v in col))
    return c.resize((size, size), Image.NEAREST)


def person_mask(a, tol):
    """Всё, что не связано с краем картинки однотонным фоном."""
    h, w, _ = a.shape
    bgc = a[2, 2]
    near = np.abs(a - bgc).sum(-1) < tol * 3
    mask = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and near[ny, nx]:
                mask[ny, nx] = True
                q.append((ny, nx))
    person = ~mask
    lab, n = ndimage.label(person)
    if n:
        sizes = ndimage.sum(person, lab, range(1, n + 1))
        person = lab == (1 + int(np.argmax(sizes)))
    return ndimage.binary_erosion(ndimage.binary_fill_holes(person), iterations=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--crop', nargs=4, type=int)
    ap.add_argument('--tol', type=int, default=22)
    args = ap.parse_args()
    im = Image.open(args.src).convert('RGB')
    if args.crop:
        im = im.crop(tuple(args.crop))
    side = max(im.size)
    im = im.resize((side, side), Image.LANCZOS)
    person = person_mask(np.asarray(im).astype(int), args.tol)
    out = Image.composite(im, brick_background(side), Image.fromarray((person * 255).astype('uint8')))
    out.resize((256, 256), Image.LANCZOS).save(args.dst, quality=88)


if __name__ == '__main__':
    main()
