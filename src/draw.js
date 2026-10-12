// Простые пиксельные примитивы и фигуры-заглушки. Позже их заменят спрайты.

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

function withAlpha(g, a, fn) {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * a;
  fn();
  g.globalAlpha = prev;
}

// Боец: x — точка между ступнями, facing 1 — смотрит вправо, -1 — влево.
// Возвращает острие и кисть (для блика и шлейфа).
export function drawFigure(g, o) {
  const {
    x, ground, facing: f, pose, colors, step = 0, plume = false, weaponLen = 17,
    bladeHidden = false, scabbard = false, shield = false, skull = false,
    bow = false, bowDraw = 0, airY = 0, trail = null, face = false, rapier = false,
  } = o;
  const gy = ground - airY;
  const hipX = x;
  const hipY = gy - 13 + pose.crouch;
  const shX = hipX + pose.lean * f;
  const shY = hipY - 12;

  // ноги
  const s = Math.round(Math.sin(step) * 3);
  thick(g, hipX - 2 * f, hipY, hipX - 2 * f - s * f, gy - 2, 3, colors.armorDark);
  thick(g, hipX + 2 * f, hipY, hipX + 2 * f + s * f, gy - 2, 3, colors.armor);
  rect(g, hipX - 3 * f - s * f - 1, gy - 2, 4, 2, colors.boots);
  rect(g, hipX + 2 * f + s * f - 1, gy - 2, 4, 2, colors.boots);

  // корпус и табард (у скелета — тёмные просветы между рёбрами)
  thick(g, hipX, hipY - 3, shX, shY + 3, skull ? 6 : 8, colors.armor);
  thick(g, hipX + f, hipY - 1, (hipX + shX) / 2 + f, shY + 5, skull ? 2 : 4, colors.tabard);

  // ножны на поясе
  if (scabbard) {
    thick(g, hipX - f, hipY - 1, hipX - 9 * f, hipY + 6, 2, colors.scabbard);
    if (bladeHidden) {
      rect(g, hipX - f, hipY - 5, 1, 4, colors.hilt);
      rect(g, hipX - f - 1, hipY - 2, 3, 1, colors.hilt);
    }
  }

  // голова
  const headX = shX - 3 + f;
  const headY = shY - 9;
  if (face) {
    // лицо без шлема: длинные чёрные волосы ниже плеч, щетина, тонкие усы и бородка
    const back = f > 0 ? headX : headX + 5;
    rect(g, back, headY + 1, 2, 12, colors.hair);
    rect(g, headX, headY, 7, 7, colors.helm);
    rect(g, headX, headY - 1, 7, 2, colors.hair);
    rect(g, back, headY + 1, 2, 4, colors.hair);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 2, 1, 1, colors.visor);
    rect(g, f > 0 ? headX + 4 : headX + 1, headY + 4, 2, 1, colors.hair);
    rect(g, f > 0 ? headX + 3 : headX + 1, headY + 6, 3, 1, colors.hair);
  } else if (skull) {
    rect(g, headX, headY + 1, 7, 6, colors.helm);
    rect(g, f > 0 ? headX + 4 : headX + 1, headY + 3, 2, 2, colors.visor);
    rect(g, f > 0 ? headX + 3 : headX + 1, headY + 6, 3, 1, colors.armorDark);
  } else {
    rect(g, headX, headY, 7, 8, colors.helm);
    rect(g, f > 0 ? headX + 3 : headX, headY + 3, 4, 1, colors.visor);
  }
  if (plume) {
    rect(g, headX + 2, headY - 2, 3, 2, colors.plume);
    rect(g, headX + (f > 0 ? -1 : 4), headY - 1, 4, 2, colors.plume);
  }

  // щит перед корпусом
  if (shield) {
    rect(g, f > 0 ? shX + 3 : shX - 7, shY + 1, 4, 11, colors.shield);
    rect(g, f > 0 ? shX + 3 : shX - 7, shY + 1, 4, 1, colors.hilt);
  }

  // рука
  const handX = shX + pose.hx * f;
  const handY = shY + 2 + pose.hy;
  thick(g, shX + f, shY + 2, handX, handY, 2, colors.armorDark);
  const a = pose.angle * Math.PI / 180;
  const dx = Math.cos(a) * f, dy = Math.sin(a);

  if (bow) {
    // лук поперёк линии прицела, тетива оттягивается к плечу
    const px = -dy, py = dx;
    const top = [handX + px * 8 - dx * 2, handY + py * 8 - dy * 2];
    const bot = [handX - px * 8 - dx * 2, handY - py * 8 - dy * 2];
    const mid = [handX + dx * 2, handY + dy * 2];
    thick(g, top[0], top[1], mid[0], mid[1], 1, colors.blade);
    thick(g, mid[0], mid[1], bot[0], bot[1], 1, colors.blade);
    const pull = [handX - dx * (2 + bowDraw * 6), handY - dy * (2 + bowDraw * 6)];
    thick(g, top[0], top[1], pull[0], pull[1], 1, colors.helm);
    thick(g, pull[0], pull[1], bot[0], bot[1], 1, colors.helm);
    if (bowDraw > 0.2) thick(g, pull[0], pull[1], handX + dx * 5, handY + dy * 5, 1, colors.armorDark);
    return { tipX: handX + dx * 5, tipY: handY + dy * 5, handX, handY };
  }

  const tipX = handX + dx * weaponLen, tipY = handY + dy * weaponLen;
  if (!bladeHidden) {
    if (trail) for (const [i, p] of trail.entries()) {
      withAlpha(g, 0.15 + 0.12 * i, () => thick(g, handX, handY, p.tipX, p.tipY, 1, '#ffffff'));
    }
    thick(g, handX + dx * 2, handY + dy * 2, tipX, tipY, 1, colors.blade);
    const gx = handX + dx * 2, gyy = handY + dy * 2;
    if (rapier) {
      // чашка гарды вокруг кисти
      rect(g, handX - 1, handY - 1, 3, 3, colors.hilt);
    } else {
      thick(g, gx - dy * 2, gyy + dx * 2, gx + dy * 2, gyy - dx * 2, 1, colors.hilt);
    }
    rect(g, handX - dx * 2, handY - dy * 2, 1, 1, colors.hilt);
  }
  return { tipX, tipY, handX, handY };
}

