# Знаки путей, нарисованные кодом (v0.94; владелец просил экономить генерации PixelLab). Солнце пилигрима — из PixelLab
# (tools/pixellab_signs.py, вариант 15), Уроборос — тоже оттуда. Здесь: корона (монарх), закрытый глаз (эгоист).
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

def crown():
    """Минималистичная корона (владелец, 16.10): три зубца с шариками, гладкий обруч, один камень."""
    pal = [(252, 244, 178), (252, 227, 107), (251, 200, 63), (233, 167, 63), (176, 98, 40), (226, 60, 64), (150, 28, 48)]
    big = Image.new('RGBA', (N*K, N*K)); d = ImageDraw.Draw(big)
    P = lambda pts: [(x*K, y*K) for x, y in pts]
    d.polygon(P([(9, 34), (9, 16), (17, 25), (24, 12), (31, 25), (39, 16), (39, 34)]), fill=pal[3])
    d.polygon(P([(11, 33), (11, 20), (17, 28), (24, 16), (31, 28), (37, 20), (37, 33)]), fill=pal[2])
    d.polygon(P([(11, 31), (11, 21), (16, 28)]), fill=pal[1])
    for x, y in ((9, 14), (24, 10), (39, 14)):
        disc(d, x*K, y*K, 2.3*K, pal[2]); disc(d, (x-0.6)*K, (y-0.6)*K, 1.0*K, pal[0])
    d.rectangle(P([(8, 32), (40, 38)]), fill=pal[4]); d.rectangle(P([(8, 32), (40, 36)]), fill=pal[2]); d.rectangle(P([(8, 32), (40, 33.2)]), fill=pal[1])
    disc(d, 24*K, 34.5*K, 2.2*K, pal[6]); disc(d, 24*K, 34.2*K, 1.4*K, pal[5]); disc(d, 23.4*K, 33.6*K, 0.5*K, pal[0])
    return finish(big, pal, (68, 32, 25))

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
for name, fn in (('monarch', crown), ('egoist', eye)):
    fn().save(os.path.join(OUT, f'sign_{name}.png')); print(name)
