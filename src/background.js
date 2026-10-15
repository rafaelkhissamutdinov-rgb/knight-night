import { PAL } from './palette.js';
import { rect, thick } from './draw.js';
import { drawDecor, decorImages } from './decor.js';
import { getFire, drawFire } from './fire.js';

// Декорации комнат: стена с колоннами и дверями, пол с глубиной, факелы, портал на полу,
// бочки и ящики, решётка камеры, паутина и темнота. Фон комнаты рисуется один раз во всю её длину.

export const DOOR_W = 22, DOOR_H = 36;

// детали комнат из PixelLab (assets/objects/<имя>.png, разрешение экрана): рисуются в комнатах со стенами-кусками
// убранство стен: тип → [вариантов, как крепится, верх по умолчанию]; вариант — по месту (d.x), у доспеха rust → второй
const DECOR_IMG = {
  window: [2, 'top', 22, -3], banner: [2, 'top', 10, -3], portrait: [3, 'top', 36, -2], tapestry: [1, 'top', 14, -2],
  chains: [1, 'top', 40, 0], shield: [1, 'center', 44, 0], armor: [2, 'floor'], rack: [2, 'floor'], bunk: [2, 'floor'], bookshelf: [2, 'floor'], shelf: [2, 'top', 40, 0], fireplace: [1, 'floor'],
  pit: [1, 'hole'], rubble: [1, 'stairs'], sign: [1, 'top', 12, 0], chandelier: [1, 'hang', 30],
  wardrobe: [1, 'floor'], mannequin: [2, 'floor'],   // гардеробная (v0.78)
};
// предметы на полу картинкой: тип → вариантов (вариант — по месту); сундук — закрытый / открытый
const PROP_IMG = { barrel: 1, crate: 2, sack: 1, chest: 1, bones: 2,
  sofa: 1, table: 1, chair: 1, armchair: 1, pew: 1, bench: 1, desk: 1, stool: 1, guardtable: 1, stall: 1, rug: 1,
  bedroll: 1, pot: 1, letter: 1, candles: 1, lute: 1, logbook: 1, bouquet: 1, loot: 1, fabric: 1 };
export const OBJECTS = ['door_wood', 'door_iron', 'door_bars', 'door_hole', 'prop_chest_open', 'bonepile', 'stairs', 'balustrade', 'stainedglass', 'prop_altar', 'lika_sit', 'lika_sit_1', 'lika_wave', 'prop_campfire', 'prop_cup', 'slime', 'slime_squash', 'slime_stretch', 'decor_chandelier', 'gate_bars', 'gate_door', 'decor_portrait_king', 'decor_portrait_mage', 'decor_sigil', 'decor_cracked', 'balcony_cliff',
  ...Object.entries(PROP_IMG).flatMap(([t, n]) => Array.from({ length: n }, (_, i) => 'prop_' + t + (i ? '_' + i : ''))),
  ...Object.entries(DECOR_IMG).flatMap(([t, [n]]) => Array.from({ length: n }, (_, i) => 'decor_' + t + (i ? '_' + i : '')))];
const obj = {};
// карты нормалей предметов (v0.69, tools/pixellab_normals.py): живой свет освещает их объёмно
const NORMAL_OF = typeof WeakMap === 'undefined' ? null : new WeakMap();
for (const n of OBJECTS) {
  if (typeof Image === 'undefined') break;
  const im = new Image(); im.src = `assets/objects/${n}.png`; obj[n] = im;
}
// какие нормали готовы — список assets/objects/n/index.json (его пишет tools/pixellab_normals.py)
if (typeof fetch !== 'undefined') fetch('assets/objects/n/index.json').then(r => (r.ok ? r.json() : [])).then(list => {
  for (const n of list) {
    if (!obj[n]) continue;
    const nm = new Image(); nm.onload = () => NORMAL_OF.set(obj[n], nm); nm.src = `assets/objects/n/${n}.png`;
  }
}).catch(() => {});
// под потолком всё, что висит на стене (окна, знамёна, портреты, люстра…), опускается под карниз — один раз на комнату
export const CEIL_DY = 18;   // карниз — 24 px мира; висящее — чуть ниже
const HANGING = new Set(['window', 'banner', 'portrait', 'tapestry', 'chains', 'shield', 'shelf', 'sign', 'chandelier', 'stainedglass', 'sigil', 'ivy']);
function ceilingShift(room) {
  if (room._ceil) return;
  room._ceil = true;
  for (const d of room.decor ?? []) {
    if (!HANGING.has(d.type)) continue;
    const top0 = DECOR_IMG[d.type]?.[2] ?? (d.type === 'chandelier' ? 30 : d.type === 'ivy' ? 0 : 20);
    d.y = (d.y ?? top0) + CEIL_DY;
  }
}
// потолок (v0.70, владелец: «потолок ниже»): своды с балками поверх верха стены; нормали — рельеф
const CEIL = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: 'assets/backgrounds/ceiling.png' });
const CEIL_N = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: 'assets/backgrounds/n/ceiling.png' });
export const objectsReady = () => OBJECTS.every(n => obj[n]?.complete) && (!CEIL || (CEIL.complete && CEIL_N.complete));   // загрузились или не нашлись — дальше не ждать
const objImg = n => (obj[n]?.complete && obj[n].naturalWidth ? obj[n] : null);
if (obj.stainedglass) obj.stainedglass.onload = () => { decorImages.stainedglass = obj.stainedglass; };
// знак мага и свежая кладка тайника (v0.74) — картинки PixelLab, убранство рисует их живыми (decor.js)
for (const n of ['decor_sigil', 'decor_cracked']) if (obj[n]) obj[n].onload = () => { decorImages[n.slice(6)] = obj[n]; };
// люстра (v0.68): фитили — верхушки свечей на картинке (самые высокие столбцы); живое пламя ставится на них (decor.js)
if (obj.decor_chandelier) obj.decor_chandelier.onload = () => {
  const im = obj.decor_chandelier, w = im.width, h = im.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const a = x.getImageData(0, 0, w, h).data;
  const top = Array.from({ length: w }, (_, i) => { for (let y = 0; y < h; y++) if (a[(y * w + i) * 4 + 3] > 100) return y; return h; });
  const m = Math.min(...top), wicks = [];
  for (let i = 0; i < w; i++) if (top[i] <= m && (i === 0 || top[i - 1] > m)) wicks.push((i - w / 2) / 2);   // мир: от центра
  decorImages.chandelier = { wicks, h: h / 2 };
};
// убранство картинкой (если есть); false — рисовать кодом
function decorImage(g, d, floorTop, room) {
  const spec = DECOR_IMG[d.type];
  if (!spec) return false;
  const [n, anchor, top0, dy] = spec;
  // портрет — по тому, кто на нём (король, маг с выцарапанным лицом, принцесса); без who — дамы по месту
  const who = d.type === 'portrait' && { king: 'decor_portrait_king', mage: 'decor_portrait_mage', princess: 'decor_portrait' }[d.who];
  const i = d.type === 'armor' ? (d.rust ? 1 : 0)
    : d.type === 'rack' ? ((d.items ?? []).filter(x => !x).length >= 2 ? 1 : 0)   // полупустая стойка
    : Math.abs(Math.round(d.x / 10)) % n;
  const im = (who && objImg(who)) || objImg('decor_' + d.type + (i ? '_' + i : '') + (d.type === 'portrait' && !i && !who ? '_1' : ''));
  if (!im) return false;
  const h = im.height / 2;
  if (anchor === 'hang') {
    // люстра: цепь от потолка кодом, верх картинки — фитили на (d.y - 7), как у прежней люстры кодом
    const cx = Math.round(d.x), top = (d.y ?? top0) - 7;
    for (let yy = 0; yy < top + 4; yy += 3) { rect(g, cx, yy, 1, 2, '#4a4654'); rect(g, cx, yy + 2, 1, 1, '#1a1720'); }
    drawObj(g, im, cx, top + h);
    return true;
  }
  if (anchor === 'stairs') {
    // завал наверху лестницы (картинкой): закрывает её проём
    const st = stairsGeom(room, floorTop);
    if (!st) return false;
    const [dx, dy] = st.pts[st.pts.length - 1];   // завал — в двери наверху
    drawObj(g, im, dx, dy + 2);
    return true;
  }
  const bottom = anchor === 'floor' ? floorTop : anchor === 'hole' ? floorTop + 1 + h : anchor === 'center' ? (d.y ?? top0) + h / 2 : (d.y ?? top0) + dy + h;
  drawObj(g, im, d.x, bottom);
  return true;
}

