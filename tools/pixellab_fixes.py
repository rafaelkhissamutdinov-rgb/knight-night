# Правки владельца 16.10 (PixelLab):
#   campfire — костёр с треногой и котелком одной картинкой (котелок над огнём, а не перед ним) → prop_campfire_pot
#   maid     — призрак служанки в стиле остальных спрайтов (пропорции Найта, ростом чуть ниже) → maid_ghost
#   python3 tools/pixellab_fixes.py <campfire|maid>              → .pixellab_work/fixes/<имя>_NN.png + лист
#   python3 tools/pixellab_fixes.py pick <campfire|maid> <номер>  → assets/objects/<картинка>.png
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'fixes'); os.makedirs(W, exist_ok=True)
OBJ = os.path.join(ROOT, 'assets', 'objects')
OUT = {'campfire': 'prop_campfire_pot', 'maid': 'maid_ghost'}

def knight_idle():
    m = json.load(open(os.path.join(ROOT, 'assets/sprites/knight/knight.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(ROOT, 'assets/sprites/knight/knight.png')).convert('RGBA')
    i = O.index('pose_idle')
    f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S))
    return f.crop(f.getbbox())

if sys.argv[1] == 'pick':
    name, n = sys.argv[2], int(sys.argv[3])
    im = Image.open(os.path.join(W, f'{name}_{n:02d}.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    if name == 'maid':   # ростом чуть ниже Найта (≈ 0,87 его роста)
        h = round(knight_idle().height * 0.87)
        im = im.resize((max(1, round(im.width * h / im.height)), h), Image.NEAREST)
    im.save(os.path.join(OBJ, OUT[name] + '.png')); print('ok', im.size)
    sys.exit()

name = sys.argv[1]
if name == 'campfire':
    fire = Image.open(os.path.join(OBJ, 'prop_campfire.png')).convert('RGBA')
    tri = Image.open(os.path.join(OBJ, 'prop_tripod.png')).convert('RGBA')
    comp = Image.new('RGBA', (48, 48))
    comp.alpha_composite(tri, ((48 - tri.width) // 2, 48 - tri.height - 2))
    comp.alpha_composite(fire, ((48 - fire.width) // 2, 48 - fire.height))
    rp = os.path.join(W, 'campfire_ref.png'); comp.save(rp)
    ref, rsz = b64img(rp)
    body = {'description': 'pixel art side view campfire of a travelling swordsman: a ring of stones and crossed logs, an iron tripod over it '
                           'with a small black iron cooking pot hanging from a chain ABOVE the flames, the orange flames rise from the logs '
                           'and lick the bottom of the pot from below and around its sides, the pot is clearly above the fire, '
                           'evenly lit, muted dusky colors, single color dark outline, transparent background',
            'image_size': {'width': 48, 'height': 48}, 'no_background': True,
            'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': 'the same stones, logs, tripod and pot, same pixel scale'}]}
else:
    k = knight_idle(); kp = os.path.join(W, 'knight_ref.png'); k.save(kp)
    pr = os.path.join(OBJ, 'priest_kneel.png')
    ref, rsz = b64img(kp); sty, ssz = b64img(pr)
    body = {'description': 'pixel art side view full body ghost of a young castle maid standing and facing left, slim realistic adult proportions '
                           '(small head, about one seventh of the height, not chibi, not anime), simple linen cap, long plain dress with an apron, '
                           'hands clasped at the chest, head bowed sadly; the whole figure pale translucent icy blue monochrome with a soft glow, '
                           'the hem of the dress fades into mist; transparent background',
            'image_size': {'width': 64, 'height': 64}, 'no_background': True,
            'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': 'body proportions, pixel scale and height of a character in this game (the maid is a bit shorter than him)'}],
            'style_image': {'image': sty, 'size': {'width': ssz[0], 'height': ssz[1]}},
            'style_options': {'color_palette': True, 'outline': True, 'detail': True, 'shading': True}}
paths = run('/generate-image-v2', body, os.path.join(W, name))
sheet(paths, os.path.join(W, name + '_sheet.png'), scale=3, cols=8)
print(name, len(paths), req('GET', '/balance')['subscription']['generations'])
