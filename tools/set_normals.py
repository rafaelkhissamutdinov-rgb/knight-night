# Карта нормалей для всего набора спрайтов (v0.81): лист <набор>.png → <набор>_n.png полосами по 16 кадров
# (PixelLab /normal-map, ≈ 0,5 генерации за полосу). Нужна, когда набор сделан переносом костюма и силуэт другой.
#   python3 tools/set_normals.py knight_marauder
import sys, os, io, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[1]
D = os.path.join(ROOT, 'assets', 'sprites', name)
W = os.path.join(ROOT, '.pixellab_work', 'normals', name); os.makedirs(W, exist_ok=True)
m = json.load(open(os.path.join(D, name + '.json')))
S, C = m['size'], m['sheet']['cols']
sh = Image.open(os.path.join(D, name + '.png')).convert('RGBA')
rows = sh.height // S
def job(r):
    strip = sh.crop((0, r * S, C * S, r * S + S))
    n = sum(1 for c in range(C) if strip.crop((c * S, 0, c * S + S, S)).getbbox())
    if not n: return r, None
    done = os.path.join(W, f'row{r}_00.png')
    if os.path.exists(done): return r, Image.open(done).convert('RGBA')   # уже посчитано (перезапуск после сбоя)
    buf = io.BytesIO(); strip.crop((0, 0, n * S, S)).save(buf, 'PNG')
    p = run('/normal-map', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, 'frames': n, 'convention': 'opengl'}, os.path.join(W, f'row{r}'))
    return r, Image.open(p[0]).convert('RGBA')
out = Image.new('RGBA', sh.size)
with ThreadPoolExecutor(4) as ex:
    for r, im in ex.map(job, range(rows)):
        if im is None: continue
        # нормали только там, где есть сам рисунок (альфа листа)
        a = sh.crop((0, r * S, im.width, r * S + S)).getchannel('A')
        im.putalpha(a)
        out.paste(im, (0, r * S))
        print('row', r, flush=True)
out.save(os.path.join(D, name + '_n.png'), optimize=True)
print('ok')
