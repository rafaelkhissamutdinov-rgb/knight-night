# Позы кота Фуджина (v0.79, владелец: до восьми поз одного и того же кота, по эталону assets/objects/cat_sit.png).
# Запуск: python3 tools/pixellab_cat.py [поза ...] → .pixellab_work/obj/cat_<поза>_NN.png + лист; выбрать — pixellab_object.py pick
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'obj')
POSES = {
    'loaf': 'lying in a neat loaf position with paws tucked under its chest, eyes half closed, content',
    'lounge': 'lounging lazily like a human on the floor: leaning back on its hips against nothing, hind legs stretched forward, belly showing, one front paw resting on its belly, smug half-closed yellow eyes',
    'side': 'lying stretched out on its side, completely relaxed, tail extended',
    'groom': 'sitting and licking its raised front paw, grooming itself',
    'stretch': 'doing a long stretch: front legs reaching forward low, rear raised, tail up',
    'stand': 'standing on four legs with its tail raised high, looking back over its shoulder with bright yellow eyes',
}
ref, rsz = b64img(os.path.join(ROOT, 'assets', 'objects', 'cat_sit.png'))
def job(k):
    p = run('/generate-image-v2', {'description': 'the same black cat ' + POSES[k] + ', sleek glossy black fur with subtle blue highlights, bright yellow eyes, athletic, not fat, side view, small pixel art game sprite, transparent background, nothing else, no furniture',
        'image_size': {'width': 48, 'height': 48}, 'no_background': True,
        'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}, 'usage_description': 'exactly this cat: same black fur, blue highlights, yellow eyes, same outline, same pixel size and style'}]},
        os.path.join(W, 'cat_' + k))
    sheet(p, os.path.join(W, f'cat_{k}_sheet.png'), scale=3, cols=4)
    return k, len(p)
with ThreadPoolExecutor(3) as ex:
    for k, n in ex.map(job, sys.argv[1:] or list(POSES)): print(k, n, flush=True)
