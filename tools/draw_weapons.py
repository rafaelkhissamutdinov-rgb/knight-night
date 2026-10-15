# Оружие (v0.68) — нарисовано попиксельно, в одном стиле, с точными пропорциями (PixelLab давал разнобой).
# Каждое лежит горизонтально: рукоять / древко слева, острие справа; 1 px картинки = 1 px экрана.
# Хват ищется в игре по картинке (src/sprites.js, WEAPON_IMG). Запуск: python3 tools/draw_weapons.py → assets/objects/wpn_*.png
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'objects')
O = (13, 11, 20, 255)                                                     # контур
STEEL = [(232, 236, 242, 255), (184, 192, 204, 255), (128, 136, 152, 255), (92, 98, 114, 255)]   # блик, свет, тень, дол
RUST = [(196, 186, 170, 255), (150, 138, 124, 255), (112, 92, 78, 255), (86, 70, 62, 255)]
GHOST = [(236, 252, 255, 255), (170, 226, 246, 255), (104, 168, 210, 255), (70, 120, 170, 255)]
LEATHER = [(110, 72, 44, 255), (74, 46, 30, 255)]
WOOD = [(140, 98, 60, 255), (104, 70, 42, 255), (76, 50, 32, 255)]
IRON = [(150, 140, 120, 255), (104, 94, 80, 255), (70, 62, 54, 255)]
SILVER = [(214, 218, 228, 255), (150, 156, 172, 255), (96, 100, 116, 255)]
GOLD = [(236, 200, 110, 255), (196, 150, 64, 255), (130, 92, 40, 255)]
SPOT = (140, 86, 56, 255)

