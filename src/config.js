// Все числа, которые влияют на ощущение боя, собраны здесь.
// Время — в секундах, расстояния — в пикселях игрового экрана (320×180).

export const VERSION = 'v0.3.1';

export const CONFIG = {
  width: 320,
  height: 180,
  ground: 150,

  // Защита
  perfectWindow: 0.16,  // нажал защиту не раньше чем за столько до удара → идеальное парирование
  mashLockout: 0.3,     // если перед этим жал защиту чаще, идеального не будет (защита от «спама»)
  counterWindow: 1.3,   // сколько враг ошеломлён после идеально отбитой серии
  guardBreakTime: 0.7,  // сколько нельзя защищаться после сбитой защиты
  wheelGuard: 0.3,      // прокрутка колёсика держит среднюю защиту столько секунд

  // Урон
  counterMult: 2,       // во сколько раз больнее бьёшь ошеломлённого врага
  tradeMult: 2,         // во сколько раз больнее получаешь, если враг ударил, пока ты атаковал (или после неудачного отскока)
  playerHp: 10,

  // Передвижение
  walkSpeed: 64,
  backWalkFactor: 0.8,  // пятиться медленнее, чем идти вперёд
  bodyGap: 14,          // ближе бойцы не подходят друг к другу
  autoSheathe: 4,       // через столько секунд без боя меч уходит в ножны

  // Ввод
  spinWindow: 0.4,      // вперёд → назад → удар нужно нажать за это время
  attackBuffer: 0.15,   // удар, нажатый чуть раньше конца анимации, не теряется

  // Ощущения
  hitstop: { perfect: 0.07, hit: 0.1, counter: 0.12, strike: 0.04 },
  glint: true,          // блик в момент, когда пора жать защиту
  audioCues: true,      // короткий звук на замахе: верх звучит выше, низ ниже
};

// Оружие рыцаря. Пока одно — полуторный меч.
// windup — замах, active — клинок разит, recover — восстановление; reach — дальность, damage — урон.
export const WEAPON = {
  name: 'Полуторный меч',
  length: 17,
  drawSide: -0.01,      // удар сбоку прямо из ножен — чуть быстрее обычного
  drawExtra: 0.06,      // верхний или нижний удар из ножен — чуть медленнее
  dashCutWindow: 0.12,  // сколько после рывка ещё можно нажать удар, чтобы вышел удар в рывке
  attacks: {
    side:     { name: 'Боковой',          height: 'mid',  pose: 'mid',  windup: 0.14, active: 0.08, recover: 0.22, reach: 30, damage: 1 },
    overhead: { name: 'Верхний',          height: 'high', pose: 'high', windup: 0.24, active: 0.08, recover: 0.3,  reach: 28, damage: 2 },
    low:      { name: 'Нижний',           height: 'low',  pose: 'low',  windup: 0.18, active: 0.08, recover: 0.24, reach: 30, damage: 1 },
    dashCut:  { name: 'Удар в рывке',     height: 'mid',  pose: 'mid',  windup: 0.05, active: 0.1,  recover: 0.28, reach: 32, damage: 2, move: 10 },
    leap:     { name: 'Прыжок с ударом',  height: 'high', pose: 'high', windup: 0.26, active: 0.1,  recover: 0.34, reach: 30, damage: 3, move: 26 },
    rollCut:  { name: 'Подсечка',         height: 'low',  pose: 'sweep', windup: 0.1, active: 0.12, recover: 0.3, reach: 32, damage: 2 },
    spin:     { name: 'Вихрь',            height: 'any',  pose: 'spin', windup: 0.1,  active: 0.6,  recover: 0.32, reach: 34, damage: 1, hits: [0.2, 0.5] },
  },
  dash:     { distance: 28, time: 0.2, cooldown: 0.45 },
  backdash: { distance: 26, time: 0.22, total: 0.6, ward: 0.35 },  // ward — сколько держится заслон от одного удара
  roll:     { distance: 34, time: 0.38, iframes: [0.04, 0.32], strikeWindow: 0.3 },
};

