// Простые пиксельные примитивы и фигуры-заглушки. Позже их заменят спрайты.
import { gaitFoot } from './poses.js';

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

// Светлее (k > 0) или темнее (k < 0) цвет #rrggbb — для объёма без новых цветов в палитре.
const shadeCache = new Map();
export function shade(hex, k) {
  const key = hex + k;
  if (shadeCache.has(key)) return shadeCache.get(key);
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  const out = '#' + [n >> 16, (n >> 8) & 255, n & 255].map(ch).map(v => v.toString(16).padStart(2, '0')).join('');
  shadeCache.set(key, out);
  return out;
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
    bow = false, bowDraw = 0, crossbow = false, gaitRun = null, breathe = 0, airY = 0, trail = null, face = false, rapier = false, robe = false,
    offhandBack = false, sit = false, seat = null, wrap = false, curved = false, slim = false, hood = false, pack = false,
    short = false, bob = false, coat = false, spear = false, halberd = false, bandit = false, axe = false, plate = false,
    bun = false, ornate = false,
  } = o;
  const gy = ground - airY;
  const hipX = x;
  // gaitRun — походка по фазе step (циклы); на бегу корпус подпрыгивает дважды за цикл и наклоняется вперёд
  const gaitOn = gaitRun !== null && !sit;
  const hop = gaitOn ? Math.round(gaitRun * 1.5 * Math.cos(step * Math.PI * 4)) : 0;
  // seat — сидит на высоте seat над полом (0 — на полу): бедро опускается туда
  const hipY = seat !== null ? gy - seat - 4 : gy - (short ? 10 : 13) + pose.crouch + hop;  // short — невысокая фигура
  const shX = hipX + (pose.lean + (gaitOn ? Math.round(gaitRun * 2.5) : 0)) * f;
  const shY = hipY - (short ? 10 : 12) + breathe;  // breathe 1 — выдох: плечи и голова на пиксель ниже

  // ноги (сидя на полу — вытянуты вперёд, одна согнута)
  const s = Math.round(Math.sin(step) * 3);
  if (sit && seat > 0) {
    // на сиденье: бедро вперёд горизонтально, колено согнуто, голень вниз до пола
    for (const [dx, c, boot] of [[-1, colors.armorDark, shade(colors.boots, -0.2)], [1, colors.armor, colors.boots]]) {
      const kx = hipX + (7 + dx) * f, ky = hipY + 1;
      thick(g, hipX, hipY, kx, ky, 3, c);
      thick(g, kx, ky, kx + f, gy - 2, 3, c);
      rect(g, kx - 1 + (f > 0 ? 0 : -2), gy - 3, 5, 3, boot);
    }
  } else if (sit && seat === 0) {
    // на полу у огня: ноги вытянуты вперёд, одна согнута
    thick(g, hipX, hipY, hipX + 11 * f, gy - 2, 3, colors.armorDark);
    rect(g, hipX + 11 * f - 1, gy - 4, 3, 3, colors.boots);
    thick(g, hipX + f, hipY, hipX + 6 * f, hipY - 3, 3, colors.armor);
    thick(g, hipX + 6 * f, hipY - 3, hipX + 9 * f, gy - 2, 3, colors.armor);
    rect(g, hipX + 9 * f - 1, gy - 2, 4, 2, colors.boots);
  } else if (sit) {
    thick(g, hipX, hipY, hipX + 10 * f, gy - 2, 3, colors.armorDark);
    rect(g, hipX + 10 * f - 1, gy - 4, 3, 3, colors.boots);
    thick(g, hipX + f, hipY, hipX + 6 * f, hipY - 4, 3, colors.armor);
    thick(g, hipX + 6 * f, hipY - 4, hipX + 9 * f, gy - 2, 3, colors.armor);
    rect(g, hipX + 9 * f - 1, gy - 2, 4, 2, colors.boots);
  } else if (gaitOn) {
    // две кости с коленом вперёд: колено находим по длинам бедра и голени
    const len = (gy - 2 - (hipY - hop)) / 2 + 0.6;
    const legIK = (hx, fx, fy, color) => {
      const vx = fx - hx, vy = fy - hipY, d = Math.min(len * 2 - 0.01, Math.hypot(vx, vy));
      const h = Math.sqrt(Math.max(0, len * len - (d / 2) ** 2));
      let px = -vy / (d || 1), py = vx / (d || 1);
      if (px * f < 0) { px = -px; py = -py; }
      const kx = hx + vx / 2 + px * h, ky = hipY + vy / 2 + py * h;
      thick(g, hx, hipY, kx, ky, 3, color);
      thick(g, kx, ky, fx, fy, 3, color);
      rect(g, kx - 1 + (f > 0 ? 1 : 0), ky - 1, 1, 2, shade(color, skull ? -0.25 : 0.25));
    };
    const feet = [[gaitFoot(step + 0.5, gaitRun), -2, shade(colors.boots, -0.2), colors.armorDark], [gaitFoot(step, gaitRun), 2, colors.boots, colors.armor]];
    for (const [ft, off, boot, color] of feet) {
      const fx = Math.round(hipX + off * f * 0.5 + ft.dx * f), fy = Math.round(gy - 2 - ft.lift);
      legIK(hipX + off * 0.5 * f, fx, fy, color);
      rect(g, fx - 2 + (f > 0 ? 0 : -1), fy - 1, 5, 3, boot);
      rect(g, fx + (f > 0 ? 2 : -3), fy + 1, 1, 1, boot);
      rect(g, fx - 2 + (f > 0 ? 0 : -1), fy - 1, 5, 1, shade(boot, 0.25));
    }
  } else {
    // бедро и голень с коленом: колено чуть вперёд, сильнее — в приседе
    const leg = (hx, fx, color) => {
      const kx = (hx + fx) / 2 + f * (1 + pose.crouch * 0.35), ky = (hipY + gy - 2) / 2;
      thick(g, hx, hipY, kx, ky, 3, color);
      thick(g, kx, ky, fx, gy - 2, 3, color);
      rect(g, kx - 1 + (f > 0 ? 1 : 0), ky - 1, 1, 2, shade(color, skull ? -0.25 : 0.25));
    };
    const bx = hipX - 2 * f - s * f, fx = hipX + 2 * f + s * f;
    leg(hipX - 2 * f, bx, colors.armorDark);
    leg(hipX + 2 * f, fx, colors.armor);
    for (const [px, c] of [[bx, shade(colors.boots, -0.2)], [fx, colors.boots]]) {
      rect(g, px - 2 + (f > 0 ? 0 : -1), gy - 3, 5, 3, c);
      rect(g, px + (f > 0 ? 2 : -3), gy - 1, 1, 1, c);
      rect(g, px - 2 + (f > 0 ? 0 : -1), gy - 3, 5, 1, shade(c, 0.25));
    }
  }

  // длинное одеяние до пят: расширяется книзу, из-под него видны только носки сапог
  if (robe) {
    const top = hipY - 2, bottom = gy - 3;
    for (let y = top; y <= bottom; y++) {
      const k = (y - top) / Math.max(1, bottom - top);
      const half = 4 + k * 3.5 + (y === bottom ? Math.abs(s) * 0.5 : 0);
      rect(g, hipX - half, y, Math.round(half * 2), 1, colors.robe);
      rect(g, f > 0 ? hipX + half - 1 : hipX - half, y, 1, 1, colors.robeDark);
    }
    rect(g, hipX + (f > 0 ? 1 : -2), top, 1, bottom - top, colors.robeDark);
  }

  // стойка фехтовальщика: свободная рука заложена за спину — видно отставленный локоть
  if (offhandBack) {
    const elX = shX - 5 * f, elY = shY + 6;
    thick(g, shX - f, shY + 2, elX, elY, 2, colors.armorDark);
    thick(g, elX, elY, hipX - f, hipY - 3, 2, colors.armorDark);
  }

  // дорожный мешок за спиной
  if (pack) {
    rect(g, shX - 9 * f - (f > 0 ? 0 : 7), shY - 1, 7, 12, colors.pack);
    rect(g, shX - 9 * f - (f > 0 ? 0 : 7), shY - 1, 7, 1, colors.belt);
  }

  // плащ до середины бедра на пуговицах, высокий ворот
  if (coat) {
    rect(g, hipX - 4, shY + 1, 8, hipY - shY + 4, colors.armor);
    rect(g, f > 0 ? hipX - 4 : hipX + 3, shY + 1, 1, hipY - shY + 4, colors.armorDark);
    rect(g, hipX - 4, hipY + 4, 8, 1, colors.armorDark);
    rect(g, hipX + f, shY + 5, 1, 1, colors.belt);
    rect(g, hipX + f, shY + 8, 1, 1, colors.belt);
    rect(g, shX - 3, shY - 1, 7, 3, colors.tabard);
    rect(g, shX - 3, shY + 1, 7, 1, colors.armorDark);
  }

  // вторая рука — за корпусом, в тени
  if (!offhandBack && !bow) {
    // на ходу рука качается против ноги
    const swing = gaitOn ? Math.round(Math.cos(step * Math.PI * 2) * (1 + 3 * gaitRun)) : 0;
    const ex = shX - 3 * f + swing * f, ey = shY + 7 - Math.abs(swing) * gaitRun * 0.5;
    thick(g, shX - f, shY + 2, ex, ey, 2, shade(colors.armorDark, -0.25));
    thick(g, ex, ey, ex + f, ey + 5, 2, shade(colors.armorDark, -0.25));
  }

  // корпус и табард (у скелета — рёбра; пояс-кушак у тонкой фигуры)
  if (!coat) {
    const w = skull || slim ? 6 : 8;
    thick(g, hipX, hipY - 3, shX, shY + 3, w, colors.armor);
    // объём: светлая сторона спереди-сверху, тень сзади
    thick(g, hipX + f * (w / 2 - 1), hipY - 3, shX + f * (w / 2 - 1), shY + 3, 1, shade(colors.armor, 0.3));
    thick(g, hipX - f * (w / 2), hipY - 3, shX - f * (w / 2), shY + 3, 1, shade(colors.armor, -0.3));
    if (skull) {
      // рёбра и позвоночник
      for (let y = shY + 3; y < hipY - 3; y += 2) {
        const k = (y - shY) / Math.max(1, hipY - shY), cx = shX + (hipX - shX) * k;
        rect(g, cx - 2, y, 5, 1, shade(colors.armor, -0.45));
      }
      rect(g, hipX - 3, hipY - 3, 7, 2, shade(colors.armor, -0.2));
    } else {
      thick(g, hipX + f, hipY - 1, (hipX + shX) / 2 + f, shY + 5, slim ? 2 : 4, colors.tabard);
      thick(g, hipX + f * (slim ? 2 : 3), hipY - 1, (hipX + shX) / 2 + f * (slim ? 2 : 3), shY + 5, 1, shade(colors.tabard, -0.3));
      // пояс
      if (!robe) rect(g, hipX - w / 2, hipY - 3, w, 1, colors.belt ?? shade(colors.armor, -0.45));
    }
  }
  if (plate) {
    // латы: нагрудник с бликом и наплечник поверх рёбер
    thick(g, hipX, hipY - 4, shX, shY + 3, 7, colors.plate);
    thick(g, hipX + f, hipY - 4, shX + f, shY + 3, 2, colors.plateLight);
    rect(g, hipX - 4, hipY - 3, 8, 2, colors.plateDark);
    rect(g, shX - 4, shY, 9, 3, colors.plateDark);
    rect(g, shX - 3, shY, 7, 1, colors.plateLight);
  }
  if (ornate) {
    // восточный узор: высокий золотой воротник, золото с красным по центру и по подолу
    rect(g, shX - 2, shY - 1, 5, 2, colors.tabard);
    rect(g, shX - 1, shY, 3, 1, colors.belt);
    thick(g, hipX + f, hipY - 3, shX + f, shY + 2, 1, colors.tabard);
    for (let y = hipY; y < gy - 4; y += 3) rect(g, hipX - 1 + (y % 2), y, 2, 1, colors.tabard);
    rect(g, hipX - 6, gy - 5, 12, 1, colors.tabard);
    for (let x = hipX - 6; x < hipX + 6; x += 2) rect(g, x, gy - 4, 1, 1, colors.belt);
  }
  if (robe) rect(g, hipX - 4, hipY - 3, 8, slim ? 2 : 1, slim ? colors.tabard : colors.belt);
  if (robe && slim) rect(g, hipX - 4, hipY - 1, 8, 1, colors.belt);

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
  if (bun) {
    // Алкима: чёрные волосы до подбородка, чёлка набок, пучок на макушке, серьга
    rect(g, f > 0 ? headX - 1 : headX + 5, headY, 3, 8, colors.hair);
    rect(g, headX, headY, 7, 7, colors.helm);
    rect(g, headX - 1, headY - 1, 9, 3, colors.hair);
    rect(g, f > 0 ? headX + 3 : headX, headY + 1, 4, 2, colors.hair);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 3, 1, 1, colors.hair);
    rect(g, headX + 1, headY - 1, 4, 1, colors.hairLight);
    rect(g, f > 0 ? headX - 1 : headX + 5, headY - 4, 3, 3, colors.hair);
    rect(g, f > 0 ? headX : headX + 6, headY - 4, 1, 1, colors.hairLight);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 3, 1, 1, colors.visor);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 5, 1, 1, colors.lips);
    rect(g, f > 0 ? headX + 1 : headX + 5, headY + 5, 1, 1, colors.tabard);
  } else if (bandit) {
    // мародёр: лицо, повязка на голове с хвостами, платок закрывает рот и нос
    rect(g, headX, headY, 7, 8, colors.helm);
    rect(g, headX - 1, headY - 1, 9, 3, colors.bandana);
    rect(g, f > 0 ? headX - 3 : headX + 7, headY, 3, 1, colors.bandana);
    rect(g, f > 0 ? headX - 4 : headX + 9, headY + 1, 2, 1, colors.bandana);
    rect(g, f > 0 ? headX + 4 : headX + 1, headY + 3, 2, 1, colors.visor);
    rect(g, headX, headY + 5, 7, 3, colors.mask);
    rect(g, f > 0 ? headX + 6 : headX, headY + 7, 1, 2, colors.mask);
  } else if (bob) {
    // длинные волосы ниже плеч, чёлка прядями падает на глаза
    rect(g, f > 0 ? headX - 2 : headX + 5, headY + 1, 4, 12, colors.hair);
    rect(g, headX - 1, headY - 1, 9, 8, colors.hair);
    rect(g, headX + (f > 0 ? 2 : 0), headY + 2, 5, 5, colors.helm);
    rect(g, headX + (f > 0 ? 2 : 0), headY + 2, 5, 1, colors.hair);
    rect(g, headX + (f > 0 ? 4 : 2), headY + 3, 1, 1, colors.hair);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 4, 1, 1, colors.visor);
    rect(g, f > 0 ? headX + 4 : headX + 2, headY + 6, 2, 1, colors.blush ?? colors.helm);
    rect(g, f > 0 ? headX + 7 : headX - 1, headY + 2, 1, 7, colors.hair);
    rect(g, headX + 1, headY - 1, 4, 1, colors.hairLight ?? colors.hair);
  } else if (wrap) {
    // платок с покрывалом: открыты только глаза, концы ткани спадают на плечи
    rect(g, headX, headY, 7, 7, colors.helm);
    rect(g, headX - 1, headY - 2, 9, 4, colors.wrap);
    rect(g, headX, headY - 3, 7, 1, colors.wrapDark);
    rect(g, f > 0 ? headX - 2 : headX + 6, headY + 1, 3, 10, colors.wrap);
    rect(g, f > 0 ? headX - 2 : headX + 8, headY + 6, 1, 6, colors.wrapDark);
    rect(g, f > 0 ? headX + 4 : headX + 1, headY + 2, 2, 1, colors.visor);
    if (o.veil !== false) {
      rect(g, headX, headY + 4, 7, 3, colors.wrapDark);
      rect(g, f > 0 ? headX + 2 : headX + 1, headY + 5, 4, 1, colors.wrap);
    } else {
      // лицо открыто: брови, губы
      rect(g, f > 0 ? headX + 4 : headX + 1, headY + 1, 2, 1, colors.hair ?? colors.visor);
      rect(g, f > 0 ? headX + 4 : headX + 1, headY + 5, 2, 1, colors.lips ?? '#a0524a');
    }
    rect(g, headX + 3, headY - 1, 1, 1, colors.belt);
  } else if (hood) {
    // глубокий капюшон: лицо в тени
    rect(g, headX - 1, headY - 1, 9, 9, colors.hood);
    rect(g, f > 0 ? headX + 3 : headX + 1, headY + 2, 4, 5, '#1a1410');
    rect(g, f > 0 ? headX + 4 : headX + 2, headY + 3, 1, 1, colors.helm);
    rect(g, f > 0 ? headX - 2 : headX + 7, headY + 3, 2, 8, colors.hoodDark);
  } else if (face) {
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
    // череп: округлый свод, глазница, нос, челюсть с зубами
    rect(g, headX + 1, headY, 5, 1, colors.helm);
    rect(g, headX, headY + 1, 7, 5, colors.helm);
    rect(g, f > 0 ? headX + 1 : headX + 2, headY + 6, 4, 2, colors.helm);
    rect(g, f > 0 ? headX : headX + 6, headY + 1, 1, 4, shade(colors.helm, -0.2));
    rect(g, f > 0 ? headX + 4 : headX + 1, headY + 2, 2, 2, colors.visor);
    rect(g, f > 0 ? headX + 6 : headX, headY + 4, 1, 1, colors.visor);
    rect(g, f > 0 ? headX + 2 : headX + 2, headY + 6, 4, 1, shade(colors.helm, -0.45));
    rect(g, f > 0 ? headX + 3 : headX + 3, headY + 6, 1, 1, colors.helm);
    if (plate) {
      // шлем-шапель с наносником
      rect(g, headX - 1, headY - 1, 9, 4, colors.plate);
      rect(g, headX - 2, headY + 2, 11, 1, colors.plateDark);
      rect(g, headX, headY - 1, 7, 1, colors.plateLight);
      rect(g, f > 0 ? headX + 5 : headX + 1, headY + 3, 1, 2, colors.plateDark);
    }
  } else {
    // топфхелм: скруглённый верх, блик спереди, прорезь забрала и дырочки для дыхания, тёмный подбородок
    rect(g, headX + 1, headY, 5, 1, colors.helm);
    rect(g, headX, headY + 1, 7, 7, colors.helm);
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 1, 1, 2, shade(colors.helm, 0.45));
    rect(g, f > 0 ? headX : headX + 6, headY + 1, 1, 7, shade(colors.helm, -0.3));
    rect(g, f > 0 ? headX + 3 : headX, headY + 3, 4, 1, colors.visor);
    rect(g, f > 0 ? headX + 4 : headX + 2, headY + 5, 1, 1, shade(colors.helm, -0.45));
    rect(g, f > 0 ? headX + 5 : headX + 1, headY + 6, 1, 1, shade(colors.helm, -0.45));
    rect(g, headX + 1, headY + 7, 5, 1, shade(colors.helm, -0.2));
  }
  if (plume) {
    // плюмаж струится назад
    rect(g, headX + 2, headY - 2, 3, 2, colors.plume);
    rect(g, headX + (f > 0 ? -1 : 4), headY - 1, 4, 2, colors.plume);
    rect(g, headX + (f > 0 ? -3 : 7), headY, 3, 2, shade(colors.plume, -0.25));
    rect(g, headX + (f > 0 ? -4 : 9), headY + 2, 2, 1, shade(colors.plume, -0.35));
    rect(g, headX + 3, headY - 2, 1, 1, shade(colors.plume, 0.35));
  }

  // щит перед корпусом
  if (shield) {
    rect(g, f > 0 ? shX + 3 : shX - 7, shY + 1, 4, 11, colors.shield);
    rect(g, f > 0 ? shX + 3 : shX - 7, shY + 1, 4, 1, colors.hilt);
  }

  // рука
  const handX = shX + pose.hx * f;
  const handY = shY + 2 + pose.hy;
  // плечо с локтем, наплечник, латная перчатка
  const elX = (shX + f + handX) / 2 - f, elY = (shY + 2 + handY) / 2 + 1;
  thick(g, shX + f, shY + 2, elX, elY, 2, colors.armorDark);
  thick(g, elX, elY, handX, handY, 2, colors.armorDark);
  if (!skull && !coat && !slim && !bandit) {
    rect(g, shX - 2, shY, 5, 3, colors.armor);
    rect(g, shX - 1, shY, 3, 1, shade(colors.armor, 0.35));
  }
  rect(g, handX - 1, handY - 1, 2, 2, (face || bandit || slim || coat || wrap || bob) ? (colors.helm) : shade(colors.armorDark, 0.2));
  const a = pose.angle * Math.PI / 180;
  const dx = Math.cos(a) * f, dy = Math.sin(a);

  if (bow && crossbow) {
    // арбалет: ложе вдоль прицела, короткие плечи поперёк спереди, тетива взведена к орешку
    const px = -dy, py = dx;
    const back = [handX - dx * 5, handY - dy * 5], front = [handX + dx * 9, handY + dy * 9];
    thick(g, back[0], back[1], front[0], front[1], 2, colors.hilt);
    const lt = [front[0] - dx * 2 + px * 5, front[1] - dy * 2 + py * 5], lb = [front[0] - dx * 2 - px * 5, front[1] - dy * 2 - py * 5];
    thick(g, lt[0], lt[1], front[0], front[1], 1, colors.blade);
    thick(g, front[0], front[1], lb[0], lb[1], 1, colors.blade);
    const nut = bowDraw > 0.5 ? [handX, handY] : [front[0] - dx * 3, front[1] - dy * 3];
    thick(g, lt[0], lt[1], nut[0], nut[1], 1, colors.helm);
    thick(g, nut[0], nut[1], lb[0], lb[1], 1, colors.helm);
    if (bowDraw > 0.5) thick(g, handX + dx, handY + dy, front[0] + dx * 2, front[1] + dy * 2, 1, '#e6e1d0');  // болт на ложе
    return { tipX: front[0], tipY: front[1], handX, handY };
  }
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
    if (halberd) {
      // алебарда: длинное древко, у конца — топор с одной стороны и крюк с другой, остриё
      thick(g, handX - dx * 8, handY - dy * 8, tipX, tipY, 1, colors.hilt);
      const px = -dy, py = dx;
      for (let i = 2; i < 8; i++) {
        const bx = tipX - dx * i, by = tipY - dy * i, w = 5 - Math.abs(i - 4.5) * 0.9;
        thick(g, bx + px, by + py, bx + px * w, by + py * w, 1, colors.blade);
      }
      thick(g, tipX - dx * 5 - px, tipY - dy * 5 - py, tipX - dx * 4 - px * 3, tipY - dy * 4 - py * 3, 1, colors.blade);  // крюк
      thick(g, tipX, tipY, tipX + dx * 3, tipY + dy * 3, 1, colors.blade);  // остриё
      return { tipX: tipX + dx * 3, tipY: tipY + dy * 3, handX, handY };
    }
    if (spear) {
      // древко назад от кисти, наконечник на конце
      thick(g, handX - dx * 8, handY - dy * 8, tipX - dx * 4, tipY - dy * 4, 1, colors.hilt);
      thick(g, tipX - dx * 4, tipY - dy * 4, tipX, tipY, 1, colors.blade);
      rect(g, tipX - dx * 4 - dy, tipY - dy * 4 + dx, 1, 1, colors.blade);
      rect(g, tipX - dx * 4 + dy, tipY - dy * 4 - dx, 1, 1, colors.blade);
      return { tipX, tipY, handX, handY };
    }
    if (axe) {
      // топор: топорище и широкое лезвие на конце
      thick(g, handX - dx * 3, handY - dy * 3, tipX, tipY, 1, colors.hilt);
      const px = -dy, py = dx;
      for (let i = 0; i < 7; i++) {
        const bx = tipX - dx * i, by = tipY - dy * i, w = 6 - Math.abs(i - 3) * 0.8;
        thick(g, bx + px, by + py, bx + px * w, by + py * w, 1, i === 0 || i === 6 ? colors.hilt : colors.blade);
      }
      return { tipX: tipX + px * 3, tipY: tipY + py * 3, handX, handY };
    }
    if (curved) {
      // изогнутый клинок: середина выгнута в сторону обуха
      const px = -dy, py = dx, bend = 2.5;
      const mx = handX + dx * (weaponLen * 0.55) + px * bend, my = handY + dy * (weaponLen * 0.55) + py * bend;
      thick(g, handX + dx * 2, handY + dy * 2, mx, my, 1, colors.blade);
      thick(g, mx, my, tipX + px * 0.5, tipY + py * 0.5, 1, colors.blade);
    } else thick(g, handX + dx * 2, handY + dy * 2, tipX, tipY, 1, colors.blade);
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
export function drawArrow(g, x, y, vx, vy, stuck = false, bolt = false) {
  const len = Math.hypot(vx, vy) || 1;
  const ux = stuck ? 0.6 : vx / len, uy = stuck ? 0.8 : vy / len;
  if (bolt) {
    // арбалетный болт: короче и толще, железный наконечник
    thick(g, x - ux * 6, y - uy * 6, x, y, 2, '#7a5a3a');
    rect(g, x, y, 2, 2, '#c3d0dc');
    rect(g, x - ux * 6, y - uy * 6, 1, 2, '#3b3550');
    return;
  }
  thick(g, x - ux * 7, y - uy * 7, x, y, 1, '#a39d8a');
  rect(g, x, y, 1, 1, '#e6e1d0');
  rect(g, x - ux * 7 - uy, y - uy * 7 + ux, 1, 1, '#e8454f');
  rect(g, x - ux * 7 + uy, y - uy * 7 - ux, 1, 1, '#e8454f');
}

