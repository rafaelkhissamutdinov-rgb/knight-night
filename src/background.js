import { PAL } from './palette.js';
import { rect, thick } from './draw.js';

// Декорации комнат: стена с колоннами и дверями, пол с глубиной, факелы, портал на полу,
// бочки и ящики, решётка камеры, паутина и темнота. Фон комнаты рисуется один раз во всю её длину.

export const DOOR_W = 22, DOOR_H = 36;
const RUNE = '#5fd3ff', RUNE_HOT = '#c8f4ff';

// floorTop — где стена встречается с полом; ниже — пол с глубиной (дальние ряды плиток уже).
export function buildRoom(room, height, floorTop) {
  const length = room.length;
  const c = document.createElement('canvas');
  c.width = length;
  c.height = height;
  const g = c.getContext('2d');
  const wallBottom = floorTop;
  let seed = 7 + length;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  g.fillStyle = PAL.mortar;
  g.fillRect(0, 0, length, wallBottom);
  for (let row = 0; row * 8 < wallBottom; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < length; x += 16) {
      const y = row * 8;
      g.fillStyle = rand() < 0.12 ? PAL.wallDark : PAL.wall;
      g.fillRect(x, y, 15, 7);
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
  const doors = room.doors ?? [];
  // колонны (не там, где двери и решётка)
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
  for (const d of doors) drawDoor(g, d, floorTop);
  if (room.gate) drawGateWall(g, room.gate === 'right' ? length - 26 : 0, floorTop);
  if (room.stairs) drawStairs(g, room.stairsX ?? (room.stairs === 'right' ? length - 70 : length / 2 - 40), floorTop);
  if (room.balcony) drawBalcony(g, length, height, floorTop, rand);
  if (room.magic) {
    // вершина башни: стены в лиловом отсвете, на стене знаки
    g.fillStyle = 'rgba(120,60,170,0.18)';
    g.fillRect(0, 0, length, height);
    for (let x = 90; x < length - 40; x += 140) drawSigil(g, x, 46);
  }
  return c;
}

// Дверь в задней стене: деревянная, решётчатая (камера) или железная.
export function drawDoor(g, d, floorTop) {
  if (d.kind === 'none') return;  // проход без двери (например, у подножия лестницы)
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
function drawStairs(g, x0, floorTop) {
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
  rect(g, x0 + (x0 ? 0 : 23), 0, 3, floorTop, PAL.wallDark);
  for (let x = x0 + 3; x < x0 + 26; x += 4) rect(g, x, 0, 1, floorTop, '#5b6b86');
  for (const yy of [18, 60, 100]) rect(g, x0, yy, 26, 2, '#45424f');
}

// Открытая дверь решётки — распахнута к зрителю, рисуется поверх бойцов.
export function drawGatePanel(g, x, floorTop, H, dir) {
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
export function drawDoorOpen(g, d, floorTop, cam, k) {
  const x0 = Math.round(d.x - DOOR_W / 2 - cam), top = floorTop - DOOR_H;
  const w = Math.round(DOOR_W * k);
  rect(g, x0, top, w, DOOR_H, '#050409');
}

export function drawTorches(g, camX, xs, time) {
  for (const x of xs) {
    const sx = Math.round(x - camX);
    if (sx < -50 || sx > 370) continue;
    const glow = g.createRadialGradient(sx, 66, 2, sx, 66, 46);
    glow.addColorStop(0, 'rgba(255,170,80,0.22)');
    glow.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = glow;
    g.fillRect(sx - 46, 20, 92, 92);

    g.fillStyle = PAL.wood;
    g.fillRect(sx - 2, 72, 4, 4);
    g.fillStyle = PAL.gold;
    g.fillRect(sx - 3, 71, 6, 1);
    const flick = Math.floor(time * 10 + x) % 3;
    const h = 6 + flick;
    for (let i = 0; i < h; i++) {
      const w = i < 2 ? 4 : i < h - 2 ? 3 : 1;
      const sway = i > h - 3 ? (flick - 1) : 0;
      g.fillStyle = i < 3 ? PAL.flame0 : i < h - 2 ? PAL.flame1 : PAL.flame2;
      g.fillRect(sx - Math.floor(w / 2) + sway, 70 - i, w, 1);
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
export function drawProp(g, type, x, gy, opened = false, time = 0) {
  x = Math.round(x);
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
