# Двери (v0.70): из закрытой двери — открытая (створка распахнута внутрь, за ней тёмный проход) и кадры поворота между ними.
#   python3 tools/pixellab_door_open.py wood|iron   → assets/objects/door_<вид>_open_<n>.png (0 — чуть приоткрыта … последняя — открыта)
import sys, os, json, io, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBJ = os.path.join(ROOT, 'assets', 'objects'); WORK = os.path.join(ROOT, '.pixellab_work', 'doors'); os.makedirs(WORK, exist_ok=True)
kind = sys.argv[1]
src = os.path.join(OBJ, f'door_{kind}.png')
im = Image.open(src).convert('RGBA')
# холст под размеры метода (кратно 8, с запасом), дверь — снизу по центру
W, H = 72, 96
c = Image.new('RGBA', (W, H)); c.alpha_composite(im, ((W - im.width) // 2, H - im.height)); cp = os.path.join(WORK, f'{kind}_closed.png'); c.save(cp)
img, _ = b64img(cp)
op = os.path.join(WORK, f'{kind}_open')
if not os.path.exists(op + '_00.png'):
    run('/edit-image-pixen', {'image': img, 'description': 'the same stone archway and the same door, but the door leaf is swung wide open inward on its left hinges (seen edge-on, narrow), revealing a dark stone passage beyond with a faint warm light deep inside',
                               'width': W, 'height': H, 'no_background': True}, op)
oimg, _ = b64img(op + '_00.png')
r = req('POST', '/interpolation-v2', {'start_image': {'image': img, 'size': {'width': W, 'height': H}}, 'end_image': {'image': oimg, 'size': {'width': W, 'height': H}},
                                      'action': 'the heavy door slowly swings open inward on its hinges', 'image_size': {'width': W, 'height': H}, 'no_background': True})
for _ in range(150):
    s = req('GET', f"/background-jobs/{r['background_job_id']}")
    if s['status'] in ('completed', 'failed'): break
    time.sleep(6)
frames = [Image.open(io.BytesIO(base64.b64decode(b.split(',')[-1]))).convert('RGBA') for b in find_images(s.get('last_response', {}))]
frames.append(Image.open(op + '_00.png').convert('RGBA'))
for i, f in enumerate(frames):
    f.save(os.path.join(WORK, f'{kind}_swing_{i}.png'))
print(kind, 'кадров', len(frames), req('GET', '/balance')['subscription']['generations'])