// Портрет Лики для лавки (48×48, заглушка до настоящего рисунка):
// чёрное каре, чёлка разобрана по бокам и падает на глаза, короткий тёмный плащ со светлым воротником.
export function drawLikaPortrait(g, c) {
  const P = (x, y, w, h, col) => rect(g, x, y, w, h, col);
  g.clearRect(0, 0, 48, 48);
  // плечи и плащ
  P(8, 40, 32, 8, c.armor);
  P(6, 43, 36, 5, c.armor);
  P(20, 38, 8, 4, c.helm);
  P(18, 40, 5, 5, c.tabard);
  P(25, 40, 5, 5, c.tabard);
  P(23, 42, 2, 6, c.armorDark);
  P(23, 45, 2, 1, c.belt);
  // волосы сзади — каре до подбородка
  P(11, 7, 26, 28, c.hair);
  P(10, 12, 28, 21, c.hair);
  // лицо
  P(15, 12, 18, 21, c.helm);
  P(16, 33, 16, 2, c.helm);
  P(18, 35, 12, 1, c.helm);
  // чёлка: прядями, по бокам длиннее, посередине видно лоб
  P(12, 6, 24, 7, c.hair);
  P(15, 12, 5, 8, c.hair);
  P(20, 12, 3, 5, c.hair);
  P(26, 12, 3, 4, c.hair);
  P(29, 12, 4, 9, c.hair);
  P(23, 12, 3, 2, c.hair);
  P(13, 13, 3, 22, c.hair);
  P(32, 13, 3, 22, c.hair);
  P(18, 6, 8, 1, c.hairLight);
  // глаза, румянец, губы
  P(18, 22, 4, 3, c.visor);
  P(27, 22, 4, 3, c.visor);
  P(19, 22, 1, 1, '#ffffff');
  P(28, 22, 1, 1, '#ffffff');
  P(17, 27, 3, 1, c.blush);
  P(29, 27, 3, 1, c.blush);
  P(23, 30, 3, 1, c.blush);
}

