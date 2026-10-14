import { POSES } from './poses.js';
import { thick } from './draw.js';

// Спрайты персонажей из PixelLab (assets/sprites/<набор>/): тело — кадры, оружие рисуется кодом от кисти под углом позы.
// Набор: <набор>.json (размер кадра, стопа, центр, анимации, точка кисти кадров) + кадры + n/ (карты нормалей).
// Кадр смотрит вправо; влево — отражение. Позы — те же, что в src/poses.js: берётся ближайшая к текущей.
// Рисуется в пикселях экрана (холст вдвое больше игрового мира), поэтому 64 px кадра = 32 px мира.
// Найт — набор 'knight' (v0.60); враги — по типу врага (v0.64).

const ROOT = 'assets/sprites/';
// враги, у которых уже есть набор кадров (имя набора = тип врага в ENEMY_TYPES); остальные — старые фигурки
export const ENEMY_SPRITES = ['skelShort', 'merc', 'skelShield', 'skelArcher', 'skelLong', 'duelist', 'axe'];
const sets = {};
let normalCtx = null;  // куда рисовать нормали (холст живого света); null — не рисовать
export const setNormalTarget = ctx => { normalCtx = ctx; };

function flip(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0);
  return c;
}
function flipNormal(img) {
  const c = flip(img);
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) d.data[i] = 255 - d.data[i];  // отражённые: красный канал (x) меняет знак
  x.putImageData(d, 0, 0);
  return c;
}

export function loadSpriteSet(name) {
  if (sets[name]) return;
  const s = sets[name] = { meta: null, imgs: {}, flipped: {}, nimgs: {}, nflipped: {}, pending: 1, poseList: null };
  const base = ROOT + name + '/';
  fetch(base + name + '.json').then(r => (r.ok ? r.json() : Promise.reject())).then(m => {
    if (m.sheet) { loadSheet(s, m, base + name); return; }
    const names = [...Object.keys(m.frames), 'front', 'back'];
    s.pending = names.length;
    for (const n of names) {
      const img = new Image();
      img.onload = () => { s.flipped[n] = flip(img); s.imgs[n] = img; s.pending--; };
      img.onerror = () => { s.pending--; };
      img.src = base + n + '.png';
      const nm = new Image();
      nm.onload = () => { s.nimgs[n] = nm; s.nflipped[n] = flipNormal(nm); };
      nm.src = base + 'n/' + n + '.png';
    }
    s.meta = m;
  }).catch(() => { s.pending = -1; });  // набора нет — рисуется старая фигурка
}

// лист спрайтов (v0.64): кадры сеткой по sheet.cols, порядок — sheet.order; нормали — <набор>_n.png
function loadSheet(s, m, path) {
  const { cols, order } = m.sheet, size = m.size;
  const cut = (img, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (i % cols) * size, Math.floor(i / cols) * size, size, size, 0, 0, size, size);
    return c;
  };
  const img = new Image();
  img.onload = () => {
    order.forEach((n, i) => { const c = cut(img, i); s.imgs[n] = c; s.flipped[n] = flip(c); });
    s.meta = m; s.pending = 0;
  };
  img.onerror = () => { s.pending = -1; };
  img.src = path + '.png';
  const nm = new Image();
  nm.onload = () => order.forEach((n, i) => { const c = cut(nm, i); s.nimgs[n] = c; s.nflipped[n] = flipNormal(c); });
  nm.src = path + '_n.png';
}

export const spriteReady = name => { const s = sets[name]; return !!s?.meta && s.pending === 0 && !!s.imgs.pose_idle; };
export const loadKnightSprites = () => loadSpriteSet('knight');
export const knightReady = () => spriteReady('knight');

// кадры-позы: основные (pose_<имя из POSES>) и промежуточные (tw_…, параметры позы — в json)
function poseFrames(s) {
  if (s.poseList) return s.poseList;
  s.poseList = [];
  for (const [n, f] of Object.entries(s.meta.frames)) {
    const q = f.pose ?? (n.startsWith('pose_') ? POSES[n.slice(5)] : null);
    if (q && s.imgs[n]) s.poseList.push([n, q]);
  }
  return s.poseList;
}