// груда костей упавшего скелета (картинкой); false — нет картинки
export function drawBonePileImg(g, x, gy, facing) {
  const im = objImg('bonepile');
  if (!im) return false;
  if (facing < 0) { g.save(); g.translate(x, 0); g.scale(-1, 1); drawObj(g, im, 0, gy + 1); g.restore(); }
  else drawObj(g, im, x, gy + 1);
  return true;
}

// слизень картинкой (v0.67): обычный / сплющенный (готовится к прыжку, приземлился) / вытянутый (в полёте);
// раздувание — масштаб size, взгляд — отражение. false — картинок нет, рисовать кодом.
export function drawSlimeImg(g, { x, ground, airY, size, squash, facing, holding, flash }) {
  const name = squash > 0.25 ? 'slime_squash' : airY > 3 || squash < -0.15 ? 'slime_stretch' : 'slime';
  const im = objImg(name) ?? objImg('slime');
  if (!im) return false;
  const w = im.width / 2 * size * (1 + Math.max(0, squash) * 0.25), h = im.height / 2 * size * (1 - Math.max(0, squash) * 0.2);
  const base = Math.round(ground - airY);
  if (airY > 2) rect(g, x - w * 0.3, ground - 1, Math.round(w * 0.6), 1, '#1e1a2b');   // тень на полу
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(x), base);
  if (facing < 0) g.scale(-1, 1);
  g.drawImage(im, -w / 2, -h + 1, w, h);
  if (flash) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(im, -w / 2, -h + 1, w, h); }
  g.restore();
  if (holding) {   // проглоченный рыцарь просвечивает
    g.save(); g.globalAlpha = 0.7;
    rect(g, x - 2, base - h * 0.7, 4, 7, '#5b6b86');
    rect(g, x - 1, base - h * 0.7 - 2, 2, 2, '#e8454f');
    g.restore();
  }
  return true;
}

// любая картинка набора по имени: низ по центру в (x, bottom), flip — отражение; false — нет картинки
export function drawObjNamed(g, name, x, bottom, flip = false) {
  const im = objImg(name);
  if (!im) return false;
  if (flip) { g.save(); g.translate(Math.round(x), 0); g.scale(-1, 1); drawObj(g, im, 0, bottom); g.restore(); }
  else drawObj(g, im, Math.round(x), bottom);
  return true;
}

// картинка в мировых координатах при масштабе холста 2: низ по центру в (x, bottom)
// холст цвета → парный холст нормалей: всё, что рисует drawObj, ложится и туда (нормаль картинки или плоская по силуэту)
const normalPair = new Map();
export function pairNormals(g, ng) { if (ng) normalPair.set(g, ng); else normalPair.delete(g); }
const flatCache = typeof WeakMap === 'undefined' ? null : new WeakMap();
function flatOf(im) {
  let c = flatCache.get(im);
  if (c) return c;
  c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  flatCache.set(im, c);
  return c;
}
function drawNormal(g, im, ...args) {
  const ng = normalPair.get(g);
  if (!ng || !im.width) return;
  const nm = NORMAL_OF.get(im);
  ng.setTransform(g.getTransform());
  ng.globalAlpha = g.globalAlpha;
  ng.drawImage(nm ?? flatOf(im), ...args);
  ng.setTransform(1, 0, 0, 1, 0, 0);
  ng.globalAlpha = 1;
}
function drawObj(g, im, x, bottom) {
  g.drawImage(im, x - im.width / 4, bottom - im.height / 2, im.width / 2, im.height / 2);
  drawNormal(g, im, x - im.width / 4, bottom - im.height / 2, im.width / 2, im.height / 2);
}
const RUNE = '#5fd3ff', RUNE_HOT = '#c8f4ff';

// floorTop — где стена встречается с полом; ниже — пол с глубиной (дальние ряды плиток уже).
// tiles — куски стены с полом из PixelLab (640×360, бесшовные): тогда фон в полном разрешении экрана (c.k = 2),
// кладка и пол — из кусков, остальное (двери, убранство) рисуется кодом поверх, как раньше.
export const TILE_W = 640, TILE_LINE = 246;  // ширина куска и где на нём стена встречается с полом
export function buildRoom(room, height, floorTop, tiles = null) {
  const length = room.length;
  const k = tiles ? 2 : 1;
  const c = document.createElement('canvas');
  c.width = length * k;
  c.height = height * k;
  c.k = k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const wallBottom = floorTop;
  let seed = 7 + length;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (tiles) {
    // куски подряд; вариант — по очереди с перемешиванием (первый, основной, — чаще)
    const dy = floorTop * 2 - TILE_LINE, th = tiles[0].height;
    // парный холст нормалей (рельеф кладки + нормали предметов) — для живого света
    const nrm = tiles.normals?.every(n => n.complete && n.naturalWidth) ? tiles.normals : null;
    let ng = null;
    if (nrm) {
      c.normal = document.createElement('canvas'); c.normal.width = c.width; c.normal.height = c.height;
      ng = c.normal.getContext('2d'); ng.imageSmoothingEnabled = false;
    }
    for (let x = 0, i = 0; x < length * 2; x += TILE_W, i++) {
      const j = i === 0 || rand() < 0.4 ? 0 : 1 + Math.floor(rand() * (tiles.length - 1));
      const t = tiles[j] ?? tiles[0];
      g.drawImage(t, x, dy);
      if (dy < 0) g.drawImage(t, 0, th + dy - 20, TILE_W, 20 - dy, x, height * 2 - 20 + dy, TILE_W, 20 - dy);
      if (ng) {
        const n = nrm[j] ?? nrm[0];
        ng.drawImage(n, x, dy);
        if (dy < 0) ng.drawImage(n, 0, th + dy - 20, TILE_W, 20 - dy, x, height * 2 - 20 + dy, TILE_W, 20 - dy);
      }
    }
    if (room.far) { g.clearRect(0, 0, length * 2, floorTop * 2); ng?.clearRect(0, 0, length * 2, floorTop * 2); }   // под открытым небом: стены нет, за полом — дальний план (рисуется отдельно)
    g.scale(2, 2);
    const ceiling = !room.far && room.tiles !== 'shop' && room.ceiling !== false && !!CEIL?.naturalWidth;
    if (ceiling) ceilingShift(room);
    pairNormals(g, ng);
    finishRoom(g, room, length, height, floorTop, rand, true);
    pairNormals(g, null);
    if (ceiling) {
      // своды тянутся по всей длине; каждый второй кусок отражён — без видимого шва
      g.setTransform(1, 0, 0, 1, 0, 0);
      ng?.setTransform(1, 0, 0, 1, 0, 0);
      for (let x = 0, i = 0; x < length * 2; x += CEIL.width, i++) {
        for (const [ctx, im] of [[g, CEIL], [ng, CEIL_N]]) {
          if (!ctx || !im.naturalWidth) continue;
          ctx.save();
          if (i % 2) { ctx.translate(x + im.width, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); }
          else ctx.drawImage(im, x, 0);
          ctx.restore();
        }
      }
      // тень под карнизом на стене
      const gr = g.createLinearGradient(0, CEIL.height, 0, CEIL.height + 10);
      gr.addColorStop(0, 'rgba(8,6,12,0.55)'); gr.addColorStop(1, 'rgba(8,6,12,0)');
      g.fillStyle = gr; g.fillRect(0, CEIL.height, length * 2, 10);
    }
    return c;
  }

  g.fillStyle = PAL.mortar;
  g.fillRect(0, 0, length, wallBottom);
  for (let row = 0; row * 8 < wallBottom; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < length; x += 16) {
      const y = row * 8;
      const t = rand();
      g.fillStyle = t < 0.12 ? PAL.wallDark : t < 0.3 ? '#353049' : t < 0.45 ? '#3f3956' : PAL.wall;
      g.fillRect(x, y, 15, 7);
      if (rand() < 0.15) { g.fillStyle = PAL.wallDark; g.fillRect(x + 2 + Math.floor(rand() * 10), y + 2 + Math.floor(rand() * 4), 2, 1); }  // щербина
      g.fillStyle = PAL.wallLight;
      g.fillRect(x, y, 15, 1);
    }
  }
  // трещины и подтёки
  for (let i = 0; i < length / 60; i++) {
    const x = Math.floor(rand() * length), y = Math.floor(rand() * (wallBottom - 30)) + 10;
    let cx = x, cy = y;
    g.fillStyle = PAL.mortar;
    for (let k = 0; k < 8; k++) { g.fillRect(cx, cy, 1, 2); cx += Math.round(rand() * 2 - 1); cy += 2; }
  }
  // колонны (не там, где двери и решётка)
  const doors = room.doors ?? [];
  if (room.columns !== false) {
    for (let x = 120; x < length - 30; x += 240) {
      if (doors.some(d => Math.abs(d.x - (x + 10)) < 40)) continue;
      g.fillStyle = PAL.wallDark;
      g.fillRect(x - 1, 0, 22, wallBottom);
      g.fillStyle = PAL.wallLight;
      g.fillRect(x, 0, 20, wallBottom);
      g.fillStyle = PAL.wall;
      g.fillRect(x + 12, 0, 8, wallBottom);
    }
  }
  // пол: ряды плиток, ближние выше и светлее — так читается глубина
  g.fillStyle = PAL.mortar;
  g.fillRect(0, wallBottom, length, height - wallBottom);
  let y = wallBottom + 1;
  for (let row = 0; y < height; row++) {
    const h = 6 + row * 3;
    const w = 24 + row * 6;
    const off = row % 2 ? w / 2 : 0;
    for (let x = -off; x < length; x += w) {
      g.fillStyle = row < 2 ? PAL.floorDark : PAL.floor;
      g.fillRect(Math.round(x), y, w - 1, h - 1);
      g.fillStyle = row < 2 ? PAL.floor : PAL.floorLight;
      g.fillRect(Math.round(x), y, w - 1, 1);
    }
    y += h;
  }
  g.fillStyle = PAL.mortar;
  g.fillRect(0, wallBottom, length, 2);
  for (let i = 0; i < length / 6; i++) {
    g.fillStyle = PAL.floorLight;
    g.fillRect(Math.floor(rand() * length), wallBottom + 4 + Math.floor(rand() * (height - wallBottom - 5)), 1, 1);
  }
  // тень под потолком и у пола — стена не плоская
  const shadeTop = g.createLinearGradient(0, 0, 0, 40);
  shadeTop.addColorStop(0, 'rgba(8,6,14,0.55)');
  shadeTop.addColorStop(1, 'rgba(8,6,14,0)');
  g.fillStyle = shadeTop;
  g.fillRect(0, 0, length, 40);
  g.fillStyle = 'rgba(8,6,14,0.35)';
  g.fillRect(0, wallBottom - 6, length, 6);
  g.fillStyle = PAL.wallDark;
  g.fillRect(0, wallBottom - 3, length, 3);  // плинтус
  finishRoom(g, room, length, height, floorTop, rand, false);
  return c;
}