// Рыцарь спереди или со спины (back) — при ходьбе вглубь и у дверей.
// squash < 1 — сжат по ширине: кадр поворота. weapon — sword | rapier (висит у бедра).
export function drawFigureFront(g, o) {
  const { x, ground, colors, back = false, step = 0, plume = true, weapon = 'sword', squash = 1, airY = 0 } = o;
  const gy = Math.round(ground - airY);
  const R = (dx, y, w, h, c) => rect(g, x + Math.round(dx * squash), y, Math.max(1, Math.round(w * squash)), h, c);
  const lift = Math.round(Math.max(0, Math.sin(step)) * 2), lift2 = Math.round(Math.max(0, -Math.sin(step)) * 2);
  const hipY = gy - 13;
  // ноги
  R(-4, hipY, 3, 11 - lift, colors.armorDark);
  R(1, hipY, 3, 11 - lift2, colors.armorDark);
  R(-5, gy - 2 - lift, 4, 2, colors.boots);
  R(1, gy - 2 - lift2, 4, 2, colors.boots);
  // корпус
  R(-5, hipY - 13, 10, 14, colors.armor);
  if (!back) R(-1, hipY - 11, 3, 12, colors.tabard);
  else R(-4, hipY - 12, 8, 2, colors.armorDark);
  R(-5, hipY - 2, 10, 1, colors.armorDark);
  // руки вдоль тела, качаются при ходьбе
  const sw = Math.round(Math.sin(step) * 1.5);
  R(-7, hipY - 12 + sw, 2, 10, colors.armorDark);
  R(5, hipY - 12 - sw, 2, 10, colors.armorDark);
  // оружие у левого бедра
  if (weapon === 'rapier') {
    R(back ? 6 : -8, hipY - 4, 1, 12, colors.blade);
    R(back ? 5 : -9, hipY - 5, 3, 2, colors.hilt);
  } else {
    R(back ? 6 : -9, hipY - 3, 2, 12, colors.scabbard);
    R(back ? 5 : -10, hipY - 5, 4, 1, colors.hilt);
  }
  // голова
  R(-3, hipY - 21, 7, 8, colors.helm);
  if (!back) R(-2, hipY - 18, 5, 1, colors.visor);
  else R(-3, hipY - 15, 7, 1, colors.armorDark);
  if (plume) R(-1, hipY - 23, 3, 2, colors.plume);
}

