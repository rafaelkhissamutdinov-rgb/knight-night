// Эффекты боя (v0.83, владелец: «атаки, отражения, блоки должны различаться и читаться»). Рисуются на слое поверх
// живого света (fxCanvas в main.js) — видны и в тёмных комнатах. Время — настоящее (performance.now): во время
// стоп-кадра удара (hitstop) кольца и вспышки продолжают расходиться — так удар «звенит».
//   росчерк клинка — дуга по следу острия (у Найта светлая, у врагов красная): видно, куда и как бьют;
//   блеск на клинке в начале замаха врага;
//   исходы: hit (разрез по цели), block (сине-белая звезда и полукольцо), perfect (золотое кольцо с лучами),
//   broken (рваное кольцо и осколки), deflect (враг закрылся — синий отскок), counter (золотой крест), miss (свист).
const now = () => performance.now() / 1000;
const impacts = [];
const swings = new Map();
const LIFE = { hit: 0.24, block: 0.22, perfect: 0.42, broken: 0.5, deflect: 0.22, counter: 0.4, miss: 0.2, glint: 0.2, dodge: 0.3 };
const SWING_LIFE = 0.13;

// x, y — мир; dir — откуда пришёл удар (направление атакующего: +1 вправо); height — high | mid | low | any
export function fxImpact(kind, x, y, o = {}) {
  if (impacts.length > 40) impacts.shift();
  const it = { kind, x, y, t0: now(), dir: o.dir ?? 1, h: o.height ?? 'mid', big: o.big ?? 1, color: o.color };
  if (kind === 'broken') it.shards = Array.from({ length: 7 }, (_, i) => ({ a: -Math.PI / 2 + (i - 3) * 0.45 + (Math.random() - 0.5) * 0.3, v: 40 + Math.random() * 40, r: Math.random() * 6 }));
  impacts.push(it);
}

// след клинка: острие (tip) и плечо (pivot) в этот кадр; дуга строится вокруг плеча — как настоящий мах
export function fxSwing(actor, tipX, tipY, baseX, baseY, color) {
  let s = swings.get(actor);
  if (!s) swings.set(actor, s = { pts: [] });
  s.color = color;
  const last = s.pts[s.pts.length - 1];
  if (last && Math.hypot(last.tx - tipX, last.ty - tipY) < 0.6) return;
  s.pts.push({ tx: tipX, ty: tipY, bx: baseX, by: baseY, t: now() });
  if (s.pts.length > 12) s.pts.shift();
}

