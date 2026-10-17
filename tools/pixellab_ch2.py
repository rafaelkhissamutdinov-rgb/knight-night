# Глава 2 — пробные картинки (владелец, 16–17.10: спуск со скалы через лес днём, гоблины и мародёры, деревня внизу).
#   python3 tools/pixellab_ch2.py goblin   → .pixellab_work/ch2/goblin_NN.png + лист (облик гоблина, по росту рядом с Найтом)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'ch2'); os.makedirs(W, exist_ok=True)

def knight():
    m = json.load(open(os.path.join(ROOT, 'assets/sprites/knight/knight.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(ROOT, 'assets/sprites/knight/knight.png')).convert('RGBA'); i = O.index('pose_idle')
    f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S)); return f.crop(f.getbbox())

WHAT = {
    'goblin': 'a forest goblin bandit for a dark fantasy side-scroller: small and wiry, about two thirds of the height of the knight, green-grey skin, '
              'long pointed ears, sharp yellow eyes, a patched leather hood and scraps of stolen armour, a crude rusty short blade, hunched aggressive stance, '
              'full body, side view facing left',
    # описание друга владельца (17.10): четыре вида гоблинов
    'shaman': 'a goblin shaman: a purple-skinned humanoid monster with long pointed ears and a long tongue hanging out, in a tattered dark ritual robe with bone charms, '
              'holding a crooked staff with a small skull, hunched, sinister, full body, side view facing left, a bit shorter than the knight',
    'jumper': 'a goblin leaper: a green-skinned humanoid monster with very long ears, bare torso, a long tongue hanging out, a short dagger in hand, '
              'crouched low on bent legs ready to leap, wiry and agile, full body, side view facing left, about two thirds the height of the knight',
    'warrior': 'a goblin warrior: an orange-skinned humanoid monster with long pointed ears in ragged worn clothes and scraps of leather, '
               'holding a notched rusty sword, sturdy fighting stance, full body, side view facing left, a bit shorter than the knight',
    'shooter': 'a goblin slinger: a yellow-skinned humanoid monster with long ears and a long tongue in ragged worn clothes, '
               'holding a wooden slingshot with a stone loaded, aiming, full body, side view facing left, about two thirds the height of the knight',
}
kp = os.path.join(W, 'knight_ref.png'); knight().save(kp); ref, rsz = b64img(kp)
for name in sys.argv[1:]:
    p = run('/generate-image-v2', {'description': WHAT[name] + '. Pixel art game sprite, same pixel scale and style as the reference knight, single color dark outline, transparent background',
                                   'image_size': {'width': 64, 'height': 64}, 'no_background': True,
                                   'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': 'pixel scale, outline and shading style; the goblin is much shorter than this knight'}],
                                   'style_image': {'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}}},
            os.path.join(W, name))
    sheet(p, os.path.join(W, name + '_sheet.png'), scale=3, cols=8)
    print(name, len(p), req('GET', '/balance')['subscription']['generations'], flush=True)
