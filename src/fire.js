// Живой огонь (v0.68): клеточная симуляция пламени в пикселях экрана (приём «огня из Doom»).
// Снизу — жар, каждая клетка отдаёт его вверх со случайным сдвигом вбок и остыванием: языки сами
// рвутся, мерцают и качаются. Цвета — ступенями (пиксель-арт), без размытия.
// Огонь — по ключу (комната + место): getFire(key, opts) хранит своё состояние, drawFire рисует и продвигает.

// палитра жара: 0 — пусто; низ — тёмно-красный край языков, верх — почти белое ядро
const PAL = [
  null, [58, 13, 10, 0.35], [107, 26, 14, 0.7], [156, 42, 16, 1], [200, 64, 26, 1], [224, 96, 31, 1],
  [240, 138, 42, 1], [247, 173, 60, 1], [252, 204, 90, 1], [255, 226, 138, 1], [255, 242, 192, 1], [255, 255, 236, 1],
];
const L = PAL.length - 1;
const STEP = 1 / 30;   // шаг симуляции: 30 раз в секунду — живо, но не мельтешит

const fires = new Map();

// opts: w, h — размер в пикселях экрана; base — доля ширины, где горит (0…1); tall — высота языков (0…1)
// px — размер клетки в пикселях экрана: 2 — клетка с пиксель мира (крупные языки, без «песка»), 1 — для мелкого пламени
export function getFire(key, { w: W, h: H, base = 0.7, tall = 0.8, px = 2 }) {
  let f = fires.get(key);
  if (f && f.W === W && f.H === H) return f;
  const w = Math.max(2, Math.round(W / px)), h = Math.max(4, Math.round(H / px));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  f = { W, H, px, w, h, base, tall, heat: new Uint8Array(w * h), c, x: c.getContext('2d'), img: null, t: null, seed: key.length * 7.3 };
  f.img = f.x.createImageData(w, h);
  // жар остывает так, чтобы языки доставали примерно до tall · h
  f.cool = Math.min(0.95, L / (h * tall));
  fires.set(key, f);
  for (let i = 0; i < h * 2; i++) step(f, i * STEP);   // сразу разгорелся
  return f;
}

function step(f, time) {
  const { w, h, heat } = f;
  // источник: нижний ряд горячий в середине, к краям слабее; угли вспыхивают
  const c = (w - 1) / 2, half = Math.max(1, (w * f.base) / 2);
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - c) / half;
    // сердцевина белая только посередине, к краям жёлтое и оранжевое
    heat[(h - 1) * w + x] = d > 1 ? 0 : Math.max(0, Math.round((L - 0.5) * (1 - d * 0.45)) - (Math.random() < 0.35 ? 1 : 0));
  }
  // ветерок: языки качаются вместе
  const wind = Math.sin(time * 1.7 + f.seed) * 0.6 + Math.sin(time * 4.1 + f.seed) * 0.3;
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = y * w + x;
      const v = heat[src];
      if (!v) { heat[src - w] = 0; continue; }
      const r = Math.random();
      const dx = Math.floor(Math.random() * 3) - 1 + (Math.random() < Math.abs(wind) * 0.5 ? Math.sign(wind) : 0);
      const nx = Math.min(w - 1, Math.max(0, x + dx));
      heat[(y - 1) * w + nx] = Math.max(0, v - (r < f.cool ? 1 : 0) - (r > 0.985 ? 2 : 0));   // изредка — отрыв языка
    }
  }
  // форма капли: чем выше, тем уже; за краем конуса жар быстро гаснет (без этого низ — прямоугольник)
  for (let y = 0; y < h - 1; y++) {
    const k = (h - 1 - y) / h;
    const lim = half * Math.pow(1 - k, 0.8) + 0.8 + Math.sin(time * 3 + y * 0.6) * 0.6;
    for (let x = 0; x < w; x++) {
      const out = Math.abs(x - c) - lim;
      if (out > 0) { const i = y * w + x; heat[i] = Math.max(0, heat[i] - 1 - Math.round(out)); }
    }
  }
}

function paint(f) {
  const { w, h, heat, img } = f;
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const p = PAL[heat[i]];
    const o = i * 4;
    if (!p) { d[o + 3] = 0; continue; }
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = p[3] * 255;
  }
  f.x.putImageData(img, 0, 0);
}

// Рисует огонь: низ по центру в (x, bottom) в координатах мира (холст в масштабе 2 → 1 клетка = 1 пиксель экрана).
// time — время игры: симуляция догоняет его шагами (не чаще STEP), при паузе огонь замирает.
export function drawFire(g, f, x, bottom, time) {
  if (f.t === null || time < f.t || time - f.t > 1) f.t = time;
  let n = 0;
  while (time - f.t >= STEP && n < 4) { step(f, f.t); f.t += STEP; n++; }
  if (n) paint(f);
  else if (!f.painted) paint(f);
  f.painted = true;
  g.save();
  g.imageSmoothingEnabled = false;
  const W = f.w * f.px, H = f.h * f.px;
  g.drawImage(f.c, Math.round(x * 2 - W / 2) / 2, Math.round(bottom * 2 - H) / 2, W / 2, H / 2);
  g.restore();
}
