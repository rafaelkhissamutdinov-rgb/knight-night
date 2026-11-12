// Проба стиля (v1.12, владелец: «не хватает графики — стиля, дизайна»; ориентиры — Hollow Knight, Celeste, Dead Cells).
// Включается только по адресу с ?style — в обычной игре ничего не меняется, пока владелец не одобрит.
// Что добавляет комнате с полем vista:
//  — высокие стрельчатые окна: в стене прорезаны проёмы, за ними — дальний план (долина с балкона), он едет медленнее стены;
//  — закатный свет из окон: полосы света в пыльном воздухе, пятна на полу, тёплые источники для живого света;
//  — передний план: тёмные силуэты (колонны, рваные полотнища под сводом, обломки у нижнего края), едут быстрее стены.
// Всё рисуется в разрешении экрана (1 px = 1 px), без увеличенных картинок.

export const STYLE2 = typeof location !== 'undefined' && new URLSearchParams(location.search).has('style');

// поправки комнат для пробы: поля ложатся поверх ROOMS[id]
export const STYLE_ROOMS = {
  dining: {
    // окна — в правой половине зала (над столом), очаг и гобелен — слева: тёплый угол и закат из окон
    vista: {
      img: 'assets/backgrounds/balcony/far.png', y: -14, shift: 0.1,
      windows: [{ x: 268 }, { x: 320 }, { x: 372 }],
      w: 30, top: 30, bottom: 94,
      sun: [-46, 60],          // куда падает свет: от окна влево-вниз, на пол
      color: [1, 0.66, 0.42],  // закат
    },
    tint: [0.88, 0.85, 1],   // стены холоднее и темнее — закат и огонь на них заметнее
    fg: {
      pillars: [238, 455],
      drapes: [[30, 54, 22], [176, 40, 16], [318, 62, 26], [470, 44, 18]],   // [x, ширина, провис]
      rubble: [96, 290, 505],
    },
  },
};
export function applyStyleRooms(ROOMS) {
  if (!STYLE2) return;
  for (const [id, over] of Object.entries(STYLE_ROOMS)) if (ROOMS[id]) Object.assign(ROOMS[id], over);
}

// ---------- окна ----------
// стрельчатая арка: полуширина проёма на строке y (в пикселях экрана); за пределами проёма — -1
function lancet(y, top, bottom, w) {
  const rise = Math.round(w * 0.866), spring = top + rise;
  if (y < top || y >= bottom) return -1;
  if (y >= spring) return w / 2;
  const h = spring - y;
  return Math.sqrt(Math.max(0, w * w - h * h)) - w / 2;
}
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Прорезать окна в картинке стены (g) и пометить проёмы в карте нормалей (ng): чёрный цвет нормали = «светится само»
// (небо за окном не должно темнеть от света комнаты). Координаты — пиксели экрана (комната ×2).
export function cutVista(g, ng, room, floorTop) {
  const v = room.vista;
  const W = v.w * 2, top = v.top * 2, bottom = v.bottom * 2, F = 5;   // F — толщина каменной рамы
  const px = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  for (const win of v.windows) {
    const cx = win.x * 2;
    // рама: камень светлее стены, сверху-слева блик, снизу-справа тень; правый откос ловит закат
    for (let y = top - F - 2; y < bottom; y++) {
      const out = lancet(y + 0, top - F - 2, bottom, W + F * 2 + 2), inn = lancet(y, top, bottom, W);
      if (out < 0) continue;
      const x0 = Math.round(cx - out), x1 = Math.round(cx + out);
      px(g, x0, y, x1 - x0, 1, '#544856');
      px(g, x0, y, 2, 1, '#756869'); px(g, x1 - 2, y, 2, 1, '#312832');
      if (ng) px(ng, x0, y, x1 - x0, 1, 'rgb(128,128,255)');
      if (inn < 0) continue;
      const a0 = Math.round(cx - inn), a1 = Math.round(cx + inn);
      g.clearRect(a0, y, a1 - a0, 1);
      if (ng) px(ng, a0, y, a1 - a0, 1, 'rgb(0,0,0)');
      // откосы — толща стены: слева в тени, справа освещён
      px(g, a0, y, 3, 1, '#211923'); px(g, a1 - 2, y, 2, 1, '#8a6250');
      if (ng) { px(ng, a0, y, 3, 1, 'rgb(128,128,255)'); px(ng, a1 - 2, y, 2, 1, 'rgb(128,128,255)'); }
    }
    // переплёт: средник, две малые арки, круглое окошко наверху, поперечины — тёмным силуэтом на фоне неба
    const DARK = '#1a141d', rise = Math.round(W * 0.866), spring = top + rise;
    const bar = (x, y, w, h) => { px(g, x, y, w, h, DARK); if (ng) px(ng, x, y, w, h, 'rgb(128,128,255)'); };
    bar(cx - 1, spring - 18, 3, bottom - spring + 18);
    for (const side of [-1, 1]) {
      const sw = W / 2 - 3, scx = cx + side * (W / 4);
      for (let y = spring - Math.round(sw * 0.866) - 6; y < spring; y++) {
        const hw = lancet(y, spring - Math.round(sw * 0.866) - 6, spring + 1, sw);
        if (hw < 0) continue;
        bar(Math.round(scx - hw) - 1, y, 2, 1); bar(Math.round(scx + hw) - 1, y, 2, 1);
      }
    }
    const oy = top + 20, R = 8;
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; bar(Math.round(cx + Math.cos(t) * R) - 1, Math.round(oy + Math.sin(t) * R) - 1, 2, 2); }
    for (const y of [spring + 26, spring + 54]) if (y < bottom - 8) bar(Math.round(cx - W / 2) + 3, y, W - 5, 2);
    // остатки стекла: мутные стёкла уцелели не везде — кое-где выбиты (замок брошен двести лет)
    const rows = [spring, spring + 28, spring + 56, bottom];
    for (let r = 0; r < rows.length - 1; r++) for (const side of [-1, 1]) {
      const k = hash(win.x + side, r);
      if (k < 0.45) continue;
      const gx = side < 0 ? Math.round(cx - W / 2) + 3 : cx + 2, gw = W / 2 - 5, gy = rows[r] + 2, gh = Math.min(rows[r + 1], bottom) - rows[r] - 2;
      for (let y = 0; y < gh; y++) {
        const cut = k > 0.7 ? Math.max(0, Math.round((gh - y) * 0.5 * hash(win.x, r + y * 0.01) + (y % 3))) : 0;   // скол по диагонали
        px(g, gx + (side < 0 ? 0 : cut), gy + y, Math.max(0, gw - cut), 1, 'rgba(126,150,168,0.30)');
      }
      px(g, gx, gy, gw, 1, 'rgba(210,225,235,0.35)');
    }
    // подоконник
    px(g, cx - W / 2 - 8, bottom, W + 16, 5, '#5c4f59'); px(g, cx - W / 2 - 8, bottom, W + 16, 1, '#8a7a78'); px(g, cx - W / 2 - 6, bottom + 5, W + 12, 2, '#211923');
    if (ng) px(ng, cx - W / 2 - 8, bottom, W + 16, 7, 'rgb(128,128,255)');
  }
}

