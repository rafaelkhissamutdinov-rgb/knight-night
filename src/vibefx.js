// «Вайбовать» (v0.81, переделано в v0.83 по владельцу: «ветер, листья, облака, луна — как японское молчаливое
// созерцание природы»; «свет должен иметь понятный источник»). Рисуется на слое поверх живого света (мир 320×180).
// Общий ветер с порывами двигает листья, дым, дождь и облака. Свет — только от того, что видно на картинке:
//   birds  — балкон: облака плывут по небу, тёплое свечение заката там, где оно на картине (sun), листья по ветру,
//            изредка — стая птиц;
//   moon   — лунное окно: по луне в проёме идут облака (луч тускнеет), луч — проём окна, протянутый наклонно до пола,
//            на полу светлое пятно той же формы; в луче — пыль и лист, залетевший в окно;
//   rain   — Часовня: отвесный столб света ширины пролома, дождь чуть косит по ветру, круги на луже, мокрый лист;
//   embers — привал: искры и дым, который сносит ветром.
// k — сила (0 → 1), t — время игры, vt — с начала вайба, dt — шаг.
const rnd = (a, b) => a + Math.random() * (b - a);
let state = null;

export function resetVibeFx() { state = null; }

function px(g, x, y, w, h, c, a = 1) {
  g.globalAlpha = Math.max(0, Math.min(1, a));
  g.fillStyle = c;
  g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h);
}

// ветер: медленная волна и порывы; > 0 — дует вправо
function wind(t) {
  const gust = Math.max(0, Math.sin(t * 0.31) * Math.sin(t * 0.13 + 1)) * 1.6;
  return 0.45 + 0.25 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.71 + 1) + gust;
}

// лист кувыркается: то ребром, то плашмя; осенние цвета
const LEAF = ['#c9773a', '#a8492e', '#d9a441', '#7d8a3c', '#b85c2c'];
const newLeaf = (x, y, vx, fall) => ({ x, y, vx, fall, ph: rnd(0, 6.28), spin: rnd(0, 6), c: LEAF[Math.floor(Math.random() * LEAF.length)] });
function leaf(g, p, a) {
  const flat = Math.sin(p.spin) > 0;
  px(g, p.x, p.y, flat ? 1 : 0.5, flat ? 0.5 : 1, p.c, a);
  if (Math.cos(p.spin * 0.5) > 0.6) px(g, p.x + 0.5, p.y + 0.5, 0.5, 0.5, p.c, a * 0.7);
}
function stepLeaf(p, dt, W, t) {
  p.vx += (W * 26 - p.vx) * Math.min(1, dt * 1.5);
  p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 6) * dt;
  p.y += (p.fall + Math.sin(t * 2.1 + p.ph) * 4) * dt;
  p.spin += dt * (4 + W * 6);
}

// облако: несколько мягких овалов
function cloud(g, c, x, y, a, col) {
  g.globalAlpha = a;
  g.fillStyle = col;
  for (const b of c.blobs) { g.beginPath(); g.ellipse(x + b.dx, y + b.dy, b.rx, b.ry, 0, 0, Math.PI * 2); g.fill(); }
}
const makeCloud = (x, y, s) => ({ x, y, v: rnd(1.2, 2.6), blobs: Array.from({ length: 4 + Math.floor(Math.random() * 3) }, (_, i) => ({ dx: (i - 2) * 5 * s + rnd(-2, 2), dy: rnd(-1.5, 1.5), rx: rnd(4, 8) * s, ry: rnd(1.6, 3) * s })) });

// проём окна внутри каменной рамы
const opening = w => ({ x0: w.x0 + (w.x1 - w.x0) * 0.24, x1: w.x1 - (w.x1 - w.x0) * 0.24, y0: w.y0 + (w.y1 - w.y0) * 0.14, y1: w.y1 - (w.y1 - w.y0) * 0.08 });
const MOON_SLANT = 0.45;   // луна сверху слева: луч идёт вниз-вправо

