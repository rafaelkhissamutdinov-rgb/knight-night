# Анимации Найта в его настоящем росте (v0.69): кадр стойки (63 px) на холсте 128×128 → animate-pixminimax.
# Шаблонная ходьба PixelLab рисует персонажа мельче (≈50 px) — из-за этого при беге рыцарь «уменьшался».
#   python3 tools/pixellab_knight_anim.py <анимация> [кадров]   → .pixellab_work/knight_anim/<анимация>_NN.png + лист
# Анимации — ACTIONS ниже; первый кадр — FIRST (кадр набора knight).
import sys, os, json, io, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'knight_anim'); os.makedirs(WORK, exist_ok=True)
SET = os.path.join(ROOT, 'assets', 'sprites', 'knight')
C = 128   # холст: место для движения, рыцарь в нём того же роста
SUBJ = ('a slender elegant knight in worn steel plate armour with a closed great helm and a red plume, '
        'a dark blue tabard, brown leather belt, side view, empty hands')
ACTIONS = {
    'runloop': ('@run_05', 'one looping sprint cycle to the right, the last frame flows back into the first: legs stride far, arms pump, body leans forward', 'running mid-stride, leaning forward'),
    'walkloop': ('@walk_04', 'one looping walk cycle to the right at a calm pace, the last frame flows back into the first, arms swing gently', 'walking mid-step'),
    'turn': ('idle_0', 'turns around in place to face the opposite direction (left), rotating the body smoothly through the front view, feet step around', 'standing upright facing right, arms down'),
    'held': ('idle_0', 'lifted up off the ground by an invisible telekinetic force and choking: both hands clutch at his throat, head tilts back, body writhes and legs kick and dangle in the air, struggling', 'standing upright, arms down'),
    'spin': ('pose_idle', 'a fast whirlwind attack: spins around a full 360 degrees in place on one foot with the right arm fully extended as if slashing with a sword in a wide horizontal circle, cape flaring, then returns to a fighting stance', 'standing in a fighting stance, right hand forward holding an invisible sword grip'),
    'run': ('idle_0', 'running forward fast to the right, a full sprint cycle that loops: legs stride far, arms pump, body leans forward', 'standing upright, arms down'),
    'walk': ('idle_0', 'walking forward to the right at a calm steady pace, a looping walk cycle, arms swing gently', 'standing upright, arms down'),
    'roll': ('idle_0', 'a fast combat roll forward to the right: crouches, tucks into a ball, rolls one full somersault along the ground and springs back up to standing', 'standing upright, arms down'),
    'sheathe': ('pose_idle', 'reaches the right hand up over the right shoulder behind the back as if sliding a long sword into a scabbard on the back, then lowers the arm and stands relaxed', 'standing in a fighting stance, right hand forward holding an invisible sword grip'),
    'draw': ('idle_0', 'reaches the right hand up over the right shoulder behind the back, grips a sword hilt on the back and pulls it forward into a fighting stance', 'standing upright, arms down'),
}

def frame(name):
    m = json.load(open(os.path.join(SET, 'knight.json')))
    cols, order, S = m['sheet']['cols'], m['sheet']['order'], m['size']
    i = order.index(name)
    sh = Image.open(os.path.join(SET, 'knight.png')).convert('RGBA')
    f = sh.crop(((i % cols) * S, (i // cols) * S, (i % cols + 1) * S, (i // cols + 1) * S))
    c = Image.new('RGBA', (C, C))
    c.alpha_composite(f, (C // 2 - m['center'], C - 8 - m['foot'] - 1))   # стопы — на 8 px выше низа холста
    return c

def wait(job):
    for _ in range(150):
        s = req('GET', f'/background-jobs/{job}')
        if s['status'] in ('completed', 'failed'): return s
        time.sleep(6)
    raise SystemExit('timeout')

if __name__ == '__main__':
    act = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    first, desc, pose = ACTIONS[act]
    # '@имя' — кадр из прежней генерации (для цикла: он же и последний кадр)
    f = Image.open(os.path.join(WORK, first[1:] + '.png')).convert('RGBA') if first.startswith('@') else frame(first)
    p0 = os.path.join(WORK, f'{act}_first.png'); f.save(p0)
    body = {'first_frame': b64img(p0)[0], 'description': desc, 'frame_count': n, 'no_background': True,
            'direction': 'east', 'view': 'side', 'subject_description': SUBJ, 'initial_pose': pose}
    if first.startswith('@'): body['last_frame'] = b64img(p0)[0]
    if act == 'turn':   # последний кадр — тот же рыцарь, отражённый (смотрит влево)
        p1 = os.path.join(WORK, 'turn_last.png'); f.transpose(Image.FLIP_LEFT_RIGHT).save(p1); body['last_frame'] = b64img(p1)[0]
    r = req('POST', '/animate-pixminimax', body)
    s = wait(r['background_job_id'])
    if s['status'] != 'completed': raise SystemExit(json.dumps(s)[:600])
    imgs = [Image.open(io.BytesIO(base64.b64decode(b.split(',')[-1]))).convert('RGBA') for b in find_images(s.get('last_response', {}))]
    paths = []
    for i, im in enumerate(imgs):
        p = os.path.join(WORK, f'{act}_{i:02d}.png'); im.save(p); paths.append(p)
    sheet(paths, os.path.join(WORK, act + '_sheet.png'), scale=2, cols=min(len(paths), 9))
    print(act, len(paths), req('GET', '/balance')['subscription']['generations'])
