// «Вайбовать» (v0.81): живая картинка места, пока Найт стоит и смотрит. Рисуется кодом поверх сцены (мир 320×180).
// Виды (`fx` у места): birds — стая над долиной и лучи заката; moon — лунный луч из окна с пылью; rain — капли сквозь
// пролом в крыше и круги на луже; embers — искры и дым от костра. k — сила (0 → 1, нарастает), t — время.
const rnd = (a, b) => a + Math.random() * (b - a);
let state = null;

export function resetVibeFx() { state = null; }

function px(g, x, y, w, h, c, a = 1) {
  g.globalAlpha = a;
  g.fillStyle = c;
  g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h);
}

// sx — место на экране (x спота минус камера); floor — линия пола; gy(z) — y пола на глубине z
export function drawVibeFx(g, fx, o) {
  const { sx, k, t, dt, floor, gy } = o, vt = o.vt ?? t;
  if (!state || state.fx !== fx) state = { fx, parts: [], birds: null, acc: 0 };
  const S = state;
  g.save();
  if (fx === 'birds') {
    // лучи заката — тёплые полосы наискосок, медленно дышат
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = (0.07 + 0.04 * Math.sin(t * 0.5 + i * 1.7)) * k;
      g.globalAlpha = a;
      g.fillStyle = '#ffb070';
      g.beginPath();
      const x0 = 250 + i * 26;
      g.moveTo(x0, -4); g.lineTo(x0 + 10 + i * 3, -4); g.lineTo(x0 - 90 + i * 8, 150); g.lineTo(x0 - 110 + i * 6, 150);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // стая: клин из птиц летит через долину, крылья машут вразнобой
    if (!S.birds) S.birds = Array.from({ length: 9 }, (_, i) => ({ dx: -Math.abs(i - 4) * 9 - rnd(0, 3), dy: Math.abs(i - 4) * 3.5 * (i < 4 ? -1 : 1) * 0.6 + rnd(-1, 1), ph: rnd(0, 6.28), sp: rnd(7, 9) }));
    const lead = -10 + ((vt * 16) % 420), ly = 24 + Math.sin(vt * 0.4) * 4;   // стая вылетает сразу, как Найт остановился
    for (const b of S.birds) {
      const x = lead + b.dx, y = ly + b.dy + Math.sin(t * 1.3 + b.ph) * 1.2;
      const up = Math.sin(t * b.sp + b.ph) > 0;
      const c = '#2a2034';
      // птица силуэтом против закатного неба: тело и крылья «галочкой» (вверх) или «чайкой» (вниз)
      px(g, x - 0.5, y, 2, 1, c, k);
      if (up) { px(g, x - 2, y - 1, 1.5, 1, c, k); px(g, x - 3.5, y - 2, 1.5, 1, c, k); px(g, x + 1.5, y - 1, 1.5, 1, c, k); px(g, x + 3, y - 2, 1.5, 1, c, k); }
      else { px(g, x - 2.5, y + 0.5, 2, 1, c, k); px(g, x - 4, y + 1, 1.5, 0.5, c, k); px(g, x + 1.5, y + 0.5, 2, 1, c, k); px(g, x + 3.5, y + 1, 1.5, 0.5, c, k); }
    }
    // искры света над долиной — тёплые пылинки, плывут вверх
    S.acc += dt * 6 * k;
    while (S.acc > 1) { S.acc--; S.parts.push({ x: rnd(0, 320), y: rnd(90, 150), vy: rnd(-4, -2), vx: rnd(1, 3), life: rnd(3, 6), t: 0 }); }
    for (const p of S.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = Math.sin(Math.PI * p.t / p.life) * 0.8 * k; px(g, p.x, p.y, 1, 1, '#ffe2a8', a); }
  } else if (fx === 'moon') {
    // лунный луч из окна наискосок до пола; в нём медленно кружит пыль
    const wx = sx, top = o.winY ?? 30, bot = floor + 18;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.7);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.24 * k * breathe;
    const grd = g.createLinearGradient(0, top, 0, bot);
    grd.addColorStop(0, '#9fc4ff'); grd.addColorStop(1, 'rgba(159,196,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(wx - 11, top); g.lineTo(wx + 11, top); g.lineTo(wx + 44, bot); g.lineTo(wx + 8, bot); g.fill();
    g.globalAlpha = 0.14 * k * breathe; g.fillStyle = '#cfe0ff';
    g.beginPath(); g.ellipse(wx + 26, bot - 4, 24, 4, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    if (!S.parts.length) S.parts = Array.from({ length: 34 }, () => ({ u: Math.random(), v: Math.random(), ph: rnd(0, 6.28), s: rnd(0.15, 0.4) }));
    for (const p of S.parts) {
      p.v = (p.v + dt * 0.02 * p.s) % 1;
      const y = top + p.v * (bot - top), w = 22 + p.v * 14, x0 = wx - 11 + p.v * 30;
      const x = x0 + p.u * w + Math.sin(t * p.s * 3 + p.ph) * 2;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.ph * 3);
      px(g, x, y, tw > 0.85 ? 1 : 0.5, tw > 0.85 ? 1 : 0.5, '#e8f0ff', k * (0.3 + 0.7 * tw) * (1 - p.v * 0.5));
    }
  } else if (fx === 'rain') {
    // капли из пролома: столб света, капли разной скорости, круги на луже
    const cx = sx, py = gy(o.z ?? 22), top = o.top ?? -2;   // top — низ пролома в крыше
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.2 * k;
    const grd = g.createLinearGradient(0, top, 0, py);
    grd.addColorStop(0, '#b8d4ff'); grd.addColorStop(1, 'rgba(184,212,255,0.15)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(cx - 12, top); g.lineTo(cx + 12, top); g.lineTo(cx + 22, py + 2); g.lineTo(cx - 20, py + 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    S.acc += dt * 26 * k;
    while (S.acc > 1) { S.acc--; S.parts.push({ x: cx + rnd(-11, 11), y: top + rnd(-4, 4), vy: rnd(150, 210), t: 0, splash: 0 }); }
    for (const p of S.parts) {
      if (!p.splash) {
        p.y += p.vy * dt; p.x += p.vy * dt * 0.04;
        if (p.y >= py - rnd(-2, 2)) { p.splash = 0.001; p.y = py + rnd(-2, 2); }
        else px(g, p.x, p.y, 0.5, 3, '#c4dcf5', 0.8 * k);
      } else {
        p.splash += dt;
        const r = 1 + p.splash * 14, a = 0.6 * (1 - p.splash / 0.45) * k;
        if (a > 0) { px(g, p.x - r, p.y, 1, 0.5, '#9ab8d8', a); px(g, p.x + r - 1, p.y, 1, 0.5, '#9ab8d8', a); px(g, p.x - r * 0.5, p.y - 0.5, r, 0.5, '#7f9cbc', a * 0.5); }
        if (p.splash < 0.12) px(g, p.x, p.y - 2 - p.splash * 20, 0.5, 0.5, '#d4e6ff', 0.7 * k);
      }
    }
    S.parts = S.parts.filter(p => !p.splash || p.splash < 0.45);
  } else if (fx === 'embers') {
    // костёр: искры вьются вверх и гаснут, сизый дым тянется к потолку
    const cx = o.fireX, cy = gy(o.z ?? 20) - 6;
    S.acc += dt * 22 * k;
    while (S.acc > 1) {
      S.acc--;
      const smoke = Math.random() < 0.25;
      S.parts.push({ x: cx + rnd(-4, 4), y: cy - rnd(0, 4), vx: rnd(-6, 6), vy: smoke ? rnd(-10, -6) : rnd(-38, -20), ph: rnd(0, 6.28), t: 0, life: smoke ? rnd(3, 5) : rnd(1, 2.4), smoke });
    }
    for (const p of S.parts) {
      p.t += dt; p.x += (p.vx + Math.sin(t * 3 + p.ph) * 10) * dt; p.y += p.vy * dt; if (!p.smoke) p.vy *= 0.995;
      const u = p.t / p.life;
      if (p.smoke) { const s = 2 + u * 8; px(g, p.x - s / 2, p.y - s / 2, s, s * 0.6, '#5c5866', 0.12 * (1 - u) * k); }
      else { const sz = u < 0.4 ? 1 : 0.5; px(g, p.x, p.y, sz, sz, u < 0.35 ? '#fff0a8' : u < 0.7 ? '#ffae4a' : '#d4502a', (1 - u * u) * k); }
    }
    S.parts = S.parts.filter(p => p.t < p.life);
  }
  if (S.parts.length > 400) S.parts.splice(0, S.parts.length - 400);
  if (fx === 'birds') S.parts = S.parts.filter(p => p.t < p.life);
  g.restore();
}
