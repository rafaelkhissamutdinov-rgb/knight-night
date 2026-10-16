# Знаки путей (v0.94, лор владельца — docs/story.md «Пути и концовки»): появляются над окном разговора, когда выбор
# влияет на путь. Пилигрим — солнце, Призрак — Уроборос, Монарх — корона, Эгоист — закрытый глаз.
# Запуск: python3 tools/pixellab_signs.py [имя ...]           → .pixellab_work/signs/<имя>_NN.png + лист
#         python3 tools/pixellab_signs.py pick <имя> <номер>   → assets/ui/sign_<имя>.png
# Ключ — PIXELLAB_API_KEY.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'signs'); os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'ui')
STYLE = ('mystical sigil emblem, pixel art for a dark fantasy RPG, single symbol centered, bold readable silhouette, '
         'soft inner glow, limited palette, single color dark outline, transparent background')
SIGNS = {
    'pilgrim': 'a radiant golden sun with straight rays, warm light, hope',
    'ghost': 'an ouroboros, a pale silver-green serpent biting its own tail forming a perfect circle, an endless loop',
    'monarch': 'a royal golden crown with red gems, regal and imposing',
    'egoist': 'a single closed eye with lashes, a calm indifferent closed eyelid, pale grey and violet',
}
if len(sys.argv) > 1 and sys.argv[1] == 'pick':
    Image.open(os.path.join(WORK, f'{sys.argv[2]}_{int(sys.argv[3]):02d}.png')).convert('RGBA').save(os.path.join(OUT, 'sign_' + sys.argv[2] + '.png')); print('ok')
else:
    for n in sys.argv[1:] or list(SIGNS):
        try:
            paths = run('/generate-image-v2', {'description': SIGNS[n] + '. ' + STYLE, 'image_size': {'width': 48, 'height': 48}, 'no_background': True}, os.path.join(WORK, n))
        except SystemExit as e:
            print('сбой', n, str(e)[:100], flush=True); continue
        sheet(paths, os.path.join(WORK, n + '_sheet.png'), scale=3, cols=8)
        print(n, len(paths), flush=True)
    print('balance', req('GET', '/balance')['subscription']['generations'])
