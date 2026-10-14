# Карты нормалей для предметов и стен (v0.69): живой свет освещает их объёмно — кладка ловит свет факела рельефом,
# бочки и шкафы — боком. Раньше нормали были только у персонажей, остальное светилось «плоской наклейкой».
#   python3 tools/pixellab_normals.py            → assets/objects/n/<имя>.png и assets/backgrounds/<набор>/n/<имя>.png
# Уже готовые пропускаются. Стены 640 px — двумя половинами (метод берёт до 512 px на сторону). 0,5 генерации за карту.
import sys, os, io, glob, base64, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'normals'); os.makedirs(WORK, exist_ok=True)

def nmap(im, tag):
    buf = io.BytesIO(); im.save(buf, 'PNG')
    p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': 1, 'convention': 'opengl'}, os.path.join(WORK, tag))
    return Image.open(p[0]).convert('RGBA')

def job(src):
    d, name = os.path.split(src)
    out = os.path.join(d, 'n', name)
    if os.path.exists(out): return None
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = Image.open(src).convert('RGBA')
    tag = os.path.basename(d) + '_' + name[:-4]
    try:
        if im.width > 512:
            res = Image.new('RGBA', im.size)
            h = im.width // 2
            res.paste(nmap(im.crop((0, 0, h, im.height)), tag + '_a'), (0, 0))
            res.paste(nmap(im.crop((h, 0, im.width, im.height)), tag + '_b'), (h, 0))
        else:
            res = nmap(im, tag)
        if res.size != im.size: res = res.resize(im.size, Image.NEAREST)
        res.save(out)
        return name
    except Exception as e:
        return f'{name}: {e}'

files = [f for f in glob.glob(os.path.join(ROOT, 'assets', 'objects', '*.png')) if not os.path.basename(f).startswith('wpn_')]
# стены — не здесь: метод делает из куска стены один «предмет» и наклоняет его целиком; их нормали — tools/wall_normals.py
only = sys.argv[1:]
if only: files = [f for f in files if any(o in f for o in only)]
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(job, files):
        if r: print(r, flush=True)
# список готовых карт — игра грузит только их (без 404 в консоли)
nd = os.path.join(ROOT, 'assets', 'objects', 'n')
json.dump(sorted(f[:-4] for f in os.listdir(nd) if f.endswith('.png')), open(os.path.join(nd, 'index.json'), 'w'))
print('баланс', req('GET', '/balance')['subscription']['generations'])