// Удары врагов. guard — какой защитой отбивать; pose — поза замаха и удара;
// breaks — сбивает защиту, если отбить обычным блоком (идеальное парирование спасает); mult — множитель урона.
export const STRIKES = {
  high:      { guard: 'high', pose: 'high' },
  mid:       { guard: 'mid',  pose: 'mid' },
  low:       { guard: 'low',  pose: 'low' },
  thrust:    { guard: 'mid',  pose: 'thrust' },
  whirl:     { guard: 'mid',  pose: 'whirl' },
  diagUp:    { guard: 'mid',  pose: 'diagUp',   breaks: true, mult: 2 },  // снизу вверх по диагонали — выглядит не как верх и не как низ
  diagDown:  { guard: 'mid',  pose: 'diagDown', breaks: true, mult: 2 },  // сверху вниз по диагонали
  heavyHigh: { guard: 'high', pose: 'high', breaks: true, mult: 1.5, heavy: true },
  heavyMid:  { guard: 'mid',  pose: 'mid',  breaks: true, mult: 1.5, heavy: true },
  heavyLow:  { guard: 'low',  pose: 'low',  breaks: true, mult: 1.5, heavy: true },
};

const BONE = { armor: '#d9d4c3', armorDark: '#a39d8a', tabard: '#2b2633', helm: '#e6e1d0', visor: '#14101e', boots: '#a39d8a', blade: '#b9c2cc', hilt: '#6b4532', shield: '#5a3726' };
const BONE_LEATHER = { ...BONE, tabard: '#6b4532', armorDark: '#7a5a3a' };  // скелет в кожаной броне

