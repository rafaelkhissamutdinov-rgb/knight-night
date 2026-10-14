# Лавка Лики (v0.67): экран торговли в духе «портрет слева, разговор справа» — свои картинки, не чужие.
#   scene   — фон сцены: прилавок, полки, свеча (без персонажа)        → art/pixellab/shop/scene_NN.png
#   bust    — Лика по пояс за прилавком (по её портрету и спрайту)      → art/pixellab/shop/bust_NN.png
#   moods   — настроения бюста правкой картинки (как у портретов)      → assets/shop/lika_<mood>.png
#   sit     — Лика сидит на бочке, вид сбоку (NPC в комнате)            → art/pixellab/shop/sit_NN.png
# Запуск: python3 tools/pixellab_shop.py scene|bust|sit ;  python3 tools/pixellab_shop.py moods <номер бюста>
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art', 'pixellab', 'shop'); os.makedirs(ART, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'shop'); os.makedirs(OUT, exist_ok=True)
LIKA = ('a short young woman with long straight black hair and ragged bangs down to the eyes, pale skin, dark eyes, '
        'olive green long coat with a high buttoned collar, a sly gentle smile')
def ref(path, usage):
    im, sz = b64img(path)
    return {'image': im, 'size': {'width': sz[0], 'height': sz[1]}, 'usage_description': usage}

cmd = sys.argv[1]
if cmd == 'scene':
    p = run('/generate-image-v2', {'description': 'detailed pixel art scene for a shop screen in a 2D fantasy game: the inside of a cozy cluttered little shop set up in an abandoned castle room; '
        'a sturdy wooden counter across the bottom third, behind it wooden shelves full of potion bottles, scrolls, jars, small boxes and trinkets, '
        'hanging dried herbs and a brass lantern with a candle, a patterned rug on the wall, warm candle light, cozy slow fantasy mood; '
        'empty space behind the counter in the middle (a shopkeeper will stand there), no characters, no text',
        'image_size': {'width': 256, 'height': 288}, 'no_background': False}, os.path.join(ART, 'scene'))
    sheet(p, os.path.join(ART, 'scene_sheet.png'), scale=2, cols=len(p))
elif cmd == 'bust':
    p = run('/generate-image-v2', {'description': LIKA + '; half body portrait from the waist up, standing behind a shop counter and leaning on it with her hands, '
        'facing the viewer, detailed pixel art, soft warm light, transparent background',
        'image_size': {'width': 160, 'height': 160}, 'no_background': True,
        'reference_images': [ref(os.path.join(ROOT, 'assets', 'portraits', 'lika.png'), 'her face, hair and coat: keep the same character'),
                             ref(os.path.join(ROOT, '.pixellab_work', 'lika_front.png'), 'her full outfit and colors')]}, os.path.join(ART, 'bust'))
    sheet(p, os.path.join(ART, 'bust_sheet.png'), scale=2, cols=len(p))
elif cmd == 'sit':
    p = run('/generate-image-v2', {'description': LIKA + '; full body, sitting on a wooden barrel, side view facing right, legs dangling, relaxed, small pixel art game character about 60 pixels tall, transparent background',
        'image_size': {'width': 64, 'height': 80}, 'no_background': True,
        'reference_images': [ref(os.path.join(ROOT, '.pixellab_work', 'lika_pose_idle.png'), 'the same character, same pixel size and style, side view')]}, os.path.join(ART, 'sit'))
    sheet(p, os.path.join(ART, 'sit_sheet.png'), scale=3, cols=min(len(p), 8))
elif cmd == 'moods':
    base = os.path.join(ART, f'bust_{int(sys.argv[2]):02d}.png')
    Image.open(base).convert('RGBA').save(os.path.join(OUT, 'lika_default.png'))
    MOODS = {'happy': 'smiling happily with eyes squinting', 'sly': 'a sly mischievous smirk, one eyebrow raised', 'surprised': 'surprised, eyes wide open, mouth slightly open',
             'sulky': 'sulking, pouting, looking aside', 'serious': 'serious calm face, no smile', 'worried': 'worried, eyebrows raised, biting lip',
             'angry': 'angry frowning face', 'blink': 'the same face with eyes closed (blinking)'}
    img, sz = b64img(base)
    def job(kv):
        k, d = kv
        q = run('/edit-image-pixen', {'image': img, 'description': 'the same woman, only the facial expression changes: ' + d, 'width': sz[0], 'height': sz[1], 'no_background': True}, os.path.join(ART, f'mood_{k}'))
        Image.open(q[0]).convert('RGBA').save(os.path.join(OUT, f'lika_{k}.png')); return k
    with ThreadPoolExecutor(3) as ex: print(list(ex.map(job, MOODS.items())))
print(req('GET', '/balance')['subscription']['generations'])
