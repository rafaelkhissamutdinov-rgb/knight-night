// Простые пиксельные примитивы и фигура бойца. Пока вместо спрайтов — фигуры из прямоугольников и линий.

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

// Линия кистью w×w пикселей (алгоритм Брезенхэма), без сглаживания.
export function thick(g, x0, y0, x1, y1, w, color) {
  g.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  const o = Math.floor(w / 2);
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Боец: x — точка между ступнями, facing 1 — смотрит вправо, -1 — влево.
// Возвращает координаты острия клинка (для блика).
export function drawFigure(g, { x, ground, facing: f, pose, colors, step = 0, plume = false }) {
  const hipX = x;
  const hipY = ground - 13 + pose.crouch;
  const shX = hipX + pose.lean * f;
  const shY = hipY - 12;

  // ноги
  const s = Math.round(Math.sin(step) * 3);
  thick(g, hipX - 2 * f, hipY, hipX - 2 * f - s * f, ground - 2, 3, colors.armorDark);
  thick(g, hipX + 2 * f, hipY, hipX + 2 * f + s * f, ground - 2, 3, colors.armor);
  rect(g, hipX - 3 * f - s * f - 1, ground - 2, 4, 2, colors.boots);
  rect(g, hipX + 2 * f + s * f - 1, ground - 2, 4, 2, colors.boots);

  // корпус и табард
  thick(g, hipX, hipY - 3, shX, shY + 3, 8, colors.armor);
  thick(g, hipX + f, hipY - 1, (hipX + shX) / 2 + f, shY + 5, 4, colors.tabard);

  // шлем
  const headX = shX - 3 + f;
  const headY = shY - 9;
  rect(g, headX, headY, 7, 8, colors.helm);
  rect(g, f > 0 ? headX + 3 : headX, headY + 3, 4, 1, colors.visor);
  if (plume) {
    rect(g, headX + 2, headY - 2, 3, 2, colors.plume);
    rect(g, headX + (f > 0 ? -1 : 4), headY - 1, 4, 2, colors.plume);
  }

  // рука и меч
  const handX = shX + pose.hx * f;
  const handY = shY + 2 + pose.hy;
  thick(g, shX + f, shY + 2, handX, handY, 2, colors.armorDark);
  const a = pose.angle * Math.PI / 180;
  const dx = Math.cos(a) * f, dy = Math.sin(a);
  const tipX = handX + dx * 17, tipY = handY + dy * 17;
  thick(g, handX + dx * 2, handY + dy * 2, tipX, tipY, 1, colors.blade);
  const gx = handX + dx * 2, gy = handY + dy * 2;
  thick(g, gx - dy * 2, gy + dx * 2, gx + dy * 2, gy - dx * 2, 1, colors.hilt);
  rect(g, handX - dx * 2, handY - dy * 2, 1, 1, colors.hilt);
  return { tipX, tipY };
}

// Те же цвета, но всё белое — вспышка при попадании.
export function flashColors(colors) {
  const out = {};
  for (const k in colors) out[k] = '#fff4e8';
  return out;
}
