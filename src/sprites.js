import { POSES } from './poses.js';
import { thick } from './draw.js';

// Спрайты Найта из PixelLab (assets/sprites/knight/): тело — кадры, меч рисуется кодом от кисти под углом позы.
// Кадр 64×64 смотрит вправо; влево — отражение. Позы — те же, что в src/poses.js: берётся ближайшая к текущей.
// Рисуется в пикселях экрана (холст вдвое больше игрового мира), поэтому 64 px кадра = 32 px мира.

const BASE = 'assets/sprites/knight/';
let meta = null;
const imgs = {};
const flipped = {};
let pending = 0;

function flip(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0);
  return c;
}

export function loadKnightSprites() {
  fetch(BASE + 'knight.json').then(r => r.json()).then(m => {
    const names = [...Object.keys(m.frames), 'front', 'back'];
    pending = names.length;
    for (const n of names) {
      const img = new Image();
      img.onload = () => { flipped[n] = flip(img); imgs[n] = img; pending--; };
      img.onerror = () => { pending--; };
      img.src = BASE + n + '.png';
    }
    meta = m;
  }).catch(() => {});
}

export const knightReady = () => !!meta && pending === 0 && !!imgs.pose_idle;

// кадры-позы: основные (pose_<имя из POSES>) и промежуточные (tw_…, параметры позы — в knight.json)
let poseList = null;
function poseFrames() {
  if (poseList) return poseList;
  poseList = [];
  for (const [n, f] of Object.entries(meta.frames)) {
    const q = f.pose ?? (n.startsWith('pose_') ? POSES[n.slice(5)] : null);
    if (q && imgs[n]) poseList.push([n, q]);
  }
  return poseList;
}

// ближайшая поза из нарисованных (по кисти, углу клинка, наклону и приседу) — чем гуще кадры, тем плавнее
function nearestPose(p) {
  let best = 'pose_idle', bd = Infinity;
  for (const [n, q] of poseFrames()) {
    let da = Math.abs(((p.angle - q.angle) % 360 + 540) % 360 - 180);
    const d = (p.hx - q.hx) ** 2 + (p.hy - q.hy) ** 2 + (da / 12) ** 2 + (p.crouch - q.crouch) ** 2 + 0.5 * (p.lean - q.lean) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// меч или рапира: рукоять, гарда, клинок с тёмным контуром (в пикселях экрана)
function drawBlade(g, wx, wy, angleDeg, facing, len, rapier) {
  const a = angleDeg * Math.PI / 180;
  const dx = Math.cos(a) * facing, dy = Math.sin(a);
  const px = -dy, py = dx;
  const R = v => Math.round(v);
  thick(g, R(wx - dx * 5), R(wy - dy * 5), R(wx), R(wy), 2, '#5c3a22');                      // рукоять
  const gw = rapier ? 3 : 5;
  thick(g, R(wx + px * gw), R(wy + py * gw), R(wx - px * gw), R(wy - py * gw), 2, rapier ? '#c9a24a' : '#8a7a5a');  // гарда
  const sx = wx + dx * 2, sy = wy + dy * 2, tx = wx + dx * len, ty = wy + dy * len;
  thick(g, R(sx), R(sy), R(tx), R(ty), rapier ? 2 : 3, '#22202c');                           // контур
  thick(g, R(sx), R(sy), R(tx - dx), R(ty - dy), 1, rapier ? '#dfe6ef' : '#c9d2de');          // клинок
  if (!rapier) thick(g, R(sx + px), R(sy + py), R(tx - dx * 3 + px), R(ty - dy * 3 + py), 1, '#8e98a8');  // тень на клинке
  return { tipX: tx, tipY: ty };
}

// o: { x, ground (мир), facing, pose, state, walking, step, time, airY, weaponLen, rapier, bladeHidden,
//      view: 'side' | 'front' | 'back', squash, alpha, frame (имя кадра вместо подбора), rotate (рад), sheathed }
// Возвращает кончик клинка в координатах мира (для шлейфа) или null.
export function drawKnight(g, o) {
  const t = g.getTransform();
  const S = t.a;
  g.save();
  g.setTransform(1, 0, 0, 1, t.e, t.f);
  g.imageSmoothingEnabled = false;
  if (o.alpha != null) g.globalAlpha = o.alpha;
  const size = meta.size, foot = meta.foot, cx = meta.center;
  const X = Math.round(o.x * S), G = Math.round((o.ground - (o.airY ?? 0)) * S);
  let tip = null;
  if (o.view === 'front' || o.view === 'back') {
    const img = imgs[o.view];
    if (!img) { g.restore(); return null; }
    const w = Math.max(2, Math.round(size * (o.squash ?? 1)));
    g.drawImage(img, X - Math.round(w / 2), G - foot, w, size);
    g.restore();
    return null;
  }
  const A = meta.anims ?? { walk: 6, idle: 4 };
  const cyc = (u, n) => Math.floor(((u % 1) + 1) % 1 * n) % n;
  let name = o.frame;
  let right = o.facing >= 0;
  if (!name && o.turn && A.turn) {
    // разворот: кадры из ролика «повернулся через вид спереди»; справа налево — по порядку, слева направо — обратно
    const i = Math.min(A.turn - 1, Math.floor(o.turn.k * A.turn));
    name = 'turn_' + (o.turn.toLeft ? i : A.turn - 1 - i);
    right = true;
  }
  if (!name && o.depth && o.walking && o.state === 'ready') {
    // идёт вглубь: шаги спереди (к камере) или со спины, клинок не виден
    const k = o.depth === 'south' ? 'walkS' : 'walkN';
    name = k + '_' + cyc(o.step, A[k]);
    right = true;
  }
  if (!name) {
    if (o.walking && o.state === 'ready') name = (o.run && A.run ? 'run_' + cyc(o.step, A.run) : 'walk_' + cyc(o.step, A.walk));
    else if (o.sheathed && o.state === 'ready') name = 'idle_' + (Math.floor(o.time * 4) % A.idle);
    else name = nearestPose(o.pose);
  }
  const img = right ? imgs[name] : flipped[name];
  if (!img) { g.restore(); return null; }  // кадр не загрузился — не рисуем, но и не падаем
  const left = right ? X - cx : X - (size - cx);
  const top = G - foot;
  if (o.rotate) {
    g.translate(X, G - size / 2 + 8);
    g.rotate(o.rotate);
    g.drawImage(img, -size / 2, -size / 2 - 4);
    g.restore();
    return null;
  }
  g.drawImage(img, left, top);
  const fr = meta.frames[name];
  if (fr?.wrist && o.pose && !o.bladeHidden && !o.sheathed) {
    const wx = left + (right ? fr.wrist[0] : size - fr.wrist[0]);
    const wy = top + fr.wrist[1];
    const len = (o.weaponLen ?? 17) * S;
    const tp = drawBlade(g, wx, wy, o.pose.angle, o.facing, len, o.rapier);
    tip = { tipX: (tp.tipX - t.e) / S, tipY: (tp.tipY - t.f) / S };
  }
  g.restore();
  return tip;
}
