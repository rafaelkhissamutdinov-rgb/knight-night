# Портрет Алкимы (v0.58): её картинка — образец лица, портрет Лики (64×64) — образец стиля. Взят вариант 0.
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from pixellab import *
style, ssz = b64img('lika64.png')
ref, rsz = b64img('alk_ref.png')
body = {
  'description': 'pixel art head-and-shoulders portrait of a young east asian woman, facing the viewer, whole head visible with space above, '
                 'calm confident slightly mysterious look, black hair tied in a high bun with side-swept bangs over one eye, small silver hoop earring, '
                 'high ornate teal-blue collar with gold and red eastern pattern, plain background',
  'image_size': {'width': 64, 'height': 64},
  'no_background': True,
  'reference_images': [{'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]},
                        'usage_description': 'the same woman: her face, black hair and bun, earring and ornate teal and gold collar'}],
  'style_image': {'image': style, 'size': {'width': ssz[0], 'height': ssz[1]}},
  'style_options': {'color_palette': False, 'outline': True, 'detail': True, 'shading': True},
}
paths = run('/generate-image-v2', body, 'out/alk1')
print(len(paths)); sheet(paths, 'out/alk1_sheet.png', scale=3, cols=4)
print(req('GET', '/balance'))