// двери, лестницы, балкон, убранство — поверх стены (и нарисованной кодом, и из кусков)
function finishRoom(g, room, length, height, floorTop, rand, tiled) {
  const doors = room.doors ?? [];
  if (tiled) {
    const shade = g.createLinearGradient(0, 0, 0, 30);
    shade.addColorStop(0, 'rgba(8,6,14,0.45)');
    shade.addColorStop(1, 'rgba(8,6,14,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, length, 30);
  }
  for (const d of doors) drawDoor(g, d, floorTop, tiled);
  if (room.gate) drawGateWall(g, room.gate === 'right' ? length - 26 : 0, floorTop);
  if (room.stairs) drawStairs(g, stairsX(room, length), floorTop, tiled, (room.decor ?? []).some(d => d.type === 'rubble') && !!objImg('decor_rubble'));
  if (room.balcony) (tiled && room.far ? drawBalconyTiled : drawBalcony)(g, length, height, floorTop, rand);
  for (const d of room.decor ?? []) if (!(tiled && decorImage(g, d, floorTop, room))) drawDecor(g, d, floorTop);  // поверх лестниц и дверей (завал на лестнице)
  if (room.magic) {
    // вершина башни: стены в лиловом отсвете, на стене знаки
    g.fillStyle = 'rgba(120,60,170,0.18)';
    g.fillRect(0, 0, length, height);
    for (let x = 90; x < length - 40; x += 140) drawSigil(g, x, 46);
  }
}

// Дверь в задней стене: деревянная, решётчатая (камера) или железная.
export function drawDoor(g, d, floorTop, tiled = false) {
  if (d.kind === 'none') return;  // проход без двери (например, у подножия лестницы)
  const im = tiled && objImg('door_' + (['bars', 'iron', 'hole'].includes(d.kind) ? d.kind : 'wood'));
  if (im) { drawObj(g, im, d.x, floorTop); return; }   // низ двери — ровно на линии пола
  if (d.kind === 'hole') {
    // пролом в стене: рваный край, за ним темнота
    const x0 = Math.round(d.x - 13), top = floorTop - 38;
    const edge = [3, 1, 0, 2, 0, 1, 3, 2, 0, 1, 0, 2, 1, 3];
    for (let y = 0; y < 38; y++) {
      const l = edge[y % edge.length], r = edge[(y + 5) % edge.length];
      rect(g, x0 + l - 2, top + y, 26 - l - r + 4, 1, '#5a5276');
      rect(g, x0 + l, top + y, 26 - l - r, 1, '#07060c');
    }
    return;
  }
  const x0 = Math.round(d.x - DOOR_W / 2), top = floorTop - DOOR_H;
  // каменный проём с аркой
  rect(g, x0 - 3, top - 2, DOOR_W + 6, DOOR_H + 2, PAL.wallDark);
  rect(g, x0 - 2, top - 4, DOOR_W + 4, 3, PAL.wallLight);
  rect(g, x0, top, DOOR_W, DOOR_H, '#0d0b14');
  if (d.kind === 'bars') {
    // камера: темнота за решёткой
    rect(g, x0 + 1, top + 1, DOOR_W - 2, DOOR_H - 1, '#141020');
    if (d.bones) {
      rect(g, x0 + 6, floorTop - 4, 4, 3, '#a39d8a');
      rect(g, x0 + 7, floorTop - 3, 1, 1, '#14101e');
      rect(g, x0 + 11, floorTop - 2, 6, 1, '#8a8474');
    }
    for (let x = x0 + 2; x < x0 + DOOR_W; x += 4) rect(g, x, top, 1, DOOR_H, '#5b6b86');
    rect(g, x0, top + 6, DOOR_W, 1, '#45424f');
    rect(g, x0, top + 24, DOOR_W, 1, '#45424f');
    rect(g, x0 + DOOR_W - 5, top + 15, 3, 3, '#3b3550');
  } else if (d.kind === 'iron') {
    rect(g, x0, top, DOOR_W, DOOR_H, '#45424f');
    for (let yy = top + 3; yy < floorTop; yy += 7) for (let xx = x0 + 3; xx < x0 + DOOR_W; xx += 5) rect(g, xx, yy, 1, 1, '#9f97b0');
    rect(g, x0, top, DOOR_W, 1, '#6d6a7a');
    rect(g, x0 + DOOR_W - 6, top + 17, 3, 4, PAL.gold);
    rect(g, x0 + DOOR_W - 5, top + 19, 1, 1, '#14101e');
  } else {
    // деревянная: доски, железные полосы, кольцо
    for (let i = 0; i < DOOR_W; i += 5) {
      rect(g, x0 + i, top, 4, DOOR_H, i % 10 ? '#6b4532' : '#7a4f36');
      rect(g, x0 + i + 4, top, 1, DOOR_H, '#3b2a1e');
    }
    rect(g, x0, top + 7, DOOR_W, 2, '#3b3550');
    rect(g, x0, top + 26, DOOR_W, 2, '#3b3550');
    rect(g, x0 + DOOR_W - 6, top + 17, 3, 3, PAL.gold);
    rect(g, x0 + DOOR_W - 5, top + 18, 1, 1, '#3b2a1e');
  }
}

// Лестница вверх вдоль стены: ступени поднимаются вправо к тёмному проёму наверху.
// Лестница (v0.70): объёмная, ступени уходят вглубь к двери наверху; нижние ступени — на полу (STAIR_DROP ниже линии стены).
// Путь рыцаря по ступеням — доли картинки (низ ступеней → площадка → дверь); по нему он реально поднимается (main.js).
// v0.70 (замечание владельца: «чужеродная, разворот неестественный, уходит в потолок»): лестница в профиль, как в
// двумерных играх (Castlevania, Blasphemous) — ступени по диагонали вдоль стены, под ними кладка, балюстрада, камень замка;
// наверху площадка и дверь (та же, что в залах). Рыцарь поднимается по ступеням наискось, сбоку.
export const STAIR_DROP = 6;                                        // низ ступеней — на линии шага у стены (z = 0)
export const STAIR_PATH = [[0.03, 0.95], [0.64, 0.19], [0.84, 0.17]];   // v0.74: дверь — вровень с правым краем площадки   // нижняя ступень → верхняя → к двери
// у картинки лестницы слева поле под нижний столб перил (v0.74, 24 px картинки = 12 мира): x0 и w — по самим ступеням
export const STAIR_PAD = 12;
const stairW = im => im.width / 2 - STAIR_PAD;
export function stairsX(room, length) {
  const im = objImg('stairs'), w = im ? stairW(im) : 70;
  return room.stairsX ?? (room.stairs === 'right' ? length - w - 4 : length / 2 - w / 2);
}
export function stairsGeom(room, floorTop) {
  const im = objImg('stairs');
  if (!im || !room.stairs || !room.tiles) return null;
  const x0 = stairsX(room, room.length), w = stairW(im), h = im.height / 2, top = floorTop + STAIR_DROP - h;
  return { x0, w, h, top, pts: STAIR_PATH.map(([fx, fy]) => [x0 + fx * w, top + fy * h]) };
}
// картинка, подкрашенная к среднему цвету стены слева от x0 (холст фона в масштабе 2: пиксели = мир × 2)
const tintCache = new Map();
function tintToWall(g, im, x0, floorTop, k = 0.3) {
  try {
    const sx = Math.max(0, Math.round((x0 - 60) * 2)), sy = Math.round((floorTop - 70) * 2);
    const d = g.getImageData(sx, sy, 100, 100).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (!n) return null;
    const col = `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})`;
    const key = im.src + col;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = k;
    x.fillStyle = col;
    x.fillRect(0, 0, c.width, c.height);
    NORMAL_OF.set(c, NORMAL_OF.get(im));
    tintCache.set(key, c);
    return c;
  } catch { return null; }
}

function drawStairs(g, x0, floorTop, tiled = false, blocked = false) {
  const im = tiled && objImg('stairs');
  if (im) {
    const w = stairW(im), h = im.height / 2, top = floorTop + STAIR_DROP - h;
    // тень на стене справа от кладки лестницы (она выступает из стены) — до двери и ступеней
    const sh = g.createLinearGradient(x0 + w, 0, x0 + w + 10, 0);
    sh.addColorStop(0, 'rgba(10,8,18,0.45)');
    sh.addColorStop(1, 'rgba(10,8,18,0)');
    g.fillStyle = sh;
    g.fillRect(x0 + w, top + 8, 10, floorTop - top - 8);
    // дверь на стене над площадкой — до ступеней (балюстрада впереди)
    const door = objImg('door_wood');
    // правый край двери — по краю площадки; низ — на заднем крае площадки, а не под ней (v0.74)
    if (door && !blocked) drawObj(g, door, x0 + w - door.width / 4, top + 9);
    // цвет кладки — к цвету стен комнаты: средний цвет стены рядом подмешивается к картинке (v0.74, владелец:
    // «вставленная картинка не вписывается»)
    const tinted = tintToWall(g, im, x0, floorTop);
    drawObj(g, tinted ?? im, x0 - STAIR_PAD + im.width / 4, floorTop + STAIR_DROP);
    // тень касания: пол у основания ступеней темнее
    const cs = g.createLinearGradient(0, floorTop + STAIR_DROP - 2, 0, floorTop + STAIR_DROP + 7);
    cs.addColorStop(0, 'rgba(10,8,18,0.5)');
    cs.addColorStop(1, 'rgba(10,8,18,0)');
    g.fillStyle = cs;
    g.fillRect(x0 - STAIR_PAD + 2, floorTop + STAIR_DROP - 2, w + STAIR_PAD - 2, 9);
    return;
  }
  const steps = 9, sw = 8, sh = 9;
  rect(g, x0 + steps * sw - 6, floorTop - steps * sh - 30, 24, 30, '#0d0b14');
  rect(g, x0 + steps * sw - 8, floorTop - steps * sh - 33, 28, 3, PAL.wallLight);
  for (let i = 0; i < steps; i++) {
    const x = x0 + i * sw, y = floorTop - (i + 1) * sh;
    rect(g, x, y, sw + 70 - i * sw, sh, PAL.wallDark);
    rect(g, x, y, sw, 2, PAL.wallLight);
    rect(g, x, y + 2, 1, sh - 2, PAL.mortar);
  }
  // перила
  for (let i = 0; i <= steps; i++) rect(g, x0 + i * sw, floorTop - i * sh - 14, 1, 12, '#5b6b86');
  for (let i = 0; i < steps; i++) {
    const x = x0 + i * sw;
    for (let k = 0; k < sw; k++) rect(g, x + k, floorTop - i * sh - 14 - Math.round(k * sh / sw), 1, 1, '#6d6a7a');
  }
}

// Обрушенный балкон: замок стоит высоко на горе — вдали хребты, а далеко внизу долина: река петляет,
// леса пятнами, лоскуты полей и маленькая деревенька кольцом вокруг церкви, дым из труб.
// Балюстрада с проломами, справа пол обрывается в пропасть.
// балкон в разрешении экрана: каменные перила картинкой, с проломом; справа пол обрывается в пропасть
function drawBalconyTiled(g, length, height, floorTop) {
  const im = objImg('balustrade');
  // обрыв (v0.74, владелец): конец балкона обломан и опирается на скалу, уступы уходят вниз, внизу — ельник.
  // Картинка — дорисовка PixelLab по маске поверх настоящей сцены (tools/pixellab_cliff.py), поэтому срастается с полом
  // и перилами. Кусок сцены 320×320 px экрана = мир (240, 20)…(400, 180); маска — правая часть ниже перил наискось.
  const cliff = objImg('balcony_cliff');
  if (im) for (let x = 0, i = 0; x < length; x += im.width / 2, i++) if (i % 4 !== 2) g.drawImage(im, x, floorTop - im.height / 2 + 2, im.width / 2, im.height / 2);
  if (!cliff || globalThis.knightNightNoCliff) return;
  const CX = 240, CY = 20;
  for (let y = 140; y < 320; y++) {
    const x0 = CX + (110 - (y - 140) * 0.12) / 2;
    g.clearRect(x0, CY + y / 2, length - x0 + 1, 0.5);
    normalPair.get(g)?.clearRect(x0 * 2, (CY + y / 2) * 2, (length - x0 + 1) * 2, 1);
  }
  drawObj(g, cliff, CX + 80, CY + 160);
}

function drawBalcony(g, length, height, floorTop, rand) {
  const horizon = 34;  // смотрим сверху: горизонт высоко, долина занимает почти всё
  const sky = g.createLinearGradient(0, 0, 0, horizon + 6);
  sky.addColorStop(0, '#2b2f5a');
  sky.addColorStop(0.6, '#9a6f9a');
  sky.addColorStop(1, '#f0b088');
  g.fillStyle = sky;
  g.fillRect(0, 0, length, horizon + 6);
  for (let i = 0; i < 5; i++) {
    const cx = rand() * length, cy = 6 + rand() * 16, w = 30 + rand() * 50;
    rect(g, cx, cy, w, 2, 'rgba(255,220,230,0.25)');
  }
  // хребты: гладкие вершины, дальние светлее (воздушная дымка)
  const range = (base, amp, period, color, phase, snow) => {
    for (let x = 0; x < length; x++) {
      const t = x / period + phase;
      const y = Math.round(base - amp * (0.55 * Math.abs(Math.sin(t)) + 0.3 * Math.abs(Math.sin(t * 2.3 + 1)) + 0.15 * Math.sin(t * 5.1)));
      rect(g, x, y, 1, floorTop - y, color);
      if (snow && base - y > amp * 0.72) rect(g, x, y, 1, 2, '#e6e2f0');
    }
  };
  range(horizon + 4, 22, 46, '#8a86b0', 0.3, true);
  range(horizon + 10, 14, 30, '#6f7898', 1.7, false);
  // долина далеко внизу
  const valley = g.createLinearGradient(0, horizon + 8, 0, floorTop);
  valley.addColorStop(0, '#8a9a8a');
  valley.addColorStop(0.35, '#6a8a5a');
  valley.addColorStop(1, '#4a6a3e');
  g.fillStyle = valley;
  g.fillRect(0, horizon + 8, length, floorTop - horizon - 8);
  // лоскуты полей
  const fields = ['#9aa64e', '#b8a85a', '#7f9a4a', '#a8964a', '#8aa05a'];
  for (let i = 0; i < 70; i++) {
    const y = horizon + 14 + rand() * (floorTop - horizon - 20);
    const far = 1 - (y - horizon) / (floorTop - horizon);
    const w = Math.round((8 + rand() * 14) * (1 - far * 0.6)), h = Math.max(1, Math.round((2 + rand() * 3) * (1 - far * 0.6)));
    rect(g, rand() * length, y, w, h, fields[Math.floor(rand() * fields.length)]);
  }
  // река петляет из дали к краю
  for (let y = horizon + 10; y < floorTop; y++) {
    const k = (y - horizon) / (floorTop - horizon);
    const x = length * 0.55 + Math.sin(y * 0.12) * (20 + k * 40);
    rect(g, x, y, 1 + Math.round(k * 3), 1, k < 0.2 ? '#b8c8d8' : '#7aa0c0');
  }
  // леса: тёмные пятна из крон
  for (let i = 0; i < 26; i++) {
    const cy = horizon + 14 + rand() * (floorTop - horizon - 20), cx = rand() * length;
    const far = 1 - (cy - horizon) / (floorTop - horizon), n = 5 + Math.floor(rand() * 9);
    for (let k = 0; k < n; k++) {
      const r = Math.max(1, Math.round((2 + rand() * 2) * (1 - far * 0.6)));
      const x = cx + (rand() - 0.5) * 18, y = cy + (rand() - 0.5) * 5;
      rect(g, x, y, r + 1, r, '#2f4a32');
      rect(g, x, y, 1, 1, '#4a6a42');
    }
  }
  // деревенька кольцом вокруг церкви, дорога к ней
  const vx = Math.round(length * 0.33), vy = Math.round(horizon + (floorTop - horizon) * 0.45);
  for (let k = 0; k < 14; k++) rect(g, vx - 40 + k * 3, vy + 6 + Math.round(Math.sin(k * 0.5) * 2), 2, 1, '#c8b88a');
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const hx = Math.round(vx + Math.cos(a) * 9), hy = Math.round(vy + Math.sin(a) * 4);
    rect(g, hx, hy, 3, 2, '#e0d4b8');
    rect(g, hx, hy - 1, 3, 1, '#9a4a3a');
    if (i % 3 === 0) for (let k = 1; k < 5; k++) rect(g, hx + 1 + Math.round(Math.sin(k) * 1), hy - 1 - k * 2, 1, 1, 'rgba(230,230,240,0.45)');
  }
  rect(g, vx, vy - 4, 2, 5, '#e0d4b8');  // церковь
  rect(g, vx, vy - 5, 2, 1, '#9a4a3a');
  rect(g, vx, vy - 7, 1, 2, '#c8c0b0');
  // балюстрада: столбики и перила, местами обрушены
  for (let x = 4; x < length - 50; x += 7) {
    if (Math.floor(x / 7) % 9 === 4 || Math.floor(x / 7) % 9 === 5) continue;  // пролом
    rect(g, x, floorTop - 12, 3, 12, '#8a8494');
    rect(g, x, floorTop - 12, 1, 12, '#b8b2c2');
  }
  for (let x = 0; x < length - 50; x += 3) if (Math.floor(x / 7) % 9 !== 4 && Math.floor(x / 7) % 9 !== 5) rect(g, x, floorTop - 14, 3, 2, '#a39daf');
  // справа пол обрывается: пропасть и неровный край
  const edge = length - 44;
  const abyss = g.createLinearGradient(0, floorTop, 0, height);
  abyss.addColorStop(0, '#8a8aa8');  // дымка над долиной
  abyss.addColorStop(0.4, '#3f5a50');
  abyss.addColorStop(1, '#16201e');
  for (let y = floorTop; y < height; y++) {
    const w = 44 - Math.round(((y - floorTop) / (height - floorTop)) * 18 + Math.sin(y * 0.7) * 3);
    g.fillStyle = abyss;
    g.fillRect(edge + (44 - w), y, w, 1);
    if (y % 5 === 0) rect(g, edge + (44 - w) + 4 + (y % 3) * 6, y, 3, 1, '#2a4038');  // верхушки леса далеко внизу
    rect(g, edge + (44 - w) - 1, y, 2, 1, '#2a2538');
  }
}