export function drawVibeFx(g, fx, o) {
  const { sx, k, t, dt, floor, gy } = o, vt = o.vt ?? t;
  if (!state || state.fx !== fx) state = { fx, parts: [], leaves: [], clouds: null, birds: null, acc: 0, lacc: 0 };
  const S = state, W = wind(t);
  g.save();

  if (fx === 'birds') {
    // свечение заката — там, где оно на картине (даль неподвижна), дышит медленно
    const sun = o.sun ?? { x: 300, y: 54 };
    g.globalCompositeOperation = 'lighter';
    const r = 70, grd = g.createRadialGradient(sun.x, sun.y, 2, sun.x, sun.y, r);
    grd.addColorStop(0, 'rgba(255,190,120,0.3)'); grd.addColorStop(1, 'rgba(255,150,90,0)');
    g.globalAlpha = k * (0.75 + 0.25 * Math.sin(t * 0.4));
    g.fillStyle = grd; g.fillRect(sun.x - r, sun.y - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over';
    // облака тянутся по небу с ветром
    if (!S.clouds) S.clouds = Array.from({ length: 5 }, (_, i) => makeCloud(i * 72 + rnd(0, 30), rnd(10, 38), rnd(0.8, 1.3)));
    for (const c of S.clouds) {
      c.x += c.v * (0.6 + W * 0.5) * dt;
      if (c.x > 360) Object.assign(c, makeCloud(-40, rnd(10, 38), rnd(0.8, 1.3)));
      cloud(g, c, c.x, c.y, 0.16 * k, '#f2c9b8');
    }
    // стая — раз в полминуты, неторопливо
    if (!S.birds) S.birds = Array.from({ length: 7 }, (_, i) => ({ dx: -Math.abs(i - 3) * 9 - rnd(0, 3), dy: Math.abs(i - 3) * 2.2 * (i < 3 ? -1 : 1) + rnd(-1, 1), ph: rnd(0, 6.28), sp: rnd(6, 8) }));
    const lead = -10 + ((vt * 13) % 520), ly = 26 + Math.sin(vt * 0.35) * 4;
    for (const b of S.birds) {
      const x = lead + b.dx, y = ly + b.dy + Math.sin(t * 1.2 + b.ph) * 1.2, up = Math.sin(t * b.sp + b.ph) > 0, c = '#2a2034';
      px(g, x - 0.5, y, 2, 1, c, k);
      if (up) { px(g, x - 2, y - 1, 1.5, 1, c, k); px(g, x - 3.5, y - 2, 1.5, 1, c, k); px(g, x + 1.5, y - 1, 1.5, 1, c, k); px(g, x + 3, y - 2, 1.5, 1, c, k); }
      else { px(g, x - 2.5, y + 0.5, 2, 1, c, k); px(g, x - 4, y + 1, 1.5, 0.5, c, k); px(g, x + 1.5, y + 0.5, 2, 1, c, k); px(g, x + 3.5, y + 1, 1.5, 0.5, c, k); }
    }
    // листья с деревьев внизу летят через весь кадр
    S.lacc += dt * (1.5 + W * 2.5) * k;
    while (S.lacc > 1) { S.lacc--; S.leaves.push(newLeaf(-4, rnd(40, 150), 10, rnd(-3, 4))); }
    for (const p of S.leaves) { stepLeaf(p, dt, W, t); leaf(g, p, k); }
    S.leaves = S.leaves.filter(p => p.x < 330 && p.y < 185 && p.y > -10);
    // тонкие струи ветра в порывах
    S.acc += dt * Math.max(0, W - 0.7) * 3 * k;
    while (S.acc > 1) { S.acc--; S.parts.push({ x: rnd(-20, 200), y: rnd(20, 140), len: rnd(14, 30), t: 0, life: rnd(0.8, 1.4) }); }
    for (const p of S.parts) { p.t += dt; p.x += W * 60 * dt; px(g, p.x, p.y, p.len, 0.5, '#f4e6d8', Math.sin(Math.PI * p.t / p.life) * 0.18 * k); }
    S.parts = S.parts.filter(p => p.t < p.life);
  } else if (fx === 'moon') {
    const w = opening(o.win ?? { x0: sx - 13, x1: sx + 13, y0: 26, y1: 60 });
    // облака у луны — внутри проёма; когда облако на луне, луч тускнеет
    if (!S.clouds) S.clouds = Array.from({ length: 3 }, (_, i) => ({ ...makeCloud(i * 26 - 20, rnd(3, 9), 0.45), v: rnd(1.2, 2) }));
    let cover = 0;
    g.save();
    g.beginPath(); g.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); g.clip();
    for (const c of S.clouds) {
      c.x += c.v * (0.5 + W * 0.4) * dt;
      if (c.x > 40) Object.assign(c, { ...makeCloud(-34, rnd(3, 9), 0.45), v: rnd(1.2, 2) });
      cover = Math.max(cover, Math.max(0, 1 - Math.abs(c.x - 3) / 12));
      cloud(g, c, (w.x0 + w.x1) / 2 + c.x - 3, w.y0 + c.y, 0.55 * k, '#7d8aa8');
    }
    g.restore();
    const lit = k * (1 - cover * 0.55) * (0.9 + 0.1 * Math.sin(t * 0.5));
    // луч: проём, протянутый вниз-вправо до пола; на полу — пятно формы окна
    const fy0 = floor + 3, fy1 = floor + 3 + (w.y1 - w.y0) * 0.3;
    const b0 = w.x0 + (fy0 - w.y1) * MOON_SLANT, b1 = w.x1 + (fy0 - w.y0) * MOON_SLANT;
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(0, w.y0, 0, fy0);
    grd.addColorStop(0, 'rgba(170,200,255,0.26)'); grd.addColorStop(1, 'rgba(170,200,255,0.06)');
    g.globalAlpha = lit; g.fillStyle = grd;
    g.beginPath(); g.moveTo(w.x0, w.y1); g.lineTo(w.x0, w.y0); g.lineTo(w.x1, w.y0); g.lineTo(b1, fy0); g.lineTo(b0, fy0); g.closePath(); g.fill();
    g.globalAlpha = lit * 0.22; g.fillStyle = '#cfdcff';
    const sk = (fy1 - fy0) * MOON_SLANT * 2;
    g.beginPath(); g.moveTo(b0, fy0); g.lineTo(b1, fy0); g.lineTo(b1 + sk, fy1); g.lineTo(b0 + sk, fy1); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    // пыль в луче
    if (!S.parts.length) S.parts = Array.from({ length: 30 }, () => ({ u: Math.random(), v: Math.random(), ph: rnd(0, 6.28), s: rnd(0.15, 0.4) }));
    for (const p of S.parts) {
      p.v = (p.v + dt * 0.02 * p.s) % 1;
      const y = w.y0 + p.v * (fy0 - w.y0), x = w.x0 + (y - w.y0) * MOON_SLANT + p.u * (w.x1 - w.x0) + Math.sin(t * p.s * 3 + p.ph) * 1.5;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.ph * 3);
      px(g, x, y, 0.5, 0.5, '#e8f0ff', lit * (0.25 + 0.6 * tw));
    }
    // лист залетает в окно и медленно падает сквозь луч
    S.lacc += dt * 0.25 * k;
    while (S.lacc > 1) { S.lacc--; S.leaves.push(newLeaf(rnd(w.x0, w.x1), w.y0 + 2, 2, rnd(5, 8))); }
    for (const p of S.leaves) { stepLeaf(p, dt, W * 0.25, t); leaf(g, p, k); }
    S.leaves = S.leaves.filter(p => p.y < fy1 + 2);
  } else if (fx === 'rain') {
    // пролом (o.hole: x0, x1, y — низ пролома) → отвесный столб света до лужи; ветер чуть косит дождь
    const h = o.hole ?? { x0: sx - 12, x1: sx + 12, y: o.top ?? 20 }, py = gy(o.z ?? 22), lean = W * 0.06;
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(0, h.y, 0, py);
    grd.addColorStop(0, 'rgba(190,212,245,0.22)'); grd.addColorStop(1, 'rgba(190,212,245,0.05)');
    g.globalAlpha = k; g.fillStyle = grd;
    const d = (py - h.y) * lean;
    g.beginPath(); g.moveTo(h.x0, h.y); g.lineTo(h.x1, h.y); g.lineTo(h.x1 + 3 + d, py + 2); g.lineTo(h.x0 - 3 + d, py + 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    S.acc += dt * 24 * k;
    while (S.acc > 1) { S.acc--; S.parts.push({ x: rnd(h.x0, h.x1), y: h.y + rnd(-3, 3), vy: rnd(150, 210), t: 0, splash: 0 }); }
    for (const p of S.parts) {
      if (!p.splash) {
        p.y += p.vy * dt; p.x += p.vy * dt * lean;
        if (p.y >= py - rnd(-2, 2)) { p.splash = 0.001; p.y = py + rnd(-2, 2); }
        else px(g, p.x, p.y, 0.5, 3, '#c4dcf5', 0.75 * k);
      } else {
        p.splash += dt;
        const r = 1 + p.splash * 14, a = 0.6 * (1 - p.splash / 0.45) * k;
        if (a > 0) { px(g, p.x - r, p.y, 1, 0.5, '#9ab8d8', a); px(g, p.x + r - 1, p.y, 1, 0.5, '#9ab8d8', a); px(g, p.x - r * 0.5, p.y - 0.5, r, 0.5, '#7f9cbc', a * 0.5); }
        if (p.splash < 0.12) px(g, p.x, p.y - 2 - p.splash * 20, 0.5, 0.5, '#d4e6ff', 0.7 * k);
      }
    }
    S.parts = S.parts.filter(p => !p.splash || p.splash < 0.45);
    // изредка мокрый лист кружит вниз сквозь пролом и лежит на воде
    S.lacc += dt * 0.12 * k;
    while (S.lacc > 1) { S.lacc--; S.leaves.push(newLeaf(rnd(h.x0, h.x1), h.y, 0, rnd(9, 13))); }
    for (const p of S.leaves) { if (p.y < py) stepLeaf(p, dt, W * 0.15, t); else p.rest = (p.rest ?? 0) + dt; leaf(g, p, k * (1 - Math.max(0, (p.rest ?? 0) - 3))); }
    S.leaves = S.leaves.filter(p => (p.rest ?? 0) < 4);
  } else if (fx === 'embers') {
    // костёр: искры вьются вверх и гаснут, сизый дым тянется к потолку и уходит по ветру
    const cx = o.fireX, cy = gy(o.z ?? 20) - 8;
    S.acc += dt * 20 * k;
    while (S.acc > 1) {
      S.acc--;
      const smoke = Math.random() < 0.3;
      S.parts.push({ x: cx + rnd(-4, 4), y: cy - rnd(0, 4), vx: rnd(-4, 4), vy: smoke ? rnd(-10, -6) : rnd(-36, -20), ph: rnd(0, 6.28), t: 0, life: smoke ? rnd(3, 5) : rnd(1, 2.4), smoke });
    }
    for (const p of S.parts) {
      p.t += dt; p.x += (p.vx + Math.sin(t * 3 + p.ph) * 8 + W * (p.smoke ? 10 : 5) * Math.min(1, p.t)) * dt; p.y += p.vy * dt; if (!p.smoke) p.vy *= 0.995;
      const u = p.t / p.life;
      if (p.smoke) { const s = 2 + u * 9; px(g, p.x - s / 2, p.y - s / 2, s, s * 0.6, '#5c5866', 0.12 * (1 - u) * k); }
      else { const sz = u < 0.4 ? 1 : 0.5; px(g, p.x, p.y, sz, sz, u < 0.35 ? '#fff0a8' : u < 0.7 ? '#ffae4a' : '#d4502a', (1 - u * u) * k); }
    }
    S.parts = S.parts.filter(p => p.t < p.life);
  }
  if (S.parts.length > 400) S.parts.splice(0, S.parts.length - 400);
  if (S.leaves.length > 60) S.leaves.splice(0, S.leaves.length - 60);
  g.restore();
}

// где лунный свет падает на пол (мир минус камера) — туда ставится источник живого света
export function moonSpot(win, floor) {
  const w = opening(win), fy0 = floor + 3;
  return { x: (w.x0 + (fy0 - w.y1) * MOON_SLANT + w.x1 + (fy0 - w.y0) * MOON_SLANT) / 2, y: fy0 + 3 };
}
