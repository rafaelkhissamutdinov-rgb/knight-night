// Позы бойцов. Для каждой: hx, hy — кисть относительно плеча (x вперёд, y вниз),
// angle — угол клинка в градусах (0 — вперёд, -90 — вверх, 90 — вниз),
// lean — наклон корпуса вперёд, crouch — присед. Всё в пикселях игрового экрана.

export const POSES = {
  idle:        { hx: 6,  hy: 6,   angle: -45,  lean: 0,  crouch: 0 },
  sheathed:    { hx: 1,  hy: 9,   angle: 160,  lean: 0,  crouch: 0 },
  fence:       { hx: 11, hy: 3,   angle: -12,  lean: 1,  crouch: 2 },  // стойка рапириста: клинок вперёд, вторая рука за спиной

  // защита
  guard_high:  { hx: 4,  hy: -9,  angle: -10,  lean: 0,  crouch: 0 },
  guard_mid:   { hx: 8,  hy: 4,   angle: -85,  lean: 1,  crouch: 0 },
  guard_low:   { hx: 8,  hy: 9,   angle: 100,  lean: 2,  crouch: 2 },

  // замахи и удары — общие для рыцаря и врагов: по замаху видно, куда придёт удар
  windup_high: { hx: -3, hy: -11, angle: -120, lean: -2, crouch: 0 },
  strike_high: { hx: 10, hy: 0,   angle: 35,   lean: 4,  crouch: 0 },
  windup_mid:  { hx: -8, hy: 6,   angle: -185, lean: 3,  crouch: 1 },
  strike_mid:  { hx: 12, hy: 5,   angle: 0,    lean: 4,  crouch: 1 },
  windup_low:  { hx: -6, hy: 11,  angle: 150,  lean: 3,  crouch: 5 },
  strike_low:  { hx: 11, hy: 12,  angle: 15,   lean: 4,  crouch: 5 },

  // укол рапирой: клинок горизонтально у груди, рука взведена → выпад
  windup_thrust: { hx: -2, hy: 3,  angle: 0,    lean: -1, crouch: 1 },
  strike_thrust: { hx: 15, hy: 3,  angle: 0,    lean: 7,  crouch: 3 },
  // вихрь врага: клинок уходит вниз, затем круговой удар
  windup_whirl:  { hx: -6, hy: 11, angle: 150,  lean: 3,  crouch: 5 },
  strike_whirl:  { hx: 10, hy: 2,  angle: 10,   lean: 2,  crouch: 2 },
  // диагонали: клинок явно под 45°, не похоже ни на верх, ни на низ
  windup_diagUp:   { hx: 2,  hy: 9,  angle: 135,  lean: 1, crouch: 3 },
  strike_diagUp:   { hx: 11, hy: -4, angle: -45,  lean: 5, crouch: 0 },
  windup_diagDown: { hx: 2,  hy: -2, angle: -135, lean: 0, crouch: 0 },
  strike_diagDown: { hx: 11, hy: 8,  angle: 45,   lean: 5, crouch: 2 },
  // захлёст: клинок заведён за плечо, как хлыст → хлёсткий удар сверху
  windup_flick:  { hx: -2, hy: -8, angle: -200, lean: -2, crouch: 0 },
  strike_flick:  { hx: 9,  hy: -6, angle: 60,   lean: 5,  crouch: 1 },
  vault:         { hx: 4,  hy: -9, angle: -150, lean: 2,  crouch: 6 },  // в прыжке через рыцаря

  // подсечка после кувырка: низко, клинок идёт вдоль пола
  windup_sweep:  { hx: -6, hy: 13, angle: 178,  lean: 3,  crouch: 8 },
  strike_sweep:  { hx: 13, hy: 14, angle: 4,    lean: 5,  crouch: 8 },

  // удар прямо из ножен: рука у пояса, затем рывок вперёд с наклоном
  draw:        { hx: 0,  hy: 9,   angle: 165,  lean: 3,  crouch: 1 },
  strike_draw: { hx: 13, hy: 5,   angle: 5,    lean: 6,  crouch: 2 },

  // перемещения рыцаря
  dash:        { hx: 7,  hy: 4,   angle: -30,  lean: 5,  crouch: 2 },
  backdash:    { hx: 9,  hy: 3,   angle: -80,  lean: -3, crouch: 1 },

  // лучник
  aim_high:    { hx: 8,  hy: -3,  angle: -25,  lean: 0,  crouch: 0 },
  aim_mid:     { hx: 9,  hy: 2,   angle: 0,    lean: 1,  crouch: 0 },
  aim_low:     { hx: 9,  hy: 4,   angle: 12,   lean: 2,  crouch: 6 },
  aim_arc:     { hx: 6,  hy: -6,  angle: -60,  lean: -2, crouch: 1 },

  broken:      { hx: 2,  hy: -4,  angle: -130, lean: -4, crouch: 1 },  // защиту сбили: меч отброшен
  tuck:        { hx: 4,  hy: 4,   angle: -60,  lean: 4,  crouch: 8 },  // сгруппировался в кувырке
  kneel:       { hx: 5,  hy: 10,  angle: 90,   lean: 1,  crouch: 9 },  // на одном колене, меч упёрт в пол

  hurt:        { hx: 4,  hy: 8,   angle: 50,   lean: -3, crouch: 0 },
  stagger:     { hx: 1,  hy: -3,  angle: -115, lean: -4, crouch: 0 },
  dead:        { hx: 6,  hy: 10,  angle: 80,   lean: -6, crouch: 9 },
};

// Вихрь: клинок делает два полных круга вокруг плеча. k — от 0 до 1.
export function spinPose(k) {
  const angle = -90 + 720 * k;
  const r = angle * Math.PI / 180;
  return { hx: Math.cos(r) * 9, hy: Math.sin(r) * 7 + 2, angle, lean: 0, crouch: 2 };
}

// «Восьмёрка» рапирой перед собой: клинок ходит по диагоналям вверх-вниз. k — от 0 до 1.
export function eightPose(k) {
  const a = k * Math.PI * 4;
  return { hx: 9 + Math.sin(a) * 2, hy: 2 + Math.sin(a / 2) * 6, angle: -20 + Math.sin(a) * 55, lean: 2, crouch: 2 };
}

const KEYS = ['hx', 'hy', 'angle', 'lean', 'crouch'];

export function lerpPose(a, b, k) {
  const out = {};
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

// плавное приближение к позе: чем больше rate, тем быстрее
export function approachPose(a, b, dt, rate) {
  return lerpPose(a, b, 1 - Math.exp(-dt * rate));
}

export const ease = t => 1 - (1 - t) ** 3;
