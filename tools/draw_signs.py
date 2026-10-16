# Знаки путей, нарисованные кодом (v0.94; владелец просил экономить генерации PixelLab). Солнце пилигрима — из PixelLab
# (tools/pixellab_signs.py, вариант 15). Здесь: Уроборос (призрак), корона (монарх), закрытый глаз (эгоист).
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

def ouroboros():
    pal = [(232, 244, 226), (178, 218, 184), (120, 172, 138), (74, 120, 98), (46, 78, 66), (214, 70, 60), (250, 230, 120)]
    big = Image.new('RGBA', (N*K, N*K)); d = ImageDraw.Draw(big)
    c, R = N*K/2, 15.5*K
    a0, a1 = math.radians(-118), math.radians(212)          # хвост → голова (по часовой стрелке, голова слева вверху)
    steps = 400
    for layer in range(3):                                  # тень, тело, блик
        for i in range(steps + 1):
            t = i / steps; a = a0 + (a1 - a0) * t
            w = (1.4 + 3.6 * t**0.7) * K                    # хвост тонкий, к голове толще
            x, y = c + R*math.cos(a), c + R*math.sin(a)
            if layer == 0: disc(d, x, y, w, pal[4])
            elif layer == 1: disc(d, x - 0.25*K*math.cos(a), y - 0.25*K*math.sin(a), w*0.78, pal[3] if (i // 18) % 2 else pal[2])
            else: disc(d, x - 0.9*K*math.cos(a) - 0.4*K, y - 0.9*K*math.sin(a) - 0.4*K, w*0.32, pal[1] if t > 0.15 else pal[2])
    ha = a1; hx, hy = c + R*math.cos(ha), c + R*math.sin(ha)
    # голова: вытянута по направлению движения, челюсть закрывает кончик хвоста
    dx, dy = -math.sin(ha), math.cos(ha)                     # касательная (по часовой)
    for s, rr, col in ((0, 6.2, pal[4]), (0.3, 5.0, pal[2]), (2.2, 4.4, pal[2]), (0.6, 2.2, pal[1])):
        disc(d, hx + dx*s*K, hy + dy*s*K, rr*K, col)
    disc(d, hx + dx*4.6*K, hy + dy*4.6*K, 3.2*K, pal[3])    # морда
    ex, ey = hx + dx*1.2*K - 2.2*K*math.cos(ha), hy + dy*1.2*K - 2.2*K*math.sin(ha)
    disc(d, ex, ey, 1.3*K, pal[6]); disc(d, ex, ey, 0.6*K, pal[4])   # глаз
    return finish(big, pal, (26, 38, 34))

def crown():
    pal = [(252, 244, 178), (252, 227, 107), (251, 200, 63), (233, 167, 63), (176, 98, 40), (110, 52, 32), (226, 60, 64), (150, 28, 48), (255, 190, 190)]
    big = Image.new('RGBA', (N*K, N*K)); d = ImageDraw.Draw(big)
    P = lambda pts: [(x*K, y*K) for x, y in pts]
    body = [(7, 36), (7, 17), (15, 26), (19, 11), (24, 23), (29, 11), (33, 26), (41, 17), (41, 36)]
    d.polygon(P(body), fill=pal[3])
    d.polygon(P([(9, 34), (9, 21), (15, 29), (19, 15), (24, 27), (29, 15), (33, 29), (39, 21), (39, 34)]), fill=pal[2])
    d.polygon(P([(10, 30), (10, 23), (15, 30), (19, 18), (21, 27)]), fill=pal[1])
    d.rectangle(P([(6, 33), (42, 41)]), fill=pal[4]); d.rectangle(P([(6, 33), (42, 38)]), fill=pal[2]); d.rectangle(P([(6, 33), (42, 34.5)]), fill=pal[0])
    for x, y, r in ((7, 15, 2.6), (19, 9, 2.6), (29, 9, 2.6), (41, 15, 2.6), (24, 21, 2.0)):
        disc(d, x*K, y*K, r*K, pal[1]); disc(d, (x-0.7)*K, (y-0.7)*K, r*0.45*K, pal[0])
    for x, r in ((14, 2.4), (24, 3.0), (34, 2.4)):         # камни на обруче
        disc(d, x*K, 37*K, r*K, pal[7]); disc(d, x*K, 37*K, r*0.7*K, pal[6]); disc(d, (x-0.8)*K, 36.2*K, 0.8*K, pal[8])
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
for name, fn in (('ghost', ouroboros), ('monarch', crown), ('egoist', eye)):
    fn().save(os.path.join(OUT, f'sign_{name}.png')); print(name)
