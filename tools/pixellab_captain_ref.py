# Образец живого капитана для картин сказания (канон — docs/art-canon.md): по фото костюма владельца (в репозиторий не кладётся:
# .pixellab_work/story/captain_photo_s.png) и спрайту босса. → .pixellab_work/story/captain_NN.png
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.pixellab_work', 'story')
im, sz = b64img(os.path.join(W, 'boss_ref.png'))
ph, psz = b64img(os.path.join(W, 'captain_photo_s.png'))
p = run('/generate-image-v2', {'description': 'full body pixel art character: a tall slender elegant knight captain standing straight; a white porcelain Venetian mask covering his whole face with ornate gold filigree around the eyes, a dark red patch on one cheek and gold lips; '
    'a steel morion helmet with a red plume over a dark chainmail coif; a long white satin surcoat with wide sleeves lined with red, a white belt, on the chest a small grey heraldic shield with an orange fleur-de-lis; '
    'black sleeves and dark steel armor underneath, dark gauntlets, steel greaves and boots, '
    'a sword at his hip, three-quarter view facing right, realistic human proportions, detailed pixel art, soft light, transparent background',
    'image_size': {'width': 64, 'height': 112}, 'no_background': True,
    'reference_images': [{'image': ph, 'size': {'width': psz[0], 'height': psz[1]}, 'usage_description': 'the exact costume: morion helmet, Venetian mask with gold filigree, red cheek and gold lips, chainmail coif, white satin surcoat, grey shield badge with orange fleur-de-lis, wide sleeves with red lining, white belt'},
                         {'image': im, 'size': {'width': sz[0], 'height': sz[1]}, 'usage_description': 'the pixel art style and the red plume on the helmet; he is alive: armored legs and boots, no ghostly mist'}]},
    os.path.join(W, 'captain'))
sheet(p, os.path.join(W, 'captain_sheet.png'), scale=2, cols=min(len(p), 8)); print(len(p))
