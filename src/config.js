// Все числа, которые влияют на ощущение боя, собраны здесь.
// Время — в секундах, расстояния — в пикселях игрового экрана (320×180).

export const VERSION = 'v0.87';

export const CONFIG = {
  width: 320,
  height: 180,
  ground: 150,

  // Глубина пола (вариант A): z = 0 — у стены, z = depth — у края экрана
  floorTop: 118,        // где стена встречается с полом
  depth: 44,
  depthSpeed: 46,       // шаг вглубь медленнее, чем вбок
  depthReach: 12,       // насколько можно разойтись по глубине, чтобы удар всё равно достал (было 9 — удары «проходили сквозь»)
  tokenPause: 0.35,     // пауза между атаками разных врагов: бьёт один, остальные ждут
  tokenRepeat: 1.0,     // кто только что бил, пропускает других вперёд столько секунд

  // Защита
  perfectWindow: 0.22,  // нажал защиту не раньше чем за столько до удара → идеальное парирование
  windupMult: 1,        // замахи врагов: ×1 обычно; лёгкий режим (пауза) — медленнее, см. EASY

  mashLockout: 0.3,     // если перед этим жал защиту чаще, идеального не будет (защита от «спама»)
  counterWindow: 1.3,   // сколько враг ошеломлён после идеально отбитой серии
  reelTime: 0.55,       // идеальное парирование посреди серии: враг выбит из ритма, ударишь — серия прервётся
  guardBreakTime: 0.7,  // сколько нельзя защищаться после сбитой защиты
  urgentTurn: 0.12,     // враг за спиной замахивается или рыцарь держит защиту — разворот почти сразу (v0.73)
  autoTurn: 0.7,        // враг оказался за спиной — рыцарь сам развернётся через столько секунд (стрелкой — сразу)

  // Урон
  counterMult: 2,       // во сколько раз больнее бьёшь ошеломлённого врага
  tradeMult: 2,         // во сколько раз больнее получаешь, если враг ударил, пока ты атаковал (или после неудачного отскока)
  playerHp: 10,
  shieldRegenDelay: 4,  // щит брони начинает восстанавливаться, если столько секунд по рыцарю не попадали
  shieldRegenTime: 1.2, // секунд на одну единицу щита

  // Передвижение
  walkSpeed: 74,        // в бою
  exploreSpeed: 120,    // вне боя: по пустым коридорам быстрее (v0.16, просьба владельца)
  runSpeed: 210,        // вне боя рыцарь сам переходит на бег (v0.17)
  runDelay: 0.35,       // через столько секунд ходьбы
  exploreDepthSpeed: 70,
  strollSpeed: 46,      // режим «шагом» (v0.87, Caps Lock или пауза → Передвижение): спокойный шаг вне боя
  strollDepthSpeed: 34,
  enemyMove: 1.4,       // множитель скорости передвижения врагов (не ударов)
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
  spinName: 'вихрь',
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
    // навык из «Свитка тяжёлого удара» (слот навыка, колесо вниз): рубит сверху сквозь защиту
    cleave:   { name: 'Тяжёлый удар',     height: 'high', pose: 'high', windup: 0.3,  active: 0.1,  recover: 0.36, reach: 32, damage: 3, move: 8, pierce: true },
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
  spinName: 'восьмёрка',
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

// Кинжал (v0.82, план главы 1: «быстрый, удар в спину»): короткий и слабый, зато самый быстрый — до четырёх уколов
// подряд. Рывок с кинжалом проскакивает сквозь врага; удар в спину (враг отвернулся или рыцарь только что проскочил
// мимо — slipWindow) — урон ×backstab и сквозь защиту. Колесо — «Шквал»: пять уколов подряд.
export const DAGGER = {
  name: 'Кинжал',
  length: 10,
  drawSide: -0.02,
  drawExtra: 0,
  spinKey: 'flurry',
  spinName: 'шквал',
  chainMax: 4,
  chainRecover: 0.22,
  backstab: 3,
  slipWindow: 0.6,
  attacks: {
    side:     { name: 'Укол',             height: 'mid',  pose: 'thrust', windup: 0.06, active: 0.05, recover: 0.12, reach: 22, damage: 1, chain: true, backstab: true },
    overhead: { name: 'Удар сверху',      height: 'high', pose: 'high',   windup: 0.13, active: 0.06, recover: 0.18, reach: 20, damage: 1, backstab: true },
    low:      { name: 'Подрез',           height: 'low',  pose: 'low',    windup: 0.08, active: 0.06, recover: 0.14, reach: 22, damage: 1, backstab: true },
    dashCut:  { name: 'Удар в рывке',     height: 'mid',  pose: 'thrust', windup: 0.04, active: 0.08, recover: 0.2,  reach: 26, damage: 1, move: 12, backstab: true },
    leap:     { name: 'Прыжок с ударом',  height: 'high', pose: 'high',   windup: 0.22, active: 0.1,  recover: 0.3,  reach: 24, damage: 2, move: 26, backstab: true },
    rollCut:  { name: 'Подрез из кувырка', height: 'low', pose: 'sweep',  windup: 0.08, active: 0.1,  recover: 0.24, reach: 26, damage: 1, backstab: true },
    // «Шквал» (v0.84, владелец: «тык-тык, подкинуть, удар-удар-удар — красивая комбинация»): два укола, подброс с вращением,
    // ловля обратным хватом, удары сверху, в середину, снизу и финальный росчерк (раскадровка — FLURRY в src/player.js)
    flurry:   { name: 'Шквал',            height: 'any',  pose: 'flurry', windup: 0.05, active: 1.1,  recover: 0.25, reach: 24, damage: 1, hits: [0.06, 0.18, 0.62, 0.74, 0.86, 1.0], front: true, backstab: true },
  },
};

export const WEAPONS = { sword: WEAPON, rapier: RAPIER, dagger: DAGGER };

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
  spin:      { guard: 'mid',  pose: 'whirl', breaks: true, mult: 2, heavy: true },   // босс: разворот и мощный удар на амплитуде
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
  // призрачный страж (третий этаж, ближе к колдуну): после серии растворяется и проявляется рядом — сбоку или за спиной
  ghost: {
    kind: 'ghost', name: 'Призрачный страж', shortName: 'Призрак', hp: 4, damage: 1, aggro: 170, reach: 32, speed: 40, lunge: 4, weapon: 18,
    skull: true, blinkChance: 0.7,
    windup: 0.6, comboWindup: 0.42, gap: 0.1, recover: 0.6, wait: [0.6, 1.0],
    combos: [['high', 'mid'], ['low', 'high'], ['mid', 'mid', 'high'], ['diagDown']],
    guardChance: 0.25, reaction: 0.12,
    colors: { ...BONE, helm: '#bfe6f2', armor: '#bfe6f2', armorDark: '#7fb0c8', boots: '#7fb0c8', tabard: '#5a3a8a', blade: '#d9f4ff', hilt: '#8fd3ff' },
  },
  // Босс главы 1 — призрак главы королевской стражи (механика владельца, docs/design.md «Босс главы 1»).
  // patterns — приёмы: combo — удары подряд; swap — после удара перелетает на другую сторону рыцаря;
  // stance — «Оби-Ван» перед серией; step — шаг вперёд с каждым ударом; windup/gap — свои темпы.
  // Вторая фаза — с половины жизни: темп ×phase2Speed, телепорт чаще.
  boss: {
    // v0.69 (владелец: «слабый, тупой, еле двигается»): быстрее, рывок-скольжение с ударом, контратака после блока,
    // за щитом не отсидеться (пробивные приёмы и удушье чаще), удушье дольше — вырваться ударами (ЛКМ)
    kind: 'boss', name: 'Призрак главы стражи', shortName: 'Глава стражи', hp: 42, damage: 1, aggro: 240, reach: 34, speed: 82, lunge: 7, weapon: 21,
    windup: 0.5, comboWindup: 0.34, gap: 0.08, recover: 0.55, wait: [0.2, 0.5],
    guardChance: 0.7, reaction: 0.08, blinkChance: 0, blink: 0.35, phase2Speed: 0.8, phase2Blink: 0.6,
    chokeChance: 0.2, chokeCast: 1.0, chokeRange: 150, chokeHold: 1.8, chokeBreak: 7,
    dashSpeed: 320, dashRange: 190, dashChance: 1.6, dashWindup: 0.28, riposteWindup: 0.24,
    patterns: [
      { id: 'twoSides', weight: 3, combo: ['mid', 'mid'], swap: [0] },
      { id: 'sideHigh', weight: 2, combo: ['mid', 'high'] },
      { id: 'sideLow', weight: 2, combo: ['mid', 'low'] },
      { id: 'steps', weight: 2, combo: ['high', 'low', 'high'], step: 14 },
      { id: 'turnPower', weight: 2, combo: ['high', 'mid', 'mid', 'high', 'spin'], phase: 2 },
      { id: 'obiwan', weight: 2, combo: ['heavyHigh', 'heavyMid'], stance: 0.9, breaker: true },
      { id: 'flurry', weight: 1, combo: ['whirl', 'whirl', 'whirl'], windup: [0.45, 0.2], gap: 0.04, breaker: true },
    ],
    colors: { armor: '#e8e4d8', armorDark: '#a8b4c8', tabard: '#f2eee4', helm: '#c9d2de', visor: '#f4f4f4', boots: '#7fb0c8', blade: '#d9f4ff', hilt: '#c9a24a' },
  },
  // скелет-алебардист (второй этаж): длинный охват; подсечка низом и рубящий сверху сбивают блок, между ними — уколы.
  // Читать по замаху: тяжёлые — идеальное парирование или отойти; после тяжёлого он долго выпрямляется.
  halberd: {
    kind: 'melee', name: 'Скелет-алебардист', shortName: 'Алебардист', hp: 5, damage: 1, aggro: 160, reach: 50, speed: 34, lunge: 6, weapon: 32,
    skull: true, halberd: true,
    windup: 0.75, comboWindup: 0.5, gap: 0.12, recover: 1.3, wait: [0.8, 1.2],
    combos: [['heavyLow'], ['thrust', 'thrust'], ['heavyHigh'], ['thrust', 'heavyLow'], ['low', 'heavyHigh']],
    guardChance: 0.35, reaction: 0.12,
    colors: { ...BONE, tabard: '#4a2a5a', blade: '#c3ccd6', hilt: '#6b4532' },
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
  // скелет — сотник стражи (до v0.57 — «командир»): хороший полуторный меч и щит, сражается на обрушенном балконе.
  // Щит держит верх и середину; пробивают низом, захлёстом, контратакой после идеальной серии.
  commander: {
    kind: 'melee', name: 'Скелет — сотник стражи', shortName: 'Сотник стражи', hp: 12, damage: 1, aggro: 160, reach: 34, speed: 46, lunge: 6, weapon: 19,
    skull: true, plate: true, shield: true, noRise: true,  // стоит на краю балкона — не встаёт из костей
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
  // мародёр с арбалетом: долго целится (пунктир на высоте выстрела), болт сильный, перезарядка долгая — тогда и подходи
  crossbow: {
    kind: 'archer', name: 'Мародёр с арбалетом', shortName: 'Арбалетчик', hp: 3, damage: 2, aggro: 210, bandit: true, crossbow: true,
    windup: 1.5, comboWindup: 1.5, recover: 2.4, wait: [0.6, 1.0],
    heights: ['high', 'mid', 'low'], volleyChance: 0, minDist: 60, maxDist: 170, arrowSpeed: 240,
    guardChance: 0.3, reaction: 0.12,
    colors: { armor: '#5a5a3e', armorDark: '#3b3b2a', tabard: '#3b4a2e', helm: '#b88a68', visor: '#14101e', blade: '#8a8478', hilt: '#6b4532', boots: '#2e2420', bandana: '#4a5a3a', mask: '#3b3b2a' },
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
  // атаман мародёров: латы снял с мёртвых стражников (замок заброшен — живой страже взяться неоткуда)
  captain: {
    kind: 'melee', name: 'Атаман мародёров', shortName: 'Атаман', hp: 6, damage: 2, aggro: 130, reach: 32, speed: 45, lunge: 6, weapon: 19,
    bandit: true, plate: true,
    windup: 0.55, comboWindup: 0.38, gap: 0.08, recover: 0.85, wait: [0.6, 1.0],
    combos: [['high', 'high'], ['mid', 'high', 'low'], ['low', 'low', 'high'], ['high', 'mid', 'low', 'mid']],
    guardChance: 0.6, reaction: 0.08,
    colors: { armor: '#5a4a3e', armorDark: '#3b2f2a', tabard: '#5a1e1e', helm: '#b08060', visor: '#14101e', blade: '#f4f8ff', hilt: '#f2c14e', boots: '#1c1828', bandana: '#8e2b3a', mask: '#2a2420', plate: '#6d6a7a', plateDark: '#45424f', plateLight: '#a89a8a' },
  },
};

// Неигровые персонажи: стоят на месте, E — заговорить (shop — открыть лавку).
export const NPC_TYPES = {
  // Лика — торговка: невысокая, длинные чёрные волосы с чёлкой до глаз, оливковый плащ с высоким воротом на пуговицах
  // (по портрету владельца assets/portraits/lika.png)
  // Илиа после поражения: сидит у костра на Привале (решение владельца); face: 'ilia' — портрет, human — лицо на фигурке
  ilia: {
    // задание у костра (v0.77, лор владельца): ранен — бинт и зелье; потом — дружеский разговор
    talks: [
      { id: 'ilia_friend', if: 'ilia_healed' },
      { id: 'ilia_heal', if: 'ilia_asked', has: ['bandage', 'potion'] },
      { id: 'ilia_need', if: 'ilia_asked' },
    ],
    name: 'Илиа', face: 'ilia', talk: 'ilia_camp_again', human: true, robe: true, sit: true, sprite: 'duelist',
    colors: { armor: '#d9c7a3', armorDark: '#b39f7c', tabard: '#efe4cc', belt: '#6b4a32', helm: '#e2b896', visor: '#1b1b22', hair: '#15151c', hairLight: '#2a2a34', boots: '#4a3626', blade: '#c9d2dc', hilt: '#8a6a3a' },
  },
  // душа служанки принцессы (v0.79): у засохшего букета на лестнице башни; письмо → страница дневника IV
  maid: {
    talks: [
      { id: 'maid_after', if: 'maid_done' },
      { id: 'maid_give', if: 'maid_asked', has: ['old_letter'] },
      { id: 'maid_wait', if: 'maid_asked' },
    ],
    name: 'Призрак служанки', talk: 'maid_meet', ghost: true, img: 'maid_ghost',
  },
  // призрак священника (v0.79, лор владельца): одержим праведностью; чаша, из которой он ни разу не пил
  priest: {
    talks: [
      { id: 'priest_silent', if: 'priest_done' },
      { id: 'priest_cup', if: 'cup_holy', has: ['silver_cup'] },
      { id: 'priest_cup_unholy', if: 'priest_met', has: ['silver_cup'] },
      { id: 'priest_again', if: 'priest_met' },
    ],
    name: 'Призрак священника', talk: 'priest_meet', ghost: true, img: 'priest_kneel', verb: 'говорить',
  },
  // кот Фуджин (v0.78, владелец): живой чёрный кот с жёлтыми глазами, сидит на столе в Старой библиотеке; «говорит» ремарками
  fujin: {
    talks: [
      { id: 'fujin_after', if: 'fujin_fed' },
      { id: 'fujin_feed', if: 'fujin_met', has: ['dried_fish'] },
      { id: 'fujin_hungry', if: 'fujin_met' },
    ],
    name: 'Фуджин', alias: 'чёрный кот', known: 'fujin_met', verb: 'подойти', talk: 'fujin_meet', cat: true,   // имя — с миски, после знакомства
    sitImgs: { idle: ['cat_sit', 'cat_sit', 'cat_sit_1'], wave: 'cat_sit_1' },
  },
  // Алкима после обучения (v0.78): ищет ткани в гардеробной на третьем этаже (лор владельца, docs/quests/alkima.md)
  alkima: {
    talks: [
      { id: 'alkima_after', if: 'alkima_done' },
      { id: 'alkima_found', if: 'alkima_quest', has: ['old_fabric'] },
    ],
    name: 'Алкима', face: 'trainer', talk: 'alkima_topics', human: true, robe: true, sprite: 'trainer',
    colors: ENEMY_TYPES.trainer.colors,
  },
  lika: {
    name: 'Лика', shop: 'lika', face: 'lika', short: true, bob: true, coat: true, sprite: 'lika',
    sitImgs: { idle: ['lika_sit', 'lika_sit_1'], wave: 'lika_wave' },   // сидит на бочке у прилавка (v0.67)
    colors: { armor: '#574f44', armorDark: '#3a352d', tabard: '#797260', belt: '#2d2a24', helm: '#e7bd9e', visor: '#2b2e38', hair: '#2b2e38', hairLight: '#3d4150', blush: '#bb6554', boots: '#2d2a24', blade: '#b9c2cc', hilt: '#6b4532' },
  },
};

// Предметы. slot — куда надевается (weapon / armor / amulet / spell / skill); use — расходник (heal — сердца);
// price — цена у Лики; ward — щит амулета (absorb — сколько урона гасит за раз, cooldown — перезарядка, с).
// Описания — в src/story/dialogues.js (ITEM_TEXTS).
export const ITEMS = {
  sword_old: { name: 'Старый стальной полуторный меч', slot: 'weapon', weapon: 'sword' },
  rapier: { name: 'Рапира Илиа', slot: 'weapon', weapon: 'rapier' },
  dagger: { name: 'Кинжал атамана', slot: 'weapon', weapon: 'dagger' },   // награда за бой в Логове атамана (v0.84, владелец)
  armor_old: { name: 'Потёртые стальные доспехи', slot: 'armor', shield: 3 },
  // голова и ноги (v0.80, владелец: сет мародёра надевается по частям)
  helm_old: { name: 'Потёртый шлем с плюмажем', slot: 'head' },
  boots_old: { name: 'Латные сапоги', slot: 'feet' },
  // сет мародёра (решение владельца): три части по разным комнатам → броня; быстрее, но щит слабее. speed — множитель ходьбы
  armor_marauder: { name: 'Снаряжение мародёра', slot: 'armor', shield: 1, speed: 1.15 },
  // части сета мародёра — каждую можно надеть отдельно; весь сет — бонус к скорости (SETS)
  mar_scarf: { name: 'Треуголка и платок мародёра', set: 'marauder', slot: 'head', speed: 1.03 },
  mar_jacket: { name: 'Кожаная куртка мародёра', set: 'marauder', slot: 'armor', shield: 1, speed: 1.04 },
  mar_boots: { name: 'Сапоги мародёра', set: 'marauder', slot: 'feet', speed: 1.03 },
  diamond_ace: { name: 'Бубновый туз', slot: 'amulet', price: 30, ward: { absorb: 4, cooldown: 10 } },
  journal: { name: 'Журнал', price: 15, journal: true },
  potion: { name: 'Зелье лечения', price: 10, use: { heal: 3 } },
  bandage: { name: 'Бинт', price: 4, use: { heal: 1 } },
  dried_fish: { name: 'Вяленая рыбка', price: 3, quest: true },
  old_letter: { name: 'Письмо с сорванной печатью', quest: true },   // для служанки (v0.79)
  sun_medallion_pure: { name: 'Очищенный медальон Солнца', quest: true },   // исход Пилигрима в задании священника   // для кота Фуджина (v0.78)
  resin_flower: { name: 'Цветок в янтарной смоле', quest: true },
  // квест Алкимы (v0.78, лор владельца): лоскут ткани памяти — у мародёров Северного крыла; награда — медальон Солнца и страница дневника
  old_fabric: { name: 'Лоскут старинной ткани', quest: true },
  sun_medallion: { name: 'Медальон Солнца', quest: true },
  // обрывки дневника капитана (лор владельца: 1 — балкон, 2 — библиотека, 3 — Алкима, 4 — служанка)
  diary_1: { name: 'Страница дневника I', diary: 1 },
  diary_2: { name: 'Страница дневника II', diary: 2 },
  diary_3: { name: 'Страница дневника III', diary: 3 },
  diary_4: { name: 'Страница дневника IV', diary: 4 },   // от Илиа; сила, застывшая в нём, починит портал (лор владельца)
  map: { name: 'Карта замка', price: 25, once: true },
  key_tower: { name: 'Ключ от башни', key: true },
  spell_bolt: { name: 'Магическая стрела', slot: 'spell' },
  // навыки — приёмы боя на колесе (вниз); learn — изучается чтением свитка, need — нужное оружие
  skill_triple: { name: 'Тройной выпад', slot: 'skill', attack: 'tripleLunge', need: 'rapier', cooldown: 5 },
  skill_cleave: { name: 'Тяжёлый удар', slot: 'skill', attack: 'cleave', need: 'sword', cooldown: 6 },
  scroll_cleave: { name: 'Свиток тяжёлого удара', learn: 'skill_cleave' },
  scroll_fencing: { name: 'Старый свиток фехтования', price: 25, learn: 'skill_triple' },
  golden_skull: { name: 'Золотой череп', price: 40, artifact: true },
  silver_cup: { name: 'Серебряная чаша', artifact: true },
  // из Ризницы за алтарём Часовни: идеальное парирование лечит; слот амулета один — туз или чётки
  rosary: { name: 'Чётки монаха', slot: 'amulet', parryHeal: { heal: 1, cooldown: 8 } },
};
export const SLOTS = [['weapon', 'Оружие'], ['head', 'Голова'], ['armor', 'Броня'], ['feet', 'Ноги'], ['amulet', 'Амулет'], ['spell', 'Заклинание'], ['skill', 'Навык']];
// Сеты (v0.80): части надеваются по отдельности; надеты все — бонус (bonus.speed — множитель ходьбы, вдобавок к частям).
// gives — прежняя цельная броня (для старых сохранений: раскладывается обратно на части)
export const SETS = {
  marauder: { name: 'Комплект мародёра', pieces: ['mar_scarf', 'mar_jacket', 'mar_boots'], bonus: { speed: 1.05 }, gives: 'armor_marauder' },
};
export const START_EQUIP = { weapon: 'sword_old', head: 'helm_old', armor: 'armor_old', feet: 'boots_old', amulet: null, spell: null, skill: null };

// Монеты с врагов (тренировочные — без монет)
export const COINS = { commander: 12, axe: 3, slime: 1, skelShort: 2, skelShield: 2, skelArcher: 2, skelLong: 3, merc: 3, spear: 3, guard: 3, captain: 8, crossbow: 4, halberd: 3, ghost: 4, duelist: 10, mage: 15, boss: 25 };

// Мир: комнаты и переходы между ними.
// edges — выход за край комнаты (left / right): to — комната, x — где рыцарь появится там.
// doors — двери в задней стене (W у двери — войти): x — центр, kind — wood | bars | iron,
//   to / toDoor — куда ведёт; locked — заперта (текст подсказки).
// encounters — встречи: пока группа жива, проход закрыт. dx — смещение врага от центра встречи, z — глубина.
// trainer — где ждёт наставница; npcs — персонажи; props — бочки и ящики; portal — знак портала на полу.
// dark — тёмная комната (свет только от портала и выхода); gate — решётка камеры с открытой дверью (left / right).
// image — фон-картинка вместо нарисованного кодом (assets/backgrounds/, 320×180 на экран); flames — где на ней факелы [x, y].
export const START = { room: 'cell', x: 112, z: 26 };

// Лёгкий режим (необязательный, в паузе; по умолчанию выключен): шире окно идеального парирования, замахи медленнее.
// Обычный баланс не трогает — решение о сложности за владельцем.
export const EASY = { perfectWindow: 0.33, windupMult: 1.25 };
export const NORMAL = { perfectWindow: CONFIG.perfectWindow, windupMult: CONFIG.windupMult };

// Карта замка (покупается у Лики, M): где комната на схеме этажа — [этаж, x, y, ширина] в клетках по 6 px.
// Ширина ≈ длина комнаты; боковые комнаты — над коридором, к которому ведёт их дверь.
export const MAP = {
  cell: [1, 2, 14, 3], hall: [1, 5, 14, 19], secret: [1, 16.2, 17, 2.6],
  gallery: [1, 24, 9, 9.5], corridor: [1, 33.5, 9, 7.2], dining: [1, 40.7, 9, 3.8], balcony: [1, 44.5, 9, 3.2],
  shop: [1, 24.2, 5, 2.4], armory: [1, 25.9, 2, 2.4], guardroom: [1, 27.6, 5, 2.4], barracks: [1, 29.6, 2, 2.4], tower: [1, 31.8, 5, 2.4], priestcell: [1, 15.5, 11, 2.6], catlib: [1, 21.4, 11, 2.6],
  landing3: [3, 8, 9, 2.9], hall3: [3, 10.9, 9, 10.4], guardhall: [3, 13, 5, 3.8], wardrobe: [3, 10, 5, 2.8], lair: [3, 17.2, 5, 3.8],
  landing2: [2, 8, 9, 3.2], hall2: [2, 11.2, 9, 12], stairs3: [2, 23.2, 9, 2.6],
  camp: [2, 12.6, 11, 2.6], library: [2, 12.6, 5, 4.2], reading: [2, 14.4, 2, 2.4], chapel: [2, 17, 5, 3.8], vestry: [2, 18.2, 2, 2.6], royal: [2, 20.8, 5, 2.4],
};


export const ROOMS = {
  cell: {
    name: 'Камера с порталом', length: 320, dark: true, tiles: 'dungeon', tileCount: 3, torches: [], columns: false, cobwebs: true, gate: 'right',
    portal: { x: 112, z: 26 },
    props: [
      { type: 'barrel', x: 30, z: 2 }, { type: 'barrel', x: 44, z: 6 }, { type: 'crate', x: 22, z: 16 },
      { type: 'barrel', x: 224, z: 2 }, { type: 'bones', x: 196, z: 38 },
    ],
    edges: { right: { to: 'hall', x: 44 } },
  },
  // нижний ярус замка: обучение, четыре встречи и Илиа; в конце — лестница наверх, в Галерею
  hall: {
    name: 'Темница', length: 2400, gate: 'left', stairs: 'right', tiles: 'dungeon', tileCount: 3,
    torches: [150, 330, 560, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200],
    edges: { left: { to: 'cell', x: 276 }, right: { to: 'gallery', x: 30, name: 'Лестница наверх' } },
    doors: [
      { id: 'cellA', x: 470, kind: 'bars', locked: 'Пустая камера' },
      { id: 'cellB', x: 870, kind: 'bars', locked: 'Пустая камера', bones: true },
      { id: 'cellC', x: 1560, kind: 'bars', to: 'priestcell', toDoor: 'out', name: 'Келья' },   // v0.79: здесь заперся священник
      { id: 'secret', x: 1460, kind: 'none', needs: 'secret_hall', to: 'secret', toDoor: 'out', name: 'Тайник' },
      // по лестнице в конце Темницы — к двери наверху, за ней Старая библиотека с котом Фуджином (владелец, v0.78)
      { id: 'lib', x: 2306, kind: 'none', stairs: true, climb: true, to: 'catlib', toDoor: 'out', name: 'Старая библиотека' },
    ],
    trainer: { x: 300, z: 22 },
    props: [{ type: 'barrel', x: 540, z: 2 }, { type: 'crate', x: 1210, z: 3 }, { type: 'bones', x: 1900, z: 30 }],
    decor: [
      { type: 'note', x: 1500, y: 70, look: 'look_prisoner', name: 'надпись на стене' },
      { type: 'chains', x: 700, y: 46 }, { type: 'chains', x: 1150, y: 46 }, { type: 'chains', x: 1680, y: 46 },
      { type: 'tally', x: 1265, y: 50, n: 37, look: 'look_tally', name: 'зарубки на стене' },
      { type: 'chains', x: 2180, y: 46 },
      // замурованный проход в тайник: осмотреть (E), три удара — пролом
      { type: 'cracks', x: 1460, secret: 'secret_hall', look: 'look_cracks', name: 'трещины в кладке' },
    ],
    encounters: [
      { x: 660, enemies: [{ type: 'slime', dx: 60, z: 10 }, { type: 'slime', dx: 90, z: 34 }] },
      { x: 1020, enemies: [{ type: 'merc', dx: 70, z: 20 }, { type: 'skelShort', dx: -90, z: 30 }] },
      { x: 1380, enemies: [{ type: 'skelShield', dx: 50, z: 26 }, { type: 'skelArcher', dx: 130, z: 8 }] },
      { x: 1740, enemies: [{ type: 'skelLong', dx: 70, z: 22 }, { type: 'skelShort', dx: 100, z: 38 }] },
      { x: 2100, story: 'ilia', enemies: [{ type: 'duelist', dx: 80, z: 22 }] },  // Илиа отдыхает, замечает рыцаря и бросается в бой
    ],
  },
  // Старая библиотека над Темницей (v0.78, идея владельца): много книг, столы, бумаги на полу, потухшая свеча; живёт кот Фуджин
  catlib: {
    name: 'Старая библиотека', tiles: 'castle', length: 420, columns: false, torches: [], dark: true, cobwebs: true,
    ambient: [0.3, 0.26, 0.32],   // полутьма видна и без свечей; каждая зажжённая свеча — светлее (владелец, 15.10)
    doors: [{ id: 'out', x: 56, kind: 'wood', stairs: true, to: 'hall', toDoor: 'lib', name: 'Лестница вниз, в Темницу' }],   // v0.85: вниз по ступеням Темницы, а не «из стены»
    // места и позы кота: выбирается случайно при входе (lift — высота стола / стопки / стула)
    npcs: [{ type: 'fujin', x: 258, z: 12.5, lift: 15, spots: [   // все — в круге света свечи: чёрного кота в темноте не видно
      { x: 258, z: 12.5, lift: 15, img: 'cat_sit' }, { x: 256, z: 12.5, lift: 15, img: 'cat_sleep' },
      { x: 277, z: 14.5, lift: 6, img: 'cat_groom' }, { x: 302, z: 20.5, lift: 9, img: 'cat_lounge' },
      { x: 222, z: 20, lift: 0, img: 'cat_side' }, { x: 296, z: 8, lift: 0, img: 'cat_stretch' },
      { x: 200, z: 12, lift: 0, img: 'cat_loaf' }, { x: 214, z: 6, lift: 0, img: 'cat_stand' },
    ] }],
    decor: [
      { type: 'bookshelf', x: 110 }, { type: 'bookshelf', x: 160, gap: 2 }, { type: 'ladder', x: 178 },
      { type: 'bookshelf', x: 330, gap: 1 }, { type: 'bookshelf', x: 380, look: 'look_libbooks', name: 'стеллаж с хрониками' },
      { type: 'window', x: 250, w: 22, h: 36, y: 22, moon: true },
    ],
    props: [
      { type: 'desk', x: 252, z: 12 }, { type: 'chair', x: 276, z: 14, flip: true },
      { type: 'table', x: 150, z: 26 }, { type: 'bookpile', x: 128, z: 28 }, { type: 'bookpile', x: 302, z: 20 },
      { type: 'candles', x: 244, z: 12.6, lift: 15, lights: 'lib_candle', look: 'look_candle', lookLit: 'look_candle_lit', name: 'свеча (зажечь)' },
      // ещё свечи по библиотеке — каждую можно зажечь (владелец, 15.10)
      { type: 'candles', x: 132, z: 26.6, lift: 16, lights: 'lib_candle2', look: 'look_candle', quiet: true, name: 'свеча (зажечь)' },
      { type: 'candles', x: 92, z: 4, lights: 'lib_candle3', look: 'look_candle', quiet: true, name: 'свечи у стеллажа (зажечь)' },
      { type: 'candles', x: 352, z: 4, lights: 'lib_candle4', look: 'look_candle', quiet: true, name: 'свечи у стеллажа (зажечь)' },
      { type: 'candles', x: 304, z: 20.6, lift: 9, lights: 'lib_candle5', look: 'look_candle', quiet: true, name: 'свеча на книгах (зажечь)' },
      { type: 'candles', x: 186, z: 30, lights: 'lib_candle6', look: 'look_candle', quiet: true, name: 'свечи на полу (зажечь)' },
      { type: 'papers', x: 200, z: 6, flat: true, look: 'look_libnote', name: 'записки на полу' }, { type: 'papers', x: 312, z: 30, flat: true },
      { type: 'bookpile', x: 360, z: 4 },
    ],
  },
  // келья священника за решёткой в Темнице (v0.79): он запер себя сам. Исходы задания — по флагам при следующем входе
  priestcell: {
    name: 'Келья', length: 320, columns: false, tiles: 'dungeon', tileCount: 3, torches: [], cobwebs: true, dark: true,
    doors: [{ id: 'out', x: 56, kind: 'bars', to: 'hall', toDoor: 'cellC', name: 'Темница' }],
    onLeave: { if: 'priest_done', set: 'priest_left' },
    npcs: [{ type: 'priest', x: 220, z: 10, ifNot: 'priest_left' }],
    decor: [{ type: 'tally', x: 140, y: 44, n: 52 }, { type: 'chains', x: 270, y: 46 }],
    props: [
      { type: 'candles', x: 196, z: 4 },
      { type: 'bedroll', x: 120, z: 6 },
      { type: 'loot', id: 'sunpure', x: 220, z: 10, pick: 'sun_medallion_pure', needs: ['priest_pilgrim', 'priest_left'] },
      { type: 'puddle', x: 220, z: 10, flat: true, needs: ['priest_monarch', 'priest_left'], look: 'look_stain', name: 'мокрое пятно' },
    ],
    encounters: [
      { x: 200, story: 'priest_wrath', before: 'priest_wrath', needs: ['priest_ghostpath', 'priest_left'], enemies: [{ type: 'ghost', dx: 40, z: 10 }] },
    ],
  },
  // тайник за замурованной стеной Темницы: кто-то спрятался здесь со всем, что успел вынести
  secret: {
    name: 'Тайник', length: 320, columns: false, tiles: 'dungeon', tileCount: 3, torches: [200], cobwebs: true,
    doors: [{ id: 'out', x: 60, kind: 'hole', to: 'hall', toDoor: 'secret', name: 'Темница' }],
    props: [
      { type: 'chest', id: 's', x: 262, z: 3, coins: 15, item: 'potion' },
      { type: 'bones', x: 150, z: 8 }, { type: 'barrel', x: 290, z: 2 }, { type: 'sack', x: 120, z: 3 },
    ],
    decor: [
      { type: 'tally', x: 140, y: 40, n: 37 },
      { type: 'note', x: 170, y: 56, look: 'look_note', name: 'записка' },
      { type: 'chains', x: 230, y: 44 },
    ],
  },
  // верхняя галерея с окнами на горы; отсюда — все комнаты и башня. Фон кодом: на картинке владельца
  // (assets/backgrounds/gallery.png) двери некуда поставить — под окнами и в простенках нет места, по краям проломы
  gallery: {
    name: 'Галерея', tiles: 'castle', length: 1180, columns: false,
    torches: [125, 222, 325, 425, 520, 615, 710, 805, 905, 1010],
    decor: [
      ...[80, 272, 472, 660, 760, 960].flatMap(x => [
        { type: 'window', x, w: 34, h: 52, y: 14, moon: x === 472 },
        { type: 'ivy', x: x - 14, y: 0, len: 46, w: 10, n: 3 },
      ]),
      { type: 'ivy', x: 600, y: 0, len: 70, w: 16, n: 4 },
      { type: 'shield', x: 1048, y: 42 },
      { type: 'banner', x: 1086, y: 12, h: 46 }, { type: 'banner', x: 1142, y: 12, h: 46, torn: true },
      { type: 'portrait', x: 30, y: 40, who: 'king', look: 'look_king', name: 'портрет' },
    ],
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
    name: 'Лавка Лики', tiles: 'shop', length: 320, columns: false, torches: [110, 306],
    doors: [{ id: 'out', x: 64, kind: 'wood', to: 'gallery', toDoor: 'shop', name: 'Галерея' }],
    npcs: [{ type: 'lika', x: 214, z: 12 }],
    // место отдыха: сесть (E) — лечение и сохранение; «продолжить» начнётся отсюда
    decor: [
      { type: 'sign', x: 214, y: 12 },
      { type: 'shelf', x: 160, y: 50, w: 56 }, { type: 'shelf', x: 268, y: 50, w: 56, rows: [['bottle', 'scroll', 'potion', 'bottle', 'potion'], ['box', 'potion', 'book', 'bottle']] },
    ],
    props: [
      { type: 'rug', x: 166, z: 18, flat: true }, { type: 'stall', x: 262, z: 6 },
      { type: 'crate', x: 300, z: 2 }, { type: 'crate', x: 296, z: 12 }, { type: 'barrel', x: 236, z: 2 },
      { type: 'sofa', x: 122, z: 2, rest: { seat: 5, name: 'на диване', face: 1 } }, { type: 'sack', x: 312, z: 22 },
    ],
  },
  // испытать рапиру на копейщиках; в сундуке монеты для лавки
  armory: {
    name: 'Оружейная', tiles: 'castle', length: 480, columns: false, torches: [120, 360],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'gallery', toDoor: 'armory', name: 'Галерея' }],
    props: [{ type: 'chest', id: 'a', x: 446, z: 3, coins: 20 }, { type: 'barrel', x: 150, z: 2 }, { type: 'crate', x: 420, z: 14 }],
    decor: [
      { type: 'rack', x: 200, look: 'look_rack', name: 'стойка с оружием' },
      { type: 'rack', x: 290, items: [null, 'spear', null, null, 'sword'], look: 'look_rack_empty', name: 'полупустая стойка' },
      { type: 'shield', x: 420, y: 40 },
      { type: 'banner', x: 245, y: 8, h: 30, color: '#2a3a6a', dark: '#1a2448' },
    ],
    encounters: [
      { x: 290, enemies: [{ type: 'spear', dx: 50, z: 16 }, { type: 'spear', dx: 110, z: 32 }] },
    ],
  },
  // караульная: стол караула (кости, кружки), табуреты, стойка, доска с ключами — одного не хватает
  guardroom: {
    name: 'Караульная', tiles: 'castle', length: 320, columns: false, torches: [100, 250],
    props: [
      { type: 'guardtable', x: 210, z: 14 }, { type: 'stool', x: 186, z: 10 }, { type: 'stool', x: 236, z: 20 },
      { type: 'barrel', x: 296, z: 3 },
    ],
    decor: [
      { type: 'rack', x: 140, items: ['spear', 'sword', null, 'spear'] },
      { type: 'keys', x: 200, y: 44, look: 'look_keys', name: 'доска с ключами' },
      { type: 'banner', x: 290, y: 10, h: 36, torn: true },
    ],
    doors: [{ id: 'out', x: 50, kind: 'wood', to: 'gallery', toDoor: 'guard', name: 'Галерея' }],
    encounters: [
      { x: 200, enemies: [{ type: 'skelShort', dx: 30, z: 18 }, { type: 'axe', dx: 80, z: 32 }] },
    ],
  },
  // казарма мародёров (атаман — в логове на третьем этаже)
  barracks: {
    name: 'Казарма', tiles: 'castle', length: 480, columns: false, torches: [120, 360],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'gallery', toDoor: 'barracks', name: 'Галерея' }],
    props: [
      { type: 'chest', id: 'key', x: 446, z: 3, coins: 25 },
      { type: 'loot', id: 'mar_scarf', x: 236, z: 30, pick: 'mar_scarf' },
      { type: 'barrel', x: 150, z: 2 }, { type: 'crate', x: 175, z: 2 }, { type: 'barrel', x: 420, z: 16 },
    ],
    decor: [
      { type: 'bunk', x: 200, look: 'look_bunk', name: 'нары' }, { type: 'bunk', x: 260, blanket: '#5a3a2a' },
      { type: 'bunk', x: 410, blanket: '#3a4a3a' },
      { type: 'banner', x: 318, y: 10, h: 40, torn: true },
    ],
    encounters: [
      // атаман переехал в своё логово на третьем этаже (v0.84, владелец); здесь — его люди
      { x: 270, enemies: [{ type: 'merc', dx: 60, z: 22 }, { type: 'axe', dx: 110, z: 36 }] },
    ],
  },
  // лестница башни: наверх — покои принцессы, там призрак главы стражи
  // за Галереей: коридор с мародёрами → столовая (чаша, лестница на второй этаж) → обрушенный балкон (тупик, сотник стражи)
  corridor: {
    name: 'Коридор', tiles: 'castle', length: 900, torches: [120, 330, 540, 760],
    edges: { left: { to: 'gallery', x: 1150, name: 'Галерея' }, right: { to: 'dining', x: 30, name: 'Столовая' } },
    props: [{ type: 'crate', x: 200, z: 2 }, { type: 'sack', x: 214, z: 6 }, { type: 'barrel', x: 585, z: 3 }, { type: 'loot', id: 'mar_boots', x: 470, z: 30, pick: 'mar_boots' }],
    decor: [
      { type: 'banner', x: 60, y: 10 },
      { type: 'portrait', x: 232, y: 36, who: 'king', look: 'look_king', name: 'портрет' },
      { type: 'portrait', x: 446, y: 36, who: 'mage', scratched: true, look: 'look_mage', name: 'портрет' },
      { type: 'window', x: 700, w: 24, h: 40, y: 22, moon: true },
      { type: 'armor', x: 810, rust: true, look: 'look_armor', name: 'доспех' },
    ],
    encounters: [
      { x: 470, enemies: [{ type: 'merc', dx: 40, z: 16 }, { type: 'crossbow', dx: 170, z: 30 }] },
    ],
  },
  dining: {
    name: 'Столовая', tiles: 'castle', length: 480, columns: false, torches: [60, 420], stairs: 'up', stairsX: 40,
    edges: { left: { to: 'corridor', x: 870, name: 'Коридор' }, right: { to: 'balcony', x: 30, name: 'Балкон' } },
    doors: [
      // у подножия лестницы: наверх можно, когда осмотрел этаж до конца (балкон)
      { id: 'up', x: 60, kind: 'none', stairs: true, to: 'landing2', toDoor: 'down', name: 'Лестница на второй этаж', requires: 'balcony_done', locked: 'Сначала осмотри этаж до конца' },
    ],
    props: [
      { type: 'table', x: 300, z: 16 }, { type: 'chair', x: 252, z: 10 }, { type: 'chair', x: 348, z: 24, flip: true },
      { type: 'cup', id: 'cup', x: 318, z: 17, pick: 'silver_cup' },
      { type: 'letter', x: 280, z: 15, look: 'look_letter', name: 'письмо', unless: 'maid_asked' },
      { type: 'letter', id: 'maidletter', x: 280, z: 15, pick: 'old_letter', needs: 'maid_asked' },   // служанка просила — письмо можно взять
      { type: 'barrel', x: 452, z: 3 },
    ],
    decor: [
      { type: 'fireplace', x: 200, look: 'look_fire', name: 'камин', rest: { seat: 0, name: 'у камина', z: 10, dx: 36, face: -1 } },
      { type: 'tapestry', x: 200, y: 2, w: 56, h: 34, look: 'look_tapestry', name: 'гобелен' },   // большой — над камином, не касаясь трубы
      { type: 'chandelier', x: 300, y: 28 },
      { type: 'banner', x: 395, y: 10 },
    ],
  },
  // тупик: обрыв и вид на долину, деревню, поля и леса — туда рыцарь пойдёт во второй локации
  balcony: {
    name: 'Обрушенный балкон', tiles: 'castle', far: 'assets/backgrounds/balcony/far.png', length: 400, balcony: true, torches: [], limitRight: 318,  // дальше — обрыв; far — даль за перилами (v0.67)
    edges: { left: { to: 'dining', x: 450, name: 'Столовая' } },
    encounters: [
      { x: 240, story: 'commander', before: 'commander_meet', after: 'balcony_after', enemies: [{ type: 'commander', dx: 40, z: 22 }] },
    ],
    // обрывок дневника №1 (лор владельца): после победы над королевским стражем — там, где он стоял
    props: [{ type: 'letter', id: 'diary1', x: 282, z: 20, pick: 'diary_1', needs: 'done_commander' }],
    vibe: [{ id: 'balcony_view', x: 300, needs: 'done_commander', fx: 'birds', sun: { x: 311, y: 54 } }],   // sun — где закат на картине дали   // «вайбовать» (v0.81): постоять и посмотреть — место оживает (fx)
  },
  // ---------- второй этаж (черновик Claude: лор и комнаты владелец поправит) ----------
  // площадка у лестницы из Столовой; дальше — Жилое крыло
  landing2: {
    name: 'Лестничная площадка', tiles: 'castle', floor: 2, length: 400, columns: false, torches: [150, 330],   // пришёл снизу: дверь к лестнице вниз (v0.70)
    doors: [{ id: 'down', x: 60, kind: 'wood', stairs: true, to: 'dining', toDoor: 'up', name: 'Лестница вниз, в Столовую' }],
    edges: { right: { to: 'hall2', x: 30, name: 'Жилое крыло' } },
    decor: [
      { type: 'window', x: 240, w: 24, h: 40, y: 22, moon: true },
      { type: 'banner', x: 110, y: 10, h: 40, color: '#2a3a6a', dark: '#1a2448' },
    ],
    encounters: [
      { x: 280, enemies: [{ type: 'skelLong', dx: 60, z: 20 }] },
    ],
  },
  // длинный коридор покоев: портреты, окна, доспехи; двери в Библиотеку, Часовню и запертые покои
  hall2: {
    name: 'Жилое крыло', tiles: 'castle', floor: 2, length: 1500, torches: [150, 450, 640, 850, 1030, 1250, 1430],
    edges: { left: { to: 'landing2', x: 370, name: 'Лестничная площадка' }, right: { to: 'stairs3', x: 30, name: 'Лестница наверх' } },
    doors: [
      { id: 'camp', x: 300, kind: 'wood', to: 'camp', toDoor: 'out', name: 'Привал' },
      { id: 'library', x: 380, kind: 'wood', to: 'library', toDoor: 'out', name: 'Библиотека' },
      { id: 'chapel', x: 760, kind: 'wood', to: 'chapel', toDoor: 'out', name: 'Часовня' },
      // кто за дверью — решит владелец (босс этажа или ключ); пока — глухие удары изнутри
      { id: 'royal', x: 1140, kind: 'iron', name: 'Покои', locked: 'Заперто изнутри. За дверью что-то скребётся', rumble: true },
    ],
    decor: [
      { type: 'window', x: 260, w: 26, h: 44, y: 18 },
      { type: 'portrait', x: 520, y: 34, who: 'king', look: 'look_king', name: 'портрет' },
      { type: 'portrait', x: 560, y: 34, who: 'lady', look: 'look_lady', name: 'портрет' },
      { type: 'tapestry', x: 940, y: 12, w: 60, h: 36, torn: true },
      { type: 'armor', x: 690, look: 'look_armor', name: 'доспех' }, { type: 'armor', x: 830 },
      { type: 'window', x: 1330, w: 26, h: 44, y: 18, moon: true },
      { type: 'banner', x: 1100, y: 10 }, { type: 'banner', x: 1180, y: 10, torn: true },
    ],
    props: [{ type: 'bones', x: 600, z: 26 }, { type: 'crate', x: 1000, z: 3 }, { type: 'barrel', x: 1400, z: 2 }, { type: 'loot', id: 'mar_jacket', x: 1040, z: 32, pick: 'mar_jacket' }],
    encounters: [
      { x: 560, enemies: [{ type: 'merc', dx: 60, z: 18 }, { type: 'crossbow', dx: 190, z: 30 }] },
      { x: 960, enemies: [{ type: 'skelShield', dx: 60, z: 24 }, { type: 'spear', dx: 110, z: 12 }, { type: 'skelArcher', dx: 200, z: 34 }] },
    ],
  },
  // Привал (решение владельца): уютная комната с костром, где после поражения отдыхает Илиа. Первый вход — разговор
  // (он хватается за оружие: «Стой, я живой — не скелет и не мародёр»). Костёр — место отдыха. Название — черновик.
  camp: {
    name: 'Привал', tiles: 'castle', floor: 2, length: 400, columns: false, torches: [], dark: true, warm: true,
    enterTalk: { id: 'ilia_camp', needs: 'done_ilia' },
    doors: [{ id: 'out', x: 60, kind: 'wood', to: 'hall2', toDoor: 'camp', name: 'Жилое крыло' }],
    decor: [
      { type: 'window', x: 300, w: 22, h: 34, y: 22, moon: true },
      { type: 'banner', x: 150, y: 10, torn: true },
    ],
    props: [
      // костёр с треногой и котелком одной картинкой (v0.83, владелец: котелок не должен перекрывать огонь); рюкзак у лежанки
      { type: 'campfire_pot', x: 210, z: 20, light: true, look: 'look_campfire', name: 'костёр', rest: { seat: 0, name: 'у костра', z: 20, dx: -30, face: 1 } },
      { type: 'bedroll', x: 268, z: 34, look: 'look_bedroll', name: 'лежанка' }, { type: 'pack', x: 292, z: 33 }, { type: 'sack', x: 300, z: 6 }, { type: 'pot', x: 232, z: 8 },
    ],
    npcs: [{ type: 'ilia', x: 242, z: 22, needs: 'done_ilia' }],
    vibe: [{ id: 'camp_fire', x: 170, needs: 'done_ilia', fx: 'embers', fxX: 210, fxZ: 20, sit: { x: 178, z: 22, face: 1 } }],   // сесть напротив Илиа в той же позе (владелец)
  },
  // библиотека: стеллажи, стремянка, стол с раскрытой книгой; алебардист и лучник; сундук в глубине
  library: {
    name: 'Библиотека', tiles: 'castle', floor: 2, length: 640, columns: false, torches: [130, 470],
    doors: [
      { id: 'out', x: 60, kind: 'wood', to: 'hall2', toDoor: 'library', name: 'Жилое крыло' },
      { id: 'hidden', x: 540, kind: 'none', needs: 'secret_library', to: 'reading', toDoor: 'out', name: 'Тайная читальня' },
    ],
    decor: [
      { type: 'bookshelf', x: 200 }, { type: 'bookshelf', x: 250, gap: 2 }, { type: 'ladder', x: 268 },
      { type: 'bookshelf', x: 400, gap: 1 },
      // одна книга торчит: потянуть — стеллаж отходит, за ним тайная читальня
      { type: 'bookshelf', x: 540, look: 'look_shelf', name: 'стеллаж', secret: 'secret_library' },
      { type: 'shelfdoor', x: 540, secret: 'secret_library' },
      { type: 'bookshelf', x: 590, skull: true },
      { type: 'chandelier', x: 320, y: 26 },
    ],
    props: [
      { type: 'desk', x: 330, z: 12, look: 'look_book', name: 'раскрытая книга' },
      { type: 'chair', x: 352, z: 14, flip: true },
      { type: 'chest', id: 'l', x: 610, z: 3, coins: 15, item: 'bandage' },
    ],
    encounters: [
      { x: 380, enemies: [{ type: 'halberd', dx: 70, z: 20 }, { type: 'skelArcher', dx: 180, z: 8 }] },
    ],
  },
  // часовня: витраж (цветной свет на полу), скамьи, алтарь с пустой подставкой — для Серебряной чаши.
  // Чаша на алтаре — за алтарём отъезжает плита, проход в Ризницу
  chapel: {
    name: 'Часовня', tiles: 'castle', floor: 2, length: 480, columns: false, torches: [90, 430],
    vibe: [{ id: 'chapel_rain', x: 196, fx: 'rain', fxX: 214, fxZ: 22, fxTop: 20 }],
    doors: [
      { id: 'out', x: 50, kind: 'wood', to: 'hall2', toDoor: 'chapel', name: 'Жилое крыло' },
      { id: 'vestry', x: 400, kind: 'none', needs: 'cup_placed', to: 'vestry', toDoor: 'out', name: 'Ризница' },
    ],
    decor: [
      { type: 'stainedglass', x: 340, y: 10 },
      { type: 'roofhole', x: 214 },   // пролом в крыше над лужей (v0.81)
      { type: 'slab', x: 400, secret: 'cup_placed' },
      { type: 'banner', x: 160, y: 10, h: 40, color: '#e8e0d0', dark: '#a89a8a' },
    ],
    props: [
      { type: 'candles', x: 110, z: 4, look: 'look_candles', name: 'свечи' },
      // дождевая вода из пролома в крыше — для чаши священника (владелец, 15.10: «вода с неба, но в грязной чаше»)
      { type: 'puddle', x: 214, z: 22, flat: true, fill: 'cup_water', look: 'look_puddle', name: 'лужа под проломом в крыше' },
      { type: 'pew', x: 170, z: 14, rest: { seat: 4, name: 'на скамье', z: 15, face: 1 } }, { type: 'pew', x: 170, z: 30 }, { type: 'pew', x: 250, z: 14 }, { type: 'pew', x: 250, z: 30 },
      { type: 'altar', id: 'altar', x: 340, z: 4, altar: 'cup_placed' },
    ],
    encounters: [
      { x: 200, enemies: [{ type: 'skelShield', dx: 60, z: 20 }, { type: 'halberd', dx: 120, z: 30 }] },
    ],
  },
  // тайная читальня за стеллажом Библиотеки: стол, оплывшая свеча, сундук
  reading: {
    name: 'Тайная читальня', tiles: 'castle', floor: 2, length: 320, columns: false, torches: [], cobwebs: true,
    doors: [{ id: 'out', x: 60, kind: 'hole', to: 'library', toDoor: 'hidden', name: 'Библиотека' }],
    decor: [{ type: 'bookshelf', x: 150, gap: 3 }, { type: 'bookshelf', x: 196, gap: 0 }, { type: 'chandelier', x: 240, y: 30 }],
    props: [
      { type: 'desk', x: 240, z: 10, look: 'look_reading', name: 'стол' },
      { type: 'chest', id: 'r', x: 290, z: 3, coins: 25, item: 'scroll_cleave' },
    ],
  },
  vestry: {
    name: 'Ризница', tiles: 'castle', floor: 2, length: 320, columns: false, torches: [200], cobwebs: true,
    doors: [{ id: 'out', x: 60, kind: 'hole', to: 'chapel', toDoor: 'vestry', name: 'Часовня' }],
    props: [
      { type: 'chest', id: 'v', x: 250, z: 3, coins: 20, item: 'rosary' },
      { type: 'bones', x: 160, z: 10 }, { type: 'sack', x: 290, z: 3 },
    ],
    decor: [{ type: 'shelf', x: 150, y: 50, w: 50, rows: [['bottle', 'scroll', 'bottle', 'book'], ['box', 'bottle', 'scroll']] }],
  },
  // ---------- третий этаж (по плану владельца: ключ от башни, выше — завал, пролом в полу — вниз к башне) ----------
  landing3: {
    name: 'Верхний этаж', tiles: 'castle', floor: 3, length: 360, columns: false, torches: [150, 300], cobwebs: true,
    doors: [{ id: 'down', x: 60, kind: 'wood', stairs: true, to: 'stairs3', toDoor: 'up3', name: 'Лестница вниз' }],
    edges: { right: { to: 'hall3', x: 30, name: 'Северное крыло' } },
    decor: [{ type: 'window', x: 230, w: 24, h: 40, y: 22 }],
    encounters: [{ x: 230, enemies: [{ type: 'halberd', dx: 60, z: 18 }, { type: 'skelArcher', dx: 110, z: 34 }] }],
  },
  // выбитые окна, дырявый потолок; пролом в полу — спрыгнуть к двери башни; в конце лестница наверх завалена
  hall3: {
    name: 'Северное крыло', tiles: 'castle', floor: 3, length: 1300, torches: [150, 360, 560, 980, 1160],
    stairs: 'up', stairsX: 1190,
    vibe: [{ id: 'hall3_moon', x: 660, fx: 'moon' }],   // лунное окно
    edges: { left: { to: 'landing3', x: 330, name: 'Верхний этаж' } },
    doors: [
      { id: 'guardhall', x: 420, kind: 'wood', to: 'guardhall', toDoor: 'out', name: 'Зал стражи' },
      { id: 'wardrobe', x: 205, kind: 'wood', to: 'wardrobe', toDoor: 'out', name: 'Гардеробная' },
      { id: 'lair', x: 930, kind: 'wood', to: 'lair', toDoor: 'out', name: 'Логово атамана' },
      { id: 'pit', x: 780, kind: 'none', to: 'gallery', toDoor: 'tower', oneWay: true, fall: true, name: 'спрыгнуть в пролом (вниз, к башне)' },
      { id: 'rubble', x: 1240, kind: 'none', name: 'Лестница наверх', locked: 'Лестница наверх завалена — не пройти' },
    ],
    decor: [
      { type: 'window', x: 260, w: 26, h: 44, y: 18 }, { type: 'window', x: 660, w: 26, h: 44, y: 18, moon: true },
      { type: 'pit', x: 780 }, { type: 'rubble', x: 1268 },
      { type: 'banner', x: 520, y: 10, torn: true }, { type: 'banner', x: 900, y: 10, torn: true },
      { type: 'ivy', x: 640, y: 0, len: 60, w: 14, n: 3 },
    ],
    props: [{ type: 'bones', x: 330, z: 24 }, { type: 'crate', x: 1080, z: 2 }, { type: 'sack', x: 1094, z: 6 }, { type: 'lute', x: 640, z: 32, look: 'look_lute', name: 'сломанная лютня' }],
    encounters: [
      { x: 600, enemies: [{ type: 'spear', dx: 50, z: 16 }, { type: 'merc', dx: 90, z: 30 }, { type: 'crossbow', dx: 180, z: 8 }] },
      { x: 1000, enemies: [{ type: 'skelLong', dx: 60, z: 22 }, { type: 'ghost', dx: 110, z: 34 }] },
    ],
  },
  // логово атамана мародёров (v0.84, владелец: «атамана — на третий этаж, кучу бойцов разного класса, тяжёлый бой,
  // награда того стоит»): сначала дозор (копьё и арбалет), потом атаман со свитой — топор, меч, арбалет. Награда — кинжал.
  lair: {
    name: 'Логово атамана', tiles: 'castle', floor: 3, length: 560, columns: false, torches: [120, 300, 470],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'hall3', toDoor: 'lair', name: 'Северное крыло' }],
    props: [
      { type: 'chest', id: 'lair', x: 520, z: 3, coins: 40 },
      { type: 'weapon', id: 'dagger', x: 470, z: 14, pick: 'dagger', needs: 'done_ataman' },   // кинжал атамана — после победы
      { type: 'barrel', x: 150, z: 2 }, { type: 'crate', x: 175, z: 2 }, { type: 'sack', x: 188, z: 6 }, { type: 'barrel', x: 500, z: 18 },
      { type: 'bones', x: 330, z: 30 }, { type: 'table', x: 400, z: 4 },
    ],
    decor: [
      { type: 'bunk', x: 220, look: 'look_bunk', name: 'нары' }, { type: 'bunk', x: 280, blanket: '#5a3a2a' },
      { type: 'banner', x: 360, y: 10, h: 40, torn: true }, { type: 'rack', x: 440, items: ['spear', null, 'axe'] },
    ],
    encounters: [
      { x: 180, enemies: [{ type: 'spear', dx: 60, z: 14 }, { type: 'crossbow', dx: 140, z: 34 }] },
      { x: 330, story: 'ataman', before: 'captain_meet', enemies: [
        { type: 'captain', dx: 70, z: 22 }, { type: 'axe', dx: 40, z: 36 }, { type: 'merc', dx: 100, z: 8 }, { type: 'crossbow', dx: 170, z: 30 },
      ] },
    ],
  },
  // гардеробная принцесс (v0.78): здесь Алкима ищет ткани (лор владельца); выцветшие платья, манекены, рулоны ткани
  wardrobe: {
    name: 'Гардеробная', tiles: 'castle', floor: 3, length: 360, columns: false, torches: [130, 290], cobwebs: true,
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'hall3', toDoor: 'wardrobe', name: 'Северное крыло' }],
    enterTalk: { id: 'alkima_meet', needs: 'trainer_gone' },
    npcs: [{ type: 'alkima', x: 236, z: 16 }],
    decor: [
      { type: 'wardrobe', x: 110 }, { type: 'mannequin', x: 176 }, { type: 'mannequin', x: 318 },
      { type: 'window', x: 260, w: 24, h: 40, y: 22, moon: true }, { type: 'tapestry', x: 200, y: 16 },
    ],
    props: [{ type: 'fabric', x: 280, z: 4 }, { type: 'chest', id: 'w', x: 330, z: 3, coins: 15 }, { type: 'rug', x: 220, z: 12 }],
  },
  // зал стражи: тяжёлый бой, за ним — сундук с ключом от башни (решение владельца: ключ — на третьем этаже)
  guardhall: {
    name: 'Зал стражи', tiles: 'castle', floor: 3, length: 480, columns: false, torches: [120, 360],
    doors: [{ id: 'out', x: 56, kind: 'wood', to: 'hall3', toDoor: 'guardhall', name: 'Северное крыло' }],
    decor: [
      { type: 'shield', x: 180, y: 40 }, { type: 'shield', x: 300, y: 40 },
      { type: 'armor', x: 240 }, { type: 'banner', x: 140, y: 10 }, { type: 'banner', x: 340, y: 10 },
      { type: 'rack', x: 420, items: ['spear', 'sword', 'spear'] },
    ],
    props: [{ type: 'chest', id: 'key', x: 446, z: 3, coins: 20, item: 'key_tower' }, { type: 'armchair', x: 120, z: 2, rest: { seat: 5, name: 'в кресле начальника стражи', face: 1 } }, { type: 'logbook', x: 170, z: 4, look: 'look_logbook', name: 'журнал дежурств' }],
    encounters: [
      { x: 260, story: 'keyguard', before: 'keyguard_meet', noRise: true, enemies: [{ type: 'skelLong', dx: 60, z: 20 }, { type: 'halberd', dx: 100, z: 34 }, { type: 'commander', dx: 170, z: 8 }] },   // одна стража, без мародёров (владелец)
    ],
  },
  // лестница на третий этаж — со второго этажа
  stairs3: {
    name: 'Лестница на третий этаж', tiles: 'castle', floor: 2, length: 320, columns: false, torches: [90], stairs: 'up', stairsX: 200, cobwebs: true,
    edges: { left: { to: 'hall2', x: 1470, name: 'Жилое крыло' } },
    doors: [
      { id: 'up3', x: 220, kind: 'none', stairs: true, to: 'landing3', toDoor: 'down', name: 'Лестница на третий этаж' },
    ],
    props: [{ type: 'bones', x: 120, z: 20 }, { type: 'crate', x: 60, z: 3 }],
  },
  tower: {
    name: 'Лестница башни', tiles: 'castle', length: 320, columns: false, torches: [100, 230], stairs: 'up', stairsX: 188, cobwebs: true,
    // перед финалом: знаки на стенах тлеют, из-под двери наверх пробивается лиловый свет
    decor: [
      { type: 'sigil', x: 150, y: 44 },
      { type: 'doorglow', x: 268, y: 75 },   // свет из-под двери на площадке лестницы { type: 'chains', x: 110, y: 44 },
    ],
    // последний отдых перед боссом — сохраниться у двери покоев
    npcs: [{ type: 'maid', x: 168, z: 12, ifNot: 'maid_done' }],
    props: [{ type: 'bench', x: 118, z: 2, rest: { seat: 4, name: 'на каменной скамье', face: 1 } }, { type: 'bouquet', x: 160, z: 4, look: 'look_bouquet', name: 'засохший букет' }],   // не на ступенях
    doors: [
      { id: 'out', x: 52, kind: 'iron', to: 'gallery', toDoor: 'tower', name: 'Галерея' },
      // за дверью — покои принцессы и призрак главы королевской стражи (финальный босс главы 1, решение владельца v0.57; маг — позже)
      { id: 'up', x: 194, kind: 'none', stairs: true, climb: true, to: 'mage', toDoor: 'in', name: 'Покои принцессы' },   // по ступеням к двери наверху
    ],
  },
  // покои принцессы — арена босса главы 1 (призрак главы стражи, v0.65); победа — конец главы
  mage: {
    name: 'Покои принцессы', tiles: 'castle', length: 480, columns: false, torches: [100, 240, 380], magic: true,
    decor: [
      { type: 'window', x: 200, y: 18, moon: true }, { type: 'window', x: 330, y: 18 },
      { type: 'portrait', x: 265, y: 30, who: 'princess', look: 'look_princess', name: 'портрет принцессы' }, { type: 'tapestry', x: 410, y: 16 },
    ],
    doors: [{ id: 'in', x: 56, kind: 'wood', to: 'tower', toDoor: 'up', name: 'Лестница башни' }],
    encounters: [
      { x: 230, story: 'boss', before: 'boss_intro', after: 'boss_end', noRise: true,
        finish: { finishTitle: 'Конец главы 1 (черновик)', finishText: 'Призрак главы стражи упокоен. Выбор «упокоить или уничтожить» и дальнейший путь — в следующей главе.' },
        enemies: [{ type: 'boss', dx: 120, z: 20 }] },
    ],
  },
};
