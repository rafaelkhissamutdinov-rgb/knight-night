# Кат-сцена конца главы 1 кадрами (владелец, 17.10: «как story mode — картинка за картинкой, нарисовано отдельно, с мечом»).
# Одна основная картина (рыцарь стоит, призрак капитана на колене у двери покоев), остальные кадры — правки её же:
# так герои и зал одинаковые от кадра к кадру, меняется только поза.
#   python3 tools/pixellab_ending.py base                 → .pixellab_work/ending/base<k>_00.png (2 варианта)
#   python3 tools/pixellab_ending.py frames <база> [кадр…] → <кадр>_00.png — правки выбранной основы
#   python3 tools/pixellab_ending.py pick <файл> <имя>     → assets/story/ending_<имя>.png
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'ending'); os.makedirs(W, exist_ok=True)
REFS = os.path.join(ROOT, '.pixellab_work', 'story')
STYLE = ('cinematic pixel art illustration for a storybook cutscene in a melancholic dark fantasy game, side view, '
         'painterly detailed pixel art, cold blue moonlight with a warm accent, no text, no frame, no border')
KNIGHT = ('the knight: slender and elegant, worn dull steel plate armour, a closed great helm with a red plume, '
          'holding a long straight steel sword (a sword, not a dagger)')
GHOST = ('the ghost of the knight captain: white porcelain Venetian mask with gold filigree, steel morion helmet with a red plume, '
         'long white surcoat with an orange emblem, dark armour underneath, translucent pale blue, his legs fading into ghostly mist')
BASE = ('inside a dark gothic castle antechamber before the tall ornate carved wooden door of the princess chamber, moonlight through a window: '
        'on the left ' + KNIGHT + ', standing with the sword lowered; on the right ' + GHOST + ', kneeling on one knee before him, defeated, head slightly lowered. '
        'Both full body, facing each other, fully painted background')
FRAMES = {   # правки основы: только поза, остальное — как было
    'bow':      'keep everything exactly the same, only the kneeling ghost bows his head very low, almost touching the floor, humble',
    'rise':     'keep everything exactly the same, only the ghost slowly rises and stands upright, calm, the sword at his side',
    'look':     'keep everything exactly the same and keep the ghost standing upright in exactly the same pose and place, only his head turns so the white mask faces the viewer, looking straight at us, calm',
    'fade':     'keep everything exactly the same, only the standing ghost dissolves into soft glowing golden and pale blue light, fading away peacefully, motes of light rising',
    'mask':     'keep the knight and the hall exactly the same; the ghost is gone; on the floor where he stood lies his white porcelain mask broken in two halves, a faint glow',
    'raise':    'keep everything exactly the same, only the knight raises his long sword high above his head with both hands over the kneeling ghost',
    'strike':   'keep the hall the same; the knight has swung his sword down in a bright slashing arc; the ghost bursts into pale blue mist, '
                'his white mask split in two halves flying apart; no blood',
}
def compose(base, edit, x0=0):
    """Кадр = основа + изменившееся из правки правее x0. Прозрачное в основе правка заливает белым — там остаётся основа."""
    B = Image.open(os.path.join(W, base + '.png')).convert('RGBA'); E = Image.open(os.path.join(W, edit + '.png')).convert('RGBA').resize(B.size)
    bg = Image.new('RGBA', B.size, (6, 5, 10, 255)); bg.alpha_composite(B); B = bg
    b, e = B.load(), E.load()
    for y in range(B.height):
        for x in range(x0, B.width):
            r, g, bl, a = e[x, y]
            if a < 128 or (r > 238 and g > 238 and bl > 238): continue   # белое пятно — артефакт правки
            b[x, y] = (r, g, bl, 255)
    return B
if sys.argv[1] == 'compose':   # compose <основа> <правка> <x0> <итог> → <итог>.png
    compose(sys.argv[2], sys.argv[3], int(sys.argv[4])).save(os.path.join(W, sys.argv[5] + '.png')); print('ok'); sys.exit()
if sys.argv[1] == 'pick':
    Image.open(os.path.join(W, sys.argv[2] + '.png')).convert('RGB').save(os.path.join(ROOT, 'assets', 'story', 'ending_' + sys.argv[3] + '.png')); print('ok'); sys.exit()
def ref(path, usage):
    im, sz = b64img(path)
    return {'image': im, 'size': {'width': sz[0], 'height': sz[1]}, 'usage_description': usage}
if sys.argv[1] == 'base':
    m = json.load(open(os.path.join(ROOT, 'assets/sprites/knight/knight.json')))
    S, C, O = m['size'], m['sheet']['cols'], m['sheet']['order']
    sh = Image.open(os.path.join(ROOT, 'assets/sprites/knight/knight.png')).convert('RGBA'); i = O.index('pose_idle')
    f = sh.crop(((i % C) * S, (i // C) * S, (i % C) * S + S, (i // C) * S + S)); f = f.crop(f.getbbox())
    kp = os.path.join(W, 'knight_ref.png'); f.resize((f.width * 2, f.height * 2), Image.NEAREST).save(kp)
    refs = [ref(os.path.join(REFS, 'captain_ref.png'), 'the ghost captain costume: mask, morion helmet, plume, white surcoat, emblem'),
            ref(os.path.join(REFS, 'boss_ref.png'), 'the ghostly pale blue mist instead of legs and the glow'),
            ref(kp, 'the knight exactly as here: armour, great helm, red plume, slender build')]
    def job(k):
        return run('/generate-image-v2', {'description': BASE + '. ' + STYLE, 'image_size': {'width': 320, 'height': 180}, 'reference_images': refs, 'seed': 300 + k},
                   os.path.join(W, f'base{k}'))
    with ThreadPoolExecutor(2) as ex: print([len(p) for p in ex.map(job, range(2))], req('GET', '/balance')['subscription']['generations'])
elif sys.argv[1] == 'frames':
    src = os.path.join(W, sys.argv[2] + '.png'); flat = os.path.join(W, sys.argv[2] + '_flat.png')
    bg = Image.new('RGBA', Image.open(src).size, (6, 5, 10, 255)); bg.alpha_composite(Image.open(src).convert('RGBA')); bg.save(flat)   # без прозрачности: иначе правка заливает её белым
    img, sz = b64img(flat)
    def job(key):
        return key, run('/edit-images-v2', {'method': 'edit_with_text', 'description': FRAMES[key] + '. ' + STYLE, 'seed': int(os.environ.get('SEED', 41)),
                                             'edit_images': [{'image': img, 'width': 320, 'height': 180}], 'image_size': {'width': 320, 'height': 180}},
                        os.path.join(W, key + os.environ.get('TAG', '')))
    with ThreadPoolExecutor(4) as ex:
        for k, p in ex.map(job, sys.argv[3:] or list(FRAMES)): print(k, len(p), flush=True)
    print(req('GET', '/balance')['subscription']['generations'])
