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

# имя в игре: (исходник, высота). Владелец (22.10): рыцарь — средний рост (≈175 см, в игре ≈ 60 px с плюмажем); взрослые — того же
# роста: стоящие — исходник PixelLab без уменьшения (уменьшение портит пиксель); сидящие и дети — сгенерированы сразу на холсте 48.
RAW = 999   # не уменьшать
JOBS = {}
for i in range(16):
    JOBS[f'vil_{i}'] = (f'ch2/villager_{i:02d}.png', RAW) if i != 9 else ('ch2/kids48_01.png', RAW)
    if i != 11: JOBS[f'vils_{i}'] = (f'ch2/sitting48_{i:02d}.png', RAW)
JOBS.update({
    'npc_bartender': ('ch2/bartender_00.png', RAW),
    'cam_glasses': ('cameo/glasses_sit48_13.png', RAW), 'cam_glasses_buzz': ('cameo/glasses_buzz_sit48_02.png', RAW),
    'cam_redhead': ('cameo/redhead_sit48_01.png', RAW), 'cam_merc': ('cameo/merc_sit48_01.png', RAW),
    'cam_polly_sit': ('cameo/polly_sit48_00.png', RAW), 'cam_tuyaa_sit': ('cameo/tuyaa_sit48_01.png', RAW),
    'prop_fountain': ('obj/fountain_01.png', RAW), 'prop_town_bench': ('obj/bench_00.png', RAW), 'prop_bar_table': ('obj/cafetable_02.png', RAW),
    'prop_telescope': ('obj/telescope_01.png', RAW), 'prop_log_seat': ('obj/log_00.png', RAW),
    'prop_bar2_table0': ('bar2/table0_full.png', RAW), 'prop_bar2_table1': ('bar2/table1_full.png', RAW),
    'prop_bar2_table2': ('bar2/table2_full.png', RAW), 'prop_bar2_table3': ('bar2/table3_full.png', RAW),
})
if __name__ == '__main__':
    for name, (src, h) in JOBS.items():
        p = os.path.join(W, src)
        if not os.path.exists(p): print('нет исходника', src); continue
        im = shrink(p, h); im.save(os.path.join(ROOT, 'assets', 'objects', name + '.png'))
    print('ok', len(JOBS))
