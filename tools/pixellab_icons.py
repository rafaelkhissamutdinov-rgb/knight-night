# Иконки предметов (v0.74) для сумки, снаряжения и лавки: PixelLab, 48×48, один стиль.
# Запуск: python3 tools/pixellab_icons.py [id ...]          → варианты в .pixellab_work/icons/<id>_NN.png + общий лист
#         python3 tools/pixellab_icons.py pick <id> <номер>  → assets/items/<id>.png
# Ключ — PIXELLAB_API_KEY.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'icons'); os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'items'); os.makedirs(OUT, exist_ok=True)
STYLE = ('pixel art inventory icon for a dark fantasy RPG, single object centered, slight three-quarter view, '
         'detailed high quality pixel art, muted dusky colors with warm highlights, single color dark outline, transparent background')
ITEMS = {
    'sword_old': 'an old worn steel bastard sword, simple crossguard, leather grip, a few nicks on the blade, diagonal',
    'rapier': 'an elegant rapier with an ornate swept silver hilt and a thin long blade, diagonal',
    'armor_old': 'a worn scratched steel knight breastplate with pauldrons and a red cloth trim',
    'armor_marauder': 'a set of brown leather marauder armor: leather jacket with buckles, dark red scarf, worn boots',
    'mar_scarf': 'a rolled dark red marauder scarf bandana tied with a knot',
    'mar_jacket': 'a folded brown leather jacket with straps and buckles',
    'mar_boots': 'a pair of worn brown leather boots with straps',
    'diamond_ace': 'a playing card, ace of diamonds, slightly glowing red diamond, old paper',
    'journal': 'a small leather-bound journal with a strap and a bookmark ribbon',
    'potion': 'a round glass bottle of red healing potion with a cork',
    'bandage': 'a rolled linen bandage',
    'map': 'a rolled parchment map of a castle tied with a cord',
    'key_tower': 'a heavy ornate iron tower key with a tower-shaped bow',
    'spell_bolt': 'a glowing blue magic bolt rune on a small stone tablet',
    'skill_triple': 'three crossed rapier thrust lines, a fencing technique emblem, silver',
    'skill_cleave': 'a heavy sword cleave emblem, a downward arc slash, orange',
    'scroll_cleave': 'an old rolled scroll with a red wax seal and a drawn sword',
    'scroll_fencing': 'an old yellowed fencing scroll with drawings of a rapier, tied with string',
    'golden_skull': 'a small golden skull with ruby eyes',
    'silver_cup': 'an ornate silver chalice cup',
    'rosary': 'a monk rosary of wooden beads with a small silver cross',
}

if len(sys.argv) > 1 and sys.argv[1] == 'pick':
    im = Image.open(os.path.join(WORK, f'{sys.argv[2]}_{int(sys.argv[3]):02d}.png')).convert('RGBA')
    bb = im.getbbox(); c = im.crop(bb)
    out = Image.new('RGBA', (48, 48)); out.paste(c, ((48 - c.width) // 2, (48 - c.height) // 2))
    out.save(os.path.join(OUT, sys.argv[2] + '.png')); print('ok')
else:
    ids = sys.argv[1:] or list(ITEMS)
    for i in ids:
        paths = run('/generate-image-v2', {'description': ITEMS[i] + '. ' + STYLE, 'image_size': {'width': 48, 'height': 48}, 'no_background': True},
                    os.path.join(WORK, i))
        print(i, len(paths), flush=True)
    print(req('GET', '/balance')['subscription']['generations'])
