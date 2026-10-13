# Клиент PixelLab (https://api.pixellab.ai/v2): POST задания, ожидание фонового job, сохранение картинок.
# Ключ — из переменной окружения PIXELLAB_API_KEY (Network secrets / переменные среды), в репозиторий НЕ класть.
# Цена: generate-image-v2 на 64×64 (16 вариантов) = 10 генераций.
import base64, io, json, os, sys, time, urllib.request
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get('PIXELLAB_API_KEY') or open(os.environ.get('PIXELLAB_KEY_FILE', os.path.join(HERE, '.pixellab_key'))).read().strip()
BASE = 'https://api.pixellab.ai/v2'

def req(method, path, body=None):
    r = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body else None,
                               headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=120) as f: return json.load(f)
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code}: {e.read().decode()[:800]}')

def b64img(path, size=None):
    im = Image.open(path).convert('RGBA')
    if size: im = im.resize(size, Image.NEAREST if max(im.size) > max(size) and im.size[0] % size[0] == 0 else Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}, im.size

def run(path, body, out_prefix):
    r = req('POST', path, body)
    job = r.get('background_job_id') or r.get('job_id')
    if not job:
        imgs = find_images(r)
    else:
        while True:
            time.sleep(6)
            j = req('GET', f'/background-jobs/{job}')
            if j.get('status') == 'completed': imgs = find_images(j.get('last_response', j)); break
            if j.get('status') == 'failed': sys.exit('failed: ' + json.dumps(j)[:800])
    paths = []
    for i, b in enumerate(imgs):
        p = f'{out_prefix}_{i:02d}.png'
        Image.open(io.BytesIO(base64.b64decode(b.split(',')[-1]))).save(p); paths.append(p)
    return paths

def find_images(o):
    out = []
    if isinstance(o, dict):
        if 'base64' in o and isinstance(o['base64'], str): return [o['base64']]
        for v in o.values(): out += find_images(v)
    elif isinstance(o, list):
        for v in o: out += find_images(v)
    return out

def sheet(paths, out, scale=3, cols=4, bg=(30, 26, 43, 255)):
    ims = [Image.open(p).convert('RGBA') for p in paths]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    s = Image.new('RGBA', (cols * (w * scale + 6), rows * (h * scale + 6)), bg)
    for i, im in enumerate(ims):
        s.alpha_composite(im.resize((w * scale, h * scale), Image.NEAREST), ((i % cols) * (w * scale + 6), (i // cols) * (h * scale + 6)))
    s.save(out)
