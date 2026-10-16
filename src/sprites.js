import { POSES } from './poses.js';
import { thick } from './draw.js';

// Спрайты персонажей из PixelLab (assets/sprites/<набор>/): тело — кадры, оружие рисуется кодом от кисти под углом позы.
// Набор: <набор>.json (размер кадра, стопа, центр, анимации, точка кисти кадров) + кадры + n/ (карты нормалей).
// Кадр смотрит вправо; влево — отражение. Позы — те же, что в src/poses.js: берётся ближайшая к текущей.
// Рисуется в пикселях экрана (холст вдвое больше игрового мира), поэтому 64 px кадра = 32 px мира.
// Найт — набор 'knight' (v0.60); враги — по типу врага (v0.64).

const ROOT = 'assets/sprites/';
// наборы кадров врагов (имя = тип в ENEMY_TYPES) и NPC (имя = sprite в NPC_TYPES); без набора — старые фигурки
export const ENEMY_SPRITES = ['skelShort', 'merc', 'skelShield', 'skelArcher', 'skelLong', 'duelist', 'axe', 'spear', 'crossbow', 'captain', 'halberd', 'commander', 'boss', 'guard', 'trainer', 'ghost', 'lika'];
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

export const spriteAnim = (name, key) => sets[name]?.meta?.anims?.[key] ?? 0;
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

// Оружие картинкой (v0.68): assets/objects/wpn_<имя>.png (рисует tools/draw_weapons.py) лежит горизонтально, рукоять слева.
// Хват ищется по картинке: у клинков — чуть позади гарды (самый высокий столбец в левой части), у древкового — доля длины.
// reach — во сколько раз вынос от кисти больше длины weaponLen (у копья наконечник дальше); flipY — лезвие вниз.
// Короткий клинок и двуручник — свои картинки (масштаб пиксель-арта сильно не меняем).
const WEAPON_IMG = {
  sword: { file: 'wpn_sword' },
  short: { file: 'wpn_short' },
  great: { file: 'wpn_great' },
  rapier: { file: 'wpn_rapier' },
  dagger: { file: 'wpn_dagger' },   // v0.82
  ghostsword: { file: 'wpn_ghostsword' },
  axe: { file: 'wpn_axe', grip: 0.12 },
  spear: { file: 'wpn_spear', grip: 0.25, reach: 1.2 },
  halberd: { file: 'wpn_halberd', grip: 0.25, reach: 1.15 },
  crossbow: { file: 'wpn_crossbow', grip: 0.3, reach: 1.0, fixed: true },
};
const wpn = {};
export function loadWeapons() {
  for (const [kind, d] of Object.entries(WEAPON_IMG)) {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (d.flipY) { x.translate(0, h); x.scale(1, -1); }
      x.drawImage(img, 0, 0);
      const a = x.getImageData(0, 0, w, h).data;
      const col = i => { let n = 0, lo = h, hi = -1; for (let y = 0; y < h; y++) if (a[(y * w + i) * 4 + 3] > 40) { n++; lo = Math.min(lo, y); hi = y; } return { n, lo, hi }; };
      let gx;
      if (d.grip != null) gx = Math.round(w * d.grip);
      else {
        let best = 0, bn = -1;   // гарда — самый высокий столбец в левых 45 %
        for (let i = 0; i < w * 0.45; i++) { const n = col(i).n; if (n > bn) { bn = n; best = i; } }
        gx = Math.max(1, best - 3);
      }
      const cg = col(gx), cb = col(Math.round(w * 0.75));
      const gy = cg.n ? (cg.lo + cg.hi) / 2 : cb.n ? (cb.lo + cb.hi) / 2 : h / 2;
      wpn[kind] = { c, gx, gy, front: w - gx, reach: d.reach ?? 1, fixed: d.fixed };
    };
    img.src = 'assets/objects/' + d.file + '.png';
  }
}

// подбор картинки по виду и длине: короткий меч и двуручник — свои
function weaponImage(kind, len) {
  if (kind === 'sword') {
    if (len < 28 && wpn.short) return wpn.short;
    if (len > 50 && wpn.great) return wpn.great;
  }
  return wpn[kind];
}

