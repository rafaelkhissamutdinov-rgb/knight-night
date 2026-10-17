# Посадка рыцаря на местах отдыха (владелец, 17.10: «садится странно — пусть садится по месту»).
#   seat   — сидит на скамье / диване / в кресле: спина прямо, бёдра на сиденье, голени вниз, руки на коленях
#   ground — сидит на земле у костра, как Илиа: колени подняты, руки на коленях, спокойно
#   python3 tools/pixellab_sit.py [seat|ground ...]   → .pixellab_work/sit/<поза>_NN.png + лист
#   python3 tools/pixellab_sit.py pick <поза> <номер>  → assets/objects/knight_sit_<поза>.png (рост — как у рыцаря)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'sit'); os.makedirs(W, exist_ok=True)
OBJ = os.path.join(ROOT, 'assets', 'objects')
POSES = {
    'seat': 'sitting upright on a low bench seen from the side, facing right: the back straight, the thighs horizontal on the seat, '
            'the lower legs straight down with the feet on the floor, both hands resting on the knees, relaxed and calm; no bench drawn, only the knight',
    'ground': 'sitting on the ground by a campfire seen from the side, facing right: the knees drawn up, the forearms resting on the knees, '
              'the back slightly bent, tired and calm, resting',
}

def knight(name):
    m = json.load(open(os.path.join(ROOT, 'assets/sprites/knight/knight.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(ROOT, 'assets/sprites/knight/knight.png')).convert('RGBA')
    i = O.index(name)
    f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S))
    return f.crop(f.getbbox())

if len(sys.argv) > 1 and sys.argv[1] == 'pick':
    pose, n = sys.argv[2], int(sys.argv[3])
    im = Image.open(os.path.join(W, f'{pose}_{n:02d}.png')).convert('RGBA'); im = im.crop(im.getbbox())
    h = round(knight('pose_idle').height * (0.74 if pose == 'seat' else 0.58))   # сидя — ниже стоящего
    im = im.resize((max(1, round(im.width * h / im.height)), h), Image.NEAREST)
    im.save(os.path.join(OBJ, f'knight_sit_{pose}.png')); print('ok', im.size)
    sys.exit()

kp = os.path.join(W, 'knight_ref.png'); knight('pose_sheathed').save(kp)
ref, rsz = b64img(kp)
def job(pose):
    body = {'description': 'pixel art full body of this exact knight: a slender elegant knight in worn steel plate armour with a closed great helm and a red plume, '
                           'the sword sheathed on his back, ' + POSES[pose] + '. Same pixel scale and style, single color dark outline, transparent background',
            'image_size': {'width': 64, 'height': 64}, 'no_background': True,
            'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': 'exactly this knight: armour, helmet, plume, colors, proportions and pixel scale'}],
            'style_image': {'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}},
            'style_options': {'color_palette': True, 'outline': True, 'detail': True, 'shading': True}}
    p = run('/generate-image-v2', body, os.path.join(W, pose))
    sheet(p, os.path.join(W, pose + '_sheet.png'), scale=3, cols=8)
    return pose, len(p)
with ThreadPoolExecutor(2) as ex:
    for r in ex.map(job, sys.argv[1:] or list(POSES)): print(*r, flush=True)
print(req('GET', '/balance')['subscription']['generations'])
