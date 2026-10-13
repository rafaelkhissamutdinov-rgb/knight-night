// Все числа, которые влияют на ощущение боя, собраны здесь.
// Время — в секундах, расстояния — в пикселях игрового экрана (320×180).

export const VERSION = 'v0.24';

export const CONFIG = {
  width: 320,
  height: 180,
  ground: 150,

  // Глубина пола (вариант A): z = 0 — у стены, z = depth — у края экрана
  floorTop: 118,        // где стена встречается с полом
  depth: 44,
  depthSpeed: 46,       // шаг вглубь медленнее, чем вбок
  depthReach: 9,        // насколько можно разойтись по глубине, чтобы удар всё равно достал
  tokenPause: 0.35,     // пауза между атаками разных врагов: бьёт один, остальные ждут
  tokenRepeat: 1.0,     // кто только что бил, пропускает других вперёд столько секунд

  // Защита
  perfectWindow: 0.22,  // нажал защиту не раньше чем за столько до удара → идеальное парирование
  mashLockout: 0.3,     // если перед этим жал защиту чаще, идеального не будет (защита от «спама»)
  counterWindow: 1.3,   // сколько враг ошеломлён после идеально отбитой серии
  reelTime: 0.55,       // идеальное парирование посреди серии: враг выбит из ритма, ударишь — серия прервётся
  guardBreakTime: 0.7,  // сколько нельзя защищаться после сбитой защиты
  autoTurn: 0.7,        // враг оказался за спиной — рыцарь сам развернётся через столько секунд (стрелкой — сразу)

  // Урон
  counterMult: 2,       // во сколько раз больнее бьёшь ошеломлённого врага
  tradeMult: 2,         // во сколько раз больнее получаешь, если враг ударил, пока ты атаковал (или после неудачного отскока)
  playerHp: 10,

  // Передвижение
  walkSpeed: 74,        // в бою
  exploreSpeed: 120,    // вне боя: по пустым коридорам быстрее (v0.16, просьба владельца)
  runSpeed: 210,        // вне боя рыцарь сам переходит на бег (v0.17)
  runDelay: 0.35,       // через столько секунд ходьбы
  exploreDepthSpeed: 70,
  enemyMove: 1.4,       // множитель скорости передвижения врагов (не ударов)
  respawnTime: 150,     // обычные враги возвращаются в комнату через столько секунд после победы (монеты не кончаются)
  backWalkFactor: 0.8,  // пятиться медленнее, чем идти вперёд
  bodyGap: 14,          // ближе бойцы не подходят друг к другу
  autoSheathe: 4,       // через столько секунд без боя меч уходит в ножны

  // Ввод
  spinCooldown: 4,      // перезарядка вихря, секунд
  attackBuffer: 0.15,   // удар, нажатый чуть раньше конца анимации, не теряется

  // Ощущения
  hitstop: { perfect: 0.07, hit: 0.1, counter: 0.12, strike: 0.04 },
  glint: true,          // блик в момент, когда пора жать защиту
  dialogues: true,      // диалоги в игре (тексты — черновики, пишет владелец)
  restHeal: 3,          // сколько здоровья возвращает отдых после победы над группой
  enemyBars: true,      // полоски здоровья над врагами
  windupHints: true,    // значок высоты удара над врагом во время замаха: ▲ верх, ━ середина, ▼ низ (оранжевый — сбивает или огибает защиту)
  audioCues: true,      // короткий звук на замахе: верх звучит выше, низ ниже
};