function drawWeaponImage(g, im, wx, wy, angleDeg, facing, len, scab = false) {
  const a = angleDeg * Math.PI / 180;
  // длина подгоняется под weaponLen, но близкие масштабы не трогаем — пиксели остаются целыми
  let k = im.fixed ? 1 : (len * im.reach) / im.front;
  if (Math.abs(k - 1) < 0.3) k = 1;
  g.save();
  g.translate(Math.round(wx), Math.round(wy));
  g.scale(facing, 1);
  g.rotate(a);
  g.scale(k, k);
  if (scab) {
    // в ножнах: видна рукоять с гардой, клинок закрыт кожаными ножнами с обоймой и наконечником
    const hilt = im.gx + 4, gy = Math.round(im.gy), L = im.front - 4;
    g.drawImage(im.c, 0, 0, hilt, im.c.height, -im.gx, -gy, hilt, im.c.height);
    g.fillStyle = '#0d0b14'; g.fillRect(3, -2, L + 2, 5);
    g.fillStyle = '#4a2f1d'; g.fillRect(4, -1, L, 3);
    g.fillStyle = '#6e4a2e'; g.fillRect(4, -1, L, 1);
    g.fillStyle = '#a89878'; g.fillRect(4, -1, 2, 3); g.fillRect(4 + Math.round(L * 0.45), -1, 1, 3);   // обоймы
    g.fillStyle = '#8a8a96'; g.fillRect(L, -1, 3, 3);                                                   // наконечник
  } else g.drawImage(im.c, -im.gx, -Math.round(im.gy));
  g.restore();
  const f = im.front * k;
  return { tipX: wx + Math.cos(a) * facing * f, tipY: wy + Math.sin(a) * f };
}

// Оружие павшего врага на полу (v0.89, вместо серой полоски): та же картинка, что была в руке, лежит плашмя,
// рукоять — в x, клинок — в сторону facing, без блика. len — weaponLen врага (px мира). false — картинки нет.
export function drawFloorWeapon(g, kind, x, ground, facing, len) {
  const tr = g.getTransform(), S = tr.a;
  const im = kind !== 'bow' && weaponImage(kind, len * S);
  if (!im) return false;
  g.save();
  g.setTransform(1, 0, 0, 1, tr.e, tr.f);
  g.imageSmoothingEnabled = false;
  const X = Math.round(x * S), Y = Math.round(ground * S - im.c.height / 2);
  if (facing < 0) { g.translate(X, 0); g.scale(-1, 1); g.drawImage(im.c, 0, Y); }
  else g.drawImage(im.c, X, Y);
  g.restore();
  return true;
}

// Оружие на полу (подобрать): картинка лежит, по клинку пробегает блик. false — картинки нет, рисовать кодом.
export function drawLyingWeapon(g, kind, x, ground, t) {
  const im = wpn[kind];
  if (!im) return false;
  const tr = g.getTransform(), S = tr.a;
  g.save();
  g.setTransform(1, 0, 0, 1, tr.e, tr.f);
  g.imageSmoothingEnabled = false;
  const w = im.c.width, h = im.c.height;
  const X = Math.round(x * S - w / 2), Y = Math.round((ground - Math.max(0, Math.sin(t * 3))) * S - h / 2 - 2);
  g.drawImage(im.c, X, Y);
  const k = (t * 0.8) % 1;
  if (k < 0.5) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(X + im.gx + Math.round(k * 2 * im.front), Y + Math.round(im.gy) - 1, 2, 2);
  }
  g.restore();
  return true;
}

