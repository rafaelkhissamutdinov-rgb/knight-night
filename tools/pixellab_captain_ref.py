# Образец живого капитана для картин сказания (замечания владельца 15.10): белая венецианская маска, морион с красным
# плюмажем, белое сюрко со знаком солнца, высокий и стройный. По спрайту босса. → .pixellab_work/story/captain_NN.png
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.pixellab_work', 'story')
im, sz = b64img(os.path.join(W, 'boss_ref.png'))
p = run('/generate-image-v2', {'description': 'full body pixel art character: a tall slender elegant knight captain standing straight, a smooth white Venetian mask covering his whole face, '
    'steel morion helmet with a red plume, long white surcoat with a single orange sun emblem on the chest over dark steel armor, dark gauntlets, steel greaves and boots, '
    'a sword at his hip, three-quarter view facing right, realistic human proportions, detailed pixel art, soft light, transparent background',
    'image_size': {'width': 64, 'height': 112}, 'no_background': True,
    'reference_images': [{'image': im, 'size': {'width': sz[0], 'height': sz[1]}, 'usage_description': 'his helmet, plume, white mask, white surcoat and dark armor; he is alive: armored legs and boots, no ghostly mist'}]},
    os.path.join(W, 'captain'))
sheet(p, os.path.join(W, 'captain_sheet.png'), scale=2, cols=min(len(p), 8)); print(len(p))
