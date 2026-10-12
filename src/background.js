import { PAL } from './palette.js';

const TORCH_STEP = 160;

// Коридор подземелья рисуется один раз во всю длину уровня.
// floorTop — где стена встречается с полом; ниже — пол с глубиной (дальние ряды плиток уже).
export function buildBackground(length, height, floorTop) {
  const c = document.createElement('canvas');
  c.width = length;
  c.height = height;
  const g = c.getContext('2d');
  const wallBottom = floorTop;
  let seed = 7;
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
  // колонны
  for (let x = 120; x < length; x += 240) {
    g.fillStyle = PAL.wallDark;
    g.fillRect(x - 1, 0, 22, wallBottom);
    g.fillStyle = PAL.wallLight;
    g.fillRect(x, 0, 20, wallBottom);
    g.fillStyle = PAL.wall;
    g.fillRect(x + 12, 0, 8, wallBottom);
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
  return c;
}

export function drawTorches(g, camX, time, width) {
  for (let x = 60; x < camX + width + 40; x += TORCH_STEP) {
    if (x < camX - 40) continue;
    const sx = Math.round(x - camX);
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
