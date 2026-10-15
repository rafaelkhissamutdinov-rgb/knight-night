# Картины для сюжетных вставок (v0.78, «режим рассказа»): PixelLab, 320×180, один стиль.
# Запуск: python3 tools/pixellab_story.py <рассказ> [номер ...] → .pixellab_work/story/<рассказ>_<n>_NN.png
#         python3 tools/pixellab_story.py pick <рассказ> <файл n[tag]> <n>  → assets/story/<рассказ>_<n>.png
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixellab import *
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, '.pixellab_work', 'story'); os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'story'); os.makedirs(OUT, exist_ok=True)
STYLE = ('cinematic pixel art illustration for a storybook cutscene in a melancholic dark fantasy game, wide shot, '
         'painterly detailed pixel art, soft warm and dusky muted palette, gentle light, no text, no frame, no border')
# Одна картина на страницу рассказа (просьба владельца: картина меняется под строчки).
# одни и те же герои на всех картинах: принцесса — как на портрете в её покоях, капитан — в шлеме (лицо не показываем)
PRINCESS = 'a young princess with chestnut brown hair tied up, in a pale ivory dress'
CAPTAIN = 'a knight captain in a white surcoat with an orange sun emblem over dark steel armor, a steel morion helmet with a red plume, his face in shadow'
SCENES = {'erinnerland': [
    'a living medieval kingdom celebrating a festival: a white castle on a hill above a river town, colorful banners and long ribbons of fabric strung between houses, lanterns, crowds of people dancing in the square, golden evening light',
    'medieval weavers at wooden looms in a stone workshop, the threads softly glowing with warm magical light, rolls of shimmering fabric',
    PRINCESS + ' and ' + CAPTAIN + ' walking side by side in a lush well-kept moonlit castle garden, roses, a fountain, quiet night',
    CAPTAIN + ' shyly offering ' + PRINCESS + ' a small golden heart pendant and a softly glowing magic rose, in a moonlit castle garden, hesitant distance between them',
    'a lone ' + CAPTAIN[2:] + ' standing on a dark castle rampart at night looking at a single warm lit window far away across the courtyard, hesitation, loneliness, cold blue moonlight',
    'a grand candlelit ballroom, ' + PRINCESS + ' dancing with an elegant foreign duke in dark velvet, a lone knight in a white surcoat watching from the shadows by a pillar',
    'a white castle under siege at night during a feast, siege fires, catapults, banners burning, chaos on the walls, red and orange glow',
    'the ghost of the knight captain (white mask, steel morion helmet with a red plume, white surcoat with an orange sun emblem, his legs fading into pale blue ghostly mist) standing guard with a sword before a closed ornate chamber door in a dark abandoned castle hall at night, the whole scene painted dark, deep shadows, cold blue glow, dust, cobwebs',
]}
# капитан — как босс главы (assets/sprites/boss, кадр front → .pixellab_work/story/boss_ref.png)
ALIVE = 'only the outfit of the knight captain: steel morion helmet with a red plume, white surcoat with an orange emblem, dark armor; he is alive here: no mask, no ghostly mist'
REF = {'erinnerland': {2: ALIVE, 3: ALIVE, 4: ALIVE, 7: 'the same ghost knight: his mask, helmet, plume, surcoat and ghostly mist'}}
# Замок — тот же, что на титульном экране (владелец): картины с ним — правкой самой титульной картины
TITLE = os.path.join(ROOT, 'assets', 'backgrounds', 'title.png')
EDITS = {'erinnerland': {
    0: 'the same castle on the same rocky crag and the same valley, but on a bright warm summer day during a joyful festival: blue sky with soft clouds, '
       'green meadows instead of snow, colorful banners and flags on every tower, a lively little town with festival ribbons, lanterns and crowds at the foot of the crag, '
       'boats on the river, remove the small knight on the cliff',
    6: 'the same castle on the same rocky crag and the same valley, at night under siege: the castle walls and towers on fire, red and orange glow, smoke, '
       'an enemy army with torches and siege engines camped in the valley, burning arrows in the sky, remove the small knight on the cliff',
}}
if sys.argv[1] == 'edit':   # python3 tools/pixellab_story.py edit <рассказ> <n> → <рассказ>_<n>e_NN.png
    story, n = sys.argv[2], int(sys.argv[3])
    t = Image.open(TITLE).convert('RGB').resize((320, 180), Image.NEAREST); tp = os.path.join(WORK, 'title_small.png'); t.save(tp)
    img, sz = b64img(tp)
    from concurrent.futures import ThreadPoolExecutor
    def job(k):   # три варианта: <рассказ>_<n>e<k>_00.png
        return run('/edit-images-v2', {'method': 'edit_with_text', 'description': EDITS[story][n] + '. ' + STYLE, 'seed': 11 + k,
                                       'edit_images': [{'image': img, 'width': 320, 'height': 180}], 'image_size': {'width': 320, 'height': 180}},
                   os.path.join(WORK, f'{story}_{n}e{k}'))
    with ThreadPoolExecutor(3) as ex: paths = [p for ps in ex.map(job, range(3)) for p in ps]
    print(story, n, 'edit', len(paths), flush=True)
    sys.exit()