// Знак мага на стене: круг с лучами, светится лиловым
function drawSigil(g, x, y) {
  const im = decorImages.sigil;
  if (im) { g.drawImage(im, Math.round(x * 2 - im.width / 2) / 2, Math.round(y * 2 - im.height / 2) / 2, im.width / 2, im.height / 2); return; }
  for (let a = 0; a < Math.PI * 2; a += 0.12) rect(g, x + Math.cos(a) * 12, y + Math.sin(a) * 12, 1, 1, '#a46be0');
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    thick(g, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * 9, y + Math.sin(a) * 9, 1, '#7d4fb0');
  }
  rect(g, x - 1, y - 1, 3, 3, '#d9b8ff');
}

// Фон из картинки: одна картинка на всю комнату или плитка, повторённая с зеркалом (tile).
// Двери поверх плитки рисуются кодом; на целой картинке двери уже нарисованы.
export function buildImageRoom(room, img, height, floorTop) {
  const c = document.createElement('canvas');
  c.width = room.length;
  c.height = height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (!room.tile) {
    g.drawImage(img, 0, 0);
    return c;
  }
  for (let i = 0; i * room.tile < room.length; i++) {
    const x = i * room.tile;
    if (i % 2) {
      g.save();
      g.translate(x + room.tile, 0);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    } else g.drawImage(img, x, 0);
  }
  for (const d of room.doors ?? []) drawDoor(g, d, floorTop);
  return c;
}