// Оружие на полу (выбитая рапира): клинок вдоль пола, чашка гарды, блик бежит по клинку.
export function drawPickup(g, x, ground, t) {
  const y = Math.round(ground - 2 - Math.max(0, Math.sin(t * 3)) * 1);
  thick(g, x - 9, y, x + 12, y - 1, 1, '#d6dde6');
  rect(g, x - 11, y - 1, 3, 3, '#c9a24a');
  rect(g, x - 13, y, 2, 1, '#6b4532');
  const k = (t * 0.8) % 1;
  if (k < 0.5) rect(g, Math.round(x - 9 + k * 2 * 21), y - 1, 1, 1, '#ffffff');
}

// Те же цвета, но всё белое — вспышка при попадании.
export function flashColors(colors) {
  const out = {};
  for (const k in colors) out[k] = '#fff4e8';
  return out;
}

// Контур: фигура рисуется на отдельный холст, обводится тёмной линией в 1 пиксель и переносится на экран.
// Так силуэт читается на любом фоне — главный приём пиксель-арта.
const OW = 120, OH = 140, OX = 60, OY = 112;
let outA = null, outB = null;
function withOutline(g, x, ground, draw, color = '#0d0b14') {
  if (typeof document === 'undefined') return draw(g, x, ground);
  if (!outA) {
    outA = document.createElement('canvas'); outA.width = OW; outA.height = OH;
    outB = document.createElement('canvas'); outB.width = OW; outB.height = OH;
  }
  const a = outA.getContext('2d'), b = outB.getContext('2d');
  a.clearRect(0, 0, OW, OH);
  const rx = Math.round(x), rg = Math.round(ground);
  const res = draw(a, OX + (x - rx), OY + (ground - rg));
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, OW, OH);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.drawImage(outA, dx, dy);
  b.globalCompositeOperation = 'source-in';
  b.fillStyle = color;
  b.fillRect(0, 0, OW, OH);
  b.globalCompositeOperation = 'source-over';
  b.drawImage(outA, 0, 0);
  const ox = rx - OX, oy = rg - OY;
  g.drawImage(outB, ox, oy);
  return res ? { tipX: res.tipX + ox, tipY: res.tipY + oy, handX: res.handX + ox, handY: res.handY + oy } : res;
}

// Боец с контуром; шлейф клинка рисуется поверх без контура.
export function drawFigureOutlined(g, o) {
  const res = withOutline(g, o.x, o.ground, (c, x, ground) => drawFigure(c, { ...o, x, ground, trail: null }));
  if (o.trail && !o.bladeHidden) for (const [i, p] of o.trail.entries()) {
    withAlpha(g, 0.15 + 0.12 * i, () => thick(g, res.handX, res.handY, p.tipX, p.tipY, 1, '#ffffff'));
  }
  return res;
}

export function drawFigureFrontOutlined(g, o) {
  withOutline(g, o.x, o.ground, (c, x, ground) => drawFigureFront(c, { ...o, x, ground }));
}

export function drawSlimeOutlined(g, o) {
  withOutline(g, o.x, o.ground, (c, x, ground) => drawSlime(c, { ...o, x, ground }));
}
