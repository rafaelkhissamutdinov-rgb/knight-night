# Город главы 2 (v0.98): картинки людей и предметов из PixelLab → под рост рыцаря (в игре ≈ 52 px вместе с плюмажем).
# Уменьшение для пиксель-арта: усреднение (BOX), порог прозрачности, цвета — к палитре исходника. Исходники — .pixellab_work.
# Запуск: python3 tools/town_scale.py   (перезаписывает assets/objects/<имя>.png из исходников, без накопления потерь)
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work')

def shrink(src, h):
    im = Image.open(src).convert('RGBA'); im = im.crop(im.getbbox())
    if im.height <= h: return im
    w = max(1, round(im.width * h / im.height))
    pal = im.convert('RGB').quantize(64)
    small = im.resize((w, h), Image.BOX)
    rgb = small.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    a = small.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    rgb.putalpha(a)
    return rgb.crop(rgb.getbbox())

# имя в игре: (исходник, высота в пикселях экрана)
ADULT, SIT, TABLE = 46, 33, 37
JOBS = {}
for i in range(16):
    JOBS[f'vil_{i}'] = (f'ch2/villager_{i:02d}.png', {9: 34, 12: 42, 5: 40, 0: 43, 11: 43}.get(i, ADULT))
    if i != 11: JOBS[f'vils_{i}'] = (f'ch2/sitting_{i:02d}.png', SIT)
JOBS.update({
    'npc_bartender': ('ch2/bartender_00.png', 47),
    'cam_glasses': ('cameo/glasses_sit_05.png', TABLE), 'cam_glasses_buzz': ('cameo/glasses_buzz_sit_05.png', TABLE),
    'cam_redhead': ('cameo/redhead_sit_02.png', TABLE), 'cam_merc': ('cameo/merc_sit_00.png', 44),   # на высоком табурете
    'prop_fountain': ('obj/fountain_01.png', 64), 'prop_town_bench': ('obj/bench_00.png', 26), 'prop_bar_table': ('obj/cafetable_02.png', 27),
    'prop_telescope': ('obj/telescope_01.png', 44), 'prop_log_seat': ('obj/log_00.png', 14),
})
if __name__ == '__main__':
    for name, (src, h) in JOBS.items():
        p = os.path.join(W, src)
        if not os.path.exists(p): print('нет исходника', src); continue
        im = shrink(p, h); im.save(os.path.join(ROOT, 'assets', 'objects', name + '.png'))
    print('ok', len(JOBS))