// Враги. kind: melee — ближний бой, archer — лучник, slime — слизень.
// aggro — с какого расстояния замечает; reach — дальность удара; windup / comboWindup — замах первого и следующих
// ударов серии; gap — пауза между ударами; recover — сколько открыт после серии; wait — пауза перед серией;
// guardChance — как часто закрывается от твоих ударов; reaction — за сколько успевает среагировать.
export const ENEMY_TYPES = {
  slime: {
    kind: 'slime', name: 'Слизень', hp: 3, damage: 1, aggro: 150, reach: 22,
    leapChance: 0.7, crouchTime: 0.55, leapTime: 0.55,
    inflateTime: 2.4, popHits: 2, suckRange: 110, stunTime: 0.9,
    colors: { body: '#7bd88f', dark: '#3c9a5f', light: '#d4ffd9', eye: '#14101e' },
  },
  merc: {
    kind: 'melee', name: 'Наёмник', hp: 4, damage: 1, aggro: 130, reach: 30, speed: 45, lunge: 4, weapon: 17,
    windup: 0.65, comboWindup: 0.45, gap: 0.1, recover: 0.95, wait: [0.7, 1.1],
    combos: [['low'], ['mid', 'high'], ['high', 'low'], ['mid', 'low', 'high']],
    guardChance: 0.5, reaction: 0.1,
    colors: { armor: '#7a5a3a', armorDark: '#4d3826', tabard: '#4a6b3a', helm: '#8f7a5a', visor: '#14101e', blade: '#d6dde6', hilt: '#5a3726', boots: '#2e2420' },
  },
  skelShort: {
    kind: 'melee', name: 'Скелет с коротким мечом', hp: 3, damage: 1, aggro: 130, reach: 24, speed: 55, lunge: 5, weapon: 11, skull: true,
    windup: 0.45, comboWindup: 0.28, gap: 0.05, recover: 0.8, wait: [0.5, 0.8],
    combos: [['mid', 'mid'], ['high', 'high'], ['mid', 'mid', 'high'], ['low', 'mid', 'mid']],
    guardChance: 0.3, reaction: 0.12,
    colors: BONE,
  },
  skelLong: {
    kind: 'melee', name: 'Скелет с двуручником', hp: 6, damage: 2, aggro: 150, reach: 50, speed: 32, lunge: 10, weapon: 28, skull: true,
    windup: 0.95, comboWindup: 0.7, gap: 0.15, recover: 1.2, wait: [1, 1.4],
    combos: [['heavyHigh'], ['heavyMid'], ['heavyHigh', 'heavyMid'], ['heavyMid', 'heavyLow']],  // первый сбивает защиту — второй уже не отбить
    guardChance: 0.35, reaction: 0.14,
    colors: { ...BONE_LEATHER },
  },
  skelShield: {
    kind: 'melee', name: 'Скелет со щитом', hp: 4, damage: 1, aggro: 130, reach: 26, speed: 40, lunge: 4, weapon: 13, skull: true, shield: true,
    windup: 0.7, comboWindup: 0.45, gap: 0.1, recover: 1, wait: [0.8, 1.2],
    combos: [['mid'], ['low'], ['mid', 'high'], ['high', 'low']],
    guardChance: 0.4, reaction: 0.12,  // щит всегда закрывает верх и середину, низ — с этим шансом
    colors: BONE,
  },
  skelArcher: {
    kind: 'archer', name: 'Скелет-лучник', hp: 2, damage: 1, aggro: 190,
    windup: 0.9, comboWindup: 0.55, recover: 0.7, wait: [0.6, 1.1],
    heights: ['high', 'mid', 'low', 'arc'], volleyChance: 0.4, arcTime: 1.1, minDist: 70, maxDist: 160, arrowSpeed: 150,  // arc — навесная стрела, падает на голову
    guardChance: 0.2, reaction: 0.15, skull: true,
    colors: { ...BONE, blade: '#8a5a3b' },
  },
  duelist: {
    kind: 'duelist', name: 'Священный рыцарь — Илиа', shortName: 'Илиа', hp: 14, damage: 1, aggro: 150, reach: 34, speed: [30, 85], lunge: 8, weapon: 22,
    windup: 0.42, comboWindup: 0.22, gap: 0.05, recover: 0.7, wait: [0.4, 0.8],
    combos: [
      ['thrust', 'thrust', 'thrust'], ['low', 'high'], ['low', 'mid'], ['whirl', 'whirl'],
      ['diagUp'], ['diagDown'], ['thrust', 'diagDown'], ['mid', 'diagUp'],
    ],
    leapBackChance: 0.18, leapInChance: 0.25, leapDistance: 64,
    guardChance: 0.6, reaction: 0.08,
    robe: true,  // длинное бежевое одеяние до пят, вроде джедайского
    colors: { armor: '#c8b48a', armorDark: '#9c8762', tabard: '#ece2c8', robe: '#b9a47a', robeDark: '#8f7c58', belt: '#5a4632', helm: '#d9a87e', visor: '#14101e', blade: '#f4f8ff', hilt: '#f2c14e', boots: '#4a3a2a', hair: '#14101e' },
  },
  // из первого прототипа, пока не на уровне
  guard: {
    kind: 'melee', name: 'Стражник', hp: 3, damage: 1, aggro: 130, reach: 30, speed: 40, lunge: 4, weapon: 17,
    windup: 0.8, comboWindup: 0.55, gap: 0.12, recover: 1.1, wait: [0.9, 1.4],
    combos: [['mid'], ['high'], ['mid', 'high'], ['high', 'mid']],
    guardChance: 0.4, reaction: 0.12,
    colors: { armor: '#6d6a7a', armorDark: '#45424f', tabard: '#8e2b3a', helm: '#7d7a8a', visor: '#14101e', blade: '#c9d2dc', hilt: '#8a5a3b', boots: '#3b2a26' },
  },
  captain: {
    kind: 'melee', name: 'Капитан стражи', hp: 6, damage: 2, aggro: 130, reach: 32, speed: 45, lunge: 6, weapon: 19,
    windup: 0.55, comboWindup: 0.38, gap: 0.08, recover: 0.85, wait: [0.6, 1.0],
    combos: [['high', 'high'], ['mid', 'high', 'low'], ['low', 'low', 'high'], ['high', 'mid', 'low', 'mid']],
    guardChance: 0.6, reaction: 0.08,
    colors: { armor: '#3b3550', armorDark: '#25212f', tabard: '#c99a2e', helm: '#4f4868', visor: '#ff7a2f', blade: '#f4f8ff', hilt: '#f2c14e', boots: '#1c1828' },
  },
};

// Коридор прототипа: длина и враги по порядку.
export const LEVEL = {
  length: 2750,
  enemies: [
    { type: 'slime', x: 340 },
    { type: 'merc', x: 650 },
    { type: 'skelShort', x: 960 },
    { type: 'skelArcher', x: 1300 },
    { type: 'skelShield', x: 1620 },
    { type: 'skelLong', x: 1950 },
    { type: 'duelist', x: 2400 },  // мини-босс: не умирает, а отступает
  ],
};
