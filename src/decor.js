import { PAL } from './palette.js';
import { rect, thick } from './draw.js';

// Убранство стен в комнатах, нарисованных кодом: знамёна, окна, портреты, гобелен, стойки с оружием,
// нары, кандалы, доспех на подставке, камин и люстра. Статичное рисуется один раз в фон комнаты
// (drawDecor), живое — огонь камина и свечи люстры — каждый кадр (drawDecorLive).
// В ROOMS: decor: [{ type, x, … }]; look — id разговора в DIALOGUES: E рядом — осмотреть.

const STONE = '#2f2a42', STONE_L = '#5a5276', STONE_D = '#1c1828';
const GOLD_D = '#a8822e';
const IRON = '#45424f', IRON_L = '#6d6a7a';

// эмблема замка: башня с зубцами (на знамёнах и щитах)
function emblem(g, cx, y, color) {
  rect(g, cx - 3, y, 7, 7, color);
  rect(g, cx - 3, y - 2, 1, 2, color);
  rect(g, cx, y - 2, 1, 2, color);
  rect(g, cx + 3, y - 2, 1, 2, color);
  rect(g, cx - 1, y + 3, 3, 4, '#1c1828');
}

function banner(g, d) {
  const w = d.w ?? 14, h = d.h ?? 44, x0 = Math.round(d.x - w / 2), top = d.y ?? 10;
  const c = d.color ?? '#7a2633', dark = d.dark ?? '#4e1820';
  rect(g, x0 - 3, top - 2, w + 6, 2, '#6b4532');           // древко
  rect(g, x0 - 4, top - 3, 2, 3, PAL.gold);
  rect(g, x0 + w + 2, top - 3, 2, 3, PAL.gold);
  rect(g, x0, top, w, h, c);
  rect(g, x0, top, 1, h, dark);
  rect(g, x0 + w - 2, top, 2, h, dark);
  rect(g, x0 + 2, top + 3, w - 4, 1, GOLD_D);              // кайма
  emblem(g, x0 + Math.floor(w / 2), top + 12, PAL.gold);
  // рваный низ: зубцы и дыры
  for (let i = 0; i < w; i++) {
    const cut = (i * 7 + (d.x | 0)) % 5;
    rect(g, x0 + i, top + h, 1, cut < 2 ? 3 - cut : 0, c);
    if (cut === 4) rect(g, x0 + i, top + h - 2, 1, 2, STONE_D);
  }
  if (d.torn) rect(g, x0 + 4, top + 26, 3, 5, STONE_D);
}