// Оружие (в пикселях экрана): kind — sword | rapier | ghostsword | axe | spear | halberd | bow | crossbow.
// Есть картинка — рисуется она; нет (не загрузилась) и у лука (тетива тянется) — кодом. Возвращает кончик (для шлейфа удара).
function drawWeapon(g, kind, wx, wy, angleDeg, facing, len, draw = 0, scab = false) {
  const im = kind !== 'bow' && weaponImage(kind, len);
  if (im) return drawWeaponImage(g, im, wx, wy, angleDeg, facing, len, scab);
  if (kind === 'ghostsword') kind = 'sword';
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
    // лезвие — сплошное: полуокружность от древка, кромка светлее
    for (let i = -6; i <= 6; i += 0.5) {
      const r = 11 - Math.abs(i) * 0.5;
      line(tx + dx * i, ty + dy * i, tx + dx * i * 1.2 + px * r, ty + dy * i * 1.2 + py * r, 2, Math.abs(i) > 5.5 ? '#22202c' : '#7a8290');
    }
    for (let i = -6; i <= 6; i += 0.5) {
      const r = 11 - Math.abs(i) * 0.5;
      line(tx + dx * i * 1.2 + px * (r - 2), ty + dy * i * 1.2 + py * (r - 2), tx + dx * i * 1.2 + px * r, ty + dy * i * 1.2 + py * r, 1, '#c9d2de');
    }
    return { tipX: tx + px * 11, tipY: ty + py * 11 };
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
let shadeCanvas = null;
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
  if (!fname && o.anim && A[o.anim.key]) fname = o.anim.key + '_' + Math.min(A[o.anim.key] - 1, Math.floor(Math.max(0, o.anim.k) * A[o.anim.key]));
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
  if (o.shade) {
    // тень-отпечаток (рывок в тень, v0.71): силуэт кадра, залитый цветом o.shade
    const sc = shadeCanvas ??= document.createElement('canvas');
    if (sc.width < size) { sc.width = size; sc.height = size; }
    const sx = sc.getContext('2d');
    sx.clearRect(0, 0, sc.width, sc.height);
    sx.globalCompositeOperation = 'source-over';
    sx.drawImage(img, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = o.shade;
    sx.fillRect(0, 0, size, size);
    g.drawImage(sc, 0, 0, size, size, left, top, size, size);
    g.restore();
    return null;
  }
  // оружие в ножнах за спиной (v0.69): рисуется до тела — клинок за корпусом, рукоять над плечом.
  // o.sheath = { kind, len, k } — k от 0 (ещё в руке) до 1 (за спиной): по пути оружие плывёт от кисти к плечу
  const fr0 = meta.frames[fname];
  let sheathFront = null;
  if (o.sheath && fr0?.back) {
    const by = top + fr0.back[1];
    // меч — за спиной: почти вдоль спины, рукоять над плечом. Рапира — на поясе (владелец): у бедра, эфес впереди,
    // ножны назад и чуть вниз
    const hip = o.sheath.kind === 'rapier' || o.sheath.kind === 'dagger';   // рапира и кинжал — на поясе
    const BACK = hip ? 140 : 104;
    const k = Math.max(0, Math.min(1, o.sheath.k ?? 1));
    const sx = hip ? X + o.facing * 4 : X - o.facing * 3, sy = hip ? G - 29 : by - 9;
    let wx = sx, wy = sy, ang = BACK;
    if (k < 1 && fr0.wrist) {
      const hx = left + (right ? fr0.wrist[0] : size - fr0.wrist[0]), hy = top + fr0.wrist[1];
      const e = k * k * (3 - 2 * k);
      wx = hx + (sx - hx) * e; wy = hy + (sy - hy) * e;
      const a0 = o.pose?.angle ?? 0; ang = a0 + (BACK - a0) * e;
    }
    if (k >= 0.7) drawWeapon(g, o.sheath.kind, wx, wy, ang, o.facing, o.sheath.len, 0, k >= 1);
    else sheathFront = [wx, wy, ang];
  }
  if (o.cloth) {
    // ткань (сюрко, призрачный хвост): ниже пояса кадр режется на строки, каждая сдвигается волной; чем ниже — тем сильнее,
    // в движении подол отстаёт назад. o.cloth = { cut (строка кадра — пояс), amp, speed, lag (−1…1, против хода) }
    const c = o.cloth, cut = Math.max(0, Math.min(size, Math.round(c.cut)));
    g.drawImage(img, 0, 0, size, cut, left, top, size, cut);
    const span = Math.max(1, foot - cut + 6), tt = o.time ?? 0;
    for (let y = cut; y < size; y++) {
      const f = Math.min(1, (y - cut) / span), w = f * Math.sqrt(f);
      const dx = c.offs ? c.offs[Math.min(c.offs.length - 1, Math.round((y - cut) / span * (c.offs.length - 1)))]   // физика ткани (main.js)
        : (Math.sin(tt * (c.speed ?? 3) - y * 0.22) * (c.amp ?? 1.5) + Math.sin(tt * 1.7 - y * 0.09) * 0.8) * w + (c.lag ?? 0) * 4 * w;
      g.drawImage(img, 0, y, size, 1, left + Math.round(dx), top + y, size, 1);
    }
  } else g.drawImage(img, left, top);
  if (sheathFront) drawWeapon(g, o.sheath.kind, sheathFront[0], sheathFront[1], sheathFront[2], o.facing, o.sheath.len);
  if (o.flash) {
    // вспышка попадания: тот же кадр поверх, светлее
    const a = g.globalAlpha, op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.55;
    g.drawImage(img, left, top);
    g.globalCompositeOperation = op; g.globalAlpha = a;
  }
  const fr = meta.frames[fname];
  if (fr?.wrist && o.pose && !o.bladeHidden && !o.sheathed && o.weapon !== 'none') {
    // рукоять — в кулаке (fist, tools/fist_points.py; v0.83, владелец: «меч летает»), а не на запястье
    const hand = fr.fist ?? fr.wrist;
    const wx = Math.round(left + (right ? hand[0] : size - hand[0]));
    const wy = Math.round(top + hand[1]);
    const len = (o.weaponLen ?? 17) * S;
    const kind = o.weapon ?? (o.rapier ? 'rapier' : 'sword');
    const tp = drawWeapon(g, kind, wx, wy, o.weaponAngle ?? o.pose.angle, o.facing, len, o.bowDraw ?? 0);   // weaponAngle — свой угол (обратный хват кинжала)
    tip = { tipX: (tp.tipX - t.e) / S, tipY: (tp.tipY - t.f) / S };
    if (fr.fist && kind !== 'bow') {
      // пальцы обхватывают рукоять: кулак из кадра — поверх рукояти (крестовина и клинок остаются видны)
      g.save();
      g.beginPath(); g.rect(wx - 2, wy - 1, 5, 3); g.rect(wx - 1, wy - 2, 3, 5); g.clip();
      g.drawImage(img, left, top);
      g.restore();
    }
  }
  if (fr?.wrist) {   // где кулак (мир) — для оружия, которое летает отдельно от руки (подброшенный кинжал)
    const hand = fr.fist ?? fr.wrist;
    tip ??= { tipX: (left + (right ? hand[0] : size - hand[0]) - t.e) / S, tipY: (top + hand[1] - t.f) / S };
    tip.handX = (left + (right ? hand[0] : size - hand[0]) - t.e) / S;
    tip.handY = (top + hand[1] - t.f) / S;
  }
  g.restore();
  return tip;
}

// оружие само по себе (мир): подброшенный кинжал крутится в воздухе
export function drawWeaponWorld(g, kind, x, y, angleDeg, facing, len) {
  const t = g.getTransform(), S = t.a;
  g.save();
  g.setTransform(1, 0, 0, 1, t.e, t.f);
  g.imageSmoothingEnabled = false;
  const tp = drawWeapon(g, kind, Math.round(x * S), Math.round(y * S), angleDeg, facing, len * S);
  g.restore();
  return { tipX: (tp.tipX) / S, tipY: (tp.tipY) / S };
}

// облик Найта по броне (v0.80): лист knight_<броня> с теми же кадрами; пока не загружен — обычный
let knightSkin = 'knight';
export function setKnightSkin(name) {
  if (name === knightSkin) return;
  knightSkin = name;
  if (name !== 'knight') loadSpriteSet(name);
  if (name === 'knight_marauder') loadSpriteSet('knight_leather');   // пока полного листа нет — кожаная броня
}
const skinNow = () => spriteReady(knightSkin) ? knightSkin : knightSkin === 'knight_marauder' && spriteReady('knight_leather') ? 'knight_leather' : 'knight';
export const drawKnight = (g, o) => drawSprite(skinNow(), g, o);