// дальний план за окнами: рисуется до стены, едет в shift раз медленнее камеры; справа — зеркальное продолжение
const imgs = {};
export function drawVistaFar(g, room, cam) {
  const v = room.vista, im = (imgs[v.img] ??= Object.assign(new Image(), { src: v.img }));
  if (!im.complete || !im.naturalWidth) return;
  const w = im.width / 2, h = im.height / 2, x = -Math.round(cam * v.shift * 2) / 2;
  g.drawImage(im, x, v.y, w, h);
  g.save(); g.translate(x + w * 2, 0); g.scale(-1, 1); g.drawImage(im, 0, v.y, w, h); g.restore();
}

// свет из окон для живого света: тёплое пятно на полу под каждым окном и отсвет на стене
export function vistaLights(room, add, floorTop, t) {
  const v = room.vista;
  for (const win of v.windows) {
    const k = 0.92 + 0.08 * Math.sin(t * 0.7 + win.x);
    add(win.x + v.sun[0] * 0.75, floorTop + 22, 70, v.color, 0.95 * k, 18);
  }
  const mid = v.windows[Math.floor(v.windows.length / 2)].x;
  add(mid, (v.top + v.bottom) / 2, 130, v.color, 0.45, 46);
}

// полосы света в воздухе и пылинки — на слое поверх живого света (fx): ступенями, без плавных градиентов
export function drawShafts(fx, room, cam, floorTop, t, camF = cam) {
  const v = room.vista, [sx, sy] = v.sun, col = v.color.map(c => Math.round(c * 255)).join(',');
  for (const win of v.windows) {
    const x0 = win.x - v.w / 2 + 2 - cam, x1 = win.x + v.w / 2 - 2 - cam, y0 = v.top + 10, y1 = v.bottom;
    if (x1 < -80 || x0 > 400) continue;
    // три вложенные полосы: у окна свет плотнее, к полу редеет
    for (const [u, a] of [[1, 0.05], [0.66, 0.05], [0.36, 0.06]]) {
      fx.fillStyle = `rgba(${col},${a})`;
      fx.beginPath();
      fx.moveTo(x0, y0); fx.lineTo(x1, y0); fx.lineTo(x1, y1);
      fx.lineTo(x1 + sx * u, y1 + sy * u); fx.lineTo(x0 + sx * u, y1 + sy * u); fx.lineTo(x0 + sx * u, y0 + sy * u + (y1 - y0) * 0.55);
      fx.closePath(); fx.fill();
    }
    // пятно на полу: скошенное окно со средником
    for (let r = 0; r < 26; r += 2) {
      const yy = floorTop + 10 + r, xx = Math.round(win.x + sx * 0.9 - cam - r * 0.55 - v.w * 0.55);
      fx.fillStyle = `rgba(${col},0.10)`;
      fx.fillRect(xx, yy, v.w * 0.55, 2); fx.fillRect(xx + v.w * 0.55 + 2, yy, v.w * 0.55, 2);
    }
    // пылинки в луче
    for (let i = 0; i < 9; i++) {
      const ph = hash(win.x, i), u = (ph * 7 + t * (0.018 + ph * 0.02)) % 1, s = hash(i, win.x);
      const mx = x0 + (x1 - x0) * s + sx * u + Math.sin(t * 0.6 + i * 2.1) * 2, my = y0 + (y1 - y0) * (0.25 + 0.75 * hash(i * 3, 7)) + sy * u * 0.9;
      if (my > floorTop + 34) continue;
      fx.fillStyle = `rgba(255,236,205,${0.35 + 0.35 * Math.sin(t * 1.7 + i * 5)})`;
      fx.fillRect(Math.round(mx * 2) / 2, Math.round(my * 2) / 2, 0.5, 0.5);
    }
  }
  // колонны переднего плана стоят ближе к нам, чем лучи: свет на них не ложится
  for (const X of room.fg?.pillars ?? []) fx.clearRect(Math.round((X - camF * FG) * 2) / 2 - 6, 0, 12, 400);
}

