import { rect } from './draw.js';

// Титульный экран: ночь, луна, хребты, на пике — заброшенный замок с башней мага (в окне лиловый свет),
// внизу на уступе — силуэт Найта. Неподвижное рисуется один раз, поверх — звёзды, туман, мыши, огоньки.

const W = 320, H = 180;
let layer = null;

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const STARS = Array.from({ length: 70 }, () => [Math.floor(rand() * W), Math.floor(rand() * 95), rand()]);

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// хребет: высота по сумме синусов
function ridge(g, base, amp, f, ph, color, snow) {
  for (let x = 0; x < W; x++) {
    const y = Math.round(base - amp * (0.55 * Math.sin(x * f + ph) + 0.3 * Math.sin(x * f * 2.3 + ph * 1.7) + 0.15 * Math.sin(x * f * 5.1 + ph)));
    rect(g, x, y, 1, H - y, color);
    if (snow && y < base - amp * 0.35) rect(g, x, y, 1, 2, snow);
  }
}

function build() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // небо
  for (let y = 0; y < H; y++) {
    const k = y / 120;
    rect(g, 0, y, W, 1, k < 0.55 ? mix('#080a1e', '#241c48', k / 0.55) : mix('#241c48', '#5a3a62', Math.min(1, (k - 0.55) / 0.45)));
  }
  // луна с ореолом
  const halo = g.createRadialGradient(252, 40, 10, 252, 40, 60);
  halo.addColorStop(0, 'rgba(240,236,216,0.22)');
  halo.addColorStop(1, 'rgba(240,236,216,0)');
  g.fillStyle = halo;
  g.fillRect(190, 0, 130, 110);
  for (let y = -14; y <= 14; y++) {
    const hw = Math.round(Math.sqrt(196 - y * y));
    rect(g, 252 - hw, 40 + y, hw * 2, 1, '#f0ecd8');
  }
  for (const [x, y, r] of [[246, 34, 3], [257, 44, 4], [250, 48, 2], [259, 33, 2]]) rect(g, x - r / 2, y - r / 2, r, r, '#d0ccb4');
  // дальние и средние хребты
  ridge(g, 122, 18, 0.03, 1, '#3a3a66', '#b8c0e0');
  ridge(g, 136, 14, 0.045, 4, '#2a2a4c', null);
  // пик под замком
  for (let x = 70; x < 250; x++) {
    const t = (x - 160) / 90;
    const y = Math.round(78 + 70 * t * t + 3 * Math.sin(x * 0.7));
    rect(g, x, y, 1, H - y, '#1c1c34');
    if (x % 7 === 0) rect(g, x, y + 4, 1, 6, '#26264a');  // скальные грани
  }
  // замок
  const S = '#101024';
  rect(g, 138, 56, 46, 26, S);                                   // главный корпус
  for (let x = 138; x < 184; x += 4) rect(g, x, 53, 2, 3, S);     // зубцы
  rect(g, 128, 48, 12, 34, S); rect(g, 126, 45, 16, 3, S);        // левая башня
  for (let x = 126; x < 142; x += 4) rect(g, x, 42, 2, 3, S);
  rect(g, 186, 18, 10, 64, S);                                    // башня мага — высокая и тонкая
  for (let i = 0; i < 12; i++) rect(g, 191 - Math.floor(i / 2), 6 + i, Math.floor(i / 2) * 2 + 1, 1, S);  // шпиль
  rect(g, 184, 30, 14, 2, S);
  rect(g, 170, 44, 10, 14, S); rect(g, 168, 42, 14, 2, S);        // малая башня
  // обрушенный балкон справа от корпуса
  rect(g, 196, 70, 14, 3, S); rect(g, 208, 73, 4, 2, S); rect(g, 211, 75, 2, 2, S);
  // тёплые окна (костры мародёров) и тёмные проёмы
  for (const [x, y] of [[146, 64], [160, 66], [131, 56]]) rect(g, x, y, 2, 3, '#e0a040');
  for (const [x, y] of [[152, 62], [168, 64], [174, 50], [134, 64]]) rect(g, x, y, 2, 3, '#06060e');
  // передний план: скала с уступом слева
  for (let x = 0; x < W; x++) {
    const y = Math.round(x < 70 ? 124 + 2 * Math.sin(x * 0.3) : x < 100 ? 124 + (x - 70) * 0.85 : 150 + (x - 100) * 0.1 + 4 * Math.sin(x * 0.11));
    rect(g, x, y, 1, H - y, '#07070f');
  }
  layer = c;
}

