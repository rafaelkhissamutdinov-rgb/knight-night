# Броня мародёра на Найте (v0.80, план ночи владельца): эталон — правка кадра pose_idle, затем перенос костюма
# на все кадры листа knight (transfer-outfit-v2, по 2 кадра + эталон за запрос при 96 px).
#   python3 tools/pixellab_marauder.py ref            → .pixellab_work/marauder/ref_NN.png (варианты эталона)
#   python3 tools/pixellab_marauder.py all <эталон>   → .pixellab_work/marauder/f_<кадр>.png
#   python3 tools/pixellab_marauder.py sheet          → assets/sprites/knight_marauder/knight_marauder.png (+ json, нормали — от knight)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.pixellab_work', 'marauder'); os.makedirs(W, exist_ok=True)
SRC = os.path.join(ROOT, 'assets', 'sprites', 'knight')
meta = json.load(open(os.path.join(SRC, 'knight.json')))
S, COLS, ORDER = meta['size'], meta['sheet']['cols'], meta['sheet']['order']
sheet_img = Image.open(os.path.join(SRC, 'knight.png')).convert('RGBA')
def frame(name):
    i = ORDER.index(name)
    return sheet_img.crop(((i % COLS) * S, (i // COLS) * S, (i % COLS) * S + S, (i // COLS) * S + S))
OUTFIT = ('marauder gear instead of the steel plate armor: a worn brown leather jacket with buckled straps and patches, '
          'a dark red scarf wrapped around the neck, dark trousers, tall worn leather boots, leather bracers; '
          'keep exactly the same helmet with the red plume, the same face area, pose, body proportions, size and pixel art style')
cmd = sys.argv[1]
if cmd == 'ref':
    p = os.path.join(W, 'idle.png'); frame('pose_idle').save(p)
    img, sz = b64img(p)
    def job(k):
        return run('/edit-image-pixen', {'image': img, 'description': OUTFIT, 'width': S, 'height': S, 'no_background': True, 'seed': 7 + k}, os.path.join(W, f'ref{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(4)) for q in ps]
    sheet(paths, os.path.join(W, 'ref_sheet.png'), scale=3, cols=len(paths)); print(len(paths))
elif cmd == 'all':
    ref, rsz = b64img(sys.argv[2])
    todo = [n for n in ORDER if not os.path.exists(os.path.join(W, f'f_{n}.png'))]
    pairs = [todo[i:i + 2] for i in range(0, len(todo), 2)]
    def job(names):
        fr = []
        for n in names:
            p = os.path.join(W, f'src_{n}.png'); frame(n).save(p); im, _ = b64img(p)
            fr.append({'image': im, 'size': {'width': S, 'height': S}})
        if len(fr) == 1: fr.append(fr[0])
        try:
            out = run('/transfer-outfit-v2', {'reference_image': {'image': ref, 'size': {'width': rsz[0], 'height': rsz[1]}}, 'frames': fr,
                                              'image_size': {'width': S, 'height': S}, 'no_background': True, 'seed': 3,
                                              'additional_instructions': 'side view game sprite frames of the same knight; keep each pose and the helmet with the red plume exactly'},
                      os.path.join(W, 'tmp_' + names[0]))
        except SystemExit as e:
            return names[0] + ' ' + str(e)[:200]
        for n, q in zip(names, out): os.replace(q, os.path.join(W, f'f_{n}.png'))
        return names[0] + ' ok'
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(job, pairs): print(r, flush=True)
elif cmd == 'sheet':
    out = Image.new('RGBA', sheet_img.size)
    for i, n in enumerate(ORDER):
        p = os.path.join(W, f'f_{n}.png')
        im = Image.open(p).convert('RGBA') if os.path.exists(p) else frame(n)
        out.paste(im, ((i % COLS) * S, (i // COLS) * S))
    D = os.path.join(ROOT, 'assets', 'sprites', 'knight_marauder'); os.makedirs(D, exist_ok=True)
    out.save(os.path.join(D, 'knight_marauder.png'))
    Image.open(os.path.join(SRC, 'knight_n.png')).save(os.path.join(D, 'knight_marauder_n.png'))
    json.dump(meta, open(os.path.join(D, 'knight_marauder.json'), 'w'), ensure_ascii=False)
    print('ok')
if cmd == 'head':   # владелец 15.10: в сете мародёра вместо шлема — капюшон/шапка и платок на лице (лица не видно)
    img, sz = b64img(sys.argv[2])
    HEAD = ('keep the body, leather jacket, red scarf, boots, pose, proportions and pixel style exactly the same; only the head changes: '
            'remove the steel helmet and plume; instead a worn grey-brown cloth hood pulled low, and the dark red scarf wrapped up over the nose and mouth, '
            'so the face is completely hidden; the eyes are only a dark shadow under the hood; like a marauder')
    def job(k):
        return run('/edit-image-pixen', {'image': img, 'description': HEAD, 'width': S, 'height': S, 'no_background': True, 'seed': 41 + k}, os.path.join(W, f'head{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(4)) for q in ps]
    sheet(paths, os.path.join(W, 'head_sheet.png'), scale=3, cols=len(paths)); print(len(paths))
if cmd == 'portrait':   # портрет в броне мародёра: шлем, забрало и плюмаж — как на утверждённом портрете (без лица)
    P = os.path.join(ROOT, 'assets', 'portraits', 'knight.png')
    small = os.path.join(W, 'portrait64.png'); Image.open(P).convert('RGBA').resize((64, 64), Image.NEAREST).save(small)
    img, sz = b64img(small)
    def job(k):
        return run('/edit-image-pixen', {'image': img, 'description': 'the same character in marauder gear, same framing, colors and pixel style: the steel helmet and plume are replaced by '
            'a worn grey-brown cloth hood pulled low and a dark red scarf wrapped over the nose and mouth so the face is completely hidden, the eyes only a dark shadow; '
            'a worn brown leather jacket with buckled straps on the shoulders', 'width': 64, 'height': 64, 'no_background': True, 'seed': 21 + k}, os.path.join(W, f'portrait{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(4)) for q in ps]
    sheet(paths, os.path.join(W, 'portrait_sheet.png'), scale=3, cols=len(paths)); print(len(paths))