// передний план: тёмные силуэты ближе к нам, чем герои; едут быстрее стены (FG — во сколько раз)
const FG = 1.35, INK = '#0d0a12', MID = '#191320', RIM = '#5a3c38';
export function drawForeground(g, room, cam, H, t) {
  const f = room.fg;
  if (!f) return;
  const sx = X => Math.round((X - cam * FG) * 2) / 2;
  const r = (x, y, w, h, c = INK) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // колонна: гранёный ствол (тёмная грань, средняя, узкая освещённая кромка со стороны окон), капитель и база ступенями
  for (const X of f.pillars ?? []) {
    const x = sx(X);
    if (x < -30 || x > 350) continue;
    r(x - 6, 0, 12, H);
    r(x - 1, 0, 5, H, MID);
    r(x + 5, 0, 1, H, RIM); r(x + 4.5, 0, 0.5, H, '#33242a');
    for (const [dy, w] of [[0, 22], [5, 18], [9, 15]]) { r(x - w / 2, dy, w, dy ? 3 : 5); r(x + w / 2 - 1, dy, 1, dy ? 3 : 5, RIM); }   // капитель
    for (const [dy, w] of [[14, 16], [9, 20], [4, 24]]) { r(x - w / 2, H - dy, w, 5); r(x + w / 2 - 1, H - dy, 1, 1, RIM); }               // база
    for (let y = 34; y < H - 20; y += 27) r(x - 6, y, 12, 0.5, '#07050a');   // швы барабанов
  }
  // рваное полотнище под сводом: провисает дугой между двумя креплениями, с него свисают лоскуты; чуть колышется
  for (const [X, w, drop] of f.drapes ?? []) {
    const x0 = sx(X * 1.12);
    if (x0 < -w - 10 || x0 > 330) continue;
    for (let i = 0; i <= w * 2; i++) {
      const u = i / (w * 2), sag = Math.sin(u * Math.PI) * drop;
      r(x0 + i / 2, Math.round(sag * 2) / 2, 0.5, 4 - Math.abs(u - 0.5) * 3);
      r(x0 + i / 2, 0, 0.5, u < 0.06 || u > 0.94 ? sag + 2 : 0);
    }
    const n = Math.max(3, Math.round(w / 9));
    for (let k = 0; k < n; k++) {   // лоскуты: клинья разной длины
      const u = (k + 0.5 + (hash(X, k) - 0.5) * 0.6) / n, len = 6 + hash(k, X) * drop * 0.9, wd = 3 + hash(X + k, 2) * 4;
      const sway = Math.sin(t * 1.2 + X + k * 1.7) * 1.5;
      for (let y = 0; y < len; y++) {
        const ww = wd * (1 - y / len);
        r(Math.round((x0 + u * w - ww / 2 + sway * (y / len)) * 2) / 2, Math.sin(u * Math.PI) * drop + 2 + y, Math.max(0.5, ww), 1);
      }
    }
  }
  // обломки у нижнего края: низкие кучи камней
  for (const X of f.rubble ?? []) {
    const x = sx(X * 1.2);
    if (x < -40 || x > 350) continue;
    for (const [dx, w, h] of [[-14, 30, 3], [-10, 20, 5], [-5, 11, 7], [8, 9, 5], [-19, 6, 4]]) r(x + dx, H - h, w, h);
    r(x - 3, H - 8, 6, 1, MID); r(x - 9, H - 6, 5, 1, MID);
  }
}

// затемнение по краям кадра — взгляд держится в середине; рисуется на слое поверх света
let vig = null;
export function drawVignette(fx, W, H) {
  if (!vig) {
    vig = document.createElement('canvas'); vig.width = W; vig.height = H;
    const c = vig.getContext('2d'), gr = c.createRadialGradient(W / 2, H * 0.52, H * 0.42, W / 2, H * 0.52, W * 0.62);
    gr.addColorStop(0, 'rgba(8,5,14,0)'); gr.addColorStop(0.6, 'rgba(8,5,14,0.16)'); gr.addColorStop(1, 'rgba(8,5,14,0.38)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }
  fx.drawImage(vig, 0, 0);
}
