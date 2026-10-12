// Позы бойцов. Для каждой: hx, hy — кисть относительно плеча (x вперёд, y вниз),
// angle — угол клинка в градусах (0 — вперёд, -90 — вверх, 90 — вниз),
// lean — наклон корпуса вперёд, crouch — присед. Всё в пикселях игрового экрана.

export const POSES = {
  idle:        { hx: 6,  hy: 6,   angle: -45,  lean: 0,  crouch: 0 },

  // защита рыцаря
  guard_high:  { hx: 4,  hy: -9,  angle: -10,  lean: 0,  crouch: 0 },
  guard_mid:   { hx: 8,  hy: 4,   angle: -85,  lean: 1,  crouch: 0 },
  guard_low:   { hx: 8,  hy: 9,   angle: 100,  lean: 2,  crouch: 2 },

  // атаки рыцаря
  attack:      { hx: 13, hy: 5,   angle: 0,    lean: 3,  crouch: 0 },
  lunge:       { hx: 15, hy: 6,   angle: 2,    lean: 6,  crouch: 3 },
  hurt:        { hx: 4,  hy: 8,   angle: 50,   lean: -3, crouch: 0 },

  // замахи и удары врага: по замаху видно, куда придёт удар
  windup_high: { hx: -3, hy: -11, angle: -120, lean: -2, crouch: 0 },
  strike_high: { hx: 10, hy: 0,   angle: 35,   lean: 4,  crouch: 0 },
  windup_mid:  { hx: -8, hy: 6,   angle: -185, lean: 3,  crouch: 1 },
  strike_mid:  { hx: 12, hy: 5,   angle: 0,    lean: 4,  crouch: 1 },
  windup_low:  { hx: -6, hy: 11,  angle: 150,  lean: 3,  crouch: 5 },
  strike_low:  { hx: 11, hy: 12,  angle: 15,   lean: 4,  crouch: 5 },

  stagger:     { hx: 1,  hy: -3,  angle: -115, lean: -4, crouch: 0 },
  dead:        { hx: 6,  hy: 10,  angle: 80,   lean: -6, crouch: 9 },
};

const KEYS = ['hx', 'hy', 'angle', 'lean', 'crouch'];

export function lerpPose(a, b, k) {
  const out = {};
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

export const ease = t => 1 - (1 - t) ** 3;