// Решётка камеры в торце: за ней темнота, прутья во всю высоту стены.
function drawGateWall(g, x0, floorTop) {
  rect(g, x0, 0, 26, floorTop, '#0f0c18');
  const im = objImg('gate_bars');
  if (im) {
    // решётка картинкой (v0.68): прутья от пола до потолка, за ними темнота коридора
    for (let b = floorTop; b > 0; b -= im.height / 2) drawObj(g, im, x0 + 13, b);
    return;
  }
  rect(g, x0 + (x0 ? 0 : 23), 0, 3, floorTop, PAL.wallDark);
  for (let x = x0 + 3; x < x0 + 26; x += 4) rect(g, x, 0, 1, floorTop, '#5b6b86');
  for (const yy of [18, 60, 100]) rect(g, x0, yy, 26, 2, '#45424f');
}

// Открытая дверь решётки — распахнута к зрителю, рисуется поверх бойцов.
// wall — створка распахнута наружу и прислонена к стене коридора рядом с решёткой (v0.74, владелец: в Темнице
// дверь камеры «стояла посреди коридора»); иначе — к зрителю, поверх бойцов (так она видна изнутри камеры)
export function drawGatePanel(g, x, floorTop, H, dir, wall = false) {
  const im = objImg('gate_door');
  if (im) {
    // распахнутая дверь решётки картинкой: петли у стены (x), створка к зрителю
    const k = wall ? 1 : 1.3, w = im.width / 2 * k, h = im.height / 2 * k, b = wall ? floorTop + 2 : Math.min(H - 3, floorTop + 36);   // выше рыцаря
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), 0);
    if (dir < 0) g.scale(-1, 1);
    g.globalAlpha = 0.95;
    g.drawImage(im, 0, b - h, w, h);
    g.restore();
    return;
  }
  const top = floorTop + 4, bottom = H - 3;
  g.globalAlpha = 0.9;
  for (let i = 0; i < 6; i++) {
    const px = x + dir * i * 4;
    thick(g, px, top + i, px, bottom - i, 1, '#5b6b86');
  }
  thick(g, x, top, x + dir * 20, top + 5, 1, '#3b3550');
  thick(g, x, Math.round((top + bottom) / 2), x + dir * 20, Math.round((top + bottom) / 2) + 2, 1, '#3b3550');
  thick(g, x, bottom, x + dir * 20, bottom - 5, 1, '#3b3550');
  g.globalAlpha = 1;
}

// Открывающаяся дверь: проём темнеет, створка уходит внутрь (k от 0 до 1).
// Дверь открывается (v0.71): створка — вырезка из той же картинки закрытой двери (раньше были отдельные кадры
// PixelLab — другая, двустворчатая дверь: казалось, что поверх появляется вторая дверь). За створкой — тёмный проём,
// створка поворачивается на петле слева внутрь: сжимается к петле, темнеет, у свободного края виден торец.
// Арка проёма в пикселях картинки: L, R — края, T — верх свода, S — где кончается скругление
const DOOR_LEAF = { wood: { L: 10, R: 52, T: 11, S: 30 }, iron: { L: 10, R: 60, T: 11, S: 30 } };
const doorParts = {};
function doorPart(kind) {
  if (doorParts[kind]) return doorParts[kind];
  const im = objImg('door_' + kind), a = DOOR_LEAF[kind];
  if (!im || !a) return null;
  const w = a.R - a.L + 1, h = im.height - a.T;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const [leaf, lx] = mk(), [dark, dx] = mk(), [hole, hx] = mk();
  const half = w / 2;
  for (let y = 0; y < h; y++) {
    // ширина строки свода: полуэллипс от T до S, ниже — во всю ширину
    const u = y + a.T < a.S ? (a.S - a.T - y) / (a.S - a.T) : 0;
    const hw = Math.round(half * Math.sqrt(Math.max(0, 1 - u * u)));
    if (hw < 1) continue;
    const l = Math.round(half - hw);
    lx.drawImage(im, a.L + l, a.T + y, hw * 2, 1, l, y, hw * 2, 1);
    // проём: почти чёрный, к полу чуть светлее (там коридор)
    const t = y / h;
    hx.fillStyle = `rgb(${8 + t * 14 | 0},${6 + t * 10 | 0},${14 + t * 14 | 0})`;
    hx.fillRect(l, y, hw * 2, 1);
  }
  dx.drawImage(leaf, 0, 0);
  dx.globalCompositeOperation = 'source-in';
  dx.fillStyle = '#0a0812';
  dx.fillRect(0, 0, w, h);
  return (doorParts[kind] = { leaf, dark, hole, w, h, im, a });
}

