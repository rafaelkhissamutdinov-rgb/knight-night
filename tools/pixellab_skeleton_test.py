# Тест v0.58: 9 кадров боя (защита/замах/удар на трёх высотах) по скелету. Вывод: руки встают точно, меч модель теряет —
# оружие рисуем отдельно кодом. Пути out/... — из рабочей папки сессии; скелет брали из POST /estimate-skeleton.
import sys, os, json, copy; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
base = [{'x': k['x'], 'y': k['y'], 'label': k['label']} for k in json.load(open('out/kn_east_skel.json'))['keypoints']]
def pose(elbow, wrist):
    kp = copy.deepcopy(base)
    for k in kp:
        if k['label'] == 'RIGHT ELBOW': k['x'], k['y'] = elbow
        if k['label'] == 'RIGHT ARM': k['x'], k['y'] = wrist
        k['z_index'] = 1 if k['label'].startswith('RIGHT') and k['label'].endswith(('ELBOW', 'ARM')) else 0
    return kp
FRAMES = {
  'guard_high':  ((0.50, 0.20), (0.57, 0.10)),
  'guard_mid':   ((0.52, 0.42), (0.62, 0.40)),
  'guard_low':   ((0.50, 0.52), (0.60, 0.63)),
  'windup_high': ((0.36, 0.18), (0.30, 0.08)),
  'strike_high': ((0.58, 0.30), (0.72, 0.36)),
  'windup_mid':  ((0.32, 0.36), (0.24, 0.34)),
  'strike_mid':  ((0.58, 0.34), (0.75, 0.36)),
  'windup_low':  ((0.34, 0.48), (0.28, 0.60)),
  'strike_low':  ((0.55, 0.50), (0.70, 0.63)),
}
img, sz = b64img('out/kn_east.png')
body = {
  'description': 'knight in worn grey steel plate armor and closed great helm, holding a steel longsword in the right hand',
  'action': 'sword fighting: guards and strikes at high, middle and low height',
  'direction': 'east', 'view': 'side',
  'first_frame': img,
  'first_frame_keypoints': base,
  'keypoints': [pose(*v) for v in FRAMES.values()],
  'no_background': True,
}
r = req('POST', '/animate-with-skeleton-v3', body)
print(r); json.dump({'job': r.get('background_job_id'), 'names': list(FRAMES)}, open('out/kanim1_meta.json', 'w'))