// арочное окно: сумеречное небо, дальние хребты со снегом, ближние темнее, дымка над долиной
function windowArch(g, d) {
  const w = d.w ?? 22, h = d.h ?? 36, x0 = Math.round(d.x - w / 2), top = d.y ?? 22;
  const r = Math.floor(w / 2);
  const inside = (x, y) => y >= r || (x - r + 0.5) ** 2 + (y - r) ** 2 <= r * r;  // верх — полукруг
  // каменный проём
  for (let y = -3; y < h + 1; y++) for (let x = -3; x < w + 3; x++) {
    const yy = y, rr = r + 3;
    if (yy >= r || (x - r + 0.5) ** 2 + (yy - r) ** 2 <= rr * rr) rect(g, x0 + x, top + y, 1, 1, (x + y) % 7 === 0 ? STONE_D : STONE_L);
  }
  const s = (d.x * 13) | 0;
  const ridge = (x, base, amp, f, ph) => base - amp * (0.55 * Math.sin((x + s) * f + ph) + 0.3 * Math.sin((x + s) * f * 2.3 + ph * 1.7) + 0.15 * Math.sin((x + s) * f * 5.1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const k = y / h;
    // небо: тёмно-синее → лиловое → тёплая полоса у горизонта
    let c = k < 0.45 ? mix('#1c2246', '#4a3a6a', k / 0.45) : mix('#4a3a6a', '#c8806a', Math.min(1, (k - 0.45) / 0.25));
    const far = ridge(x, h * 0.62, h * 0.16, 0.21, 1);
    const near = ridge(x, h * 0.8, h * 0.12, 0.13, 4);
    if (y > far) c = y < far + 2 && (far < h * 0.52) ? '#d8e0ee' : mix('#5a6288', '#3e4668', Math.min(1, (y - far) / 10));
    if (y > near) c = mix('#2e3a4a', '#1e2a2e', Math.min(1, (y - near) / 8));
    if (y > h - 4) c = mix('#2a4038', '#3a5a48', (x % 5) / 5);  // долина внизу
    rect(g, x0 + x, top + y, 1, 1, c);
  }
  for (let i = 0; i < 4; i++) {
    const sx = 2 + ((s + i * 7) % (w - 4)), sy = 2 + ((s + i * 5) % Math.floor(h * 0.3));
    if (inside(sx, sy)) rect(g, x0 + sx, top + sy, 1, 1, '#d8dcf8');
  }
  if (d.moon) { rect(g, x0 + w - 9, top + r - 2, 4, 4, '#f0ecd8'); rect(g, x0 + w - 8, top + r - 1, 1, 1, '#c8c4b0'); }
  // подоконник
  rect(g, x0 - 5, top + h, w + 10, 3, '#6a6288');
  rect(g, x0 - 5, top + h + 3, w + 10, 1, STONE_D);
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function portrait(g, d) {
  const w = 18, h = 22, x0 = Math.round(d.x - w / 2), top = d.y ?? 36;
  rect(g, x0 - 2, top - 2, w + 4, h + 4, GOLD_D);
  rect(g, x0 - 1, top - 1, w + 2, h + 2, PAL.gold);
  rect(g, x0, top, w, h, d.bg ?? '#2a2030');
  const cx = x0 + Math.floor(w / 2);
  // плечи и голова
  rect(g, x0 + 2, top + 15, w - 4, 7, d.robe ?? '#4a2a5a');
  rect(g, cx - 3, top + 13, 6, 3, d.robe ?? '#4a2a5a');
  rect(g, cx - 3, top + 6, 6, 7, '#c8a088');
  if (d.who === 'lady') {
    // дама в красном: длинные тёмные волосы, высокий ворот
    rect(g, cx - 4, top + 4, 8, 3, '#2a1a1a');
    rect(g, cx - 4, top + 6, 2, 10, '#2a1a1a'); rect(g, cx + 2, top + 6, 2, 10, '#2a1a1a');
    rect(g, x0 + 2, top + 15, w - 4, 7, '#8e2b3a');
    rect(g, cx - 2, top + 13, 4, 2, '#e8e0d0');
    rect(g, cx - 1, top + 8, 1, 1, '#3b2a1e'); rect(g, cx + 1, top + 8, 1, 1, '#3b2a1e');
  } else if (d.who === 'king') {
    rect(g, cx - 3, top + 4, 6, 2, PAL.gold);
    rect(g, cx - 3, top + 3, 1, 1, PAL.gold); rect(g, cx, top + 3, 1, 1, PAL.gold); rect(g, cx + 2, top + 3, 1, 1, PAL.gold);
    rect(g, cx - 3, top + 11, 6, 3, '#8a7a6a');  // борода
    rect(g, x0 + 2, top + 16, w - 4, 1, '#e8e0d0');  // горностай
  } else if (d.who === 'mage') {
    // капюшон, посох; лицо выцарапано
    rect(g, cx - 4, top + 4, 8, 3, d.robe ?? '#2a3a5a');
    rect(g, cx - 4, top + 6, 1, 8, d.robe ?? '#2a3a5a');
    rect(g, cx + 3, top + 6, 1, 8, d.robe ?? '#2a3a5a');
    rect(g, x0 + w - 4, top + 3, 1, 18, '#6b4532');
    rect(g, x0 + w - 5, top + 2, 3, 2, '#5fd3ff');
  } else {
    rect(g, cx - 3, top + 5, 6, 2, '#3b2a1e');
  }
  if (d.scratched) {
    for (let i = 0; i < 5; i++) thick(g, cx - 3 + i, top + 6, cx - 1 + i, top + 13, 1, '#e8dcc8');
  }
}

// гобелен: замок на горе над долиной, бахрома
function tapestry(g, d) {
  const w = d.w ?? 64, h = d.h ?? 40, x0 = Math.round(d.x - w / 2), top = d.y ?? 14;
  rect(g, x0 - 3, top - 2, w + 6, 2, '#6b4532');
  rect(g, x0, top, w, h, '#5a2a30');
  rect(g, x0 + 2, top + 2, w - 4, h - 4, '#2e3a5a');
  rect(g, x0 + 2, top + h - 14, w - 4, 12, '#3a5a3a');                      // долина
  for (let x = 0; x < w - 4; x++) {
    const yy = Math.round(12 * Math.abs(((x + 6) % 28) - 14) / 14);          // горы
    rect(g, x0 + 2 + x, top + 6 + yy, 1, h - 20 - yy, '#5a5a78');
  }
  const cx = x0 + Math.floor(w / 2);
  rect(g, cx - 6, top + 8, 12, 9, '#c8b890');                               // замок
  rect(g, cx - 8, top + 5, 4, 12, '#c8b890');
  rect(g, cx + 4, top + 3, 4, 14, '#c8b890');
  rect(g, cx + 5, top + 6, 2, 2, '#2a2030');
  rect(g, cx - 1, top + 12, 2, 5, '#2a2030');
  rect(g, x0 + 8, top + h - 8, 3, 2, '#c8b890');                            // деревня
  rect(g, x0 + 12, top + h - 7, 2, 1, '#c8b890');
  rect(g, x0 + 2, top + 2, w - 4, 1, PAL.gold);
  rect(g, x0 + 2, top + h - 3, w - 4, 1, PAL.gold);
  for (let x = x0 + 1; x < x0 + w; x += 2) rect(g, x, top + h, 1, 2 + (x % 3 === 0 ? 1 : 0), GOLD_D);
  if (d.torn) { rect(g, x0 + w - 12, top + h - 10, 6, 10, STONE_D); rect(g, x0 + w - 10, top + h, 4, 2, STONE_D); }
}

// стойка с оружием: копья, меч, пустые гнёзда
function rack(g, d, floorTop) {
  const w = d.w ?? 40, x0 = Math.round(d.x - w / 2), top = floorTop - 40;
  rect(g, x0, top, 2, 40, '#4a3226');
  rect(g, x0 + w - 2, top, 2, 40, '#4a3226');
  rect(g, x0, top + 6, w, 3, '#6b4532');
  rect(g, x0, top + 30, w, 3, '#6b4532');
  const items = d.items ?? ['spear', null, 'sword', 'spear', null];
  items.forEach((it, i) => {
    const x = x0 + 5 + i * Math.floor((w - 8) / items.length);
    if (it === 'spear') {
      rect(g, x, top - 8, 1, 46, '#7a5a3a');
      rect(g, x - 1, top - 12, 3, 4, PAL.steel);
      rect(g, x, top - 14, 1, 2, PAL.steel);
    } else if (it === 'sword') {
      rect(g, x, top + 2, 1, 28, PAL.steel);
      rect(g, x - 2, top + 30, 5, 1, '#e0a437');
      rect(g, x, top + 31, 1, 4, '#4a3226');
    } else {
      rect(g, x - 1, top + 6, 3, 1, '#2a1f18');  // пустое гнездо
    }
  });
}

// двухъярусные нары с соломой и истлевшим одеялом
function bunk(g, d, floorTop) {
  const w = d.w ?? 46, x0 = Math.round(d.x - w / 2), top = floorTop - 34;
  rect(g, x0, top, 3, 36, '#4a3226');
  rect(g, x0 + w - 3, top, 3, 36, '#4a3226');
  for (const y of [top + 8, top + 26]) {
    rect(g, x0, y, w, 3, '#6b4532');
    rect(g, x0, y, w, 1, '#8a5a3b');
    rect(g, x0 + 3, y - 2, w - 6, 2, '#8c7a58');  // солома
  }
  rect(g, x0 + 8, top + 22, 20, 4, d.blanket ?? '#4a3a5a');
  rect(g, x0 + 8, top + 22, 20, 1, '#5e4e70');
  rect(g, x0 + 26, top + 26, 4, 5, d.blanket ?? '#4a3a5a');  // свисает
}

// кандалы на цепях
function chains(g, d) {
  const top = d.y ?? 40;
  for (const dx of [-6, 6]) {
    for (let y = 0; y < 18; y += 3) rect(g, d.x + dx + (y % 6 ? 0 : 1), top + y, 2, 2, IRON);
    rect(g, d.x + dx - 2, top + 18, 6, 4, IRON_L);
    rect(g, d.x + dx - 1, top + 19, 4, 2, STONE_D);
  }
  rect(g, d.x - 9, top - 2, 18, 2, IRON);
}

// зарубки на стене: кто-то считал дни
function tally(g, d) {
  const top = d.y ?? 58;
  for (let i = 0; i < (d.n ?? 22); i++) {
    const grp = Math.floor(i / 5), k = i % 5;
    const x = d.x + grp * 8 + k * 1.5 - 20, row = Math.floor(grp / 6), y = top + row * 9;
    if (k === 4) thick(g, x - 6, y + 5, x, y + 1, 1, '#6a6288');
    else rect(g, Math.round(x - 6 + (grp % 6) * 0), y, 1, 6, '#6a6288');
  }
}

// круглый щит и скрещённые мечи
function shieldSwords(g, d) {
  const cx = d.x, cy = d.y ?? 44;
  thick(g, cx - 12, cy + 12, cx + 12, cy - 12, 1, PAL.steel);
  thick(g, cx - 12, cy - 12, cx + 12, cy + 12, 1, PAL.steel);
  rect(g, cx - 14, cy + 11, 4, 1, '#e0a437');
  rect(g, cx + 10, cy + 11, 4, 1, '#e0a437');
  for (let y = -8; y <= 8; y++) {
    const hw = Math.round(Math.sqrt(64 - y * y));
    rect(g, cx - hw, cy + y, hw * 2, 1, y < -5 || y > 5 ? '#6b4532' : '#7a2633');
  }
  rect(g, cx - 1, cy - 8, 2, 16, PAL.gold);
  rect(g, cx - 8, cy - 1, 16, 2, PAL.gold);
  rect(g, cx - 2, cy - 2, 4, 4, IRON_L);
}

// доспех на подставке — пустой, но стоит как страж
function armorStand(g, d, floorTop) {
  const cx = Math.round(d.x), b = floorTop;
  rect(g, cx - 7, b - 3, 14, 3, STONE_L);
  rect(g, cx - 1, b - 8, 2, 5, '#4a3226');
  rect(g, cx - 4, b - 22, 3, 14, '#7a8494');      // ноги
  rect(g, cx + 1, b - 22, 3, 14, '#6a7484');
  rect(g, cx - 5, b - 36, 10, 14, '#9aa4b4');     // кираса
  rect(g, cx - 5, b - 36, 10, 1, '#c3d0dc');
  rect(g, cx - 1, b - 34, 1, 10, '#6a7484');
  rect(g, cx - 8, b - 36, 3, 11, '#7a8494');      // руки
  rect(g, cx + 5, b - 36, 3, 11, '#7a8494');
  rect(g, cx - 4, b - 45, 8, 9, '#aab4c4');       // шлем
  rect(g, cx - 3, b - 41, 6, 1, '#14101e');
  rect(g, cx - 4, b - 45, 8, 1, '#c3d0dc');
  if (d.rust) { rect(g, cx - 3, b - 30, 2, 2, '#8a5a3b'); rect(g, cx + 2, b - 18, 1, 3, '#8a5a3b'); }
}

// камин: каменный портал, полка, сажа; огонь — в drawDecorLive
function fireplace(g, d, floorTop) {
  const w = d.w ?? 52, x0 = Math.round(d.x - w / 2), top = floorTop - 40;
  rect(g, x0, top, w, 40, STONE_L);
  rect(g, x0 + 1, top + 1, w - 2, 38, '#4f4868');
  rect(g, x0 - 4, top - 4, w + 8, 4, '#6a6288');   // полка
  rect(g, x0 - 4, top, w + 8, 1, STONE_D);
  rect(g, x0 + 8, top + 10, w - 16, 30, '#120e18');
  rect(g, x0 + 8, top + 10, w - 16, 2, '#2a1f18'); // сажа
  rect(g, x0 + 10, floorTop - 3, w - 20, 2, '#3b2a1e');  // поленья
  rect(g, x0 + 14, floorTop - 5, w - 28, 2, '#4a3226');
  // подсвечники на полке
  for (const dx of [6, w - 7]) { rect(g, x0 + dx, top - 9, 2, 5, '#ece4d0'); rect(g, x0 + dx - 1, top - 4, 4, 1, PAL.gold); }
  // свет на полу перед камином
  const gr = g.createRadialGradient(d.x, floorTop + 6, 2, d.x, floorTop + 6, 48);
  gr.addColorStop(0, 'rgba(255,140,60,0.18)');
  gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr;
  g.fillRect(d.x - 48, floorTop - 2, 96, 50);
}

function chandelier(g, d) {
  const cx = Math.round(d.x), y = d.y ?? 30;
  for (let yy = 0; yy < y - 4; yy += 3) rect(g, cx, yy, 1, 2, IRON);
  rect(g, cx - 18, y, 37, 2, IRON);
  rect(g, cx - 14, y + 2, 29, 1, IRON_L);
  rect(g, cx - 1, y - 4, 3, 4, IRON);
  for (const dx of CANDLES) rect(g, cx + dx, y - 5, 2, 5, '#ece4d0');
}
const CANDLES = [-17, -9, 0, 9, 17];

// плющ: плети свисают сверху, листья пятнами
function ivy(g, d) {
  let seed = (d.x * 31) | 0;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const len = d.len ?? 50;
  for (let v = 0; v < (d.n ?? 4); v++) {
    let x = d.x + Math.round((rand() - 0.5) * (d.w ?? 24));
    const l = Math.round(len * (0.5 + rand() * 0.5));
    for (let y = d.y ?? 0; y < (d.y ?? 0) + l; y++) {
      if (rand() < 0.25) x += rand() < 0.5 ? -1 : 1;
      rect(g, x, y, 1, 1, '#2e4a2a');
      if (rand() < 0.35) rect(g, x + (rand() < 0.5 ? -1 : 1), y, 2, 2, rand() < 0.5 ? '#3f6a34' : '#548a40');
    }
  }
}

// полка лавки: склянки, свитки, золотой череп — то, что продаёт Лика
function shelf(g, d) {
  const w = d.w ?? 60, x0 = Math.round(d.x - w / 2), top = d.y ?? 40;
  for (const [k, row] of (d.rows ?? [['potion', 'potion', 'bottle', 'scroll', 'bottle', 'potion'], ['skull', 'book', 'bottle', 'box', 'potion']]).entries()) {
    const y = top + k * 18;
    rect(g, x0, y + 12, w, 2, '#8a5a3b');
    rect(g, x0, y + 14, w, 1, '#3b2a1e');
    rect(g, x0 + 2, y + 15, 2, 3, '#4a3226');
    rect(g, x0 + w - 4, y + 15, 2, 3, '#4a3226');
    row.forEach((it, i) => {
      const x = x0 + 4 + Math.floor(i * (w - 8) / row.length);
      if (it === 'potion') {
        rect(g, x, y + 5, 5, 7, '#c8384a'); rect(g, x + 1, y + 3, 3, 2, '#d8d0c0'); rect(g, x + 1, y + 6, 1, 2, '#f08090');
      } else if (it === 'bottle') {
        rect(g, x, y + 6, 4, 6, '#3a7a5a'); rect(g, x + 1, y + 3, 2, 3, '#3a7a5a'); rect(g, x + 1, y + 2, 2, 1, '#8a5a3b');
      } else if (it === 'scroll') {
        rect(g, x, y + 8, 8, 4, '#e8dcb8'); rect(g, x, y + 8, 1, 4, '#c8b890'); rect(g, x + 3, y + 9, 2, 2, '#8e2b3a');
      } else if (it === 'skull') {
        rect(g, x, y + 5, 7, 5, PAL.gold); rect(g, x + 1, y + 10, 5, 2, PAL.gold);
        rect(g, x + 1, y + 7, 2, 2, '#3b2a1e'); rect(g, x + 4, y + 7, 2, 2, '#3b2a1e'); rect(g, x + 1, y + 5, 3, 1, '#fff0b0');
      } else if (it === 'book') {
        rect(g, x, y + 4, 3, 8, '#5a2a30'); rect(g, x + 3, y + 5, 3, 7, '#2a3a5a'); rect(g, x + 6, y + 6, 2, 6, '#3a5a3a');
      } else if (it === 'box') {
        rect(g, x, y + 7, 8, 5, '#6b4532'); rect(g, x, y + 7, 8, 1, '#8a5a3b'); rect(g, x + 3, y + 9, 2, 1, PAL.gold);
      }
    });
  }
}

// вывеска на цепочках
function sign(g, d) {
  const w = d.w ?? 34, x0 = Math.round(d.x - w / 2), top = d.y ?? 14;
  rect(g, x0 + 4, top - 6, 1, 6, IRON); rect(g, x0 + w - 5, top - 6, 1, 6, IRON);
  rect(g, x0, top, w, 12, '#6b4532'); rect(g, x0, top, w, 1, '#8a5a3b'); rect(g, x0, top + 11, w, 1, '#3b2a1e');
  // монета и склянка вместо надписи
  rect(g, x0 + 8, top + 3, 6, 6, PAL.gold); rect(g, x0 + 10, top + 5, 2, 2, GOLD_D);
  rect(g, x0 + w - 13, top + 4, 5, 6, '#c8384a'); rect(g, x0 + w - 12, top + 2, 3, 2, '#d8d0c0');
}

// записка на гвозде
function note(g, d) {
  const x0 = Math.round(d.x - 5), top = d.y ?? 52;
  rect(g, x0, top, 10, 12, '#d8ccb0');
  rect(g, x0 + 9, top + 1, 1, 11, '#b0a488');
  for (let y = top + 3; y < top + 11; y += 2) rect(g, x0 + 2, y, 5 + (y % 3), 1, '#6b5a4a');
  rect(g, x0 + 4, top - 1, 2, 2, IRON);
}

// доска с ключами на крючках: одного, самого большого, нет
function keys(g, d) {
  const x0 = Math.round(d.x - 18), top = d.y ?? 44;
  rect(g, x0, top, 36, 14, '#6b4532');
  rect(g, x0, top, 36, 1, '#8a5a3b');
  rect(g, x0, top + 13, 36, 1, '#3b2a1e');
  for (let i = 0; i < 5; i++) {
    const x = x0 + 4 + i * 7;
    rect(g, x, top + 2, 1, 2, IRON_L);
    if (i === 3) { rect(g, x - 2, top + 5, 5, 7, '#4f3a2a'); continue; }  // светлый след — ключ висел долго
    rect(g, x - 1, top + 4, 3, 3, '#c8a050');
    rect(g, x, top + 7, 1, 4, '#c8a050');
    rect(g, x + 1, top + 9, 1, 1, '#c8a050');
  }
}

// высокий стеллаж с книгами: корешки разного цвета и высоты, пустые места, иногда череп
function bookshelf(g, d, floorTop) {
  const w = d.w ?? 44, h = d.h ?? 62, x0 = Math.round(d.x - w / 2), top = floorTop - h;
  rect(g, x0, top, w, h, '#3b2a1e');
  rect(g, x0 + 2, top + 2, w - 4, h - 2, '#241a12');
  const COLORS = ['#7a2633', '#2a3a6a', '#3a5a3a', '#6b4532', '#5a2a5a', '#8a7a58', '#4a4462'];
  let seed = (d.x * 7) | 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let s = 0; s < 4; s++) {
    const sy = top + 4 + s * 15;
    rect(g, x0 + 1, sy + 12, w - 2, 2, '#5a3f2a');
    let x = x0 + 3;
    while (x < x0 + w - 4) {
      const bw = 2 + Math.floor(rnd() * 2), bh = 7 + Math.floor(rnd() * 5);
      if (d.gap === s && x > x0 + 10 && x < x0 + 24) { x += bw + 1; continue; }  // пустое место — книги унесли
      rect(g, x, sy + 12 - bh, bw, bh, COLORS[Math.floor(rnd() * COLORS.length)]);
      if (rnd() < 0.3) rect(g, x, sy + 12 - bh + 2, bw, 1, '#c8a050');
      x += bw + (rnd() < 0.15 ? 2 : 0);
    }
  }
  if (d.skull) { rect(g, x0 + w - 12, top + 9, 6, 5, '#e6e1d0'); rect(g, x0 + w - 11, top + 11, 1, 1, '#14101e'); rect(g, x0 + w - 8, top + 11, 1, 1, '#14101e'); }
  rect(g, x0, top, w, 2, '#5a3f2a');
}

// стремянка, прислонённая к стеллажу
function ladder(g, d, floorTop) {
  const x = Math.round(d.x), top = floorTop - 58;
  thick(g, x, floorTop, x + 6, top, 1, '#8a5a3b');
  thick(g, x + 6, floorTop, x + 12, top, 1, '#8a5a3b');
  for (let i = 1; i < 8; i++) {
    const t = i / 8, y = Math.round(floorTop - 58 * t), xx = Math.round(x + 6 * t);
    rect(g, xx, y, 6, 1, '#6b4532');
  }
}

export function drawDecor(g, d, floorTop) {
  switch (d.type) {
    case 'bookshelf': return bookshelf(g, d, floorTop);
    case 'ladder': return ladder(g, d, floorTop);
    case 'keys': return keys(g, d);
    case 'note': return note(g, d);
    case 'shelf': return shelf(g, d);
    case 'sign': return sign(g, d);
    case 'ivy': return ivy(g, d);
    case 'banner': return banner(g, d);
    case 'window': return windowArch(g, d);
    case 'portrait': return portrait(g, d);
    case 'tapestry': return tapestry(g, d);
    case 'rack': return rack(g, d, floorTop);
    case 'bunk': return bunk(g, d, floorTop);
    case 'chains': return chains(g, d);
    case 'tally': return tally(g, d);
    case 'shield': return shieldSwords(g, d);
    case 'armor': return armorStand(g, d, floorTop);
    case 'fireplace': return fireplace(g, d, floorTop);
    case 'chandelier': return chandelier(g, d);
  }
}

// живое: пламя в камине и свечи люстры (sx — x на экране)
export function drawDecorLive(g, d, sx, floorTop, time) {
  if (sx < -60 || sx > 380) return;
  if (d.type === 'fireplace') {
    const w = (d.w ?? 52) - 24;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const f = 0.8 + 0.2 * Math.sin(time * 11) * Math.sin(time * 7.3);
    const gr = g.createRadialGradient(sx, floorTop - 10, 2, sx, floorTop - 10, 40);
    gr.addColorStop(0, `rgba(255,140,50,${0.25 * f})`);
    gr.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = gr;
    g.fillRect(sx - 40, floorTop - 50, 80, 60);
    g.restore();
    for (let i = 0; i < w; i += 2) {
      const h = 6 + Math.round(6 * Math.abs(Math.sin(time * 6 + i * 1.7)) + 3 * Math.sin(i * 0.9));
      const x = Math.round(sx - w / 2 + i);
      for (let k = 0; k < h; k++) rect(g, x, floorTop - 5 - k, 2, 1, k < 3 ? PAL.flame0 : k < h - 3 ? PAL.flame1 : PAL.flame2);
    }
  } else if (d.type === 'chandelier') {
    const y = d.y ?? 30;
    for (const dx of CANDLES) {
      const flick = Math.floor(time * 9 + dx) % 2;
      rect(g, sx + dx, y - 7 - flick, 2, 2, PAL.flame1);
      rect(g, sx + dx, y - 7, 1, 1, PAL.flame0);
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(sx, y - 4, 2, sx, y - 4, 40);
    gr.addColorStop(0, 'rgba(255,190,90,0.16)');
    gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr;
    g.fillRect(sx - 40, y - 44, 80, 80);
    g.restore();
  }
}

export const DECOR_LIVE = new Set(['fireplace', 'chandelier', 'cracks']);

// Замурованный проход: кладка светлее соседней и в трещинах (их больше с каждым ударом);
// после трёх ударов — пролом с грудой камней. state: { open, hits }.
export function drawCracks(g, sx, floorTop, state, time) {
  const w = 26, h = 38, x0 = Math.round(sx - w / 2), top = floorTop - h;
  if (state.open) {
    // рваный край пролома
    const edge = [3, 1, 0, 2, 0, 1, 3, 2, 0, 1, 0, 2, 1, 3];
    for (let y = 0; y < h; y++) {
      const l = edge[y % edge.length], r = edge[(y + 5) % edge.length];
      rect(g, x0 + l - 2, top + y, w - l - r + 4, 1, STONE_L);
      rect(g, x0 + l, top + y, w - l - r, 1, '#07060c');
    }
    rect(g, x0 + 2, top - 3, w - 4, 3, STONE_L);
    // груда камней у порога
    for (const [dx, dy, s] of [[-12, -3, 4], [-7, -2, 3], [9, -3, 4], [13, -2, 3], [-2, -2, 2], [4, -1, 3]]) {
      rect(g, sx + dx, floorTop + dy, s, s - 1, '#6a6288');
      rect(g, sx + dx, floorTop + dy, s, 1, '#8a82a8');
    }
    return;
  }
  // кладка свежее: светлее, швы ровнее
  for (let row = 0; row * 7 < h; row++) {
    const off = row % 2 ? 4 : 0;
    for (let x = -off; x < w; x += 9) {
      const bw = Math.min(8, w - Math.max(0, x)), bx = Math.max(0, x);
      rect(g, x0 + bx, top + row * 7, bw, 6, '#4a4462');
      rect(g, x0 + bx, top + row * 7, bw, 1, '#5e5878');
    }
  }
  // трещины: базовые и новые после каждого удара
  const lines = [
    [[13, 4], [11, 12], [14, 20], [12, 30]],
    [[5, 10], [9, 16], [7, 24]],
    [[20, 8], [17, 17], [21, 26], [18, 35]],
    [[3, 28], [10, 31], [16, 26], [24, 30]],
  ];
  const n = 1 + Math.min(3, state.hits ?? 0);
  for (const pts of lines.slice(0, n)) {
    for (let i = 1; i < pts.length; i++) thick(g, x0 + pts[i - 1][0], top + pts[i - 1][1], x0 + pts[i][0], top + pts[i][1], 1, '#1c1828');
  }
  if ((state.hits ?? 0) > 0 && Math.floor(time * 4) % 6 === 0) rect(g, x0 + 12, top + 16, 1, 1, '#8a82a8');  // сыплется крошка
}