// k: 0 — закрыта, 1 — распахнута
export function drawDoorOpen(g, d, floorTop, cam, k) {
  const kind = d.kind === 'iron' ? 'iron' : d.kind === 'wood' || !d.kind ? 'wood' : null;
  const part = kind && doorPart(kind);
  if (part) {
    if (k <= 0.02) return;
    const { leaf, dark, hole, w, h, im, a } = part;
    const x0 = Math.round(d.x - cam) - im.width / 4 + a.L / 2, y0 = floorTop - im.height / 2 + a.T / 2;
    const lw = w / 2, lh = h / 2;
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(hole, x0, y0, lw, lh);
    const e = k * k * (3 - 2 * k), th = e * 1.38;           // угол створки, до ~80°
    const ww = Math.max(0.5, Math.round(lw * Math.cos(th) * 2) / 2);
    g.drawImage(leaf, x0, y0, ww, lh);
    g.globalAlpha = 0.65 * Math.sin(th);                     // уходит от света — темнеет
    g.drawImage(dark, x0, y0, ww, lh);
    g.globalAlpha = 1;
    if (th > 0.15) g.drawImage(dark, w - 2, 0, 2, h, x0 + ww, y0, 1, lh);   // торец створки
    g.restore();
    return;
  }
  const x0 = Math.round(d.x - DOOR_W / 2 - cam), top = floorTop - DOOR_H;
  const w = Math.round(DOOR_W * k);
  rect(g, x0, top, w, DOOR_H, '#050409');
}

