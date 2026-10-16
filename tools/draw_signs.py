# Знаки путей, нарисованные кодом (v0.94; владелец просил экономить генерации PixelLab). Солнце пилигрима — из PixelLab
# (tools/pixellab_signs.py: солнце — 15, Уроборос — 0, корона — 4). Здесь только закрытый глаз (эгоист).
# Рисуется крупно, уменьшается до 48×48, цвета приводятся к палитре знака, обводка в 1 пиксель.
# Запуск: python3 tools/draw_signs.py [папка] → assets/ui/sign_<имя>.png
import math, os, sys
from PIL import Image, ImageDraw

N, K = 48, 8                      # размер знака и множитель черновика
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'ui')

def finish(big, pal, outline):
    """Черновик K×N → N×N: цвета к палитре, прозрачность порогом, тёмная обводка снаружи."""
    small = big.resize((N, N), Image.LANCZOS)
    px = small.load(); res = Image.new('RGBA', (N, N)); out = res.load()
    for y in range(N):
        for x in range(N):
            r, g, b, a = px[x, y]
            if a < 120: continue
            out[x, y] = min(pal, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2) + (255,)
    edge = [(x, y) for y in range(N) for x in range(N) if out[x, y][3] == 0 and any(
        0 <= x+dx < N and 0 <= y+dy < N and out[x+dx, y+dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge: out[x, y] = outline + (255,)
    return res

def disc(d, cx, cy, r, c): d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c)

def eye():
    pal = [(244, 240, 252), (212, 204, 236), (170, 158, 210), (124, 108, 176), (84, 68, 130), (52, 40, 86)]
    big = Image.new('RGBA', (N*K, N*K)); d = ImageDraw.Draw(big)
    c = N*K/2
    def lid(y0, sag, w, col):                               # дуга века: сверху выпуклая
        pts = []
        for i in range(81):
            t = i/80; x = 6 + 36*t
            pts.append((x*K, (y0 + sag*math.sin(math.pi*t))*K))
        d.line(pts, fill=col, width=int(w*K), joint='curve')
        for p in (pts[0], pts[-1]): disc(d, p[0], p[1], w*K/2, col)
    # мягкое сияние-миндалина за глазом
    d.ellipse([5*K, 12*K, 43*K, 34*K], fill=pal[5]); d.ellipse([7*K, 14*K, 41*K, 32*K], fill=pal[4])
    d.ellipse([10*K, 16.5*K, 38*K, 29.5*K], fill=pal[3])
    lid(22, 5.5, 3.4, pal[0])                               # сомкнутое веко — светлая дуга вниз
    lid(21, 5.5, 1.4, pal[1])
    for i in range(7):                                      # ресницы вниз
        t = 0.14 + i * 0.12; x = 6 + 36*t; y = 22 + 5.5*math.sin(math.pi*t)
        ang = math.pi/2 + (t - 0.5) * 1.1
        d.line([(x*K, (y+1)*K), ((x + 4.6*math.cos(ang))*K, (y + 1 + 4.6*math.sin(ang))*K)], fill=pal[1], width=int(1.5*K))
    lid(13.5, -4.5, 1.6, pal[2])                            # бровь-складка века сверху
    return finish(big, pal, (36, 26, 58))

os.makedirs(OUT, exist_ok=True)
for name, fn in (('egoist', eye),):
    fn().save(os.path.join(OUT, f'sign_{name}.png')); print(name)