// ближайшая поза из нарисованных (по кисти, углу клинка, наклону и приседу) — чем гуще кадры, тем плавнее
function nearestPose(s, p) {
  let best = 'pose_idle', bd = Infinity;
  for (const [n, q] of poseFrames(s)) {
    const da = Math.abs(((p.angle - q.angle) % 360 + 540) % 360 - 180);
    const d = (p.hx - q.hx) ** 2 + (p.hy - q.hy) ** 2 + (da / 12) ** 2 + (p.crouch - q.crouch) ** 2 + 0.5 * (p.lean - q.lean) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// Оружие кодом (в пикселях экрана): kind — sword | rapier | axe | spear | halberd | bow | crossbow.
// Возвращает кончик (для шлейфа удара).
function drawWeapon(g, kind, wx, wy, angleDeg, facing, len, draw = 0) {
  const a = angleDeg * Math.PI / 180;
  const dx = Math.cos(a) * facing, dy = Math.sin(a);
  const px = -dy, py = dx;
  const R = v => Math.round(v);
  const line = (x0, y0, x1, y1, w, c) => thick(g, R(x0), R(y0), R(x1), R(y1), w, c);
  if (kind === 'bow') {
    // лук поперёк направления выстрела; тетива оттянута на draw (0…1)
    const h = 22, bend = 7, pull = 2 + draw * 12;
    const tx = wx + px * h, ty = wy + py * h, bx = wx - px * h, by = wy - py * h;
    const mx = wx + dx * bend, my = wy + dy * bend;
    for (const [w, c] of [[4, '#1a1410'], [2, '#9a6a40']]) {   // плечи лука с контуром
      line(tx, ty, wx + dx * bend * 0.7 + px * h * 0.5, wy + dy * bend * 0.7 + py * h * 0.5, w, c);
      line(wx + dx * bend * 0.7 + px * h * 0.5, wy + dy * bend * 0.7 + py * h * 0.5, mx, my, w, c);
      line(mx, my, wx + dx * bend * 0.7 - px * h * 0.5, wy + dy * bend * 0.7 - py * h * 0.5, w, c);
      line(wx + dx * bend * 0.7 - px * h * 0.5, wy + dy * bend * 0.7 - py * h * 0.5, bx, by, w, c);
    }
    const sx = wx - dx * pull, sy = wy - dy * pull;
    line(tx, ty, sx, sy, 1, '#e8e0d0'); line(sx, sy, bx, by, 1, '#e8e0d0');
    if (draw > 0.1) line(sx, sy, sx + dx * 30, sy + dy * 30, 1, '#c9b48a');   // стрела на тетиве
    return { tipX: mx, tipY: my };
  }
  if (kind === 'crossbow') {
    line(wx - dx * 10, wy - dy * 10, wx + dx * 22, wy + dy * 22, 5, '#1a1410');      // контур ложа
    line(wx - dx * 9, wy - dy * 9, wx + dx * 21, wy + dy * 21, 3, '#6b4a30');         // ложе
    line(wx + dx * 19 + px * 14, wy + dy * 19 + py * 14, wx + dx * 19 - px * 14, wy + dy * 19 - py * 14, 4, '#1a1410');
    line(wx + dx * 19 + px * 13, wy + dy * 19 + py * 13, wx + dx * 19 - px * 13, wy + dy * 19 - py * 13, 2, '#8a8a96');  // плечи
    return { tipX: wx + dx * 22, tipY: wy + dy * 22 };
  }
  if (kind === 'spear' || kind === 'halberd') {
    // древко назад и вперёд от кисти, наконечник; у алебарды — топорик
    const back = len * 0.35;
    line(wx - dx * back, wy - dy * back, wx + dx * len, wy + dy * len, 2, '#5c3a22');
    const tx = wx + dx * len, ty = wy + dy * len;
    line(tx, ty, tx + dx * 7, ty + dy * 7, 3, '#22202c'); line(tx, ty, tx + dx * 6, ty + dy * 6, 1, '#c9d2de');
    if (kind === 'halberd') {
      const hx = tx - dx * 3, hy = ty - dy * 3;
      for (let i = 0; i < 6; i++) line(hx - dx * i * 0.6, hy - dy * i * 0.6, hx - dx * i * 0.6 + px * (7 - i), hy - dy * i * 0.6 + py * (7 - i), 1, i < 1 ? '#22202c' : '#aab3c0');
    }
    return { tipX: tx + dx * 7, tipY: ty + dy * 7 };
  }
  // меч / рапира / топор: рукоять, гарда, клинок
  line(wx - dx * 5, wy - dy * 5, wx, wy, 2, '#5c3a22');
  if (kind === 'axe') {
    const tx = wx + dx * len, ty = wy + dy * len;
    line(wx, wy, tx, ty, 2, '#5c3a22');
    for (let i = 0; i < 8; i++) line(tx - dx * i, ty - dy * i, tx - dx * i + px * (9 - i * 0.6), ty - dy * i + py * (9 - i * 0.6), 1, i < 1 ? '#22202c' : '#9aa3b0');
    return { tipX: tx + px * 9, tipY: ty + py * 9 };
  }
  const rapier = kind === 'rapier';
  const gw = rapier ? 3 : 5;
  line(wx + px * gw, wy + py * gw, wx - px * gw, wy - py * gw, 2, rapier ? '#c9a24a' : '#8a7a5a');  // гарда
  const sx = wx + dx * 2, sy = wy + dy * 2, tx = wx + dx * len, ty = wy + dy * len;
  line(sx, sy, tx, ty, rapier ? 2 : 3, '#22202c');                                                 // контур
  line(sx, sy, tx - dx, ty - dy, 1, rapier ? '#dfe6ef' : '#c9d2de');                                // клинок
  if (!rapier) line(sx + px, sy + py, tx - dx * 3 + px, ty - dy * 3 + py, 1, '#8e98a8');            // тень на клинке
  return { tipX: tx, tipY: ty };
}

// o: { x, ground (мир), facing, pose, state, walking, step, time, airY, weaponLen, weapon (вид), rapier, bladeHidden,
//      view: 'side' | 'front' | 'back', squash, alpha, frame (имя кадра вместо подбора), rotate (рад), sheathed,
//      flash (вспышка попадания), bowDraw, turn, depth, run }
// Возвращает кончик оружия в координатах мира (для шлейфа) или null.
export function drawSprite(name, g, o) {
  const s = sets[name];
  const meta = s.meta;
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
    const img = s.imgs[o.view];
    if (!img) { g.restore(); return null; }
    const w = Math.max(2, Math.round(size * (o.squash ?? 1)));
    g.drawImage(img, X - Math.round(w / 2), G - foot, w, size);
    if (normalCtx && s.nimgs[o.view]) normalCtx.drawImage(s.nimgs[o.view], X - Math.round(w / 2) + t.e, G - foot + t.f, w, size);
    g.restore();
    return null;
  }
  const A = meta.anims ?? { walk: 6, idle: 4 };
  const cyc = (u, n) => Math.floor(((u % 1) + 1) % 1 * n) % n;
  let fname = o.frame;
  let right = o.facing >= 0;
  if (!fname && o.turn && A.turn) {
    // разворот: кадры ролика «повернулся через вид со спины»; справа налево — по порядку, слева направо — обратно
    const i = Math.min(A.turn - 1, Math.floor(o.turn.k * A.turn));
    fname = 'turn_' + (o.turn.toLeft ? i : A.turn - 1 - i);
    right = true;
  }
  if (!fname && o.depth && o.walking && o.state === 'ready' && A.walkS) {
    // идёт вглубь: шаги спереди (к камере) или со спины, клинок не виден
    const k = o.depth === 'south' ? 'walkS' : 'walkN';
    fname = k + '_' + cyc(o.step, A[k]);
    right = true;
  }
  if (!fname) {
    if (o.walking && o.state === 'ready' && A.walk) fname = (o.run && A.run ? 'run_' + cyc(o.step, A.run) : 'walk_' + cyc(o.step, A.walk));
    else if (o.sheathed && o.state === 'ready' && A.idle) fname = 'idle_' + (Math.floor(o.time * 4) % A.idle);
    else fname = nearestPose(s, o.pose);
  }
  const img = right ? s.imgs[fname] : s.flipped[fname];
  if (!img) { g.restore(); return null; }  // кадр не загрузился — не рисуем, но и не падаем
  const left = right ? X - cx : X - (size - cx);
  const top = G - foot;
  const nimg = right ? s.nimgs[fname] : s.nflipped[fname];
  if (normalCtx && nimg && !o.rotate) {
    normalCtx.globalAlpha = g.globalAlpha;
    normalCtx.drawImage(nimg, left + t.e, top + t.f);
    normalCtx.globalAlpha = 1;
  }
  if (o.rotate) {
    g.translate(X, G - size / 2 + 8);
    g.rotate(o.rotate);
    g.drawImage(img, -size / 2, -size / 2 - 4);
    g.restore();
    return null;
  }
  g.drawImage(img, left, top);
  if (o.flash) {
    // вспышка попадания: тот же кадр поверх, светлее
    const a = g.globalAlpha, op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.55;
    g.drawImage(img, left, top);
    g.globalCompositeOperation = op; g.globalAlpha = a;
  }
  const fr = meta.frames[fname];
  if (fr?.wrist && o.pose && !o.bladeHidden && !o.sheathed && o.weapon !== 'none') {
    const wx = left + (right ? fr.wrist[0] : size - fr.wrist[0]);
    const wy = top + fr.wrist[1];
    const len = (o.weaponLen ?? 17) * S;
    const tp = drawWeapon(g, o.weapon ?? (o.rapier ? 'rapier' : 'sword'), wx, wy, o.pose.angle, o.facing, len, o.bowDraw ?? 0);
    tip = { tipX: (tp.tipX - t.e) / S, tipY: (tp.tipY - t.f) / S };
  }
  g.restore();
  return tip;
}

export const drawKnight = (g, o) => drawSprite('knight', g, o);