function ribbon(g, s, cam, tn) {
  const pts = s.pts.filter(p => tn - p.t < SWING_LIFE);
  s.pts = pts;
  if (pts.length < 2) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  // между соседними кадрами острие идёт по дуге вокруг плеча (угол и радиус плавно), ширина — внешние 40 % клинка
  const arc = [];
  for (let i = 0; i < pts.length; i++) {
    const b = pts[i], ab = Math.atan2(b.ty - b.by, b.tx - b.bx), rb = Math.hypot(b.tx - b.bx, b.ty - b.by);
    if (!i) { arc.push({ x: b.bx, y: b.by, a: ab, r: rb, t: b.t }); continue; }
    const a = pts[i - 1], aa = Math.atan2(a.ty - a.by, a.tx - a.bx), ra = Math.hypot(a.tx - a.bx, a.ty - a.by);
    let da = ab - aa; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const n = Math.max(1, Math.min(8, Math.ceil(Math.abs(da) / 0.2)));
    for (let j = 1; j <= n; j++) {
      const u = j / n;
      arc.push({ x: a.bx + (b.bx - a.bx) * u, y: a.by + (b.by - a.by) * u, a: aa + da * u, r: ra + (rb - ra) * u, t: a.t + (b.t - a.t) * u });
    }
  }
  const P = (q, f) => [q.x + Math.cos(q.a) * q.r * f - cam, q.y + Math.sin(q.a) * q.r * f];
  g.fillStyle = s.color;
  for (let i = 1; i < arc.length; i++) {
    const a = arc[i - 1], b = arc[i];
    const k = 1 - (tn - b.t) / SWING_LIFE;
    g.globalAlpha = 0.42 * k * k;
    const [ax0, ay0] = P(a, 0.6), [ax1, ay1] = P(a, 1), [bx1, by1] = P(b, 1), [bx0, by0] = P(b, 0.6);
    g.beginPath(); g.moveTo(ax0, ay0); g.lineTo(ax1, ay1); g.lineTo(bx1, by1); g.lineTo(bx0, by0); g.closePath(); g.fill();
  }
  // яркая кромка по следу острия
  g.globalAlpha = 0.85;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 0.6;
  g.beginPath();
  arc.forEach((q, i) => { const [x, y] = P(q, 1); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  g.restore();
}

const ANG = { high: 0.95, mid: 0.12, low: -0.7, any: 0.4 };
function star(g, x, y, r, rays, color, w = 0.7) {
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath();
  for (let i = 0; i < rays; i++) { const a = i * Math.PI * 2 / rays + Math.PI / 4 * (rays === 4); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.stroke();
}

function drawImpact(g, it, cam, tn) {
  const age = tn - it.t0, life = LIFE[it.kind] ?? 0.25, k = age / life;
  if (k >= 1) return false;
  const x = it.x - cam, y = it.y, e = 1 - k, d = it.dir;
  g.save();
  g.globalCompositeOperation = 'lighter';
  switch (it.kind) {
    case 'hit': {
      // разрез по цели: светлая полоса под углом удара, быстро вырастает и гаснет в красный
      const grow = Math.min(1, age / 0.04), L = 11 * it.big * grow, a = ANG[it.h] * d;
      const cx = Math.cos(a) * d, cy = Math.sin(a);
      g.globalAlpha = e;
      g.strokeStyle = k < 0.35 ? '#ffffff' : '#ff5a6a'; g.lineWidth = 1.6 * e + 0.4;
      g.beginPath(); g.moveTo(x - cx * L, y - cy * L); g.lineTo(x + cx * L, y + cy * L); g.stroke();
      g.globalAlpha = e * 0.5; star(g, x, y, 4 * e, 6, '#ffd0d0');
      break;
    }
    case 'block': {
      // клинок о клинок: сине-белая звезда и полукольцо волны к атакующему
      g.globalAlpha = e;
      star(g, x, y, 7 * e + 1, 4, '#e6f3ff', 1);
      const r = 3 + 10 * k;
      g.strokeStyle = '#8fc4ff'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, r, d > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, d > 0 ? Math.PI * 1.4 : Math.PI * 0.4); g.stroke();
      break;
    }
    case 'perfect': {
      // идеальное парирование: золотое кольцо расходится, восемь лучей, белая сердцевина в первые мгновения
      const r = 3 + 20 * Math.sqrt(k);
      g.globalAlpha = e;
      g.strokeStyle = '#ffe08a'; g.lineWidth = 1.4 * e + 0.3;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = e * 0.8;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; g.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45); g.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); }
      g.stroke();
      if (age < 0.09) { g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(x - 2, y - 2, 4, 4); }
      break;
    }
    case 'broken': {
      // защита сбита: рваное оранжевое кольцо и осколки, падающие под тяжестью
      g.globalAlpha = e;
      g.strokeStyle = '#ff9a4a'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= 12; i++) { const a = i * Math.PI / 6, r = (4 + 12 * k) * (i % 2 ? 0.7 : 1); i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + r, y); }
      g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#b8c0d0';
      for (const s of it.shards) {
        const px = x + Math.cos(s.a) * s.v * age, py = y + Math.sin(s.a) * s.v * age + 120 * age * age;
        g.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, 1, 1);
      }
      break;
    }
    case 'deflect': {
      // твой удар отбит: синий отскок «<» от цели обратно к рыцарю
      g.globalAlpha = e;
      g.strokeStyle = '#9ccfff'; g.lineWidth = 1;
      const s = 4 + 4 * k, bx = x - d * (2 + 6 * k);
      g.beginPath(); g.moveTo(bx + d * s, y - s); g.lineTo(bx, y); g.lineTo(bx + d * s, y + s); g.stroke();
      star(g, x, y, 4 * e + 1, 4, '#ffffff', 0.8);
      break;
    }
    case 'counter': {
      // контратака: золотой крест-разрез и кольцо
      const L = 13 * Math.min(1, age / 0.05);
      g.globalAlpha = e;
      g.strokeStyle = '#fff2b0'; g.lineWidth = 2 * e + 0.5;
      g.beginPath(); g.moveTo(x - L, y - L); g.lineTo(x + L, y + L); g.moveTo(x - L, y + L); g.lineTo(x + L, y - L); g.stroke();
      g.strokeStyle = '#ffcc55'; g.lineWidth = 0.8;
      g.beginPath(); g.arc(x, y, 4 + 14 * k, 0, Math.PI * 2); g.stroke();
      break;
    }
    case 'miss': {
      // промах: серый свист по воздуху
      g.globalAlpha = e * 0.6;
      g.strokeStyle = '#c9c4d8'; g.lineWidth = 0.6;
      for (const o of [-3, 2]) { g.beginPath(); g.moveTo(x - d * 8, y + o); g.quadraticCurveTo(x, y + o - 2, x + d * (6 + 8 * k), y + o); g.stroke(); }
      break;
    }
    case 'glint': {
      // блеск на клинке перед ударом врага (белый — обычный, оранжевый — нельзя отбить обычным блоком)
      const r = 5 * Math.sin(Math.PI * k) + 0.5;
      g.globalAlpha = 1;
      star(g, x, y, r, 4, it.color ?? '#ffffff', 0.8);
      g.fillStyle = '#ffffff'; g.fillRect(x - 0.5, y - 0.5, 1, 1);
      break;
    }
  }
  g.restore();
  return true;
}

export function drawCombatFx(g, cam) {
  const tn = now();
  for (const [actor, s] of swings) { ribbon(g, s, cam, tn); if (!s.pts.length) swings.delete(actor); }
  for (let i = impacts.length - 1; i >= 0; i--) if (!drawImpact(g, impacts[i], cam, tn)) impacts.splice(i, 1);
}
export const combatFxBusy = () => impacts.length > 0 || swings.size > 0;