export function drawTorches(g, camX, xs, time, blue = false, flare = 0) {
  for (const x of xs) {
    const sx = Math.round(x - camX);
    if (sx < -50 || sx > 370) continue;
    const glow = g.createRadialGradient(sx, 69, 1, sx, 69, 38);
    glow.addColorStop(0, blue ? 'rgba(90,170,255,0.26)' : 'rgba(255,170,80,0.22)');
    glow.addColorStop(1, blue ? 'rgba(90,170,255,0)' : 'rgba(255,170,80,0)');
    g.fillStyle = glow;
    g.fillRect(sx - 38, 31, 76, 76);

    // факел вдвое мельче (просьба владельца, v0.61): рисуется в полупикселях мира = пикселях экрана
    g.save();
    g.translate(sx, 72);
    g.scale(0.5, 0.5);
    g.fillStyle = '#3a3240';
    g.fillRect(-1, 4, 2, 6);            // кронштейн
    g.fillStyle = PAL.wood;
    g.fillRect(-2, 0, 4, 5);
    g.fillStyle = PAL.gold;
    g.fillRect(-3, -1, 6, 1);
    g.restore();
    // пламя — живой огонь (src/fire.js) в пикселях экрана, размером с прежний (факелы мелкие — просьба владельца)
    drawFire(g, getFire('torch:' + x + (blue ? ':b' : ''), { w: 7, h: 14, base: 0.9, tall: 0.8, px: 1, blue }), sx, 71, time);
    if (flare > 0.02) {
      // вспышка: огонь раздувается, как от плеснутого масла, и опадает
      const fl = getFire('flare:' + x + (blue ? ':b' : ''), { w: 16, h: 36, base: 0.95, tall: 0.95, px: 1, blue });
      g.save(); g.globalAlpha = flare; drawFire(g, fl, sx, 71 + 1, time); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(sx, 64, 1, sx, 64, 30 * flare + 6);
      gr.addColorStop(0, blue ? `rgba(170,220,255,${0.6 * flare})` : `rgba(255,220,150,${0.6 * flare})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(sx - 40, 24, 80, 80); g.restore();
    }
  }
}

// Мерцание огня поверх нарисованных факелов: тёплый ореол и яркая точка пламени.
export function drawFlames(g, camX, flames, time) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [x, y] of flames) {
    const sx = Math.round(x - camX);
    if (sx < -40 || sx > 360) continue;
    const f = 0.75 + 0.25 * Math.sin(time * 9 + x) * Math.sin(time * 13 + y);
    const gr = g.createRadialGradient(sx, y, 1, sx, y, 26);
    gr.addColorStop(0, `rgba(255,150,60,${0.22 * f})`);
    gr.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = gr;
    g.fillRect(sx - 26, y - 26, 52, 52);
  }
  g.restore();
  for (const [x, y] of flames) {
    const sx = Math.round(x - camX);
    const flick = Math.floor(time * 10 + x) % 3;
    rect(g, sx - 1 + (flick === 2 ? 1 : 0), y - 3 - flick, 1, 2, PAL.flame0);
  }
}

// Знак портала на полу: два кольца, руны и звезда. lit — сколько рун горит (0…1), glow — яркость.
export function drawPortal(g, cx, cy, time, lit = 1, glow = 0.5) {
  const rx = 26, ry = 7;
  if (glow > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 60);
    gr.addColorStop(0, `rgba(95,211,255,${0.35 * glow})`);
    gr.addColorStop(1, 'rgba(95,211,255,0)');
    g.fillStyle = gr;
    g.fillRect(cx - 60, cy - 60, 120, 120);
    g.restore();
  }
  const pulse = 0.75 + 0.25 * Math.sin(time * 3);
  g.globalAlpha = Math.max(0.15, lit) * pulse;
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    rect(g, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1, 1, RUNE);
    rect(g, cx + Math.cos(a) * (rx - 6), cy + Math.sin(a) * (ry - 2), 1, 1, RUNE);
  }
  // звезда внутри
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    pts.push([cx + Math.cos(a) * (rx - 7), cy + Math.sin(a) * (ry - 2)]);
  }
  for (let i = 0; i < 5; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 2) % 5];
    thick(g, ax, ay, bx, by, 1, RUNE);
  }
  g.globalAlpha = 1;
  // руны по кругу: загораются по очереди
  const n = 8;
  for (let i = 0; i < n; i++) {
    const on = lit * n > i;
    const a = i * Math.PI * 2 / n + 0.2;
    const x = Math.round(cx + Math.cos(a) * (rx - 3)), y = Math.round(cy + Math.sin(a) * (ry - 1));
    g.globalAlpha = on ? pulse : 0.2;
    rect(g, x - 1, y, 3, 1, on ? RUNE_HOT : RUNE);
    rect(g, x, y - 1, 1, 1, on ? RUNE_HOT : RUNE);
  }
  g.globalAlpha = 1;
}

// Бочки, ящики, мешки и кости — стоят на полу и сортируются по глубине вместе с бойцами.
// живой огонь костра: язычки пляшут, искры летят вверх
function campfireFlames(g, x, gy, time) {
  drawFire(g, getFire('campfire:' + Math.round(gy), { w: 22, h: 38, base: 0.8, tall: 0.85 }), x, gy - 3, time);
  for (let k = 0; k < 3; k++) {
    const t = (time * 0.9 + k * 0.37) % 1;
    rect(g, x + Math.round(Math.sin((time + k) * 3) * 4), gy - 18 - Math.round(t * 22), 1, 1, t < 0.6 ? '#ffd27a' : '#a0442a');
  }
}

export function drawProp(g, type, x, gy, opened = false, time = 0, seed = 0) {
  x = Math.round(x);
  if ((type === 'loot' || type === 'cup') && opened) return;   // подобрали
  if (type === 'campfire' && objImg('prop_campfire')) { drawObj(g, objImg('prop_campfire'), x, gy + 1); campfireFlames(g, x, gy, time); return; }
  if (type === 'cup' && objImg('prop_cup')) {
    // серебряная чаша стоит на столе, поблёскивает
    drawObj(g, objImg('prop_cup'), x, gy - 13);
    if (Math.floor(time * 3) % 3 === 0) rect(g, x + 1, gy - 20, 1, 1, '#ffffff');
    return;
  }
  if (PROP_IMG[type]) {
    const i = Math.abs(Math.round(seed / 10)) % PROP_IMG[type];
    const im = objImg(type === 'chest' && opened ? 'prop_chest_open' : 'prop_' + type + (i ? '_' + i : ''));
    if (im && type === 'chair' && opened) { g.save(); g.translate(x, 0); g.scale(-1, 1); drawObj(g, im, 0, gy + 1); g.restore(); return; }  // стул развёрнут
    if (im) { drawObj(g, im, x, gy + 1); return; }
  }
  if (type === 'barrel') {
    rect(g, x - 5, gy - 13, 10, 13, '#6b4532');
    rect(g, x - 6, gy - 10, 12, 7, '#6b4532');
    rect(g, x - 6, gy - 11, 12, 1, '#3b2a1e');
    rect(g, x - 6, gy - 4, 12, 1, '#3b2a1e');
    rect(g, x - 5, gy - 14, 10, 2, '#8a5a3b');
    rect(g, x + 2, gy - 12, 1, 11, '#7a4f36');
  } else if (type === 'crate') {
    rect(g, x - 6, gy - 11, 12, 11, '#7a5a3a');
    rect(g, x - 6, gy - 11, 12, 1, '#a07a50');
    rect(g, x - 6, gy - 11, 1, 11, '#4a3226');
    rect(g, x + 5, gy - 11, 1, 11, '#4a3226');
    rect(g, x - 6, gy - 1, 12, 1, '#4a3226');
    thick(g, x - 5, gy - 2, x + 4, gy - 10, 1, '#4a3226');
  } else if (type === 'sack') {
    rect(g, x - 4, gy - 8, 9, 8, '#8c7a58');
    rect(g, x - 3, gy - 10, 7, 2, '#8c7a58');
    rect(g, x - 1, gy - 11, 3, 1, '#5a4632');
    rect(g, x - 4, gy - 1, 9, 1, '#6b5a3e');
  } else if (type === 'chest') {
    // сундук: открытый — крышка откинута, внутри темно
    rect(g, x - 8, gy - 9, 16, 9, '#7a4f36');
    rect(g, x - 8, gy - 5, 16, 1, '#3b3550');
    rect(g, x - 8, gy - 1, 16, 1, '#4a3226');
    if (opened) {
      rect(g, x - 8, gy - 15, 16, 4, '#8a5a3b');
      rect(g, x - 7, gy - 10, 14, 1, '#2a1f18');
    } else {
      rect(g, x - 8, gy - 12, 16, 4, '#8a5a3b');
      rect(g, x - 1, gy - 9, 3, 3, PAL.gold);
      rect(g, x, gy - 8, 1, 1, '#3b2a1e');
    }
  } else if (type === 'table') {
    // длинный стол со скатертью и свечами
    rect(g, x - 40, gy - 14, 80, 4, '#6b4532');
    rect(g, x - 40, gy - 14, 80, 1, '#8a5a3b');
    rect(g, x - 36, gy - 10, 3, 10, '#4a3226');
    rect(g, x + 33, gy - 10, 3, 10, '#4a3226');
    rect(g, x - 30, gy - 14, 60, 2, '#d8d0c0');
    for (const cx of [-24, -8, 10, 26]) {
      rect(g, x + cx, gy - 19, 2, 5, '#ece4d0');
      rect(g, x + cx, gy - 21 - (Math.floor(time * 8 + cx) % 2), 2, 2, PAL.flame1);
      rect(g, x + cx, gy - 21, 1, 1, PAL.flame0);
    }
    rect(g, x - 18, gy - 15, 6, 1, '#a39d8a');  // тарелки
    rect(g, x + 14, gy - 15, 6, 1, '#a39d8a');
  } else if (type === 'sofa') {
    // продавленный диван Лики: спинка, подлокотники, две подушки, заплатка
    rect(g, x - 18, gy - 18, 36, 9, '#5a2a3a');
    rect(g, x - 18, gy - 18, 36, 1, '#7a3a4e');
    rect(g, x - 20, gy - 12, 5, 10, '#4a2230'); rect(g, x + 15, gy - 12, 5, 10, '#4a2230');
    rect(g, x - 15, gy - 10, 15, 5, '#6a3446'); rect(g, x + 1, gy - 10, 14, 5, '#6a3446');
    rect(g, x - 15, gy - 10, 15, 1, '#8a4a5e'); rect(g, x + 1, gy - 10, 14, 1, '#8a4a5e');
    rect(g, x - 16, gy - 5, 32, 3, '#4a2230');
    rect(g, x + 6, gy - 16, 5, 4, '#8a7a58');  // заплатка
    rect(g, x - 17, gy - 2, 2, 2, '#3b2a1e'); rect(g, x + 15, gy - 2, 2, 2, '#3b2a1e');
  } else if (type === 'guardtable') {
    // грубый стол караула: кости, кружки, огарок
    rect(g, x - 22, gy - 13, 44, 3, '#6b4532');
    rect(g, x - 22, gy - 13, 44, 1, '#8a5a3b');
    rect(g, x - 19, gy - 10, 3, 10, '#4a3226');
    rect(g, x + 16, gy - 10, 3, 10, '#4a3226');
    rect(g, x - 12, gy - 17, 4, 4, '#8a7a6a'); rect(g, x - 12, gy - 17, 4, 1, '#a89a8a');  // кружка
    rect(g, x - 8, gy - 16, 1, 2, '#8a7a6a');
    rect(g, x + 8, gy - 16, 3, 3, '#8a7a6a');
    rect(g, x - 2, gy - 15, 2, 2, '#e8e0d0'); rect(g, x + 2, gy - 15, 2, 2, '#e8e0d0');      // кости
    rect(g, x - 2, gy - 15, 1, 1, '#14101e'); rect(g, x + 3, gy - 14, 1, 1, '#14101e');
    rect(g, x + 14, gy - 18, 2, 5, '#ece4d0');
    rect(g, x + 14, gy - 20 - (Math.floor(time * 8) % 2), 2, 2, PAL.flame1);
  } else if (type === 'armchair') {
    // кресло начальника стражи: высокая спинка, подлокотники, красная обивка
    rect(g, x - 9, gy - 24, 18, 16, '#4a3226'); rect(g, x - 7, gy - 22, 14, 12, '#7a2633');
    rect(g, x - 10, gy - 11, 20, 4, '#5a3a28'); rect(g, x - 8, gy - 11, 16, 2, '#8e2b3a');
    rect(g, x - 11, gy - 14, 3, 14, '#4a3226'); rect(g, x + 8, gy - 14, 3, 14, '#4a3226');
    rect(g, x - 9, gy - 25, 18, 1, PAL.gold);
  } else if (type === 'bench') {
    // каменная скамья
    rect(g, x - 16, gy - 8, 32, 4, '#6a6288'); rect(g, x - 16, gy - 8, 32, 1, '#8a82a8');
    rect(g, x - 13, gy - 4, 5, 4, '#4f4868'); rect(g, x + 8, gy - 4, 5, 4, '#4f4868');
  } else if (type === 'pew') {
    // церковная скамья: сплошная спинка, сиденье, боковины со скруглённым верхом
    rect(g, x - 17, gy - 17, 34, 7, '#5a3a28');
    rect(g, x - 17, gy - 17, 34, 1, '#7a5238');
    rect(g, x - 17, gy - 10, 34, 3, '#6b4532');
    rect(g, x - 17, gy - 10, 34, 1, '#8a5a3b');
    for (const sx of [x - 19, x + 16]) {
      rect(g, sx, gy - 18, 3, 18, '#4a3226');
      rect(g, sx, gy - 19, 3, 1, '#5a3a28');
    }
    rect(g, x - 17, gy - 7, 34, 1, '#3b2a1e');
  } else if (type === 'altar' && objImg('prop_altar')) {
    // алтарь картинкой; свечи и чаша — живые, по верху алтаря
    const im = objImg('prop_altar');
    drawObj(g, im, x, gy + 1);
    const top = Math.round(gy + 1 - im.height / 2) + 2;
    for (const cx of [-12, 10]) {
      rect(g, x + cx, top - 5, 2, 5, '#ece4d0');
      rect(g, x + cx, top - 7 - (Math.floor(time * 6 + cx) % 2), 2, 2, PAL.flame1);
    }
    rect(g, x - 3, top - 2, 6, 2, '#a8822e');  // подставка
    if (opened) {
      rect(g, x - 1, top - 7, 3, 3, '#d8dde6'); rect(g, x, top - 4, 1, 2, '#a3aab4');
      if (Math.floor(time * 3) % 3 === 0) rect(g, x + 1, top - 8, 1, 1, '#ffffff');
    }
  } else if (type === 'altar') {
    // алтарь: каменная плита, белое покрывало, свечи; на подставке — чаша, если поставили (opened)
    rect(g, x - 16, gy - 16, 32, 16, '#6a6288');
    rect(g, x - 16, gy - 16, 32, 1, '#8a82a8');
    rect(g, x - 13, gy - 15, 26, 9, '#e8e0d0');
    rect(g, x - 2, gy - 13, 4, 6, PAL.gold);
    for (const cx of [-12, 10]) {
      rect(g, x + cx, gy - 21, 2, 5, '#ece4d0');
      rect(g, x + cx, gy - 23 - (Math.floor(time * 6 + cx) % 2), 2, 2, PAL.flame1);
    }
    rect(g, x - 3, gy - 18, 6, 2, '#a8822e');  // подставка
    if (opened) {
      rect(g, x - 1, gy - 23, 3, 3, '#d8dde6'); rect(g, x, gy - 20, 1, 2, '#a3aab4');
      if (Math.floor(time * 3) % 3 === 0) rect(g, x + 1, gy - 24, 1, 1, '#ffffff');
    }
  } else if (type === 'desk') {
    // стол для чтения: раскрытая книга, свеча, чернильница
    rect(g, x - 16, gy - 13, 32, 3, '#6b4532');
    rect(g, x - 16, gy - 13, 32, 1, '#8a5a3b');
    rect(g, x - 14, gy - 10, 2, 10, '#4a3226'); rect(g, x + 12, gy - 10, 2, 10, '#4a3226');
    rect(g, x - 7, gy - 15, 6, 2, '#e8dcb8'); rect(g, x, gy - 15, 6, 2, '#e0d4b0'); rect(g, x - 1, gy - 15, 1, 2, '#8a7a58');
    rect(g, x - 6, gy - 15, 4, 1, '#6b5a4a'); rect(g, x + 1, gy - 14, 4, 1, '#6b5a4a');
    rect(g, x + 9, gy - 18, 2, 5, '#ece4d0');
    rect(g, x + 9, gy - 20 - (Math.floor(time * 7) % 2), 2, 2, PAL.flame1);
    rect(g, x - 13, gy - 15, 2, 2, '#1c1828');
  } else if (type === 'stool') {
    rect(g, x - 4, gy - 7, 8, 2, '#6b4532');
    rect(g, x - 3, gy - 5, 1, 5, '#4a3226');
    rect(g, x + 2, gy - 5, 1, 5, '#4a3226');
  } else if (type === 'chair') {
    const f = opened ? -1 : 1;
    rect(g, x - 4, gy - 8, 8, 2, '#6b4532');
    rect(g, x - 4, gy - 6, 1, 6, '#4a3226');
    rect(g, x + 3, gy - 6, 1, 6, '#4a3226');
    rect(g, f > 0 ? x - 4 : x + 3, gy - 18, 1, 10, '#4a3226');
  } else if (type === 'cup') {
    // серебряная чаша на столе, поблёскивает; взятую не рисуем
    if (opened) return;
    rect(g, x - 1, gy - 20, 3, 3, '#d8dde6');
    rect(g, x, gy - 17, 1, 2, '#a3aab4');
    rect(g, x - 1, gy - 15, 3, 1, '#d8dde6');
    if (Math.floor(time * 3) % 3 === 0) rect(g, x + 1, gy - 21, 1, 1, '#ffffff');
  } else if (type === 'letter') {
    rect(g, x - 3, gy - 2, 7, 2, '#e3d6b6');
    rect(g, x - 3, gy - 2, 7, 1, '#f2e8d0');
    rect(g, x, gy - 2, 2, 1, '#9a2f2f');  // сорванная печать
  } else if (type === 'candles') {
    for (const [dx, h] of [[-4, 6], [0, 9], [3, 5], [6, 7]]) {
      rect(g, x + dx, gy - h, 2, h, '#e8dcc0');
      if ((Math.floor(time * 7) + dx) % 3) rect(g, x + dx, gy - h - 2, 2, 2, '#ffd27a');
    }
    rect(g, x - 6, gy - 1, 15, 1, '#c9bc9c');  // натёкший воск
  } else if (type === 'lute') {
    rect(g, x - 5, gy - 5, 7, 5, '#a0703a');
    rect(g, x - 4, gy - 6, 5, 1, '#b8854a');
    rect(g, x - 2, gy - 3, 1, 1, '#2a1e14');  // розетка
    thick(g, x + 2, gy - 3, x + 10, gy - 6, 1, '#6b4532');  // гриф
    rect(g, x + 9, gy - 8, 2, 2, '#4a3226');
  } else if (type === 'logbook') {
    rect(g, x - 6, gy - 3, 12, 3, '#5a2f2a');
    rect(g, x - 5, gy - 4, 5, 1, '#e3d6b6'); rect(g, x + 1, gy - 4, 5, 1, '#e3d6b6');
    rect(g, x, gy - 4, 1, 1, '#3a2018');
  } else if (type === 'bouquet') {
    thick(g, x - 2, gy - 1, x - 3, gy - 8, 1, '#6b6040');
    thick(g, x, gy - 1, x + 1, gy - 9, 1, '#6b6040');
    thick(g, x + 2, gy - 1, x + 4, gy - 7, 1, '#6b6040');
    for (const [dx, dy] of [[-3, -9], [1, -10], [4, -8]]) rect(g, x + dx, gy + dy, 2, 2, '#8a6070');
    rect(g, x - 2, gy - 3, 5, 1, '#c0505a');  // лента
  } else if (type === 'loot') {
    // свёрток на полу: что-то оставили мародёры; поблёскивает, пока не взят
    if (opened) return;
    rect(g, x - 5, gy - 4, 10, 4, '#6b5a44');
    rect(g, x - 4, gy - 5, 8, 1, '#8a7656');
    rect(g, x - 1, gy - 5, 2, 5, '#3e3226');
    if (Math.floor(time * 2.5) % 4 === 0) rect(g, x + 3, gy - 6, 1, 1, '#fff4c2');
  } else if (type === 'campfire') {
    // костёр: камни кольцом, скрещённые поленья, пламя мерцает, искры летят вверх
    for (const [dx, c] of [[-9, '#5a5560'], [-6, '#6e6874'], [6, '#6e6874'], [9, '#5a5560'], [-3, '#4a4550'], [3, '#4a4550']]) rect(g, x + dx - 1, gy - 2, 3, 2, c);
    thick(g, x - 7, gy - 1, x + 6, gy - 5, 2, '#5b3a24');
    thick(g, x + 7, gy - 1, x - 6, gy - 5, 2, '#6b4532');
    campfireFlames(g, x, gy, time);
  } else if (type === 'bedroll') {
    rect(g, x - 12, gy - 3, 24, 3, '#6a3b3b');
    rect(g, x - 12, gy - 4, 24, 1, '#8a5050');
    rect(g, x + 8, gy - 6, 6, 4, '#c9b48a');  // свёрнутое одеяло-подушка
  } else if (type === 'pot') {
    rect(g, x - 4, gy - 7, 9, 6, '#3a3640');
    rect(g, x - 5, gy - 7, 11, 1, '#55505e');
    rect(g, x - 3, gy - 1, 7, 1, '#2a2630');
  } else if (type === 'bones') {
    rect(g, x - 2, gy - 3, 4, 3, '#d9d4c3');
    rect(g, x - 1, gy - 2, 1, 1, '#14101e');
    thick(g, x + 3, gy - 1, x + 10, gy - 2, 1, '#bdb6a2');
    thick(g, x - 8, gy, x - 3, gy - 1, 1, '#bdb6a2');
  }
}

// Паутина в углу экрана: лучи из угла и провисшие нити. dx, dy — куда растёт (±1).
export function drawCobweb(g, x, y, dx, dy, size) {
  g.globalAlpha = 0.35;
  const rays = [0.1, 0.45, 0.8, 1.2, 1.45];
  const ends = rays.map(a => [x + dx * Math.cos(a) * size, y + dy * Math.sin(a) * size]);
  for (const [ex, ey] of ends) thick(g, x, y, ex, ey, 1, '#d6d6e6');
  for (const r of [0.35, 0.6, 0.85]) {
    for (let i = 0; i < ends.length - 1; i++) {
      const ax = x + (ends[i][0] - x) * r, ay = y + (ends[i][1] - y) * r;
      const bx = x + (ends[i + 1][0] - x) * r, by = y + (ends[i + 1][1] - y) * r;
      const mx = (ax + bx) / 2 + dx * 1.5, my = (ay + by) / 2 + dy * 1.5;  // нить провисает к углу
      thick(g, ax, ay, mx, my, 1, '#d6d6e6');
      thick(g, mx, my, bx, by, 1, '#d6d6e6');
    }
  }
  g.globalAlpha = 1;
}

// Темнота: экран заливается почти чёрным, свет вырезает в ней пятна. lights: [{ x, y, r, a }].
const shade = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function drawDarkness(g, W, H, lights, depth = 0.82) {
  shade.width = W;
  shade.height = H;
  const s = shade.getContext('2d');
  s.fillStyle = `rgba(5,4,10,${depth})`;
  s.fillRect(0, 0, W, H);
  s.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const gr = s.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r);
    gr.addColorStop(0, `rgba(0,0,0,${l.a ?? 1})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = gr;
    s.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  s.globalCompositeOperation = 'source-over';
  g.drawImage(shade, 0, 0);
}