// Оружие рыцаря. Пока одно — полуторный меч.
// windup — замах, active — клинок разит, recover — восстановление; reach — дальность, damage — урон.
export const WEAPON = {
  name: 'Полуторный меч',
  spinKey: 'spin',      // приём на колесе
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

// Рапира — трофей Илиа (выпадает, когда он повержен). Быстрее и длиннее меча, слабее; свои приёмы.
export const RAPIER = {
  name: 'Рапира',
  length: 22,
  drawSide: 0,
  drawExtra: 0,
  spinKey: 'figure8',   // колесо — «восьмёрка»: слабая атака и блок одновременно
  chainMax: 3,          // до трёх уколов подряд быстрыми кликами
  chainRecover: 0.35,   // пауза после третьего укола
  chargeTime: 0.3,      // зажать ЛКМ вверху столько — прыжок с захлёстом
  vaultCooldown: 3,
  riposteAfter: 2,      // столько успешных блоков подряд — автоматический рипост
  attacks: {
    side:       { name: 'Укол',               height: 'mid',  pose: 'thrust', windup: 0.09, active: 0.06, recover: 0.16, reach: 34, damage: 1, chain: true },
    overhead:   { name: 'Захлёст',            height: 'high', pose: 'flick',  windup: 0.18, active: 0.08, recover: 0.26, reach: 30, damage: 2, bypass: true },
    low:        { name: 'Нижний укол',        height: 'low',  pose: 'low',    windup: 0.12, active: 0.07, recover: 0.2,  reach: 32, damage: 1 },
    dashCut:    { name: 'Выпад',              height: 'mid',  pose: 'thrust', windup: 0.05, active: 0.1,  recover: 0.26, reach: 38, damage: 2, move: 14 },
    leap:       { name: 'Прыжок с уколом',    height: 'high', pose: 'high',   windup: 0.26, active: 0.1,  recover: 0.34, reach: 30, damage: 2, move: 26 },
    rollCut:    { name: 'Подсечка',           height: 'low',  pose: 'sweep',  windup: 0.1,  active: 0.12, recover: 0.3,  reach: 32, damage: 1 },
    // прыгает через врага и хлещет сзади: много урона, но долгая подготовка; закрылся враг — долгая отдача
    vaultFlick: { name: 'Прыжок с захлёстом', height: 'high', pose: 'flick',  windup: 0.65, active: 0.1,  recover: 0.4,  reach: 30, damage: 4, vault: 0.4 },
    // навык из свитка: выпад и три молниеносных укола
    tripleLunge: { name: 'Тройной выпад',     height: 'mid',  pose: 'thrust', windup: 0.06, active: 0.3,  recover: 0.25, reach: 40, damage: 1, move: 18, hits: [0.03, 0.13, 0.23] },
    riposte:    { name: 'Рипост',             height: 'mid',  pose: 'thrust', windup: 0.04, active: 0.06, recover: 0.15, reach: 38, damage: 1, pierce: true },
    figure8:    { name: 'Восьмёрка',          height: 'any',  pose: 'eight',  windup: 0.05, active: 0.9,  recover: 0.2,  reach: 26, damage: 1, hits: [0.15, 0.45, 0.75], weave: true, front: true },
  },
};

export const WEAPONS = { sword: WEAPON, rapier: RAPIER };

// Удары врагов. guard — какой защитой отбивать; pose — поза замаха и удара;
// breaks — сбивает защиту, если отбить обычным блоком (идеальное парирование спасает); mult — множитель урона;
// bypass — огибает удержанный блок: спасает только идеальное парирование или уклонение; whip — свистящий звук захлёста.
export const STRIKES = {
  high:      { guard: 'high', pose: 'high' },
  mid:       { guard: 'mid',  pose: 'mid' },
  low:       { guard: 'low',  pose: 'low' },
  thrust:    { guard: 'mid',  pose: 'thrust' },
  whirl:     { guard: 'mid',  pose: 'whirl' },
  diagUp:    { guard: 'mid',  pose: 'diagUp',   breaks: true, mult: 2 },  // снизу вверх по диагонали — выглядит не как верх и не как низ
  diagDown:  { guard: 'mid',  pose: 'diagDown', breaks: true, mult: 2 },  // сверху вниз по диагонали
  flick:     { guard: 'high', pose: 'flick', bypass: true, mult: 1.5, whip: true },   // захлёст через защиту спереди
  flickBack: { guard: 'high', pose: 'flick', breaks: true, mult: 2, whip: true },    // захлёст в спину после прыжка через рыцаря
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
  // мародёры пришли грабить замок: повязка на лице, лохмотья, разномастная кожа
  merc: {
    kind: 'melee', name: 'Мародёр', hp: 4, damage: 1, aggro: 130, reach: 30, speed: 45, lunge: 4, weapon: 17, bandit: true,
    windup: 0.65, comboWindup: 0.45, gap: 0.1, recover: 0.95, wait: [0.7, 1.1],
    combos: [['low'], ['mid', 'high'], ['high', 'low'], ['mid', 'low', 'high']],
    guardChance: 0.5, reaction: 0.1,
    colors: { armor: '#7a5a3a', armorDark: '#4d3826', tabard: '#7a3b2e', helm: '#c09070', visor: '#14101e', blade: '#c3ccd6', hilt: '#5a3726', boots: '#2e2420', bandana: '#3b2f2a', mask: '#5a4a3e' },
  },
  // мародёр с топором: медленные тяжёлые рубящие сверху — сбивают блок; держи дистанцию или парируй идеально
  axe: {
    kind: 'melee', name: 'Мародёр с топором', shortName: 'Топорщик', hp: 5, damage: 1, aggro: 130, reach: 32, speed: 40, lunge: 6, weapon: 18, bandit: true, axe: true,
    windup: 0.85, comboWindup: 0.6, gap: 0.15, recover: 1.15, wait: [0.8, 1.2],
    combos: [['heavyHigh'], ['mid', 'heavyHigh'], ['diagDown'], ['heavyMid', 'mid']],
    guardChance: 0.3, reaction: 0.13,
    colors: { armor: '#6b5a48', armorDark: '#45392d', tabard: '#5a5a3a', helm: '#b8866a', visor: '#14101e', blade: '#aab3bc', hilt: '#6b4532', boots: '#2e2420', bandana: '#6b2e2e', mask: '#4a3e34' },
  },
  skelShort: {
    kind: 'melee', name: 'Скелет с коротким мечом', hp: 3, damage: 1, aggro: 130, reach: 24, speed: 55, lunge: 5, weapon: 11, skull: true,
    windup: 0.45, comboWindup: 0.28, gap: 0.05, recover: 0.8, wait: [0.5, 0.8],
    combos: [['mid', 'mid'], ['high', 'high'], ['mid', 'mid', 'high'], ['low', 'mid', 'mid']],
    guardChance: 0.3, reaction: 0.12,
    colors: BONE,
  },
  skelLong: {
    kind: 'melee', name: 'Скелет с двуручником', hp: 6, damage: 2, aggro: 150, reach: 50, speed: 32, lunge: 10, weapon: 28, skull: true, plate: true,  // в старых латах и шлеме
    windup: 0.95, comboWindup: 0.7, gap: 0.15, recover: 1.2, wait: [1, 1.4],
    combos: [['heavyHigh'], ['heavyMid'], ['heavyHigh', 'heavyMid'], ['heavyMid', 'heavyLow']],  // первый сбивает защиту — второй уже не отбить
    guardChance: 0.35, reaction: 0.14,
    colors: { ...BONE, plate: '#8e98a3', plateDark: '#5f6873', plateLight: '#c3ccd6', tabard: '#3b3550' },
  },
  // наёмник с копьём: лёгкая кожаная броня, длинные уколы и круговой взмах «тык-тык — диск».
  // Нижних ударов нет и снизу не закрывается — его берут скоростью и кувырком с подсечкой.
  spear: {
    kind: 'melee', name: 'Мародёр с копьём', shortName: 'Копейщик', bandit: true, hp: 4, damage: 1, aggro: 160, reach: 46, speed: 44, lunge: 6, weapon: 30, spear: true,
    windup: 0.6, comboWindup: 0.42, gap: 0.08, recover: 1.0, wait: [0.7, 1.1],
    combos: [['thrust', 'thrust', 'whirl'], ['thrust', 'thrust'], ['thrust', 'whirl'], ['thrust', 'thrust', 'whirl']],
    guardChance: 0.5, reaction: 0.1, noLowGuard: true,
    colors: { armor: '#8a6a48', armorDark: '#5e4630', tabard: '#6b4532', helm: '#c49a76', visor: '#14101e', blade: '#c9d2dc', hilt: '#7a5a3a', boots: '#3b2a1e', bandana: '#2e3b4a', mask: '#5e4630' },
  },
  // скелет — командир стражи: хороший полуторный меч и щит, сражается на обрушенном балконе.
  // Щит держит верх и середину; пробивают низом, захлёстом, контратакой после идеальной серии.
  commander: {
    kind: 'melee', name: 'Скелет — командир стражи', shortName: 'Командир стражи', hp: 12, damage: 1, aggro: 160, reach: 34, speed: 46, lunge: 6, weapon: 19,
    skull: true, plate: true, shield: true,
    windup: 0.6, comboWindup: 0.42, gap: 0.08, recover: 0.9, wait: [0.6, 1.0],
    combos: [['high', 'mid'], ['diagDown'], ['mid', 'low', 'high'], ['heavyHigh'], ['thrust', 'diagUp'], ['low', 'low', 'high']],
    guardChance: 0.5, reaction: 0.1,
    colors: { ...BONE, plate: '#b8a46a', plateDark: '#7a6a3e', plateLight: '#efe2a8', tabard: '#7a1e2e', shield: '#5a2a2a', blade: '#e8eef4', hilt: '#e0b04a' },
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
  // тренировочное чучело: не умирает, медленно и без урона показывает удары на трёх высотах
  dummy: {
    kind: 'melee', practice: true, name: 'Чучело', hp: 9999, damage: 0, aggro: 70, reach: 32, speed: 0, lunge: 0, weapon: 15,
    windup: 1.1, comboWindup: 0.9, gap: 0.3, recover: 1.2, wait: [1.8, 2.6],
    combos: [['high'], ['mid'], ['low'], ['mid', 'high']],
    guardChance: 0, reaction: 0.1,
    colors: { armor: '#b89a5e', armorDark: '#8a6f3e', tabard: '#6b4532', helm: '#d6be86', visor: '#4a3226', blade: '#8a5a3b', hilt: '#5a3726', boots: '#6b4532' },
  },
  duelist: {
    kind: 'duelist', name: 'Священный рыцарь — Илиа', shortName: 'Илиа', defeatDialogue: 'ilia_defeat', hp: 14, damage: 1, aggro: 150, reach: 34, speed: [30, 85], lunge: 8, weapon: 22,
    windup: 0.5, comboWindup: 0.3, gap: 0.06, recover: 0.75, wait: [0.5, 0.9],  // v0.10: медленнее по отчётам тестера
    combos: [
      ['thrust', 'thrust', 'thrust'], ['low', 'high'], ['low', 'mid'], ['whirl', 'whirl'],
      ['diagUp'], ['diagDown'], ['thrust', 'diagDown'], ['mid', 'diagUp'], ['flick'], ['thrust', 'flick'],
    ],
    leapBackChance: 0.15, leapInChance: 0.22, vaultChance: 0.1, leapDistance: 64, vaultWindup: 0.3,  // vault — прыжок через рыцаря с захлёстом в спину
    guardChance: 0.6, reaction: 0.08,
    robe: true,  // длинное бежевое одеяние до пят, вроде джедайского
    rests: true, // до встречи отдыхает, опершись на рапиру; замечает рыцаря — «!» и в бой
    colors: { armor: '#c8b48a', armorDark: '#9c8762', tabard: '#ece2c8', robe: '#b9a47a', robeDark: '#8f7c58', belt: '#5a4632', helm: '#d9a87e', visor: '#14101e', blade: '#f4f8ff', hilt: '#f2c14e', boots: '#4a3a2a', hair: '#14101e' },
  },
  // Алкима: восточное женское платье, лицо открыто; знакома с Найтом; вместо чучела учит драться, урона не наносит
  trainer: {
    kind: 'trainer', practice: true, name: 'Алкима', hp: 9999, damage: 0, aggro: 0, reach: 30, speed: 45, lunge: 3, weapon: 16,
    windup: 1.1, comboWindup: 0.9, gap: 0.3, recover: 1.0, wait: [1.2, 1.7],
    combos: [['mid']],
    guardChance: 0, reaction: 0.1,
    robe: true, bun: true, ornate: true, curved: true, slim: true,
    // по портрету владельца: чёрные волосы с пучком, открытое лицо, бирюзовое восточное платье с золотым и красным узором
    colors: { armor: '#2f6a80', armorDark: '#1f4a5c', tabard: '#c9a24a', robe: '#2c5d72', robeDark: '#1c3d4e', belt: '#8a3a2a', helm: '#f0c8b0', visor: '#3a2418', hair: '#1c1820', hairLight: '#4a4050', lips: '#c06a6a', blade: '#e6edf3', hilt: '#e0b04a', boots: '#5a3a22' },
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

// Неигровые персонажи: стоят на месте, E — заговорить (shop — открыть лавку).
export const NPC_TYPES = {
  // Лика — торговка: невысокая, длинные чёрные волосы с чёлкой до глаз, оливковый плащ с высоким воротом на пуговицах
  // (по портрету владельца assets/portraits/lika.jpg)
  lika: {
    name: 'Лика', shop: 'lika', face: 'lika', short: true, bob: true, coat: true,
    colors: { armor: '#574f44', armorDark: '#3a352d', tabard: '#797260', belt: '#2d2a24', helm: '#e7bd9e', visor: '#2b2e38', hair: '#2b2e38', hairLight: '#3d4150', blush: '#bb6554', boots: '#2d2a24', blade: '#b9c2cc', hilt: '#6b4532' },
  },
};

// Предметы. slot — куда надевается (weapon / armor / amulet / spell / skill); use — расходник (heal — сердца);
// price — цена у Лики; ward — щит амулета (absorb — сколько урона гасит за раз, cooldown — перезарядка, с).
// Описания — в src/story/dialogues.js (ITEM_TEXTS).
export const ITEMS = {
  sword_old: { name: 'Старый стальной полуторный меч', slot: 'weapon', weapon: 'sword' },
  rapier: { name: 'Рапира Илиа', slot: 'weapon', weapon: 'rapier' },
  armor_old: { name: 'Потёртые стальные доспехи', slot: 'armor' },
  diamond_ace: { name: 'Бубновый туз', slot: 'amulet', price: 30, ward: { absorb: 4, cooldown: 10 } },
  journal: { name: 'Журнал', price: 15, journal: true },
  potion: { name: 'Зелье лечения', price: 10, use: { heal: 3 } },
  bandage: { name: 'Бинт', price: 4, use: { heal: 1 } },
  map: { name: 'Карта замка', price: 25 },
  key_tower: { name: 'Ключ от башни', key: true },
  spell_bolt: { name: 'Магическая стрела', slot: 'spell' },
  // навыки — приёмы боя на колесе (вниз); learn — изучается чтением свитка, need — нужное оружие
  skill_triple: { name: 'Тройной выпад', slot: 'skill', attack: 'tripleLunge', need: 'rapier', cooldown: 5 },
  scroll_fencing: { name: 'Старый свиток фехтования', price: 25, learn: 'skill_triple' },
  golden_skull: { name: 'Золотой череп', price: 40, artifact: true },
  silver_cup: { name: 'Серебряная чаша', artifact: true },
};
export const SLOTS = [['weapon', 'Оружие'], ['armor', 'Броня'], ['amulet', 'Амулет'], ['spell', 'Заклинание'], ['skill', 'Навык']];
export const START_EQUIP = { weapon: 'sword_old', armor: 'armor_old', amulet: null, spell: null, skill: null };

// Монеты с врагов (тренировочные — без монет)
export const COINS = { commander: 12, axe: 3, slime: 1, skelShort: 2, skelShield: 2, skelArcher: 2, skelLong: 3, merc: 3, spear: 3, guard: 3, captain: 8, duelist: 10, mage: 15 };

// Мир: комнаты и переходы между ними.
// edges — выход за край комнаты (left / right): to — комната, x — где рыцарь появится там.
// doors — двери в задней стене (W у двери — войти): x — центр, kind — wood | bars | iron,
//   to / toDoor — куда ведёт; locked — заперта (текст подсказки).
// encounters — встречи: пока группа жива, проход закрыт. dx — смещение врага от центра встречи, z — глубина.
// trainer — где ждёт наставница; npcs — персонажи; props — бочки и ящики; portal — знак портала на полу.
// dark — тёмная комната (свет только от портала и выхода); gate — решётка камеры с открытой дверью (left / right).
// image — фон-картинка вместо нарисованного кодом (assets/backgrounds/, 320×180 на экран); flames — где на ней факелы [x, y].
export const START = { room: 'cell', x: 112, z: 26 };

// Галерея: картинка-плитка 236×180 повторяется с зеркалом; факелы на плитке — в TILE_FLAMES
const GALLERY_TILE = 236;
const TILE_FLAMES = [[19, 69], [95, 69], [170, 69]];
const tiledFlames = (length, tile, flames) => {
  const out = [];
  for (let i = 0; i * tile < length; i++) for (const [x, y] of flames) out.push([i * tile + (i % 2 ? tile - x : x), y]);
  return out;
};

export const ROOMS = {
  cell: {
    name: 'Камера с порталом', length: 320, dark: true, torches: [], columns: false, cobwebs: true, gate: 'right',
    portal: { x: 112, z: 26 },
    props: [
      { type: 'barrel', x: 30, z: 2 }, { type: 'barrel', x: 44, z: 6 }, { type: 'crate', x: 22, z: 16 },
      { type: 'barrel', x: 224, z: 2 }, { type: 'bones', x: 196, z: 38 },
    ],
    edges: { right: { to: 'hall', x: 44 } },
  },
  // нижний ярус замка: обучение, четыре встречи и Илиа; в конце — лестница наверх, в Галерею
  hall: {
    name: 'Темница', length: 2400, gate: 'left', stairs: 'right',
    torches: [150, 330, 560, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200],
    edges: { left: { to: 'cell', x: 276 }, right: { to: 'gallery', x: 30, name: 'Лестница наверх' } },
    doors: [
      { id: 'cellA', x: 470, kind: 'bars', locked: 'Пустая камера' },
      { id: 'cellB', x: 870, kind: 'bars', locked: 'Пустая камера', bones: true },
      { id: 'cellC', x: 1560, kind: 'bars', locked: 'Пустая камера' },
    ],
    trainer: { x: 300, z: 22 },
    props: [{ type: 'barrel', x: 540, z: 2 }, { type: 'crate', x: 1210, z: 3 }, { type: 'bones', x: 1900, z: 30 }],
    encounters: [
      { x: 660, enemies: [{ type: 'slime', dx: 60, z: 10 }, { type: 'slime', dx: 90, z: 34 }] },
      { x: 1020, enemies: [{ type: 'merc', dx: 70, z: 20 }, { type: 'skelShort', dx: -90, z: 30 }] },
      { x: 1380, enemies: [{ type: 'skelShield', dx: 50, z: 26 }, { type: 'skelArcher', dx: 130, z: 8 }] },
      { x: 1740, enemies: [{ type: 'skelLong', dx: 70, z: 22 }, { type: 'skelShort', dx: 100, z: 38 }] },
      { x: 2100, enemies: [{ type: 'duelist', dx: 80, z: 22 }] },  // Илиа отдыхает, замечает рыцаря и бросается в бой
    ],
  },
  // верхняя галерея с окнами на горы (фон владельца, плитка с зеркалом); отсюда — все комнаты и башня
  gallery: {
    name: 'Галерея', length: 1180, image: 'assets/backgrounds/gallery.png', tile: GALLERY_TILE, torches: [],
    flames: tiledFlames(1180, GALLERY_TILE, TILE_FLAMES),
    edges: { left: { to: 'hall', x: 2370, name: 'Темница' }, right: { to: 'corridor', x: 30, name: 'Коридор' } },
    doors: [
      { id: 'shop', x: 170, kind: 'wood', to: 'shop', toDoor: 'out', name: 'Лавка Лики' },
      { id: 'armory', x: 377, kind: 'wood', to: 'armory', toDoor: 'out', name: 'Оружейная' },
      { id: 'guard', x: 567, kind: 'wood', to: 'guardroom', toDoor: 'out', name: 'Караульная' },
      { id: 'barracks', x: 849, kind: 'wood', to: 'barracks', toDoor: 'out', name: 'Казарма' },
      // финальный босс (маг) — за этой дверью; ключ будет на втором или третьем этаже
      { id: 'tower', x: 1114, kind: 'iron', to: 'tower', toDoor: 'out', name: 'Башня', key: 'key_tower', locked: 'Заперто. Нужен ключ от башни' },
    ],
    encounters: [
      { x: 700, enemies: [{ type: 'spear', dx: 60, z: 18 }, { type: 'skelArcher', dx: 150, z: 6 }] },
    ],
  },
  shop: {
    name: 'Лавка Лики', length: 320, columns: false, torches: [160],
    doors: [{ id: 'out', x: 64, kind: 'wood', to: 'gallery', toDoor: 'shop', name: 'Галерея' }],
    npcs: [{ type: 'lika', x: 214, z: 12 }],
    props: [
      { type: 'crate', x: 252, z: 2 }, { type: 'crate', x: 264, z: 10 }, { type: 'barrel', x: 282, z: 3 },
      { type: 'barrel', x: 120, z: 2 }, { type: 'sack', x: 236, z: 4 },
    ],
  },
  // испытать рапиру на копейщиках; в сундуке монеты для лавки
  armory: {
    name: 'Оружейная', length: 480, columns: false, torches: [120, 360],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'gallery', toDoor: 'armory', name: 'Галерея' }],
    props: [{ type: 'chest', id: 'a', x: 446, z: 3, coins: 20 }, { type: 'barrel', x: 150, z: 2 }, { type: 'crate', x: 420, z: 14 }],
    encounters: [
      { x: 290, enemies: [{ type: 'spear', dx: 50, z: 16 }, { type: 'spear', dx: 110, z: 32 }] },
    ],
  },
  // фон нарисован целиком (картинка владельца): двери и факелы уже на нём, поверх — только мерцание огня
  guardroom: {
    name: 'Караульная', length: 320, image: 'assets/backgrounds/guardroom.png', torches: [],
    flames: [[19, 77], [90, 92], [143, 80], [232, 79], [252, 90], [303, 76]],
    doors: [{ id: 'out', x: 50, kind: 'wood', to: 'gallery', toDoor: 'guard', name: 'Галерея' }],
    encounters: [
      { x: 200, enemies: [{ type: 'skelShort', dx: 30, z: 18 }, { type: 'axe', dx: 80, z: 32 }] },
    ],
  },
  // капитан стражи стережёт сундук с монетами (ключ от башни — на втором или третьем этаже, решение владельца)
  barracks: {
    name: 'Казарма', length: 480, columns: false, torches: [120, 360],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'gallery', toDoor: 'barracks', name: 'Галерея' }],
    props: [
      { type: 'chest', id: 'key', x: 446, z: 3, coins: 25 },
      { type: 'barrel', x: 150, z: 2 }, { type: 'crate', x: 175, z: 2 }, { type: 'barrel', x: 420, z: 16 },
    ],
    encounters: [
      { x: 270, before: 'captain_meet', enemies: [{ type: 'captain', dx: 60, z: 22 }, { type: 'skelShort', dx: 110, z: 36 }] },
    ],
  },
  // лестница башни: наверх — к магу
  // за Галереей: коридор с мародёрами → столовая (чаша, лестница на второй этаж) → обрушенный балкон (тупик, командир стражи)
  corridor: {
    name: 'Коридор', length: 900, torches: [120, 330, 540, 760],
    edges: { left: { to: 'gallery', x: 1150, name: 'Галерея' }, right: { to: 'dining', x: 30, name: 'Столовая' } },
    props: [{ type: 'crate', x: 200, z: 2 }, { type: 'sack', x: 214, z: 6 }, { type: 'barrel', x: 640, z: 3 }],
    encounters: [
      { x: 470, enemies: [{ type: 'merc', dx: 40, z: 16 }, { type: 'axe', dx: 110, z: 30 }] },
    ],
  },
  dining: {
    name: 'Столовая', length: 480, columns: false, torches: [60, 420], stairs: 'up', stairsX: 40,
    edges: { left: { to: 'corridor', x: 870, name: 'Коридор' }, right: { to: 'balcony', x: 30, name: 'Балкон' } },
    doors: [
      // у подножия лестницы: наверх можно, когда осмотрел этаж до конца (балкон)
      { id: 'up', x: 60, kind: 'none', name: 'Лестница на второй этаж', requires: 'balcony_done', locked: 'Сначала осмотри этаж до конца', finish: true },
    ],
    props: [
      { type: 'table', x: 300, z: 16 }, { type: 'chair', x: 252, z: 10 }, { type: 'chair', x: 348, z: 24, flip: true },
      { type: 'cup', id: 'cup', x: 318, z: 17, pick: 'silver_cup' },
      { type: 'barrel', x: 452, z: 3 },
    ],
  },
  // тупик: обрыв и вид на долину, деревню, поля и леса — туда рыцарь пойдёт во второй локации
  balcony: {
    name: 'Обрушенный балкон', length: 400, balcony: true, torches: [], limitRight: 348,  // дальше — обрыв
    edges: { left: { to: 'dining', x: 450, name: 'Столовая' } },
    encounters: [
      { x: 240, before: 'commander_meet', after: 'balcony_after', enemies: [{ type: 'commander', dx: 40, z: 22 }] },
    ],
  },
  tower: {
    name: 'Лестница башни', length: 320, columns: false, torches: [100, 230], stairs: 'up',
    doors: [
      { id: 'out', x: 52, kind: 'iron', to: 'gallery', toDoor: 'tower', name: 'Галерея' },
      { id: 'up', x: 272, kind: 'wood', to: 'mage', toDoor: 'in', name: 'Вершина башни' },
    ],
  },
  mage: {
    name: 'Вершина башни', length: 480, columns: false, torches: [100, 240, 380], magic: true,
    doors: [{ id: 'in', x: 56, kind: 'wood', to: 'tower', toDoor: 'up', name: 'Лестница башни' }],
  },
};
