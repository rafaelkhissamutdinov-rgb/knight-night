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
                                              'additional_instructions': 'side view game sprite frames of the same character; keep each pose exactly; the head wears the black tricorn hat and the dark red scarf over the face exactly as on the reference: no steel helmet, no plume'},
                      os.path.join(W, 'tmp_' + names[0]))
        except SystemExit as e:
            return names[0] + ' ' + str(e)[:200]
        for n, q in zip(names, out): os.replace(q, os.path.join(W, f'f_{n}.png'))
        return names[0] + ' ok'
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(job, pairs): print(r, flush=True)
elif cmd == 'sheet':   # sheet [папка кадров] [имя набора] — по умолчанию кадры f_* → knight_marauder
    FD = os.path.join(W, sys.argv[2]) if len(sys.argv) > 2 else W
    NAME = sys.argv[3] if len(sys.argv) > 3 else 'knight_marauder'
    out = Image.new('RGBA', sheet_img.size)
    for i, n in enumerate(ORDER):
        p = os.path.join(FD, f'f_{n}.png')
        im = Image.open(p).convert('RGBA') if os.path.exists(p) else frame(n)
        out.paste(im, ((i % COLS) * S, (i // COLS) * S))
    D = os.path.join(ROOT, 'assets', 'sprites', NAME); os.makedirs(D, exist_ok=True)
    out.save(os.path.join(D, NAME + '.png'))
    Image.open(os.path.join(SRC, 'knight_n.png')).save(os.path.join(D, NAME + '_n.png'))
    json.dump(meta, open(os.path.join(D, NAME + '.json'), 'w'), ensure_ascii=False)
    print('ok')
if cmd == 'head':   # владелец 15.10: в сете мародёра вместо шлема — треуголка и платок на лице (лица не видно)
    img, sz = b64img(sys.argv[2])
    HEAD = ('keep the body, leather jacket, red scarf, boots, pose, proportions and pixel style exactly the same; only the head changes: '
            'remove the steel helmet and plume; instead a worn black leather pirate tricorn hat, and the dark red scarf wrapped up over the nose and mouth, '
            'so the face is completely hidden; the eyes are only a dark shadow under the hat brim; like a marauder')
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
            'a worn black leather pirate tricorn hat and a dark red scarf wrapped over the nose and mouth so the face is completely hidden, the eyes only a dark shadow under the brim; '
            'a worn brown leather jacket with buckled straps on the shoulders', 'width': 64, 'height': 64, 'no_background': True, 'seed': 21 + k}, os.path.join(W, f'portrait{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(4)) for q in ps]
    sheet(paths, os.path.join(W, 'portrait_sheet.png'), scale=3, cols=len(paths)); print(len(paths))
if cmd == 'eyes':   # владелец 15.10: глаза у Найта оливковые — видны в тени под треуголкой, лицо закрыто платком
    src = os.path.join(W, sys.argv[2]); img, sz = b64img(src)
    def job(k):
        return run('/edit-image-pixen', {'image': img, 'description': 'keep everything exactly the same; only in the dark shadow between the hat brim and the scarf show two calm olive green eyes, '
            'the rest of the face stays hidden', 'width': sz[0], 'height': sz[1], 'no_background': True, 'seed': 51 + k}, os.path.join(W, 'eyes_' + sys.argv[2][:-4] + f'_{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(4)) for q in ps]
    sheet(paths, os.path.join(W, 'eyes_' + sys.argv[2][:-4] + '_sheet.png'), scale=3, cols=len(paths)); print(len(paths))
if cmd == 'face':   # владелец 15.10: в прорезь между треуголкой и платком — фрагмент лица с портрета без шлема (глаза), а не тень
    lum = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
    nh = Image.open(os.path.join(ROOT, 'assets', 'portraits', 'knight-nohelm.png')).convert('RGBA').resize((64, 64), Image.NEAREST)
    m = Image.open(os.path.join(W, sys.argv[2])).convert('RGBA'); out = m.copy()
    for y in range(23, 28):
        for x in range(14, 50):
            p = m.getpixel((x, y))
            if p[3] and lum(p) < 20 and nh.getpixel((x, y + 1))[3]:
                q = nh.getpixel((x, y + 1)); k = 0.55 if y == 23 else 1   # верхняя строка — в тени полей
                out.putpixel((x, y), (int(q[0] * k), int(q[1] * k), int(q[2] * k), q[3]))
    out.resize((256, 256), Image.NEAREST).save(os.path.join(ROOT, 'assets', 'portraits', 'knight-marauder.png')); print('ok')
if cmd == 'fixport':   # замечания владельца 15.10 к портрету мародёра
    src = os.path.join(W, 'portrait_fix_src.png')
    Image.open(os.path.join(ROOT, 'assets', 'portraits', 'knight-marauder.png')).convert('RGBA').resize((64, 64), Image.NEAREST).save(src)
    img, sz = b64img(src)
    D = ('keep the same character, jacket, colors and pixel style; fix the head: the black tricorn hat is a bit wider than the face; '
         'the dark red scarf covers the nose and mouth and its top edge rises to a soft rounded point at the bridge of the nose and slopes gently down to both sides, like a bandit mask; '
         'only a narrow strip of the face around the eyes is visible, not wider than the head, the face does not bulge out of the scarf; '
         'the olive green eyes are a bit larger and set wider apart, calm look')
    def job(k):
        return run('/edit-image-pixen', {'image': img, 'description': D, 'width': 64, 'height': 64, 'no_background': True, 'seed': 61 + k}, os.path.join(W, f'fix{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(6)) for q in ps]
    sheet(paths, os.path.join(W, 'fix_sheet.png'), scale=3, cols=6); print(len(paths))
if cmd == 'ownerface':   # владелец 15.10: Найт списан с него — в прорези его глаза и брови, из-под треуголки — тёмные кудри.
    # Фото владельца — только локально (.pixellab_work/marauder/owner_face_s.png), в репозиторий не класть.
    cur = os.path.join(W, 'portrait_cur64.png')
    Image.open(os.path.join(ROOT, 'assets', 'portraits', 'knight-marauder.png')).convert('RGBA').resize((64, 64), Image.NEAREST).save(cur)
    st, ssz = b64img(cur); ph, psz = b64img(os.path.join(W, 'owner_face_s.png'))
    D = ('pixel art head-and-shoulders portrait of a young man in marauder gear: a black tricorn hat a bit wider than his face, '
         'dark curly hair spilling out from under the hat over the forehead and temples, a dark red scarf over the nose and mouth whose top edge rises to a soft rounded point at the nose bridge, '
         'only the eyes and eyebrows visible: wide-set almond-shaped grey-olive eyes, straight dark eyebrows, calm serious look; worn brown leather jacket with buckled straps')
    def job(k):
        return run('/generate-image-v2', {'description': D, 'image_size': {'width': 64, 'height': 64}, 'no_background': True, 'seed': 71 + k,
            'reference_images': [{'image': ph, 'size': {'width': psz[0], 'height': psz[1]}, 'usage_description': 'his eyes, eyebrows, eye spacing and his dark curly hair'},
                                 {'image': st, 'size': {'width': ssz[0], 'height': ssz[1]}, 'usage_description': 'exactly this outfit: tricorn hat, red scarf, leather jacket, framing'}],
            'style_image': {'image': st, 'size': {'width': ssz[0], 'height': ssz[1]}}}, os.path.join(W, f'own{k}'))
    with ThreadPoolExecutor(4) as ex: paths = [q for ps in ex.map(job, range(2)) for q in ps]
    sheet(paths, os.path.join(W, 'own_sheet.png'), scale=3, cols=8); print(len(paths))