class Pic:
    def __init__(s, w, h): s.w, s.h = w, h; s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.px = s.im.load()
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[x, y] = c
    def clear(s, x, y): s.put(x, y, (0, 0, 0, 0))
    def save(s, name):
        src = s.im.copy(); sp = src.load()
        for x in range(s.w):     # контур: прозрачный сосед непрозрачного (4 стороны)
            for y in range(s.h):
                if sp[x, y][3] == 0 and any(0 <= x + dx < s.w and 0 <= y + dy < s.h and sp[x + dx, y + dy][3]
                                            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    s.px[x, y] = O
        im = s.im.crop(s.im.getbbox()); im.save(os.path.join(OUT, name + '.png')); print(name, im.size)

def blade(p, x0, x1, cy, pal, fuller=True, tip=6, thin=False):
    # клинок от x0 до x1: 3 px (блик, дол, тень) или 1 px (рапира); последние tip px — острие
    for x in range(x0, x1 + 1):
        t = x - (x1 - tip)
        if thin:
            p.put(x, cy, pal[0] if x % 5 else pal[1]); continue
        if t >= tip - 1: p.put(x, cy, pal[1]); continue
        if t >= tip // 2: p.put(x, cy, pal[1]); p.put(x, cy - 1, pal[0]); continue
        p.put(x, cy - 1, pal[0] if x % 7 else pal[1])
        p.put(x, cy, pal[3] if fuller and x < x1 - tip - 3 else pal[1])
        p.put(x, cy + 1, pal[2])

def grip(p, x0, x1, cy, pal=LEATHER):
    for x in range(x0, x1 + 1):
        for y in (cy - 1, cy, cy + 1): p.put(x, y, pal[(x + (y == cy + 1)) % 2])

def pommel(p, x0, cy, pal, r=2):
    for x in range(x0, x0 + 3):
        for y in range(cy - r, cy + r + 1): p.put(x, y, pal[1] if y > cy else pal[0])
    p.put(x0 + 1, cy - 1, (255, 255, 255, 200))

def cross(p, x, cy, half, pal):
    for y in range(cy - half, cy + half + 1): p.put(x, y, pal[0]); p.put(x + 1, y, pal[1])
    p.put(x + 2, cy - half, pal[2]); p.put(x + 2, cy + half, pal[2])

def sword(name, blade_len, pal, grip_len=7, half=5, spots=(), nicks=(), fuller=True, gpal=IRON, ppal=IRON):
    cy = half + 1
    w = 4 + grip_len + 2 + blade_len + 2
    p = Pic(w, 2 * half + 3)
    pommel(p, 1, cy, ppal)
    grip(p, 4, 3 + grip_len, cy)
    g = 4 + grip_len
    cross(p, g, cy, half, gpal)
    blade(p, g + 2, g + 1 + blade_len, cy, pal, fuller)
    for x in nicks: p.clear(g + 2 + x, cy + 1)
    for x, dy in spots: p.put(g + 2 + x, cy + dy, SPOT)
    p.save(name)

# меч Найта: старый полуторный — клинок 30, рукоять 7, пара зазубрин
sword('wpn_sword', 30, STEEL, nicks=(11, 20), spots=((6, 1), (15, -1)))
# кинжал (v0.82): узкий клинок 14 с долом, короткая рукоять, крестовина с загнутыми концами, кольцо-навершие
sword('wpn_dagger', 14, STEEL, grip_len=5, half=3, nicks=(9,), spots=((4, 1),))
# короткий ржавый меч скелетов
sword('wpn_short', 15, RUST, half=4, fuller=False, nicks=(7,), spots=((3, -1), (5, 1), (10, 0)))
# двуручник: длинная рукоять, широкая крестовина
sword('wpn_great', 44, STEEL, grip_len=12, half=6, nicks=(30,), spots=((9, 1), (22, -1)))
# меч призрака-главы стражи: бледный, светится, серебряная крестовина
sword('wpn_ghostsword', 34, GHOST, half=5, gpal=SILVER, ppal=SILVER)

# рапира: золотая чашка-гарда и дужка над рукоятью, тонкий длинный клинок
cy = 6
p = Pic(52, 13)
pommel(p, 1, cy, GOLD, r=1)
grip(p, 4, 8, cy, [(70, 60, 64, 255), (40, 34, 40, 255)])
for x in range(5, 11): p.put(x, cy - 4, GOLD[0] if x < 10 else GOLD[1])      # дужка над кистью
p.put(4, cy - 3, GOLD[1]); p.put(4, cy - 2, GOLD[1])
for y in range(cy - 4, cy + 5): p.put(10, y, GOLD[0] if y < cy else GOLD[1])  # чашка
for y in range(cy - 3, cy + 4): p.put(11, y, GOLD[1])
p.put(12, cy - 2, GOLD[2]); p.put(12, cy + 2, GOLD[2])
for y in range(cy - 5, cy + 6): p.put(13, y, GOLD[0]) if abs(y - cy) in (0, 4, 5) else None   # гарда-крестовина
blade(p, 12, 50, cy, STEEL, thin=True)
p.put(13, cy - 1, STEEL[1]); p.put(14, cy - 1, STEEL[1]); p.put(13, cy + 1, STEEL[2])   # рикассо толще
p.save('wpn_rapier')

# топор: древко, сверху над концом — обух, снизу — лезвие полумесяцем (лезвие вниз, как раньше)
cy = 4
p = Pic(40, 18)
for x in range(0, 38): p.put(x, cy, WOOD[1] if x % 6 else WOOD[2]); p.put(x, cy + 1, WOOD[2])
for x in range(1, 7): p.put(x, cy, LEATHER[0]); p.put(x, cy + 1, LEATHER[1])  # обмотка
for x in range(29, 36):                                                    # крепление и обух
    for y in range(cy - 2, cy + 2): p.put(x, y, IRON[1] if y < cy else IRON[2])
c = 32                                                                     # лезвие вниз: узкая шейка → широкая выпуклая кромка
for k in range(0, 11):
    half = 1 + k * 0.55
    for x in range(round(c - half), round(c + half) + 1):
        bottom = 10 - (x - c) ** 2 * 0.06                                   # кромка — дуга
        if k > bottom: continue
        edge = k > bottom - 1.5
        p.put(x, cy + 2 + k, STEEL[0] if edge else STEEL[2] if k < 3 else STEEL[1] if (x - c) > -2 else STEEL[2])
p.put(31, cy + 5, SPOT); p.put(34, cy + 6, SPOT)
p.save('wpn_axe')

def pole(name, length, head):
    cy = 7
    p = Pic(length + 14, 20)
    for x in range(0, length): p.put(x, cy, WOOD[0] if (x // 9) % 2 else WOOD[1]); p.put(x, cy + 1, WOOD[2])
    p.put(0, cy, IRON[1]); p.put(0, cy + 1, IRON[2])                         # подток
    head(p, length, cy)
    p.save(name)

def spear_head(p, x0, cy):
    for x in range(x0 - 3, x0): p.put(x, cy, IRON[1]); p.put(x, cy + 1, IRON[2])   # втулка
    for i in range(12):                                                    # листовидный наконечник
        half = [1, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0][i]
        for dy in range(-half, half + 2): p.put(x0 + i, cy + dy, STEEL[0] if dy <= 0 else STEEL[2])
        p.put(x0 + i, cy, STEEL[1])

def halberd_head(p, x0, cy):
    for x in range(x0 - 4, x0 + 3): p.put(x, cy, IRON[1]); p.put(x, cy + 1, IRON[2])
    for i in range(10): p.put(x0 + 3 + i, cy, STEEL[1] if i < 8 else STEEL[0]); p.put(x0 + 3 + i, cy + 1, STEEL[2]) if i < 6 else None   # копейное острие
    for x in range(x0 - 5, x0 + 4):                                         # топор вниз
        depth = 9 if x > x0 - 4 else 6
        for y in range(cy + 2, cy + 2 + depth): p.put(x, y, STEEL[0] if y == cy + 1 + depth or x == x0 + 3 else STEEL[2] if x < x0 - 2 else STEEL[1])
    for i in range(5): p.put(x0 - 2 - i // 2, cy - 1 - i, STEEL[1])        # крюк вверх
    p.put(x0 - 1, cy + 4, SPOT)

pole('wpn_spear', 76, spear_head)
pole('wpn_halberd', 84, halberd_head)

# арбалет: ложе слева, дуга поперёк на правом конце, тетива, болт
cy = 13
p = Pic(36, 28)
for x in range(0, 30):
    for y in (cy - 1, cy, cy + 1): p.put(x, y, WOOD[0] if y == cy - 1 else WOOD[1] if y == cy else WOOD[2])
for y in range(cy + 2, cy + 5): p.put(2, y, WOOD[2]); p.put(3, y, WOOD[1])      # приклад
for x in range(10, 14): p.put(x, cy + 2, IRON[1])                              # спуск
for y in range(cy - 12, cy + 13):                                             # дуга: концы чуть назад
    d = abs(y - cy)
    p.put(30 - d // 5, y, IRON[0] if y < cy else IRON[1])
for y in range(cy - 11, cy + 12): p.put(30 - abs(y - cy) // 5 - 1, y, (220, 214, 200, 255)) if abs(y - cy) > 9 else None
for x in range(14, 30): p.put(x, cy - 1, (220, 214, 200, 255)) if x in (14, 15) else None
for x in range(16, 34): p.put(x, cy - 2, STEEL[1] if x < 32 else STEEL[0])   # болт
p.save('wpn_crossbow')
