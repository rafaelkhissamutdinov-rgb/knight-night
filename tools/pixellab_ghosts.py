# Портреты призраков (v0.81): священник и служанка — в стиле остальных портретов (образец стиля — Лика 64×64),
# облик — по их фигуркам в игре (assets/objects/priest_kneel.png, maid_ghost.png). Бледно-голубые, полупрозрачные.
#   python3 tools/pixellab_ghosts.py <priest|maid>        → .pixellab_work/ghosts/<имя>_NN.png + лист
#   python3 tools/pixellab_ghosts.py pick <имя> <номер>   → assets/portraits/<имя>.png (256×256)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'ghosts'); os.makedirs(W, exist_ok=True)
GHOST = ('a ghost: the whole figure is pale translucent icy blue and cyan monochrome with soft glow, no warm colors, '
         'plain dark background, head-and-shoulders portrait facing the viewer, whole head visible with space above')
WHO = {
    'priest': ('pixel art portrait of the ghost of an old castle priest, gaunt tired face, bald head, deep sorrowful eyes, '
               'plain monk cassock with a hood lowered on the shoulders, a small cross on a cord, ', 'priest_kneel',
               'the same ghost priest: bald, cassock, pale blue ghostly colors'),
    'maid': ('pixel art portrait of the ghost of a young castle maid, gentle worried face, soft hair under a simple linen cap, '
             'plain dress with an apron collar, hands not visible, ', 'maid_ghost',
             'the same ghost maid: linen cap, hair, dress, pale blue ghostly colors'),
}
if sys.argv[1] == 'pick':
    im = Image.open(os.path.join(W, f'{sys.argv[2]}_{int(sys.argv[3]):02d}.png')).convert('RGBA')
    im.resize((256, 256), Image.NEAREST).save(os.path.join(ROOT, 'assets', 'portraits', sys.argv[2] + '.png')); print('ok')
    sys.exit()
name = sys.argv[1]
desc, obj, usage = WHO[name]
lika = Image.open(os.path.join(ROOT, 'assets', 'portraits', 'lika.png')).convert('RGBA').resize((64, 64), Image.NEAREST)
sp = os.path.join(W, 'style64.png'); lika.save(sp)
o = Image.open(os.path.join(ROOT, 'assets', 'objects', obj + '.png')).convert('RGBA')
k = 96 // max(o.size); rp = os.path.join(W, obj + '_ref.png'); o.resize((o.width * k, o.height * k), Image.NEAREST).save(rp)
style, ssz = b64img(sp); ref, rsz = b64img(rp)
paths = run('/generate-image-v2', {
    'description': desc + GHOST, 'image_size': {'width': 64, 'height': 64}, 'no_background': True,
    'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': usage}],
    'style_image': {'image': style, 'size': {'width': ssz[0], 'height': ssz[1]}},
    'style_options': {'color_palette': False, 'outline': True, 'detail': True, 'shading': True},
}, os.path.join(W, name))
sheet(paths, os.path.join(W, name + '_sheet.png'), scale=3, cols=8)
print(name, len(paths), req('GET', '/balance')['subscription']['generations'])