export function drawSlime(g, { x, ground, airY, size, squash, colors, facing, holding }) {
  const w = Math.max(6, Math.round(16 * size * (1 + squash * 0.6)));
  const h = Math.max(4, Math.round(11 * size * (1 - squash * 0.5)));
  const base = Math.round(ground - airY);
  if (airY > 2) rect(g, x - w * 0.3, ground - 1, Math.round(w * 0.6), 1, '#1e1a2b');
  for (let r = 0; r < h; r++) {
    const yy = (h - r) / h;
    const hw = (w / 2) * Math.sqrt(Math.max(0, 1 - yy * yy * 0.92));
    const x0 = Math.round(x - hw), x1 = Math.round(x + hw);
    if (x1 <= x0) continue;
    rect(g, x0, base - h + r, x1 - x0, 1, r === h - 1 ? colors.dark : colors.body);
    rect(g, x1 - 1, base - h + r, 1, 1, colors.dark);
  }
  if (holding) {
    rect(g, x - 2, base - h * 0.75, 4, 7, '#5b6b86');
    rect(g, x - 1, base - h * 0.75 - 2, 2, 2, '#e8454f');
  }
  rect(g, x - w * 0.25, base - h * 0.75, 2, 1, colors.light);
  const ex = Math.round(x + facing * w * 0.12);
  rect(g, ex - 2, base - h * 0.55, 1, 2, colors.eye);
  rect(g, ex + 2, base - h * 0.55, 1, 2, colors.eye);
}

// Стрела по направлению полёта; воткнувшаяся — наклонно в полу.
export function drawArrow(g, x, y, vx, vy, stuck = false) {
  const len = Math.hypot(vx, vy) || 1;
  const ux = stuck ? 0.6 : vx / len, uy = stuck ? 0.8 : vy / len;
  thick(g, x - ux * 7, y - uy * 7, x, y, 1, '#a39d8a');
  rect(g, x, y, 1, 1, '#e6e1d0');
  rect(g, x - ux * 7 - uy, y - uy * 7 + ux, 1, 1, '#e8454f');
  rect(g, x - ux * 7 + uy, y - uy * 7 - ux, 1, 1, '#e8454f');
}

// Те же цвета, но всё белое — вспышка при попадании.
export function flashColors(colors) {
  const out = {};
  for (const k in colors) out[k] = '#fff4e8';
  return out;
}