// силуэт Найта на уступе: смотрит на замок, плюмаж и клинок ловят лунный свет
function knight(g, time) {
  const x = 46, b = 124;
  const C = '#04040a';
  rect(g, x - 3, b - 9, 2, 9, C); rect(g, x + 1, b - 9, 2, 9, C);         // ноги
  rect(g, x - 4, b - 21, 8, 12, C);                                       // корпус
  rect(g, x - 3, b - 29, 7, 8, C);                                        // шлем
  rect(g, x + 2, b - 25, 2, 1, '#2a2a40');                                 // прорезь забрала
  const sway = Math.round(Math.sin(time * 2) * 1);
  rect(g, x - 5 + sway, b - 34, 4, 2, '#8e2b3a'); rect(g, x - 7 + sway, b - 32, 3, 2, '#8e2b3a'); rect(g, x - 2, b - 31, 3, 2, '#8e2b3a');  // плюмаж
  rect(g, x + 4, b - 18, 2, 6, C);                                        // рука
  for (let i = 0; i < 12; i++) rect(g, x + 6 + Math.floor(i * 0.25), b - 13 + i, 1, 1, i < 2 ? '#e0a437' : '#9aa8c8');  // меч остриём вниз
  rect(g, x - 8, b - 20, 4, 14, '#0a0a18');                               // плащ за спиной
  rect(g, x - 9 - sway, b - 8, 3, 2, '#0a0a18');
}

export function drawTitle(g, time) {
  if (!layer) build();
  g.drawImage(layer, 0, 0);
  // звёзды мерцают
  for (const [x, y, p] of STARS) {
    const tw = Math.sin(time * (1 + p * 2) + p * 30);
    if (tw > -0.3) rect(g, x, y, 1, 1, tw > 0.7 ? '#ffffff' : '#9aa0d0');
  }
  // лиловый свет в окне башни — пульсирует
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.6);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(191, 24, 1, 191, 24, 16);
  gl.addColorStop(0, `rgba(170,90,255,${0.35 + 0.25 * pulse})`);
  gl.addColorStop(1, 'rgba(170,90,255,0)');
  g.fillStyle = gl;
  g.fillRect(175, 8, 32, 32);
  g.restore();
  rect(g, 190, 22, 2, 4, pulse > 0.5 ? '#e0c0ff' : '#b080ff');
  // окна мародёров дрожат
  if (Math.floor(time * 5) % 4 === 0) rect(g, 160, 66, 2, 3, '#ffd070');
  // туман в долине плывёт
  g.save();
  for (let i = 0; i < 4; i++) {
    const y = 128 + i * 6, x = ((time * (6 + i * 3) + i * 90) % 420) - 100;
    g.globalAlpha = 0.07;
    g.fillStyle = '#c8c8f0';
    g.fillRect(Math.round(x), y, 140, 3);
    g.fillRect(Math.round(x) + 30, y + 2, 90, 2);
  }
  g.restore();
  // летучие мыши кружат у башни
  for (let i = 0; i < 3; i++) {
    const a = time * (0.8 + i * 0.2) + i * 2.1;
    const bx = Math.round(191 + Math.cos(a) * (18 + i * 6)), by = Math.round(26 + Math.sin(a) * (7 + i * 2));
    const flap = Math.floor(time * 10 + i) % 2;
    rect(g, bx, by, 1, 1, '#000');
    rect(g, bx - 2, by - flap, 2, 1, '#000');
    rect(g, bx + 1, by - flap, 2, 1, '#000');
  }
  knight(g, time);
}