if sys.argv[1] == 'fix':   # python3 tools/pixellab_story.py fix <файл> "<что поправить>" → <файл>_fix_00.png
    img, sz = b64img(os.path.join(WORK, sys.argv[2] + '_00.png'))
    paths = run('/edit-images-v2', {'method': 'edit_with_text', 'description': sys.argv[3] + '. ' + STYLE,
                                    'edit_images': [{'image': img, 'width': 320, 'height': 180}], 'image_size': {'width': 320, 'height': 180}},
                os.path.join(WORK, sys.argv[2] + '_fix'))
    print('fix', len(paths), flush=True)
    sys.exit()
if sys.argv[1] == 'bg':   # python3 tools/pixellab_story.py bg <файл> "<фон>" → дорисовать фон вокруг героев: <файл>_bg_00.png
    img, sz = b64img(os.path.join(WORK, sys.argv[2] + '_00.png'))
    paths = run('/edit-images-v2', {'method': 'edit_with_text', 'description': 'keep the characters exactly as they are, paint a full detailed background behind them that fills the whole picture: ' + sys.argv[3] + '. ' + STYLE,
                                    'edit_images': [{'image': img, 'width': 320, 'height': 180}], 'image_size': {'width': 320, 'height': 180}},
                os.path.join(WORK, sys.argv[2] + '_bg'))
    print('bg', len(paths), flush=True)
    sys.exit()
if sys.argv[1] == 'pick':
    im = Image.open(os.path.join(WORK, f'{sys.argv[2]}_{sys.argv[3]}_00.png')).convert('RGB')
    im.save(os.path.join(OUT, f'{sys.argv[2]}_{sys.argv[4]}.png')); print('ok')
else:
    # вариант: TAG=b → <рассказ>_<n>b_00.png (не затирает прежние)
    story = sys.argv[1]; nums = [int(n) for n in sys.argv[2:]] or range(len(SCENES[story])); tag = os.environ.get('TAG', '')
    for n in nums:
        body = {'description': SCENES[story][n] + '. ' + STYLE, 'image_size': {'width': 320, 'height': 180}}
        if n in REF.get(story, {}) and not os.environ.get('NOREF'):   # образец — спрайт босса: тот же облик капитана
            im, sz = b64img(os.path.join(WORK, 'boss_ref.png'))
            body['reference_images'] = [{'image': im, 'size': {'width': sz[0], 'height': sz[1]}, 'usage_description': REF[story][n]}]
        paths = run('/generate-image-v2', body,
                    os.path.join(WORK, f'{story}_{n}{tag}'))
        print(story, n, len(paths), flush=True)
