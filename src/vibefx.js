// «Вайбовать» (v0.81, переделано в v0.83 по владельцу: «ветер, листья, облака, луна — как японское молчаливое
// созерцание природы»; «свет должен иметь понятный источник»). Рисуется на слое поверх живого света (мир 320×180).
// Общий ветер с порывами двигает листья, дым, дождь и облака. Свет — только от того, что видно на картинке:
//   birds  — балкон: облака плывут по небу, тёплое свечение заката там, где оно на картине (sun), листья по ветру,
//            изредка — стая птиц улетает вдаль, к горизонту;
//   moon   — лунное окно: по луне в проёме идут облака (луч тускнеет), луч — проём окна, протянутый наклонно до пола,
//            на полу светлое пятно той же формы; в луче — пыль и лист, залетевший в окно;
//   rain   — Часовня: отвесный столб света ширины пролома, дождь чуть косит по ветру, круги на луже, мокрый лист;
//   embers — привал: искры и дым, который сносит ветром.
// k — сила (0 → 1), t — время игры, vt — с начала вайба, dt — шаг.
const rnd = (a, b) => a + Math.random() * (b - a);
let state = null;

export function resetVibeFx() { state = null; }
// звёзды — только в небе картины: пиксель голубой и светлый, вокруг тоже небо (не листва); луна — в самом широком просвете
function skyStars(img) {
  if (!img?.complete || !img.naturalWidth) return null;
  // небо картины (мир 320×70, по пикселю картины 640×140): голубое и облака; маска — чтобы закат и ночь ложились только на небо
  const W2 = 640, H2 = 140;
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const x2 = c.getContext('2d', { willReadFrequently: true }); x2.drawImage(img, 0, 0, W2, H2, 0, 0, W2, H2);
  const id = x2.getImageData(0, 0, W2, H2), d = id.data;
  const skyAt = i => { const r = d[i], gg = d[i + 1], b = d[i + 2]; return (b > r + 25 && b > 110 && gg > r) || (r > 190 && gg > 195 && b > 200); };
  const m = new Uint8Array(W2 * H2);
  for (let i = 0; i < W2 * H2; i++) m[i] = skyAt(i * 4) ? 1 : 0;
  const mask = document.createElement('canvas'); mask.width = W2; mask.height = H2;
  const mx = mask.getContext('2d'), md = mx.createImageData(W2, H2);
  for (let i = 0; i < W2 * H2; i++) { md.data[i * 4 + 3] = m[i] ? 255 : 0; }
  mx.putImageData(md, 0, 0);
  const sky = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && m[y * W2 + x];
  const clear = (x, y, n) => { for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (!sky(x + dx * 2, y + dy * 2)) return false; return true; };
  const list = [];
  for (let y = 2; y < 128; y += 2) for (let x = 0; x < W2; x += 2) if (clear(x, y, 1) && Math.random() < 0.075)
    list.push({ x: x / 2, y: y / 2, ph: rnd(0, 6.28), s: Math.random() < 0.1 ? 2 : 1, thr: 0.45 + Math.random() * 0.5, warm: Math.random() < 0.2 });
  let moon = { x: 200, y: 20 }, best = -1;
  for (let y = 10; y < 50; y += 2) for (let x = 160; x < 300; x += 2) { let n = 0; while (n < 8 && clear(x, y, n + 1)) n++; if (n > best || (n === best && x > moon.x * 2)) { best = n; moon = { x: x / 2, y: y / 2 }; } }
  return { list, moon, mask };
}
// цвет неба по времени: k — 0 день … 1 ночь; dawn — путь обратно (рассвет розовее заката)
const SKY_DUSK = [[0, ['#ffffff', '#ffffff', 0]], [0.35, ['#5a4a8a', '#ff9a5a', 0.55]], [0.6, ['#2a2a62', '#c0587a', 0.72]], [1, ['#060b26', '#1b2552', 0.9]]];
const SKY_DAWN = [[0, ['#ffffff', '#ffffff', 0]], [0.35, ['#8a8ac8', '#ffc0a0', 0.45]], [0.65, ['#3a3a7a', '#e88aa0', 0.7]], [1, ['#060b26', '#1b2552', 0.9]]];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function skyAt(k, dawn) {
  const T = dawn ? SKY_DAWN : SKY_DUSK;
  let i = 0; while (i < T.length - 2 && k > T[i + 1][0]) i++;
  const [k0, a] = T[i], [k1, b] = T[i + 1], u = Math.max(0, Math.min(1, (k - k0) / (k1 - k0)));
  const mix = (p, q) => hex(p).map((v, j) => Math.round(v + (hex(q)[j] - v) * u));
  return { top: mix(a[0], b[0]), low: mix(a[1], b[1]), a: a[2] + (b[2] - a[2]) * u };
}

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

  if (fx === 'night') {
    // ночь на поляне (владелец, 22.10: «медленнее, красивее, звёзды у костра»): закат → сумерки → ночь; уходит — рассвет и снова день.
    // Темноту и свет костра даёт живой свет (applyLight в main.js); здесь — небо по маске картины, звёзды, луна, светлячки, искры
    if (!S.stars) S.stars = skyStars(o.sky);
    if (!S.stars) { g.restore(); return; }
    const N = o.night ?? k, dawn = !!o.dawn, cam = o.cam ?? 0;
    const sk = skyAt(N, dawn);
    if (sk.a > 0.01 && !o.painted) {   // небо: цветной градиент только по маске неба (облака и даль остаются под ним)
      const tc = S.tint ??= document.createElement('canvas');
      tc.width = 640; tc.height = 140;
      const tx = tc.getContext('2d');
      tx.globalCompositeOperation = 'source-over';
      tx.clearRect(0, 0, 640, 140);
      const gr = tx.createLinearGradient(0, 0, 0, 140);
      gr.addColorStop(0, `rgb(${sk.top})`); gr.addColorStop(1, `rgb(${sk.low})`);
      tx.fillStyle = gr; tx.fillRect(0, 0, 640, 140);
      tx.globalCompositeOperation = 'destination-in';
      tx.drawImage(S.stars.mask, 0, 0);
      g.globalAlpha = sk.a; g.drawImage(tc, -cam, 0, 320, 70);
      // солнце уходит за горизонт тёплым пятном (закат) / встаёт розовым (рассвет)
      const sunK = dawn ? Math.max(0, 1 - Math.abs(N - 0.4) / 0.35) : Math.max(0, 1 - Math.abs(N - 0.3) / 0.3);
      if (sunK > 0) {
        g.globalCompositeOperation = 'lighter';
        const sx = (dawn ? 70 : 250) - cam, sy = 62;
        const sg = g.createRadialGradient(sx, sy, 2, sx, sy, 90);
        sg.addColorStop(0, dawn ? 'rgba(255,190,200,0.5)' : 'rgba(255,160,90,0.55)'); sg.addColorStop(1, 'rgba(255,140,90,0)');
        g.globalAlpha = sunK; g.fillStyle = sg; g.fillRect(sx - 90, sy - 90, 180, 180);
        g.globalCompositeOperation = 'source-over';
      }
    }
    // звёзды загораются по одной (у каждой свой порог), мерцают — если ночь не нарисована на картине
    g.globalCompositeOperation = 'lighter';
    for (const st of o.painted ? [] : S.stars.list) {
      const on = Math.max(0, Math.min(1, (N - st.thr) / 0.12));
      if (on <= 0) continue;
      g.globalAlpha = on * (0.55 + 0.4 * Math.sin(t * (1.2 + st.ph * 0.3) + st.ph));
      g.fillStyle = st.warm ? '#ffe7c4' : '#dfe8ff';
      g.fillRect(st.x - cam, st.y, st.s, st.s);
      if (st.s > 1 && on > 0.5) { g.globalAlpha *= 0.35; g.fillRect(st.x - cam - 1, st.y + 0.5, 4, 1); g.fillRect(st.x - cam + 0.5, st.y - 1, 1, 4); }
    }
    // падающая звезда — иногда
    if (N > 0.85) {
      S.shoot ??= { t: -3 };
      S.shoot.t += dt;
      if (S.shoot.t > 7 + (S.shoot.wait ?? 0)) S.shoot = { t: 0, x: rnd(110, 260), y: rnd(6, 26), wait: rnd(0, 6) };
      if (S.shoot.t < 0.7 && S.shoot.x) {
        const u = S.shoot.t / 0.7, x0 = S.shoot.x - cam - u * 50, y0 = S.shoot.y + u * 18;
        for (let i = 0; i < 10; i++) { g.globalAlpha = (1 - u) * (1 - i / 10) * 0.8; g.fillStyle = '#ffffff'; g.fillRect(Math.round(x0 + i * 2.6), Math.round(y0 - i * 0.95), 1, 1); }
      }
    }
    // луна: поднимается с ночью
    const mm = S.stars.moon, mon = Math.max(0, Math.min(1, (N - 0.4) / 0.5));
    if (mon > 0 && !o.painted) {
      const mx = mm.x - cam, my = mm.y + (1 - mon) * 18;
      const gl = g.createRadialGradient(mx, my, 1, mx, my, 24); gl.addColorStop(0, 'rgba(200,215,255,0.32)'); gl.addColorStop(1, 'rgba(200,215,255,0)');
      g.globalAlpha = mon; g.fillStyle = gl; g.fillRect(mx - 24, my - 24, 48, 48);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#eef2ff'; g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9d3f0'; g.fillRect(mx - 1, my - 2, 2, 1); g.fillRect(mx + 1, my + 1, 1, 1);
      g.globalCompositeOperation = 'lighter';
    }
    // светлячки в траве и искры костра — ночью
    if (N > 0.5) {
      S.flies ??= Array.from({ length: 16 }, () => ({ x: rnd(20, 300), y: rnd(o.floor + 8, o.floor + 50), ph: rnd(0, 6.28), v: rnd(0.3, 0.8) }));
      for (const f of S.flies) {
        const fx = f.x + Math.sin(t * f.v + f.ph) * 8 - cam, fy = f.y + Math.sin(t * f.v * 1.3 + f.ph * 2) * 4, b = 0.5 + 0.5 * Math.sin(t * 2.3 + f.ph * 3);
        g.globalAlpha = (N - 0.5) * 2 * b * 0.8; g.fillStyle = '#d9ff8a'; g.fillRect(Math.round(fx), Math.round(fy), 1, 1);
        g.globalAlpha *= 0.3; g.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1); g.fillRect(Math.round(fx), Math.round(fy) - 1, 1, 3);
      }
      S.sparks ??= [];
      S.sacc = (S.sacc ?? 0) + dt * 7 * N;
      while (S.sacc > 1) { S.sacc--; S.sparks.push({ x: o.fireX + cam + rnd(-3, 3), y: gy(o.z ?? 24) - 6, vx: rnd(-4, 4), vy: rnd(-26, -14), life: rnd(0.8, 1.6), t: 0 }); }
      for (const p of S.sparks) { p.t += dt; p.x += (p.vx + Math.sin(t * 3 + p.y) * 3) * dt; p.y += p.vy * dt; }
      S.sparks = S.sparks.filter(p => p.t < p.life);
      for (const p of S.sparks) { const u = p.t / p.life; g.globalAlpha = (1 - u) * N; g.fillStyle = u < 0.4 ? '#ffe08a' : '#ff8a3a'; g.fillRect(Math.round(p.x - cam), Math.round(p.y), 1, 1); }
    }
    g.restore();
    return;
  }
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
    // стая улетает вдаль (владелец: «не вдоль экрана, а удаляются»): появляется близко, над балконом, крупно, и уходит
    // к горизонту — в сторону заката: меньше, медленнее машет, тает. Новая стая — раз в ~20 с.
    if (!S.birds) S.birds = Array.from({ length: 7 }, (_, i) => ({ dx: (i - 3) * 6 + rnd(-2, 2), dy: Math.abs(i - 3) * 3 + rnd(-1, 1), ph: rnd(0, 6.28), sp: rnd(6, 8) }));
    const FL = 11, cyc = (vt + 2) % 20;
    if (cyc < FL) {
      const u = cyc / FL, e = u * u * (3 - 2 * u);                       // плавно разгоняются и уходят
      const vx = sun.x - 30, vy = sun.y - 6;                            // куда улетают — к горизонту у заката
      const fx = 120 + (vx - 120) * e, fy = 40 + (vy - 40) * e;        // центр стаи: от ближнего неба над балконом — вдаль
      const sc = 1.8 * (1 - e) + 0.25 * e;                              // ближе — крупнее
      const fade = Math.min(1, cyc / 0.8) * Math.min(1, (FL - cyc) / 1.5);
      for (const b of S.birds) {
        const x = fx + b.dx * sc * 2.2, y = fy + b.dy * sc * 2 + Math.sin(t * 1.2 + b.ph) * sc;
        const flap = Math.sin(t * b.sp * (0.5 + sc * 0.4) + b.ph) > 0, c = '#2a2034', a = k * fade, w = Math.max(0.5, sc);
        px(g, x - w / 2, y, w, Math.max(0.5, sc * 0.6), c, a);           // тело
        const span = 1.6 * sc, lift = flap ? -0.9 * sc : 0.5 * sc;
        px(g, x - w / 2 - span, y + lift, span, Math.max(0.5, sc * 0.5), c, a);   // крылья
        px(g, x + w / 2, y + lift, span, Math.max(0.5, sc * 0.5), c, a);
        if (sc > 1) { px(g, x - w / 2 - span * 1.6, y + lift * 1.8, span * 0.6, 0.5, c, a); px(g, x + w / 2 + span, y + lift * 1.8, span * 0.6, 0.5, c, a); }
      }
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
