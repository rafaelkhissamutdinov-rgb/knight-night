# Анимация любого набора от его кадра (v0.70): animate-pixminimax, персонаж в своём росте, холст с запасом под движение.
#   python3 tools/pixellab_anim.py <набор> <анимация> [кадров]   → .pixellab_work/anim_<набор>/<анимация>_NN.png
# Холст C: стопы на 8 px выше низа, середина корпуса — по центру. Разбор в лист — tools/add_anim.py.
import sys, os, json, io, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBJ = {
    'knight': 'a slender elegant knight in worn steel plate armour with a closed great helm and a red plume, a dark blue tabard, brown leather belt, side view',
    'boss': 'the ghost of the captain of the royal guard: a steel morion helmet with a red crest, a pale white mask for a face, a long white surcoat with an orange cross emblem, black chainmail sleeves, his body fades into a swirling cyan ghostly mist below the waist, side view',
    'duelist': 'a young holy knight fencer in a long beige coat and dark trousers with a ponytail, elegant and agile, side view',
}
ACTIONS = {
    ('knight', 'lunge'): ('pose_fence', 'a fast deep fencing lunge forward to the right: the front foot steps far forward, the back leg straightens, the right arm thrusts forward fully extended as if piercing with a thin rapier, then quickly recovers back to the en garde stance', 'en garde fencing stance, right arm forward'),
    ('knight', 'whip'): ('pose_fence', 'an overhead whip strike: raises the right arm high above the head and snaps the wrist down and forward in a fast whipping arc like cracking a whip, body twisting, then back to en garde', 'en garde fencing stance, right arm forward'),
    ('knight', 'push'): ('pose_sheathed', 'leans forward and pushes a heavy wooden table to the right with both hands: both arms stretched forward at chest height, palms pressed against it, legs braced, slow heavy straining steps forward, the sword stays sheathed on the back', 'leaning forward, both arms stretched forward to push'),
    ('boss', 'clench'): ('pose_cast', 'extends the left arm toward the viewer-right with an open clawed hand, then slowly and powerfully clenches the hand into a tight trembling fist as if crushing something with telekinesis, leaning forward menacingly', 'standing, left arm extended forward with an open hand'),
    ('boss', 'dash'): ('pose_idle', 'glides forward fast like a ghost without walking, the body leaning forward, the cape and the ghostly mist tail streaming behind', 'floating upright'),
    ('boss', 'raise'): ('pose_idle', 'raises both arms high and summons power: the cape billows, the body rises slightly, the eyes flare, menacing pose, then lowers into a fighting stance', 'floating upright'),
    ('duelist', 'lunge'): ('pose_fence', 'a lightning fast deep fencing lunge forward to the right: the front foot steps far forward, the back leg straightens, the right arm thrusts forward fully extended as if piercing with a rapier, the coat flaring, then recovers to en garde', 'en garde fencing stance, right arm forward'),
}

def frame(set_, name, C):
    m = json.load(open(os.path.join(ROOT, 'assets', 'sprites', set_, set_ + '.json')))
    cols, order, S = m['sheet']['cols'], m['sheet']['order'], m['size']
    i = order.index(name)
    sh = Image.open(os.path.join(ROOT, 'assets', 'sprites', set_, set_ + '.png')).convert('RGBA')
    f = sh.crop(((i % cols) * S, (i // cols) * S, (i % cols + 1) * S, (i // cols + 1) * S))
    c = Image.new('RGBA', (C, C)); c.alpha_composite(f, (C // 2 - m['center'], C - 8 - m['foot'] - 1))
    return c

def wait(job):
    for _ in range(150):
        s = req('GET', f'/background-jobs/{job}')
        if s['status'] in ('completed', 'failed'): return s
        time.sleep(6)
    raise SystemExit('timeout')

if __name__ == '__main__':
    set_, act = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    first, desc, pose = ACTIONS[(set_, act)]
    C = 128
    W = os.path.join(ROOT, '.pixellab_work', 'anim_' + set_); os.makedirs(W, exist_ok=True)
    f = frame(set_, first, C); p0 = os.path.join(W, f'{act}_first.png'); f.save(p0)
    r = req('POST', '/animate-pixminimax', {'first_frame': b64img(p0)[0], 'description': desc, 'frame_count': n, 'no_background': True,
                                           'direction': 'east', 'view': 'side', 'subject_description': SUBJ[set_], 'initial_pose': pose})
    s = wait(r['background_job_id'])
    if s['status'] != 'completed': raise SystemExit(json.dumps(s)[:600])
    imgs = [Image.open(io.BytesIO(base64.b64decode(b.split(',')[-1]))).convert('RGBA') for b in find_images(s.get('last_response', {}))]
    for i, im in enumerate(imgs): im.save(os.path.join(W, f'{act}_{i:02d}.png'))
    print(set_, act, len(imgs), req('GET', '/balance')['subscription']['generations'])
