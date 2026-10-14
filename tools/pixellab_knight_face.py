# Портрет Найта (v0.68, замечание владельца): глаза видны в прорези забрала, забрало не похоже на грустное лицо.
# Правка готового портрета (64×64, на экране ×4), а не новая картинка — стиль и шлем остаются.
#   python3 tools/pixellab_knight_face.py edit      → варианты .pixellab_work/kface/edit_NN.png (по 4 на описание)
#   python3 tools/pixellab_knight_face.py pick N     → assets/portraits/knight.png (×4)
#   python3 tools/pixellab_knight_face.py tired      → из выбранного: прищур (knight-tired.png)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'kface'); os.makedirs(WORK, exist_ok=True)
POR = os.path.join(ROOT, 'assets', 'portraits')
SMALL = os.path.join(WORK, 'base64.png')
FACE = ('a knight in a closed steel great helm with a red plume; the visor has one wide straight horizontal eye slit, '
        'and through the dark slit the knight\'s two human eyes are clearly visible, light grey-green eyes with a calm steady look; '
        'the lower part of the visor below the slit is smooth plain metal with a vertical ridge in the middle, no breathing holes, no mouth shape, no face drawn on the metal')

def small(src, out):
    Image.open(src).convert('RGBA').resize((64, 64), Image.NEAREST).save(out)

cmd = sys.argv[1]
if cmd == 'edit':
    small(os.path.join(POR, 'knight.png'), SMALL)
    img, sz = b64img(SMALL)
    def job(i):
        return run('/edit-image-pixen', {'image': img, 'description': 'keep the same knight, same helmet, armor, plume, colors and style; only change the visor: ' + FACE,
                                         'width': 64, 'height': 64, 'no_background': True}, os.path.join(WORK, f'edit{i}'))
    with ThreadPoolExecutor(4) as ex: paths = [p for ps in ex.map(job, range(4)) for p in ps]
    sheet(paths, os.path.join(WORK, 'edit_sheet.png'), scale=4, cols=4)
    print(paths)
elif cmd == 'pick':
    src = sys.argv[2]
    Image.open(src).convert('RGBA').resize((256, 256), Image.NEAREST).save(os.path.join(POR, 'knight.png'))
    print('ok')
elif cmd == 'tired':
    small(os.path.join(POR, 'knight.png'), SMALL)
    img, sz = b64img(SMALL)
    def job(i):
        return run('/edit-image-pixen', {'image': img, 'description': 'the same knight, only the eyes in the visor slit change: tired, half closed squinting eyes, heavy eyelids; the visor metal stays exactly the same',
                                         'width': 64, 'height': 64, 'no_background': True}, os.path.join(WORK, f'tired{i}'))
    with ThreadPoolExecutor(3) as ex: paths = [p for ps in ex.map(job, range(3)) for p in ps]
    sheet(paths, os.path.join(WORK, 'tired_sheet.png'), scale=4, cols=4)
    print(paths)
print(req('GET', '/balance')['subscription']['generations'])
