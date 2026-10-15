# Настроения портретов (владелец, 15.10: «больше эмоций всем, как у Лики»): правка утверждённого портрета 64×64
# (edit-image-pixen), тот же персонаж — меняется только выражение / поза головы / свет. Канон — docs/art-canon.md.
#   python3 tools/pixellab_moods.py [персонаж ...]          → .pixellab_work/moods/<персонаж>_<настроение>_<k>_NN.png + лист
#   python3 tools/pixellab_moods.py pick <персонаж> <настроение> <файл>  → assets/portraits/<имя>-<настроение>.png (256×256)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'moods'); os.makedirs(W, exist_ok=True)
POR = os.path.join(ROOT, 'assets', 'portraits')
FACE = {'alkima': 'alkima', 'ilia': 'ilia', 'knight': 'knight'}
KEEP = 'keep exactly the same character, hair, clothes, colors, framing and pixel art style; only change: '
MOODS = {
    'alkima': {'happy': 'a warm open smile', 'sly': 'a sly knowing half smile, one eyebrow raised', 'surprised': 'surprised, eyebrows up, lips parted',
               'serious': 'serious focused look, calm closed lips', 'worried': 'worried, eyebrows drawn together', 'sad': 'quietly sad, eyes lowered',
               'annoyed': 'annoyed, slight frown, eyes narrowed'},
    'ilia': {'happy': 'a friendly grin', 'surprised': 'surprised, eyebrows up, mouth open', 'serious': 'serious stern look',
             'worried': 'worried, eyebrows drawn together', 'sad': 'sad, eyes lowered', 'angry': 'angry, frowning, teeth clenched',
             'pain': 'wincing in pain, one eye shut, teeth gritted', 'awkward': 'an awkward embarrassed smile, eyes looking aside'},
    # у Найта лица не видно: эмоция — поза головы и свет на шлеме (владелец: как смайлик-череп — голова наклонена, тень на шлеме)
    'knight': {'down': 'the head is bowed down and slightly tilted, a dark shadow falls over the helmet and visor, gloomy and displeased',
               'up': 'the head is raised up proudly, light falls on the helmet, determined',
               'tilt': 'the head is tilted to one side, curious and doubtful',
               'aside': 'the whole helmet is turned slightly away to the side and down, embarrassed; the visor stays fully closed: no face, no eyes, no mouth visible, only a dark visor slit',
               'sad': 'the head is lowered softly, shoulders dropped, the helmet in soft shadow, sad',
               'surprised': 'the head jerks back and up slightly, the red plume flicks up, a small startle; the visor stays fully closed: no face, no eyes, no mouth visible, only a dark visor slit'},
}
if sys.argv[1:2] == ['pick']:
    who, mood, f = sys.argv[2:5]
    Image.open(os.path.join(W, f)).convert('RGBA').resize((256, 256), Image.NEAREST).save(os.path.join(POR, f'{FACE[who]}-{mood}.png')); print('ok')
    sys.exit()
only = os.environ.get('MOODS_ONLY', '').split(',') if os.environ.get('MOODS_ONLY') else None   # только эти настроения
for who in sys.argv[1:] or list(MOODS):
    small = os.path.join(W, who + '64.png'); Image.open(os.path.join(POR, FACE[who] + '.png')).convert('RGBA').resize((64, 64), Image.NEAREST).save(small)
    img, sz = b64img(small)
    seeds = range(2, 4) if only else range(2)   # повтор — с новыми семенами, прежние файлы не затираются
    jobs = [(m, k) for m in MOODS[who] if not only or m in only for k in seeds]
    def job(a):
        m, k = a
        try:
          return run('/edit-image-pixen', {'image': img, 'description': KEEP + MOODS[who][m], 'width': 64, 'height': 64, 'no_background': True, 'seed': 31 + k},
                   os.path.join(W, f'{who}_{m}_{k}'))
        except SystemExit as e:   # сбой сервера на одном варианте — не валить остальные
          print('сбой', m, k, str(e)[:120], flush=True); return []
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, jobs) for q in ps]
    sheet(paths, os.path.join(W, who + '_sheet.png'), scale=3, cols=4); print(who, len(paths), flush=True)
