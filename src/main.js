import { CONFIG, ROOMS, START, MAP, NPC_TYPES, ITEMS, SLOTS, START_EQUIP, COINS, VERSION, STRIKES, WEAPON, WEAPONS } from './config.js';
import { PAL, KNIGHT_COLORS } from './palette.js';
import { createInput } from './input.js';
import { createEnemy } from './enemy.js';
import { Player } from './player.js';
import { resolveImpact } from './combat.js';
import { drawFigure, drawFigureOutlined, drawFigureFrontOutlined, drawSlimeOutlined, drawFigureFront, drawLikaPortrait, drawSlime, drawArrow, drawPickup, flashColors, rect } from './draw.js';
import { POSES, approachPose, ease, gaitCycle, gaitFoot } from './poses.js';
import { buildRoom, buildImageRoom, drawTorches, drawFlames, drawPortal, drawProp, drawCobweb, drawDarkness, drawGatePanel, drawDoorOpen, DOOR_W } from './background.js';
import { Tutorial } from './tutorial.js';
import { drawDecorLive, drawCracks, drawSlab, drawStainedGlass, drawShelfDoor, DECOR_LIVE } from './decor.js';
import { drawTitle } from './title.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { unlockAudio, sfx, setWind, drip, crackle, ambientOn, setAmbient } from './audio.js';
import { DialogueRunner } from './dialogue.js';
import { DIALOGUES, SPEAKERS, SHOPS, ITEM_TEXTS } from './story/dialogues.js';
import { BESTIARY } from './story/bestiary.js';
import { ENEMY_TYPES } from './config.js';

const W = CONFIG.width, H = CONFIG.height;
const STEP = 1 / 60;
const ARROW_G = 300;

// Вариант A: WASD / стрелки — ходьба по полу с глубиной, защита — на мыши.
const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  depthIn: ['ArrowUp', 'KeyW'],     // к стене
  depthOut: ['ArrowDown', 'KeyS'],  // к краю экрана
  attack: ['Mouse0', 'KeyJ'],
  guard: ['Mouse2'],                 // держать — защита на высоте курсора
  dash: ['Space', 'KeyK', 'ShiftLeft'],
};
// где на экране земля под бойцом на глубине z, и высота удара над ней
const groundY = z => CONFIG.floorTop + 6 + z;
const HIT_UP = { high: 34, mid: 22, low: 9 };
const clashY = (h, z) => groundY(z) - HIT_UP[h];
const near = (a, b) => Math.abs(a.z - b.z) <= CONFIG.depthReach;
const ATTACKING = new Set(['windup', 'strike', 'reel', 'leapIn', 'vault', 'crouch', 'leap', 'retreat', 'inflate', 'suck']);
const HEIGHT_NAME = { high: 'верх', mid: 'середина', low: 'низ' };
const RESULT_NAME = { perfect: 'идеально', block: 'блок', broken: 'защита сбита', hit: 'попадание', dodged: 'уклон', warded: 'заслон', miss: 'мимо' };
const SPECIAL = new Set(['rollCut', 'dashCut', 'leap', 'spin', 'figure8', 'vaultFlick']);
// Управление (решение владельца после бета-теста): курсор выбирает высоту, ЛКМ — удар, держать ПКМ — защита, пробел — рывок.
const HINT_WALK = 'WASD — ходить · курсор выше / ниже рыцаря — высота · ЛКМ удар · ПКМ защита · пробел рывок';
const HINT_FIGHT = 'курсор — высота ▲ ━ ▼ · ЛКМ удар · держать ПКМ — защита · пробел рывок';
// подсказки управления — только поначалу: дальше они мешают, а управление есть в меню (Esc → Управление)
const hintFight = () => game.cleared?.size >= 3 ? '' : HINT_FIGHT;
const hintWalk = () => game.visited?.includes('gallery') || game.flags?.done_ilia || game.cleared?.size >= 3 ? '' : HINT_WALK;

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const rollCanvas = document.createElement('canvas');
rollCanvas.width = rollCanvas.height = 48;
const rollCtx = rollCanvas.getContext('2d');

const $ = id => document.getElementById(id);
const ui = {
  box: $('game-box'), hearts: $('hearts'), foe: $('foe'), foeName: $('foe-name'), foeBar: $('foe-bar'),
  callout: $('callout'), hint: $('hint'), debug: $('debug'), overlay: $('overlay'), version: $('version'),
  overlayTitle: $('overlay-title'), overlayText: $('overlay-text'), overlayPress: $('overlay-press'),
  talk: $('talk'), talkPortrait: $('talk-portrait'), talkFace: $('talk-face'), talkName: $('talk-name'), talkText: $('talk-text'),
  talkChoices: $('talk-choices'), talkNext: $('talk-next'),
  reportBtn: $('report-btn'), reportText: $('report-text'), overlayMenu: $('overlay-menu'),
  journal: $('journal'), journalList: $('journal-list'), journalPage: $('journal-page'), journalFig: $('journal-fig'),
  journalName: $('journal-name'), journalHow: $('journal-how'), journalWin: $('journal-win'), journalLore: $('journal-lore'), journalKills: $('journal-kills'),
  equip: $('equip'), equipSlots: $('equip-slots'), equipBag: $('equip-bag'), equipDesc: $('equip-desc'), equipCoins: $('equip-coins'),
  skillWard: $('skill-ward'), skillWardBar: $('skill-ward-bar'), skillG: $('skill-g'), skillGBar: $('skill-g-bar'),
  shop: $('shop'), shopPortrait: $('shop-portrait'), shopFace: $('shop-face'), shopName: $('shop-name'), shopCoins: $('shop-coins'),
  shopText: $('shop-text'), shopMenu: $('shop-menu'),
  skillSpin: $('skill-spin'), skillSpinBar: $('skill-spin-bar'), skillName: $('skill-name'), weapon: $('weapon'),
};
ui.reportBtn.addEventListener('pointerdown', e => e.stopPropagation());
ui.reportBtn.addEventListener('click', copyReport);
ui.reportText.addEventListener('pointerdown', e => e.stopPropagation());
ui.version.textContent = VERSION;

const input = createInput(window);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// фон каждой комнаты рисуется один раз, при первом входе
const backgrounds = {};
const bgImages = {};
const imageRooms = {};
for (const [id, r] of Object.entries(ROOMS)) if (r.image) (bgImages[id] = new Image()).src = r.image;  // загрузить заранее
// фон-картинка, если есть и загрузилась; иначе — нарисованный кодом
function bgFor(id) {
  const img = bgImages[id];
  if (img?.complete && img.naturalWidth) return (imageRooms[id] ??= buildImageRoom(ROOMS[id], img, H, CONFIG.floorTop));
  return (backgrounds[id] ??= buildRoom(ROOMS[id], H, CONFIG.floorTop));
}
const room = () => ROOMS[game.room];
const encKey = (roomId, i) => `${roomId}:${i}`;
const ALL_ENCOUNTERS = Object.entries(ROOMS).flatMap(([id, r]) => (r.encounters ?? []).map((enc, i) => ({ key: encKey(id, i), enc })));
const held = group => KEYS[group].some(input.isDown);
const is = (code, group) => KEYS[group].includes(code);

const game = {};

function spawnGroup(roomId, i) {
  const enc = ROOMS[roomId].encounters[i];
  return enc.enemies.map(d => Object.assign(createEnemy(d.type, enc.x + d.dx, Math.random, d.z), { group: i }));
}
// враги комнаты: непройденные встречи и наставница, если обучение ещё впереди
function spawnRoom(roomId) {
  const r = ROOMS[roomId];
  const list = (r.encounters ?? []).flatMap((_, i) => game.cleared.has(encKey(roomId, i)) ? [] : spawnGroup(roomId, i));
  if (r.trainer && !game.flags.trainer_gone) list.unshift(createEnemy('trainer', r.trainer.x, Math.random, r.trainer.z));
  return list;
}

// Перейти в комнату: враги, персонажи, камера. at — { x, z, facing } прибытия.
// Обычные встречи (не боссы и не встречи с диалогом) возвращаются, если долго не заходил: монеты не кончаются.
const BOSSES = new Set(['duelist', 'captain', 'commander', 'mage']);
// сюжетные бои (story — имя) не возвращаются никогда: победа помнится флагом done_<имя>, а не номером встречи
function respawnable(enc) {
  return !enc.story && !enc.before && !enc.unique && !enc.enemies.some(e => BOSSES.has(e.type));
}

function loadRoom(id, at) {
  game.coinFx = [];
  game.flags['map_' + id] = true;  // для карты: где побывал
  (ROOMS[id].encounters ?? []).forEach((enc, i) => {
    const key = encKey(id, i);
    if (enc.story && game.flags['done_' + enc.story]) game.cleared.add(key);
    if (game.cleared.has(key) && respawnable(enc) && game.time - (game.clearedAt[key] ?? 0) >= CONFIG.respawnTime) game.cleared.delete(key);
  });
  game.room = id;
  game.visited.push(id);
  const r = ROOMS[id];
  game.enemies = spawnRoom(id);
  game.npcs = (r.npcs ?? []).map(n => ({ ...n, npc: true, def: NPC_TYPES[n.type], facing: -1 }));
  game.arena = null;
  game.current = null;
  game.token = null;
  game.arrows = [];
  game.waves = [];
  ui.foe.hidden = true;
  const p = game.player;
  p.x = at.x;
  p.z = at.z ?? p.z;
  if (at.facing) p.facing = at.facing;
  game.checkpoint = p.x;
  game.camX = Math.max(0, Math.min(r.length - W, p.x - W / 2));
  game.motes = r.dark ? Array.from({ length: 28 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 2 + Math.random() * 5, s: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * 6 })) : [];
}

function newGame() {
  Object.assign(game, {
    mode: 'title',
    time: 0,
    hitstop: 0,
    shake: 0,
    flash: 0,
    flashColor: '#fff',
    camX: 0,
    particles: [],
    arrows: [],
    waves: [],
    enemies: [],
    npcs: [],
    room: START.room,
    arena: null,
    cleared: new Set(),
    clearedAt: {},
    token: null,
    tokenFreeAt: 0,
    current: null,
    checkpoint: START.x,
    player: new Player(START.x),
    unlocked: game.unlocked ?? new Set(['sword']),  // открытое оружие сохраняется между забегами
    pickups: [],
    blockStreak: 0,
    charge: null,
    lastHolder: null,
    lastPress: null,
    prevPress: null,
    lastTiming: '',
    aim: 'mid',
    mouseY: game.mouseY ?? null,
    flags: {},
    talk: null,
    afterTalk: null,
    tutorial: null,
    cutscene: null,
    rest: null,
    fallY: 0,
    transition: null,
    view: 'side',
    viewPrev: 'side',
    viewT: 1,
    doorNear: null,
    doorPush: 0,
    lockedSaidAt: -9,
    motes: [],
    visited: [],
    coins: 0,
    coinsShown: 0,
    coinFx: [],
    bag: [],
    equip: { ...START_EQUIP },
    bestiary: {},
    wardReadyAt: 0,
    wardFlash: 0,
    skillReadyAt: 0,
    shop: null,
    impactFrom: null,
    stats: { perfect: 0, block: 0, hit: 0, counter: 0, dodged: 0, broken: 0, weave: 0, riposte: 0, vault: 0, vaultHit: 0, ward: 0, potions: 0, coinsEarned: 0, skill: 0, spell: 0 },
    deaths: {},
    killers: {},
    missWhy: {},
    missHeight: {},
    lastHitBy: '',
    startedAt: performance.now(),
    debug: game.debug || false,
  });
  game.player.z = START.z;
  loadRoom(START.room, START);
  renderHearts();
  ui.foe.hidden = true;
}

// Сохранение: комната и место, пройденные встречи, оружие, флаги сюжета, лежащее оружие.
function save() {
  const p = game.player;
  writeSave({
    version: VERSION, room: game.room, x: Math.round(game.checkpoint), z: Math.round(p.z), hp: p.hp, weapon: p.weapon,
    coins: game.coins, bag: game.bag, equip: game.equip, bestiary: game.bestiary, unlocked: [...game.unlocked], cleared: [...game.cleared], flags: game.flags, pickups: game.pickups,
  });
}

function continueGame(data) {
  newGame();
  game.unlocked = new Set(data.unlocked ?? ['sword']);
  game.cleared = new Set(data.cleared ?? []);
  for (const k of game.cleared) game.clearedAt[k] = 0;  // после загрузки обычные враги вернутся через respawnTime
  game.flags = data.flags ?? {};
  game.pickups = data.pickups ?? [];
  game.coins = data.coins ?? 0;
  game.bag = data.bag ?? [];
  game.bestiary = data.bestiary ?? {};
  game.equip = { ...START_EQUIP, ...(data.equip ?? {}) };
  // старые сохранения: рапира была только в unlocked
  if (game.unlocked.has('rapier') && game.equip.weapon !== 'rapier' && !game.bag.includes('rapier')) game.bag.push('rapier');
  if (!data.equip && data.weapon === 'rapier') { game.bag = game.bag.filter(i => i !== 'rapier'); game.bag.push('sword_old'); game.equip.weapon = 'rapier'; }
  // старые сохранения: бои помнились по номеру встречи — рапира у рыцаря значит, что Илиа уже побеждён
  if (game.unlocked.has('rapier') || game.bag.includes('rapier') || game.equip.weapon === 'rapier') game.flags.done_ilia = true;
  if (game.flags.balcony_done) game.flags.done_commander = true;
  game.player = new Player(data.x, ITEMS[game.equip.weapon].weapon);
  game.player.sheathed = false;
  game.player.hp = Math.max(1, Math.min(CONFIG.playerHp, data.hp ?? CONFIG.playerHp));
  const rest = game.flags.restAt;
  if (rest && ROOMS[rest.room]) loadRoom(rest.room, { x: rest.x, z: rest.z ?? 8 });  // как скамейки: с места отдыха
  else loadRoom(ROOMS[data.room] ? data.room : START.room, { x: data.x, z: data.z ?? 22 });
  renderHearts();
}

// ---------- мир для врагов ----------

const world = {
  get player() { return game.player; },
  engage() {},
  // сколько места у врага в сторону dir до края арены
  roomBehind(e, dir) {
    if (!game.arena) return 999;
    const [lo, hi] = arenaBounds();
    return dir > 0 ? hi - e.x : e.x - lo;
  },
  dropWeapon(e, kind) {
    callout('Рапира выбита!', 'counter');
    if (owns(kind) || game.pickups.some(it => it.kind === kind)) return;  // рапира уже есть — второй не будет
  },
  // бьёт один враг, остальные ждут своей очереди
  requestToken(e) {
    if (e.def.practice) return !game.arena;  // чучело не занимает очередь и молчит во время боя
    const t = game.token;
    if (t && t.e === e) return true;
    if (t && t.e.alive) return false;
    if (game.time < game.tokenFreeAt) return false;
    // кто только что бил, пропускает других вперёд
    if (e === game.lastHolder && game.time < game.tokenFreeAt + CONFIG.tokenRepeat && game.enemies.some(o => o !== e && o.alive && o.group === e.group && o.state !== 'dormant')) return false;
    game.token = { e, since: game.time, attacked: false };
    return true;
  },
  impact(e, type) {
    const p = game.player;
    const s = STRIKES[type] ?? STRIKES.mid;
    if (Math.abs(p.x - e.x) > e.def.reach + 2 || !near(p, e)) {
      game.lastTiming = `${HEIGHT_NAME[s.guard]}: мимо — рыцарь вне досягаемости`;
      callout('Мимо', 'muted');
      sfx.swish();
      return 'miss';
    }
    // в спину бьют, если рыцарь не успел развернуться к врагу
    const backTurned = Math.sign(e.x - p.x) !== p.facing && Math.abs(e.x - p.x) > 2;
    game.impactFrom = e;
    const result = applyImpact(s.guard, e.def.damage * (s.mult ?? 1), e.x, s.breaks, s.bypass, backTurned, e.def.name);
    game.impactFrom = null;
    return result;
  },
  heavySwing(e) {
    game.waves.push({ x: e.x, z: e.z, dir: e.facing, t: 0 });
    sfx.heavy();
    shake(2);
  },
  defeated(e) {
    callout(`${e.def.shortName ?? e.def.name} отступил`, 'counter');
    game.stats.counter++;
  },
  spawnArrow(e, height) {
    sfx.bow();
    const x = e.x + e.facing * 8;
    if (height === 'arc') {
      // навесная: летит дугой и падает туда, где рыцарь стоял в момент выстрела
      const pz = game.player.z;
      const T = e.def.arcTime, y0 = groundY(e.z) - 32, y1 = clashY('high', pz);
      const vx = (game.player.x - x) / T;
      const vy = (y1 - y0 - 0.5 * ARROW_G * T * T) / T;
      game.arrows.push({ who: e.def.name, x, y: y0, z: e.z, vz: (pz - e.z) / T, vx, vy, arc: true, height: 'high', damage: e.def.damage, resolved: false, falling: false, life: 4 });
      return;
    }
    // целится и по глубине: туда, где рыцарь стоит в момент выстрела, — попадание совпадает с тем, что видно
    const T = Math.max(0.12, Math.abs(game.player.x - x) / e.def.arrowSpeed);
    const vz = (game.player.z - e.z) / T;
    game.arrows.push({ who: e.def.name, x, y: clashY(height, e.z), z: e.z, vz, vx: e.facing * e.def.arrowSpeed, vy: 0, height, damage: e.def.damage, resolved: false, falling: false, life: 3, bolt: !!e.def.crossbow });
  },
  swallow(slime) {
    const p = game.player;
    if (p.defense().dodge) {
      callout('Уклон', 'muted');
      return false;
    }
    const dmg = Math.ceil(CONFIG.playerHp / 2);
    p.hp = Math.max(0, p.hp - dmg);
    p.swallowedBy(slime);
    renderHearts();
    sfx.gulp();
    shake(3);
    flash('#7bd88f', 0.35);
    callout(`Проглотил! −${dmg}`, 'hit');
    game.lastHitBy = slime.def.name;
    game.stats.hit++;
    return true;
  },
  cue(height, strike) {
    if (strike?.whip) sfx.whip();
    else if (CONFIG.audioCues) sfx.cue(height);
  },
  staggered() {
    sfx.stagger();
    callout('Враг открыт!', 'counter');
  },
};

// Удар врага или стрела дошли до рыцаря.
function applyImpact(height, damage, sourceX, breaks = false, bypass = false, backTurned = false, who = '') {
  const p = game.player;
  const { result, mult } = resolveImpact(
    { height, time: game.time, defense: { ...p.defense(), backTurned }, lastPress: game.lastPress, prevPress: game.prevPress, breaks, bypass },
    CONFIG,
  );
  const lp = game.lastPress;
  game.lastTiming = lp
    ? `${HEIGHT_NAME[height]}: нажал ${HEIGHT_NAME[lp.height]} за ${Math.round((game.time - lp.time) * 1000)} мс до удара → ${RESULT_NAME[result]}`
    : `${HEIGHT_NAME[height]}: защиту не нажимал → ${RESULT_NAME[result]}`;
  const x = (p.x + sourceX) / 2;
  const y = clashY(height, p.z);

  if (result === 'perfect') {
    game.stats.perfect++;
    sparks(x, y, 16, [PAL.spark, PAL.sparkHot, '#ffffff'], 120);
    sfx.perfect();
    game.hitstop = CONFIG.hitstop.perfect;
    shake(1.5);
    flash('#fff4c2', 0.35);
    callout('Идеально', 'perfect');
    const ph = ITEMS[game.equip.amulet]?.parryHeal;
    if (ph && game.time >= (game.parryHealAt ?? 0) && p.hp < CONFIG.playerHp) {
      // Чётки монаха: идеальное парирование лечит
      game.parryHealAt = game.time + ph.cooldown;
      p.hp = Math.min(CONFIG.playerHp, p.hp + ph.heal);
      renderHearts();
      sparks(p.x, groundY(p.z) - 22, 6, ['#8fd3ff', '#ffffff'], 50);
      setTimeout(() => callout(`Чётки  +${ph.heal}`, 'perfect'), 350);
    }
  } else if (result === 'block') {
    game.stats.block++;
    sparks(x, y, 6, [PAL.sparkHot, PAL.flame2], 70);
    sfx.block();
    shake(1);
    const weave = p.defense().weave;
    if (weave) game.stats.weave++;
    callout(weave ? 'Отбито восьмёркой' : 'Блок', 'block');
  } else if (result === 'broken') {
    game.stats.broken++;
    p.breakGuard(sourceX);
    sparks(x, y, 12, [PAL.flame2, PAL.sparkHot, '#ffffff'], 110);
    sfx.block();
    sfx.heavy();
    shake(2.5);
    callout('Защита сбита!', 'hit');
  } else if (result === 'warded') {
    p.ward.used = true;
    game.stats.block++;
    sparks(p.x + p.facing * 10, y, 12, ['#8fd3ff', '#ffffff'], 100);
    sfx.ward();
    callout('Заслон', 'perfect');
  } else if (result === 'dodged') {
    game.stats.dodged++;
    callout('Уклон', 'muted');
  } else if (damage === 0) {
    // тренировка: без урона
    callout('Пропущен · тренировка', 'muted');
    sfx.block();
  } else {
    game.stats.hit++;
    game.lastHitBy = who;
    // почему пропущен — для отчёта тестера
    const d = p.defense();
    const why = backTurned ? 'удар в спину' : d.attacking ? 'бил сам' : d.vulnerable ? 'отскок рано' : d.broken ? 'защита была сбита'
      : bypass && d.guard === height ? 'захлёст обошёл блок' : !d.guard ? 'защита не стояла' : 'не та высота';
    game.missWhy[why] = (game.missWhy[why] ?? 0) + 1;
    game.missHeight[height] = (game.missHeight[height] ?? 0) + 1;
    const dmg = damage * mult;
    const ward = ITEMS[game.equip.amulet]?.ward;
    if (ward && game.time >= game.wardReadyAt && dmg <= ward.absorb) {
      // Бубновый туз: удар засчитан, но здоровье не уходит; потом перезарядка
      game.wardReadyAt = game.time + ward.cooldown;
      game.wardFlash = 0.8;
      game.wardSide = Math.sign(sourceX - p.x) || p.facing;  // щит встаёт со стороны удара
      game.wardHeight = height;
      game.stats.ward++;
      sparks(p.x, y, 14, ['#e8454f', '#ffffff', '#ffb3b8'], 110);
      sfx.ward();
      shake(1.5);
      callout(`♦ Бубновый туз  −0`, 'perfect');
    } else {
      p.hurt(dmg, sourceX);
      renderHearts();
      sparks(p.x + 2, y, 10, [PAL.blood, '#9e2648'], 80);
      sfx.hit();
      game.hitstop = CONFIG.hitstop.hit;
      shake(mult > 1 ? 4 : 3);
      flash('#e8454f', 0.3);
      callout(backTurned ? `В спину! −${dmg}` : mult > 1 ? `Пропущен ×${mult}  −${dmg}` : `Пропущен  −${dmg}`, 'hit');
    }
  }
  // рапира: два успешных блока подряд — автоматический рипост
  if (result === 'block' || result === 'perfect') {
    if (p.weapon === 'rapier') {
      game.blockStreak++;
      if (game.blockStreak >= WEAPONS.rapier.riposteAfter && p.ready) {
        game.blockStreak = 0;
        p.startAttack('riposte');
        game.stats.riposte++;
        callout('Рипост!', 'counter');
      }
    }
  } else if (result === 'hit' || result === 'broken') game.blockStreak = 0;
  if (game.impactFrom?.kind === 'trainer') tutorialEvent({ type: 'impact', result });
  return result;
}

// Клинок рыцаря дошёл до цели.
function playerStrike(atk) {
  const p = game.player;
  let touched = false;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = (e.x - p.x) * p.facing;
    const inReach = atk.height === 'any' && !atk.front ? Math.abs(dx) <= atk.reach : dx >= -6 && dx <= atk.reach;
    if (!inReach || !near(p, e)) continue;
    touched = true;
    const { out, dmg } = e.receiveAttack(atk);
    if (e.kind === 'trainer' && (out === 'hit' || out === 'counter')) tutorialEvent({ type: out, height: atk.height, key: atk.key });
    if (atk.key === 'vaultFlick' && (out === 'hit' || out === 'counter')) game.stats.vaultHit++;
    if (e.state === 'yield' && e.def.defeatDialogue && !e.spoke) {
      e.spoke = true;
      setTimeout(() => startTalk(e.def.defeatDialogue), 700);  // сначала встаёт на колено
    }
    const x = e.x - p.facing * 6;
    const y = e.kind === 'slime' ? groundY(e.z) - e.airY - 6 : clashY(atk.height === 'any' ? 'mid' : atk.height, e.z);
    if (out === 'counter') {
      game.stats.counter++;
      sparks(x, y, 22, [PAL.blood, PAL.spark, PAL.sparkHot], 150);
      sfx.counter();
      game.hitstop = CONFIG.hitstop.counter;
      shake(4);
      flash('#ffffff', 0.4);
      callout(`Контратака! −${dmg}`, 'counter');
    } else if (out === 'hit') {
      sparks(x, y, 8, e.kind === 'slime' ? ['#7bd88f', '#d4ffd9'] : [PAL.blood, '#9e2648'], 90);
      sfx.enemyHit();
      game.hitstop = Math.max(game.hitstop, CONFIG.hitstop.strike);
      shake(2);
      callout(e.def.practice ? `${atk.name} · ${HEIGHT_NAME[atk.height] ?? 'по кругу'}` : `${atk.name}  −${dmg}`, 'block');
    } else if (out === 'blocked') {
      sparks(x, y, 6, [PAL.sparkHot], 60);
      sfx.block();
      p.recoil();
      callout('Враг закрылся', 'muted');
    } else if (out === 'miss') {
      sfx.swish();
      callout('Мимо', 'muted');
    }
  }
  if (!touched) sfx.swish();
  renderFoe();
}

function handlePlayerEvents() {
  const p = game.player;
  for (const ev of p.events.splice(0)) {
    if (ev.type === 'attackStart') {
      for (const e of game.enemies) if (e.alive && Math.abs(e.x - p.x) < 150) e.notifyAttack(ev.atk);
      if (SPECIAL.has(ev.atk.key)) callout(ev.atk.name, 'muted');
      if (ev.atk.key === 'vaultFlick') game.stats.vault++;
    } else if (ev.type === 'strike') {
      if (ev.atk.height === 'low') dust(p.x + p.facing * 22, groundY(p.z), p.facing);
      if (!game.arena) hitWall(ev.atk);
      playerStrike(ev.atk);
    } else if (ev.type === 'dash' || ev.type === 'roll' || ev.type === 'backdash') {
      sfx.dash();
    } else if (ev.type === 'spinNotReady') {
      callout(p.weapon === 'rapier' ? 'Восьмёрка не готова' : 'Вихрь не готов', 'muted');
    } else if (ev.type === 'feint') {
      callout('Отмена', 'muted');
    } else if (ev.type === 'spit') {
      ev.slime.release();
      sfx.spit();
      shake(2);
    }
  }
}

// ---------- режимы ----------

function die() {
  game.mode = 'dead';
  const a = game.arena ? game.arena.key : '-';
  game.deaths[a] = (game.deaths[a] ?? 0) + 1;
  if (game.lastHitBy) game.killers[game.lastHitBy] = (game.killers[game.lastHitBy] ?? 0) + 1;
  showOverlay('Ты пал', `Тебя одолел: ${game.lastHitBy || 'неизвестно кто'}.`, 'R — снова в бой');
  ui.reportBtn.hidden = false;
}

function restartFight() {
  const a = game.arena;
  if (a) {
    game.enemies = game.enemies.filter(e => e.group !== a.index).concat(spawnGroup(game.room, a.index));
    game.arena = null;
  }
  game.current = null;
  game.token = null;
  game.arrows = [];
  const z = game.player.z;
  game.player = new Player(game.checkpoint, game.player.weapon);
  game.player.z = z;
  game.player.sheathed = false;
  game.transition = null;
  game.view = 'side';
  game.blockStreak = 0;
  game.charge = null;
  game.lastPress = game.prevPress = null;
  game.mode = 'play';
  ui.foe.hidden = true;
  renderHearts();
  hideOverlay();
  hint(hintWalk());
}

// Отчёт для тестера: копируется кнопкой и вставляется в сообщение.
function buildReport() {
  const s = game.stats;
  const mins = Math.floor((performance.now() - game.startedAt) / 60000);
  const secs = Math.floor((performance.now() - game.startedAt) / 1000) % 60;
  const names = key => {
    const i = ALL_ENCOUNTERS.findIndex(a => a.key === key);
    if (i < 0) return null;
    const [roomId] = key.split(':');
    return `${i + 1}. ${ROOMS[roomId].name}: ${ALL_ENCOUNTERS[i].enc.enemies.map(e => ENEMY_TYPES[e.type].shortName ?? ENEMY_TYPES[e.type].name).join(' + ')}`;
  };
  const deaths = Object.entries(game.deaths).map(([k, n]) => `  ${names(k) ?? 'вне встреч'} — ${n}`).join('\n') || '  ни одной';
  const killers = Object.entries(game.killers).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ') || '—';
  const total = s.perfect + s.block + s.broken + s.hit + s.dodged;
  const pct = total ? Math.round(s.perfect / total * 100) : 0;
  return [
    `Knight Night ${VERSION} — отчёт тестера`,
    `Время: ${mins}:${String(secs).padStart(2, '0')} · пройдено встреч: ${game.cleared.size} из ${ALL_ENCOUNTERS.length}`,
    `Обучение: ${game.flags.tutorial_done ? 'пройдено' : game.flags.tutorial_skipped ? 'пропущено' : game.tutorial ? `остановился на шаге ${game.tutorial.i + 1}` : 'не начато'} · комнаты: ${[...new Set(game.visited ?? [])].map(id => ROOMS[id].name).join(', ')}`,
    `Смерти по встречам:`,
    deaths,
    `Кто убивал: ${killers}`,
    `Удары врагов: идеально ${s.perfect} (${pct}%), блок ${s.block}, сбита защита ${s.broken}, уклон ${s.dodged}, пропущено ${s.hit}`,
    `Почему пропущено: ${Object.entries(game.missWhy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`,
    `Пропущено по высоте: верх ${game.missHeight.high ?? 0}, середина ${game.missHeight.mid ?? 0}, низ ${game.missHeight.low ?? 0}`,
    `Контратак: ${s.counter}`,
    `Снаряжение: ${SLOTS.map(([s, l]) => `${l.toLowerCase()} — ${game.equip[s] ? ITEMS[game.equip[s]].name : 'нет'}`).join(', ')}`,
    `Монеты: ${game.coins} (заработано ${s.coinsEarned}) · в сумке: ${game.bag.map(id => ITEMS[id].name).join(', ') || 'пусто'} · туз погасил ${s.ward} · зелий ${s.potions} · навык ${s.skill} раз`,
    `Оружие: ${game.unlocked.has('rapier') ? `рапира получена, сейчас — ${game.player.arms.name.toLowerCase()}` : 'только меч'}`
      + (game.unlocked.has('rapier') ? ` · рипостов ${s.riposte}, отбито восьмёркой ${s.weave}, прыжков с захлёстом ${s.vault} (попали ${s.vaultHit})` : ''),
  ].join('\n');
}

async function copyReport() {
  const text = buildReport();
  try {
    await navigator.clipboard.writeText(text);
    ui.reportBtn.textContent = 'Скопировано ✓';
  } catch {
    // запасной путь: показать текст, чтобы выделить и скопировать вручную
    ui.reportText.value = text;
    ui.reportText.hidden = false;
    ui.reportText.select();
    ui.reportBtn.textContent = 'Выдели текст и скопируй';
  }
}

function finish(d = {}) {
  game.mode = 'end';
  ui.reportBtn.hidden = false;
  const s = game.stats;
  showOverlay(d.finishTitle ?? 'Конец первого этажа',
    `${d.finishText ?? 'Рыцарь поднимается на второй этаж — его мы сделаем дальше.'} Идеальных парирований: ${s.perfect} · блоков: ${s.block} · уклонов: ${s.dodged} · пропущено: ${s.hit} · контратак: ${s.counter} · монет: ${game.coins}`,
    'R — пройти заново');
}

// ---------- начало игры ----------

function showTitle() {
  const data = loadSave();
  game.titleConfirm = false;
  showOverlay('Knight Night',
    'Рыцарь отмечает порталы на карте мира. Очередной портал перенёс его в заброшенный замок.',
    data ? `Enter — продолжить (${ROOMS[data.flags?.restAt?.room ?? data.room]?.name ?? 'начало'}) · N — новая игра` : 'Нажми любую клавишу');
  setMenu(data ? [
    ['Продолжить', () => { unlockAudio(); startContinue(loadSave()); }],
    ['Новая игра', askNewFromTitle],
    ['Управление', () => showControls(showTitle)],
  ] : [
    ['Начать', () => { unlockAudio(); startNew(); }],
    ['Управление', () => showControls(showTitle)],
  ]);
  ui.overlay.classList.add('title');  // текст внизу, картинка замка видна
}

function askNewFromTitle() {
  showOverlay('Начать заново?', 'Сохранение сотрётся: монеты, вещи, пройденные комнаты. История начнётся с камеры.', 'N — да · Esc — нет');
  setMenu([['Да, начать заново', () => { unlockAudio(); startNew(); }], ['Нет', showTitle]]);
  ui.overlay.classList.add('title');
  game.titleConfirm = true;
}

// кнопки меню: [подпись, действие]; клик по кнопке не доходит до игры
function setMenu(items) {
  ui.overlayMenu.innerHTML = '';
  for (const [label, go] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); go(); });
    ui.overlayMenu.appendChild(b);
  }
}

const CONTROLS_TEXT = [
  'WASD — ходить вбок и вглубь (вне боя — бег)',
  'Курсор выше рыцаря — верх, на груди — середина, ниже пояса — низ',
  'ЛКМ — удар на этой высоте · держать ПКМ — защита',
  'Пробел — рывок (курсор внизу — кувырок, вверху — прыжок, с «назад» — отскок)',
  'Колесо вверх — приём оружия · колесо вниз — навык · Q — сменить оружие',
  'E — говорить, лавка, сундук, осмотреть, отдохнуть · W у двери — войти',
  'I — снаряжение · H — зелье · B — журнал · M — карта · Esc — пауза',
].join('\n');

function showControls(back) {
  showOverlay('Управление', CONTROLS_TEXT, 'Esc — назад');
  ui.overlayText.classList.add('controls');  // тёмный фон: текст поверх картинки замка не читается
  setMenu([['Назад', back]]);
  game.controlsBack = back;
}

function showPause() {
  game.confirmNew = false;
  hint('');
  showOverlay('Пауза', '', 'Esc — продолжить');
  setMenu([
    ['Продолжить', resumePlay],
    ...(game.arena ? [['Встреча заново', restartFight]] : []),
    ['Управление', () => showControls(showPause)],
    [`Звуки окружения: ${ambientOn ? 'вкл' : 'выкл'}`, () => { setAmbient(!ambientOn); game.ambRoom = null; showPause(); }],
    ['Новая игра', askNewFromPause],
    ['Главное меню', toTitle],
  ]);
  ui.reportBtn.hidden = false;
}
function resumePlay() {
  game.mode = 'play';
  hideOverlay();
}
function askNewFromPause() {
  game.confirmNew = true;
  showOverlay('Начать заново?', 'Сохранение сотрётся: монеты, вещи, пройденные комнаты. История начнётся с камеры.', 'N — да · Esc — нет');
  setMenu([['Да, начать заново', startNew], ['Нет', showPause]]);
}

// в главное меню: прогресс сохранён, там «продолжить» или N — новая игра
function toTitle() {
  save();
  ui.talk.hidden = true;
  newGame();
  hideOverlay();
  showTitle();
}

function startNew() {
  game.confirmNew = false;
  clearSave();
  newGame();
  game.mode = 'play';
  hideOverlay();
  hint('');
  game.cutscene = { t: 0 };
}

function startContinue(data) {
  continueGame(data);
  game.mode = 'play';
  hideOverlay();
  hint(hintWalk());
  callout(ROOMS[game.room].name, 'muted');
}

// ---------- ввод ----------

function recordGuard(height) {
  // курсор встал на высоту и ПКМ нажата в том же кадре — это одно нажатие, а не два
  const lp = game.lastPress;
  if (lp && lp.time === game.time && lp.height === height) return;
  game.prevPress = game.lastPress;
  game.lastPress = { height, time: game.time };
}


function handlePress(code) {
  if (game.mode === 'shop') { shopPress(code); return; }
  if (game.mode === 'map') { mapPress(code); return; }
  if (game.mode === 'equip') { equipPress(code); return; }
  if (game.mode === 'journal') { journalPress(code); return; }
  if (code === 'Escape' && game.controlsBack) {
    // из «Управления» — назад, откуда пришли
    const back = game.controlsBack;
    game.controlsBack = null;
    back();
    return;
  }
  if (game.mode === 'title' && game.titleConfirm) {
    if (code === 'KeyN') { unlockAudio(); startNew(); }
    else if (code === 'Escape') showTitle();
    return;
  }
  if (code === 'Escape' || code === 'KeyP') {
    if (game.mode === 'play') {
      game.mode = 'paused';
      showPause();
    } else if (game.mode === 'paused') {
      if (game.confirmNew) { game.confirmNew = false; showPause(); return; }  // «нет» — назад в паузу
      game.mode = 'play';
      hideOverlay();
    }
    return;
  }
  if (game.mode === 'paused') {
    if (code === 'KeyR' && !game.confirmNew) restartFight();
    else if (code === 'KeyN') {
      // новая игра — с подтверждением: сбрасывает сохранение
      if (game.confirmNew) startNew();
      else askNewFromPause();
    } else if (code === 'KeyM' && !game.confirmNew) toTitle();
    return;
  }
  if (code === 'F3') {
    game.debug = !game.debug;
    ui.debug.hidden = !game.debug;
    return;
  }
  if (game.mode === 'title') {
    if (code === 'Escape') return;
    unlockAudio();
    const data = loadSave();
    if (data && code === 'KeyN') askNewFromTitle();  // сохранение есть — сначала спросить
    else if (data) startContinue(data);
    else startNew();
    return;
  }
  if (game.mode === 'talk') {
    if (/^Digit[1-9]$/.test(code)) chooseTalk(Number(code.slice(5)) - 1);
    else if (is(code, 'attack') || code === 'Enter' || code === 'KeyE') advanceTalk();
    return;
  }
  if (game.mode === 'dead') {
    if (code === 'KeyR' || code === 'Enter') restartFight();
    return;
  }
  if (game.mode === 'end') {
    if (code === 'KeyR' || code === 'Enter') startNew();
    return;
  }
  // сцена пробуждения: любое нажатие — пропустить; во время перехода между комнатами ввод ждёт
  if (game.cutscene) {
    if (!code.startsWith('Wheel')) game.cutscene.t = Math.max(game.cutscene.t, WAKE.end);
    return;
  }
  if (game.transition) return;

  const p = game.player;
  if (game.rest) {
    // сидит: E или удар — встать
    if (code === 'KeyE' || is(code, 'attack')) standUp();
    return;
  }
  if (code === 'KeyE' && !game.arena) {
    const chest = nearChest();
    if (chest) {
      game.flags[chestFlag(chest)] = true;
      if (chest.pick) {
        // предмет просто лежит — взять
        game.bag.push(chest.pick);
        callout(`Взято: ${ITEMS[chest.pick].name}`, 'perfect');
        sfx.perfect();
        save();
        return;
      }
      game.coins += chest.coins ?? 0;
      for (let i = 0; i < Math.min(12, chest.coins ?? 0); i++) {
        game.coinFx.push({ x: chest.x, y: groundY(chest.z) - 10, gy: groundY(chest.z), vx: (Math.random() * 2 - 1) * 50, vy: -110 - Math.random() * 60, t: 0, wait: 0.5 + i * 0.06, fly: null });
      }
      if (chest.item) {
        game.bag.push(chest.item);
        const slot = ITEMS[chest.item].slot;
        if (slot && slot !== 'weapon' && !game.equip[slot]) equipItem(chest.item);  // амулет в пустой слот — сразу надеть
        callout(`Сундук: ${ITEMS[chest.item].name}${chest.coins ? ` и ${chest.coins} монет` : ''}`, 'perfect');
      } else callout(`Сундук: +${chest.coins} монет`, 'perfect');
      sfx.perfect();
      sparks(chest.x, groundY(chest.z) - 10, 14, [PAL.gold, PAL.spark], 80);
      save();
      return;
    }
    const altar = !game.doorNear && nearAltar();
    if (altar) { useAltar(altar); return; }
    const rest = !game.doorNear && nearRest();
    if (rest) { startRest(rest); return; }
    const look = !game.doorNear && nearLook();
    if (look) {
      // у тайника выбор в разговоре ставит флаг — тогда проход открывается
      startTalk(look.look, look.secret ? () => {
        if (!game.flags[look.secret]) return;
        sfx.door();
        shake(2);
        dust(look.x, CONFIG.floorTop + 2, 1);
        callout('Стеллаж отошёл — за ним проход!', 'perfect');
        save();
      } : null);
      return;
    }
    const npc = nearNpc();
    if (npc) {
      npc.facing = Math.sign(p.x - npc.x) || -1;
      if (npc.def.shop) openShop(npc);
      else startTalk(npc.def.talk);
      return;
    }
  }
  const engaged = !!game.current?.alive;
  const backKeys = p.facing > 0 ? KEYS.left : KEYS.right;

  // высота — по курсору: ЛКМ бьёт, ПКМ защищает, пробел — рывок на этой высоте
  const vert = game.aim === 'high' ? 'up' : game.aim === 'low' ? 'down' : null;
  if (code === 'WheelUp') {
    // колесо вверх — приём оружия (вихрь или восьмёрка); пока перезаряжается, ничего не делает
    if (p.spinCharge < 1) callout(p.weapon === 'rapier' ? 'Восьмёрка не готова' : 'Вихрь не готов', 'muted');
    else p.requestAttack(null, true);
  }
  if (code === 'WheelDown') useSkill();
  if (code === 'KeyQ' && (p.ready || (p.state === 'attack' && p.airY === 0))) {
    // Q — взять другое оружие из сумки
    const other = game.bag.find(id => ITEMS[id].slot === 'weapon');
    if (other) {
      equipItem(other);
      callout(ITEMS[other].name, 'muted');
    }
  }
  if (code === 'KeyI') { openEquip(); return; }
  if (code === 'KeyH') drinkPotion();
  if (code === 'KeyB') openJournal();
  if (code === 'KeyM') openMap();
  if (is(code, 'guard')) { recordGuard(game.aim); p.cancel(); game.charge = null; }
  if (is(code, 'attack')) {
    // рапира, курсор вверху: зажал — прыжок с захлёстом, щёлкнул — обычный захлёст
    if (p.weapon === 'rapier' && vert === 'up' && p.ready) game.charge = { t: game.time };
    else p.requestAttack(vert, false);
  }
  if (is(code, 'dash')) {
    const back = backKeys.some(input.isDown);
    p.requestDash(vert ?? (back && engaged ? 'back' : null));
  }
}

function controls() {
  const p = game.player;
  const engaged = !!game.current?.alive;
  const L = held('left'), R = held('right');
  const dz = (held('depthOut') ? 1 : 0) - (held('depthIn') ? 1 : 0);
  return {
    fwd: p.facing > 0 ? R : L,
    back: engaged && (p.facing > 0 ? L : R) && !(p.facing > 0 ? R : L),
    dz,
    guard: held('guard') ? game.aim : null,
    engaged,
    anyInput: L || R || dz !== 0,
  };
}

// ---------- обновление ----------

// Высота по мыши: курсор выше груди рыцаря — верх, ниже пояса — низ, между — середина.
// Перевёл мышь, держа ПКМ, — это тоже нажатие защиты (можно поймать идеальное парирование).
function updateAim() {
  if (game.mouseY == null) return;
  const p = game.player;
  const dy = game.mouseY - (groundY(p.z) - 22);
  const aim = dy < -13 ? 'high' : dy > 12 ? 'low' : 'mid';  // середина шире (v0.12)
  if (aim !== game.aim) {
    game.aim = aim;
    if (input.isDown('Mouse2')) { recordGuard(aim); p.cancel(); }
  }
}

// Границы арены: ±150 от центра встречи, но не за стенами комнаты.
function arenaBounds() {
  const L = room().length;
  return [Math.max(16, game.arena.x - 150), Math.min(room().limitRight ?? L - 16, game.arena.x + 150)];
}

// Встреча начинается, когда рыцарь подходит; проход закрыт, пока группа жива.
function updateArena() {
  const p = game.player;
  const encs = room().encounters ?? [];
  if (!game.arena) {
    if (game.tutorial) return;
    const i = encs.findIndex((enc, i) => !game.cleared.has(encKey(game.room, i)) && p.x > enc.x - 140 && p.x < enc.x + 150);
    if (i < 0) return;
    game.arena = { index: i, x: encs[i].x, key: encKey(game.room, i) };
    game.checkpoint = Math.max(40, encs[i].x - 140);
    for (const e of game.enemies) if (e.group === i) { e.awake = true; seen(e.type); }
    ui.foe.hidden = false;
    hint(hintFight());
    const before = encs[i].before;
    if (before && !game.flags['seen_' + before]) startTalk(before);
    return;
  }
  const alive = game.enemies.some(e => e.group === game.arena.index && (e.alive || e.state === 'yield'));
  if (!alive) {
    game.cleared.add(game.arena.key);
    game.clearedAt[game.arena.key] = game.time;
    const enc = encs[game.arena.index];
    if (enc.story) game.flags['done_' + enc.story] = true;
    if (enc.after) setTimeout(() => startTalk(enc.after, () => {
      if (game.room === 'balcony') {
        game.flags.balcony_done = true;
        callout('Лестница на второй этаж — в Столовой', 'perfect');
        save();
      }
    }), 900);
    // отдых после победы над группой
    const healed = Math.min(CONFIG.restHeal, CONFIG.playerHp - p.hp);
    if (healed > 0) {
      p.hp += healed;
      renderHearts();
      callout(`Передышка  +${healed}`, 'perfect');
    }
    game.arena = null;
    game.current = null;
    game.token = null;
    ui.foe.hidden = true;
    hint(hintWalk());
    game.checkpoint = p.x;
    save();
  }
}

// Очередь атак: враг держит право бить, пока атакует; закончил — пауза и право переходит.
function updateToken() {
  const t = game.token;
  if (!t) return;
  const e = t.e;
  const attacking = ATTACKING.has(e.state);
  if (attacking) t.attacked = true;
  const stale = !t.attacked && game.time - t.since > 2.5;  // так и не ударил — пусть попробует другой
  if (!e.alive || (t.attacked && !attacking) || stale) {
    game.lastHolder = e;
    game.token = null;
    game.tokenFreeAt = game.time + CONFIG.tokenPause;
  }
}

// Цель рыцаря: тот, кто сейчас бьёт, иначе ближайший. На обучении — наставница.
function pickTarget() {
  const p = game.player;
  if (game.tutorial) {
    game.current = trainer();
    return;
  }
  if (!game.arena) {
    game.current = null;
    return;
  }
  const group = game.enemies.filter(e => e.group === game.arena.index && e.alive);
  const holder = game.token?.e;
  let best = holder?.alive && group.includes(holder) ? holder : null;
  if (!best) for (const e of group) {
    if (!best || Math.hypot(e.x - p.x, (e.z - p.z) * 2) < Math.hypot(best.x - p.x, (best.z - p.z) * 2)) best = e;
  }
  if (best !== game.current) {
    game.current = best ?? game.enemies.find(e => e.group === game.arena.index && e.state === 'yield') ?? null;
    renderFoe();
  }
}

// ---------- обучение у наставницы ----------

const trainer = () => game.enemies.find(e => e.kind === 'trainer' && e.state !== 'leave' && e.state !== 'gone');

// подошёл к наставнице — разговор; дальше обучение или пропуск
function updateTrainerMeet() {
  const t = trainer();
  if (!t || game.tutorial || game.flags.trainer_met) return;
  if (Math.abs(t.x - game.player.x) > 100) return;
  game.flags.trainer_met = true;
  startTalk('trainer_meet', () => {
    if (game.flags.tutorial_skipped) trainerLeave();
    else startTutorial();
  });
}

function startTutorial() {
  const t = trainer();
  if (!t) return;
  game.tutorial = new Tutorial();
  t.awake = true;
  t.setPlan(game.tutorial.step.plan);
  hint(game.tutorial.text);
}

function tutorialEvent(ev) {
  const tut = game.tutorial;
  if (!tut) return;
  const before = tut.text;
  if (tut.note(ev)) {
    sfx.ward();
    if (tut.done) {
      game.tutorial = null;
      game.flags.tutorial_done = true;
      callout('Обучение пройдено', 'perfect');
      trainer()?.setPlan(null);
      hint('');
      setTimeout(() => startTalk('trainer_done', trainerLeave), 600);
      return;
    }
    callout('Получилось!', 'perfect');
    trainer()?.setPlan(tut.step.plan);
  }
  if (tut.text !== before) hint(tut.text);
}

function trainerLeave() {
  trainer()?.leave();
  game.flags.trainer_gone = true;
  game.current = null;
  hint(hintWalk());
  save();
}

// ---------- комнаты, двери, переходы ----------

// дверь, у которой стоит рыцарь (у самой стены, напротив проёма)
function doorAt(p) {
  // needs — проход появляется только после события (например, пролом в стене)
  return (room().doors ?? []).find(d => (!d.needs || game.flags[d.needs]) && Math.abs(d.x - p.x) < DOOR_W / 2 + 2 && p.z < 14) ?? null;
}
const hasItem = id => game.bag.includes(id);
const chestFlag = pr => `chest_${game.room}_${pr.id}`;
// сундук у стены рядом с рыцарем (ещё не открытый)
function nearChest() {
  const p = game.player;
  return (room().props ?? []).find(pr => (pr.type === 'chest' || pr.pick) && !game.flags[chestFlag(pr)] && Math.abs(pr.x - p.x) < 18 && Math.abs(pr.z - p.z) < 14) ?? null;
}
// декор, который можно осмотреть (look — разговор в DIALOGUES): стоять у стены напротив
function nearLook() {
  const p = game.player;
  const r = room();
  return [...(r.decor ?? []), ...(r.props ?? [])].find(d => d.look && !(d.secret && game.flags[d.secret]) && Math.abs(d.x - p.x) < 20 && (d.z === undefined ? p.z < 14 : Math.abs(d.z - p.z) < 12)) ?? null;
}
// удар у замурованного прохода: три удара — стена рушится
function hitWall(atk) {
  const p = game.player;
  const d = (room().decor ?? []).find(d => d.type === 'cracks' && !game.flags[d.secret] && Math.abs(d.x - p.x) < 22 && p.z < 10);
  if (!d) return;
  game.wallHits = (game.wallHits ?? 0) + 1;
  const y = CONFIG.floorTop - 18;
  sparks(d.x, y, 6, ['#8a82a8', '#5e5878', '#c8c0e0'], 70);
  sfx.block();
  shake(1.5);
  if (game.wallHits < 3) { callout(game.wallHits === 1 ? 'Кладка дрогнула' : 'Ещё удар!', 'muted'); return; }
  game.flags[d.secret] = true;
  game.wallHits = 0;
  for (let i = 0; i < 3; i++) dust(d.x + (i - 1) * 8, CONFIG.floorTop + 2, i - 1 || 1);
  sparks(d.x, y, 16, ['#8a82a8', '#5e5878', '#4a4462'], 110);
  shake(4);
  sfx.door();
  callout('Стена рухнула — за ней проход!', 'perfect');
  save();
}
// звуки окружения по комнате: капли в подземельях, ветер у окон и на балконе, треск камина вблизи
function updateAmbience(dt) {
  const r = room(), p = game.player;
  game.ambT = (game.ambT ?? 1) - dt;
  const windLevel = r.balcony ? 1 : game.room === 'gallery' ? 0.35 : 0;
  if (game.ambRoom !== game.room) { game.ambRoom = game.room; setWind(windLevel, 0.3); }
  const fire = (r.decor ?? []).find(d => d.type === 'fireplace');
  const fireNear = fire ? Math.max(0, 1 - Math.abs(fire.x - p.x) / 220) : 0;
  if (game.ambT > 0) return;
  const rumble = (r.doors ?? []).find(d => d.rumble && Math.abs(d.x - p.x) < 110);
  if (rumble && ambientOn && Math.random() < 0.5) { sfx.thud(); shake(0.6); game.ambT = 2.5 + Math.random() * 3; return; }
  if (fireNear > 0.05) { crackle(fireNear); game.ambT = 0.08 + Math.random() * 0.35; return; }
  if (windLevel) { setWind(windLevel * (0.7 + Math.random() * 0.6), Math.random()); game.ambT = 1.5 + Math.random() * 2; return; }
  if (r.dark || game.room === 'hall' || game.room === 'secret') { drip(); game.ambT = 2 + Math.random() * 4; return; }
  game.ambT = 2;
}

// алтарь: поставить Серебряную чашу — за алтарём открывается проход
function nearAltar() {
  const p = game.player;
  return (room().props ?? []).find(pr => pr.altar && Math.abs(pr.x - p.x) < 20 && Math.abs(pr.z - p.z) < 12) ?? null;
}
function useAltar(pr) {
  if (game.flags[pr.altar]) { startTalk('look_altar_done'); return; }
  if (!hasItem('silver_cup')) { startTalk('look_altar'); return; }
  game.bag.splice(game.bag.indexOf('silver_cup'), 1);
  game.flags[pr.altar] = true;
  sparks(pr.x, groundY(pr.z) - 20, 18, ['#ffe080', '#ffffff', '#8fd3ff'], 90);
  flash('#fff4c2', 0.4);
  sfx.portal();
  shake(2);
  callout('Чаша на алтаре. За алтарём сдвинулась плита', 'perfect');
  save();
}

// место отдыха (rest у вещи или убранства): диван, камин
function nearRest() {
  const p = game.player;
  const r = room();
  return [...(r.props ?? []), ...(r.decor ?? [])].find(s => s.rest && Math.abs(s.x - p.x) < 22 && p.z < 18) ?? null;
}

// сесть: лечение понемногу, сохранение; отсюда начнётся «продолжить»
function startRest(spot) {
  const p = game.player;
  game.rest = { spot, t: 0, heal: 0 };
  p.x = spot.x + (spot.rest.dx ?? 0);  // dx — сбоку от вещи (у камина — рядом с огнём, а не в нём)
  p.z = spot.rest.z ?? (spot.z + 1);
  if (spot.rest.face) p.facing = spot.rest.face;
  p.walking = false;
  p.guard = null;
  game.flags.restAt = { room: game.room, x: p.x, z: p.z };
  game.checkpoint = p.x;
  save();
  callout(`Отдых ${spot.rest.name} · сохранено`, 'perfect');
  sfx.ward();
  hint('Движение или E — встать');
}
function standUp() {
  game.rest = null;
  hint(hintWalk());
}
function updateRest(dt) {
  const r = game.rest, p = game.player;
  r.t += dt;
  r.heal += dt;
  if (r.heal >= 0.4 && p.hp < CONFIG.playerHp) {
    r.heal = 0;
    p.hp++;
    renderHearts();
    sparks(p.x, groundY(p.z) - 20, 3, ['#8fd3ff', '#ffffff'], 30);
    if (p.hp === CONFIG.playerHp) save();
  }
  if (r.t > 0.3 && (held('left') || held('right') || held('depthIn') || held('depthOut'))) standUp();
}

function nearNpc() {
  const p = game.player;
  return game.npcs.find(n => Math.abs(n.x - p.x) < 28 && Math.abs(n.z - p.z) < 12) ?? null;
}

// Вход в дверь: прижался к стене у двери и держит W.
function updateDoors(dt) {
  const p = game.player;
  const d = p.ready && !game.arena && !game.tutorial ? doorAt(p) : null;
  game.doorNear = d;
  if (game.doorLock && !held('depthIn')) game.doorLock = false;  // вышел из двери — сначала отпусти W
  if (!d || !held('depthIn') || p.z > 1 || game.doorLock) { game.doorPush = 0; return; }
  game.doorPush += dt;
  if (game.doorPush < 0.12) return;
  game.doorPush = 0;
  const opensWithKey = (d.key && hasItem(d.key)) || (d.requires && game.flags[d.requires]);
  if (opensWithKey && !game.flags['opened_' + d.id]) {
    game.flags['opened_' + d.id] = true;
    callout('Ключ подошёл', 'perfect');
  }
  if (d.locked && !opensWithKey) {
    if (game.time - game.lockedSaidAt > 1.5) {
      game.lockedSaidAt = game.time;
      callout(d.locked, 'muted');
      sfx.block();
    }
    return;
  }
  if (d.finish) { finish(d); return; }
  if (d.fall) { game.transition = { kind: 'fall', door: d, phase: 'drop', t: 0 }; sfx.dash(); return; }
  game.transition = { kind: 'door', door: d, phase: 'turn', t: 0, x0: p.x, z0: p.z };
  sfx.door();
}

// Выход за край комнаты (там, где есть проход).
function updateEdges() {
  const p = game.player;
  if (game.arena || game.tutorial || !p.ready) return;
  const edges = room().edges ?? {};
  const L = room().length;
  if (edges.left && p.x <= 10 && held('left')) game.transition = { kind: 'edge', edge: edges.left, dir: -1, phase: 'out', t: 0 };
  else if (edges.right && p.x >= L - 10 && held('right')) game.transition = { kind: 'edge', edge: edges.right, dir: 1, phase: 'out', t: 0 };
}

const DOOR_PHASES = { turn: 0.14, walkIn: 0.5, fadeOut: 0.22, fadeIn: 0.22, walkOut: 0.5, turnOut: 0.12 };
const EDGE_PHASES = { out: 0.3, in: 0.3 };

function updateTransition(dt) {
  const tr = game.transition;
  const p = game.player;
  tr.t += dt;
  if (tr.kind === 'fall') {
    // прыжок в пролом: падает вниз за край экрана, темнота, падает сверху в другой комнате, пыль
    if (tr.phase === 'drop') {
      game.fallY = 300 * tr.t * tr.t;
      if (tr.t >= 0.45) {
        const to = ROOMS[tr.door.to];
        const out = to.doors.find(x => x.id === tr.door.toDoor);
        loadRoom(tr.door.to, { x: out.x + 24, z: 8 });
        callout(`${to.name} — внизу`, 'muted');
        tr.phase = 'land';
        tr.t = 0;
      }
    } else {
      game.fallY = -160 * (1 - Math.min(1, tr.t / 0.3)) ** 2;
      if (tr.t >= 0.3) {
        game.fallY = 0;
        game.transition = null;
        shake(4);
        sfx.heavy();
        dust(p.x - 6, groundY(p.z), -1); dust(p.x + 6, groundY(p.z), 1);
        save();
      }
    }
    return;
  }
  if (tr.kind === 'edge') {
    const v = Math.max(CONFIG.exploreSpeed, p.speedNow ?? 0);
    p.x += tr.dir * v * dt;
    p.facing = tr.dir;
    p.step += dt * v / gaitCycle(p.gaitRun ?? 0);
    p.walking = true;
    if (tr.phase === 'out' && tr.t >= EDGE_PHASES.out) {
      loadRoom(tr.edge.to, { x: tr.edge.x - tr.dir * 18, z: p.z, facing: tr.dir });
      tr.phase = 'in';
      tr.t = 0;
      callout(tr.edge.name && tr.dir > 0 && tr.edge.name !== room().name ? `${tr.edge.name} → ${room().name}` : room().name, 'muted');
    } else if (tr.phase === 'in' && tr.t >= EDGE_PHASES.in) {
      game.transition = null;
      p.walking = false;
      save();
    }
    return;
  }
  // дверь: повернулся спиной → вошёл → темнота → вышел из двери в другой комнате лицом к нам → повернулся боком
  const T = DOOR_PHASES[tr.phase];
  const k = Math.min(1, tr.t / T);
  if (tr.phase === 'walkIn') {
    p.x = tr.x0 + (tr.door.x - tr.x0) * k;
    p.z = tr.z0 + (-7 - tr.z0) * k;
    p.step += dt * 1.6;
  } else if (tr.phase === 'walkOut') {
    p.z = -7 + 15 * k;
    p.step += dt * 1.6;
  }
  if (tr.t < T) return;
  tr.t = 0;
  const next = { turn: 'walkIn', walkIn: 'fadeOut', fadeOut: 'fadeIn', fadeIn: 'walkOut', walkOut: 'turnOut', turnOut: null }[tr.phase];
  if (tr.phase === 'fadeOut') {
    const to = ROOMS[tr.door.to];
    const out = to.doors.find(d => d.id === tr.door.toDoor);
    loadRoom(tr.door.to, { x: out.x, z: -7 });
    tr.door = out;
    callout(to.name, 'muted');
    sfx.door();
  }
  if (!next) {
    game.transition = null;
    game.doorLock = true;
    p.z = 8;
    p.step = 0;
    game.view = 'side';
    game.viewPrev = 'front';
    game.viewT = 0;
    save();
    return;
  }
  tr.phase = next;
}

// Сцена пробуждения: руны портала загораются, вспышка, рыцарь сидит, трясёт головой, встаёт.
const WAKE = { flash: 1.1, kneel: 3.0, stand: 3.7, end: 4.3 };
const SIT = { hx: 6, hy: 9, angle: 25, lean: 2, crouch: 10 };

function updateCutscene(dt) {
  const c = game.cutscene;
  const p = game.player;
  const before = c.t;
  c.t += dt;
  if (before < WAKE.flash && c.t >= WAKE.flash) {
    flash('#bff0ff', 0.9);
    sfx.portal();
    shake(2);
    const r = room().portal;
    sparks(r.x, groundY(r.z) - 10, 30, ['#5fd3ff', '#c8f4ff', '#ffffff'], 140);
  }
  p.sheathed = false;
  if (c.t < WAKE.kneel) {
    // сидит, голова опущена → поднимает голову → снова опускает взгляд, смотрит вперёд
    const k = (a, b) => Math.min(1, Math.max(0, (c.t - a) / (b - a)));
    const lean = 3 - 4 * ease(k(1.7, 2.1)) + 2 * ease(k(2.5, 2.9));
    p.pose = { ...SIT, lean };
  } else if (c.t < WAKE.stand) {
    p.pose = approachPose(p.pose, POSES.kneel, dt, 10);
  } else {
    p.pose = approachPose(p.pose, POSES.idle, dt, 10);
  }
  if (c.t >= WAKE.end) {
    game.cutscene = null;
    p.pose = { ...POSES.idle };
    startTalk('wake', () => {
      game.flags.portal_cell = true;  // портал отмечен на карте
      callout('Портал отмечен', 'perfect');
      hint(hintWalk());
      save();
    });
  }
}

// Вне боя рыцарь поворачивается спиной, когда идёт к стене, и лицом, когда идёт к краю экрана.
function updateView(dt, engaged) {
  const p = game.player;
  let want = 'side';
  if (!engaged && p.state === 'ready' && !held('guard')) {
    const L = held('left'), R = held('right');
    if (!L && !R && held('depthIn')) want = 'back';
    else if (!L && !R && held('depthOut')) want = 'front';
  }
  game.viewT += dt;
  if (want !== game.view) {
    game.viewPrev = game.view;
    game.view = want;
    game.viewT = 0;
  }
}

function update(dt) {
  if (game.mode === 'play') updateAim();  // высота — до нажатий этого кадра
  for (const code of input.take()) handlePress(code);
  if (game.mode !== 'play') return;

  game.time += dt;
  const p = game.player;
  updateMotes(dt);
  if (game.cutscene) { updateCutscene(dt); return; }
  if (game.transition) { updateTransition(dt); updateCamera(dt); return; }
  if (game.rest) { updateRest(dt); updateCoinFx(dt); updateCamera(dt); return; }
  updateArena();
  updateTrainerMeet();
  if (!game.arena && !game.tutorial && game.mode === 'play') {
    const npc = nearNpc();
    const d = game.doorNear;
    const near = nearChest();
    hint(near ? (near.pick ? `E — взять: ${ITEMS[near.pick].name}` : 'E — открыть сундук') : npc ? `E — ${npc.def.shop ? 'лавка' : 'говорить'}: ${npc.def.name}` : d ? (d.locked ? `${d.locked}` : d.fall ? `W — ${d.name}` : `W у двери — войти: ${d.name ?? 'дверь'}`) : nearAltar() ? (game.flags[nearAltar().altar] ? 'E — осмотреть: алтарь' : hasItem('silver_cup') ? 'E — поставить Серебряную чашу на алтарь' : 'E — осмотреть: алтарь') : nearRest() ? `E — отдохнуть ${nearRest().rest.name} (сохранение)` : nearLook() ? `E — осмотреть: ${nearLook().name}${nearLook().type === 'cracks' ? ' · ЛКМ — ударить' : ''}` : hintWalk());
  }
  updateToken();
  pickTarget();
  const cur = game.current?.alive ? game.current : null;

  // куда смотрит рыцарь: в бою — на врага, иначе — куда идёт
  const free = p.state === 'ready';
  if (cur && free) {
    // враг за спиной: стрелка в его сторону разворачивает сразу, иначе — с задержкой
    const want = Math.sign(cur.x - p.x) || p.facing;
    if (want === p.facing) game.turnT = 0;
    else {
      game.turnT = (game.turnT ?? 0) + dt;
      if (held(want > 0 ? 'right' : 'left') || game.turnT >= CONFIG.autoTurn) {
        p.facing = want;
        game.turnT = 0;
      }
    }
  }
  else if (!cur && free) {
    if (held('left') && !held('right')) p.facing = -1;
    else if (held('right') && !held('left')) p.facing = 1;
  }
  updateView(dt, !!cur);

  updateCharge();
  updateCoinFx(dt);
  updateAmbience(dt);
  p.update(dt, controls());
  // на бегу из-под ступни, которая встала на пол, — облачко пыли
  const fall = Math.floor(p.step * 2);
  if (p.walking && p.state === 'ready' && (p.gaitRun ?? 0) > 0.6 && fall !== p.lastFall) {
    const fx = p.x + p.facing * 8;
    for (let i = 0; i < 3; i++) game.particles.push({
      x: fx + (Math.random() - 0.5) * 4, y: groundY(p.z) - 1,
      vx: -p.facing * (10 + Math.random() * 25), vy: -6 - Math.random() * 14,
      life: 0.2 + Math.random() * 0.15, color: i % 2 ? '#6b6377' : '#4f4868',
    });
  }
  p.lastFall = fall;
  handlePlayerEvents();
  updatePickups(dt);
  for (const n of game.npcs) if (Math.abs(n.x - p.x) < 80) n.facing = Math.sign(p.x - n.x) || n.facing;

  for (const e of game.enemies) {
    if ((e.state === 'dead' && e.t > 2) || e.state === 'gone') continue;
    e.update(dt, world);
    if (!e.alive && !e.paid && e.state !== 'leave' && COINS[e.type]) payCoins(e);
  }
  game.wardFlash = Math.max(0, game.wardFlash - dt);
  updateArrows(dt);

  // тела не проходят друг сквозь друга (если стоят на одной линии по глубине)
  const solids = game.enemies.filter(e => e.solid && e.type !== 'dummy');  // сквозь чучело можно пройти
  for (const e of solids) {
    if (p.state === 'swallowed' || p.airY > 4 || Math.abs(e.z - p.z) >= 8) continue;  // в прыжке — над врагом
    const d = e.x - p.x;
    if (Math.abs(d) < CONFIG.bodyGap) p.x = e.x - (Math.sign(d) || p.facing) * CONFIG.bodyGap;
  }
  for (const a of solids) for (const b of solids) {
    if (a === b || Math.abs(a.z - b.z) >= 8) continue;
    const d = b.x - a.x;
    if (Math.abs(d) < CONFIG.bodyGap) {
      const push = (CONFIG.bodyGap - Math.abs(d)) / 2 * (Math.sign(d) || 1);
      a.x -= push;
      b.x += push;
    }
  }
  const L = room().length;
  let lo = 8, hi = L - 8;
  if (game.arena) [lo, hi] = arenaBounds();
  else if (game.tutorial) {
    // на обучении от наставницы далеко не уйти
    const t = trainer();
    if (t) [lo, hi] = [Math.max(16, t.homeX - 170), Math.min(L - 16, t.homeX + 170)];
  } else {
    // где нет прохода, стена
    const edges = room().edges ?? {};
    if (!edges.left) lo = 16;
    if (!edges.right) hi = room().limitRight ?? L - 16;
  }
  p.x = Math.max(lo, Math.min(hi, p.x));
  if (game.arena) for (const e of game.enemies) {
    if (e.group === game.arena.index && e.state !== 'flee' && e.state !== 'yield') e.x = Math.max(lo - 10, Math.min(hi + 10, e.x));
  }
  updateDoors(dt);
  updateEdges();

  if (p.hp <= 0 && p.state !== 'swallowed') die();
  else if (room().finish && (room().encounters ?? []).every((_, i) => game.cleared.has(encKey(game.room, i))) && p.x > L - 60) finish();

  updateCamera(dt);
}

function updateCamera(dt) {
  const p = game.player;
  const L = room().length;
  const target = game.arena ? game.arena.x - W / 2 : p.x - (p.facing > 0 ? 120 : 200);
  const clamped = Math.max(0, Math.min(L - W, target));
  game.camX += (clamped - game.camX) * Math.min(1, dt * 5);
}

// пылинки в тёмной комнате медленно плывут
function updateMotes(dt) {
  for (const m of game.motes) {
    m.y -= m.v * dt * 0.4;
    m.x += Math.sin(game.time * 0.7 + m.ph) * dt * 3;
    if (m.y < -2) { m.y = H + 2; m.x = Math.random() * W; }
  }
}

// Зажатая ЛКМ вверху с рапирой: отпустил быстро — захлёст, держал дольше chargeTime — прыжок через врага.
function updateCharge() {
  const c = game.charge;
  if (!c) return;
  const p = game.player;
  if (p.weapon !== 'rapier' || !p.ready) { game.charge = null; return; }
  const heldFor = game.time - c.t;
  if (!held('attack')) {
    game.charge = null;
    p.requestAttack('up', false);
    return;
  }
  if (heldFor < WEAPONS.rapier.chargeTime) return;
  game.charge = null;
  const cur = game.current?.alive ? game.current : null;
  const target = cur && Math.abs(cur.x - p.x) < 70 && Math.sign(cur.x - p.x) === p.facing ? cur.x : p.x + p.facing * 44;
  if (!p.requestVault(target)) {
    callout('Прыжок не готов', 'muted');
    p.requestAttack('up', false);
  }
}

// Враг побеждён — монеты летят к рыцарю.
function payCoins(e) {
  e.paid = true;
  if (e.def.skull) sparks(e.x, groundY(e.z) - 16, 10, ['#e6e1d0', '#a39d8a', '#c8c2b0'], 90);  // кости брызнули
  seen(e.type).kills++;
  const n = COINS[e.type];
  game.coins += n;  // в сохранение — сразу; счётчик в HUD растёт, когда монета долетает
  game.stats.coinsEarned += n;
  sparks(e.x, groundY(e.z) - 14, 4, [PAL.gold, '#fff4c2'], 50);
  const gy = groundY(e.z);
  for (let i = 0; i < n; i++) {
    game.coinFx.push({ x: e.x, y: gy - 14, gy, vx: (Math.random() * 2 - 1) * 55, vy: -90 - Math.random() * 60, t: 0, wait: 0.55 + i * 0.07, fly: null });
  }
}

// монеты: подпрыгивают на полу, потом по одной летят в счётчик (левый верх экрана)
const COIN_TARGET = { x: 46, y: 28 };
function updateCoinFx(dt) {
  for (const c of game.coinFx) {
    c.t += dt;
    if (!c.fly) {
      c.vy += 420 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y > c.gy) {
        c.y = c.gy;
        if (Math.abs(c.vy) > 40) sfx.clink();
        c.vy *= -0.4;
        c.vx *= 0.6;
      }
      if (c.t >= c.wait) c.fly = { k: 0, sx: c.x - game.camX, sy: c.y };
    } else {
      c.fly.k += dt * 2.4;
      if (c.fly.k >= 1) {
        c.done = true;
        game.coinsShown = Math.min(game.coins, game.coinsShown + 1);
        sfx.coin(game.coinsShown % 4);
        ui.weapon.classList.remove('gain');
        void ui.weapon.offsetWidth;
        ui.weapon.classList.add('gain');
      }
    }
  }
  game.coinFx = game.coinFx.filter(c => !c.done);
  if (!game.coinFx.length) game.coinsShown = game.coins;  // всё долетело (или покупка, загрузка) — счётчик честный
}

function coinAt(x, y, t) {
  // вращается: ширина 3 → 2 → 1 → 2
  const w = [3, 2, 1, 2][Math.floor(t * 12) % 4];
  rect(g, Math.round(x - w / 2), Math.round(y - 3), w, 3, PAL.gold);
  if (w > 1) rect(g, Math.round(x - w / 2), Math.round(y - 3), 1, 1, '#fff4c2');
  rect(g, Math.round(x - w / 2), Math.round(y - 1), w, 1, '#a8822e');
}

function renderCoinFx(cam) {
  for (const c of game.coinFx) {
    if (!c.fly) { coinAt(c.x - cam, c.y, c.t); continue; }
    const k = ease(c.fly.k);
    const x = c.fly.sx + (COIN_TARGET.x - c.fly.sx) * k;
    const y = c.fly.sy + (COIN_TARGET.y - c.fly.sy) * k - Math.sin(Math.PI * c.fly.k) * 24;
    coinAt(x, y, c.t);
  }
}

// ---------- снаряжение и сумка ----------

// предмет надет или лежит в сумке
const owns = id => game.bag.includes(id) || Object.values(game.equip).includes(id);

// Надеть предмет из сумки в его слот; что было надето — в сумку. Возвращает true, если надето.
function equipItem(id) {
  const item = ITEMS[id];
  const i = game.bag.indexOf(id);
  if (!item?.slot || i < 0) return false;
  const p = game.player;
  if (item.slot === 'weapon' && !(p.ready || p.state === 'attack')) return false;
  game.bag.splice(i, 1);
  const prev = game.equip[item.slot];
  if (prev) game.bag.push(prev);
  game.equip[item.slot] = id;
  if (item.slot === 'weapon') {
    p.setWeapon(item.weapon);
    game.charge = null;
    game.blockStreak = 0;
  }
  return true;
}

// Снять амулет, заклинание или навык (оружие и броню не снять — можно только заменить)
function unequip(slot) {
  if (slot === 'weapon' || slot === 'armor' || !game.equip[slot]) return;
  game.bag.push(game.equip[slot]);
  game.equip[slot] = null;
}

function useItem(id) {
  const item = ITEMS[id];
  const p = game.player;
  if (!item?.use) return false;
  if (item.use.heal && p.hp >= CONFIG.playerHp) { callout('Здоровье полное', 'muted'); return false; }
  game.bag.splice(game.bag.indexOf(id), 1);
  const heal = Math.min(item.use.heal ?? 0, CONFIG.playerHp - p.hp);
  p.hp += heal;
  renderHearts();
  game.stats.potions++;
  sparks(p.x, groundY(p.z) - 20, 10, ['#7bd88f', '#d4ffd9'], 50);
  sfx.ward();
  callout(`${item.name}  +${heal} ♥`, 'perfect');
  return true;
}

// H — выпить: при большой ране — зелье, при малой — бинт
function drinkPotion() {
  const p = game.player;
  if (!p.ready) return;
  const lost = CONFIG.playerHp - p.hp;
  const order = lost >= 2 ? ['potion', 'bandage'] : ['bandage', 'potion'];
  const id = order.find(x => game.bag.includes(x));
  if (!id) { callout('Нет зелий — купи у Лики', 'muted'); return; }
  useItem(id);
}

// Колесо вниз — навык из слота: приём боя (движение), у навыка своё оружие и перезарядка
function useSkill() {
  const id = game.equip.skill;
  if (!id) { callout('Навыка нет — свиток у Лики', 'muted'); return; }
  const skill = ITEMS[id];
  const p = game.player;
  if (skill.need && p.weapon !== skill.need) { callout(`${skill.name}: нужна ${skill.need === 'rapier' ? 'рапира' : 'другое оружие'}`, 'muted'); return; }
  if (game.time < game.skillReadyAt) { callout(`${skill.name} не готов`, 'muted'); return; }
  if (!p.ready) return;
  p.startAttack(skill.attack);
  game.skillReadyAt = game.time + skill.cooldown;
  game.stats.skill++;
  callout(skill.name, 'muted');
}

// Прочитать свиток: выучить навык (если есть нужное оружие) и сразу поставить в слот
function readScroll(id) {
  const scroll = ITEMS[id];
  const skill = ITEMS[scroll.learn];
  if (skill.need && !owns(skill.need)) { callout(`Непонятно без оружия: нужна ${skill.need === 'rapier' ? 'рапира' : 'другое оружие'}`, 'muted'); return false; }
  game.bag.splice(game.bag.indexOf(id), 1);
  game.bag.push(scroll.learn);
  equipItem(scroll.learn);
  sfx.perfect();
  callout(`Выучен навык: ${skill.name} (колесо вниз)`, 'perfect');
  return true;
}

// Окно снаряжения: слева — надетое, справа — сумка, внизу — описание
function openEquip() {
  if (game.mode !== 'play' || game.transition || game.cutscene) return;
  game.mode = 'equip';
  game.equipSel = null;
  ui.equip.hidden = false;
  renderEquip();
}
function closeEquip() {
  ui.equip.hidden = true;
  game.mode = 'play';
  save();
}

function bagStacks() {
  const out = [];
  for (const id of game.bag) {
    const s = out.find(x => x.id === id);
    if (s) s.n++;
    else out.push({ id, n: 1 });
  }
  return out;
}

function renderEquip() {
  ui.equipSlots.innerHTML = '';
  for (const [slot, label] of SLOTS) {
    const id = game.equip[slot];
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="equip-slot">${label}</span><span>${id ? ITEMS[id].name : '—'}</span>`;
    b.addEventListener('pointerenter', () => showEquipDesc(id));
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); unequip(slot); renderEquip(); });
    ui.equipSlots.appendChild(b);
  }
  ui.equipBag.innerHTML = '';
  const stacks = bagStacks();
  if (!stacks.length) ui.equipBag.innerHTML = '<p class="equip-empty">Пусто</p>';
  stacks.forEach((s, i) => {
    const item = ITEMS[s.id];
    const b = document.createElement('button');
    b.type = 'button';
    const what = item.slot ? 'надеть' : item.use ? 'использовать' : item.learn ? 'прочитать' : item.journal ? 'открыть' : '';
    b.innerHTML = `<span>${i + 1}. ${item.name}${s.n > 1 ? ' ×' + s.n : ''}</span><span class="equip-act">${what}</span>`;
    b.addEventListener('pointerenter', () => showEquipDesc(s.id));
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); bagAction(s.id); });
    ui.equipBag.appendChild(b);
  });
  ui.equipCoins.textContent = `Монеты: ${game.coins}`;
}

function showEquipDesc(id) {
  ui.equipDesc.textContent = id ? `${ITEMS[id].name}. ${(ITEM_TEXTS[id] ?? '').replace('[черновик] ', '')}` : '';
}

function bagAction(id) {
  const item = ITEMS[id];
  if (item.slot) equipItem(id);
  else if (item.use) useItem(id);
  else if (item.learn) readScroll(id);
  else if (item.journal) { closeEquip(); openJournal(); return; }
  showEquipDesc(id);
  renderEquip();
}

function equipPress(code) {
  if (code === 'Escape' || code === 'KeyI') { closeEquip(); return; }
  const m = /^Digit([1-9])$/.exec(code);
  const s = m && bagStacks()[Number(m[1]) - 1];
  if (s) bagAction(s.id);
}

// ---------- журнал (бестиарий) ----------

// запись о враге: встречен ли и сколько побеждено
function seen(type) {
  if (!BESTIARY[type]) return { kills: 0 };
  const rec = (game.bestiary[type] ??= { kills: 0 });
  if (!rec.noted && owns('journal')) {
    rec.noted = true;
    callout(`Журнал: новая запись — ${ENEMY_TYPES[type].shortName ?? ENEMY_TYPES[type].name}`, 'muted');
  }
  return rec;
}

// B — журнал; нужен журнал от Лики (встреченные до покупки враги туда тоже попадают)
// ---------- карта замка ----------
function openMap() {
  if (!owns('map')) { callout('Нужна карта — её продаёт Лика', 'muted'); return; }
  if (game.mode !== 'play' || game.transition || game.cutscene || game.arena) return;
  game.mode = 'map';
  game.mapFloor = room().floor ?? 1;
  hint('');
  ui.box.classList.add('mapping');
}
function mapPress(code) {
  if (code === 'KeyM' || code === 'Escape' || code === 'Enter') { game.mode = 'play'; ui.box.classList.remove('mapping'); return; }
  if (code === 'KeyA' || code === 'ArrowLeft') game.mapFloor = Math.max(1, game.mapFloor - 1);
  if (code === 'KeyD' || code === 'ArrowRight') game.mapFloor = Math.min(3, game.mapFloor + 1);
}
function renderMap() {
  const f = game.mapFloor, U = 6, X0 = 14, Y0 = 26;
  // пергамент
  rect(g, 8, 12, 304, 156, '#5a4632');
  rect(g, 10, 14, 300, 152, '#d8c8a0');
  rect(g, 12, 16, 296, 148, '#e0d2ac');
  for (let i = 0; i < 40; i++) rect(g, 14 + (i * 73) % 290, 18 + (i * 37) % 140, 2, 1, '#cbb98e');  // пятна
  g.fillStyle = '#5a4632';
  g.font = '7px monospace';
  g.textBaseline = 'top';
  g.fillText(`Этаж ${f}${(room().floor ?? 1) === f ? ' · ' + room().name : ''}`, 18, 18);
  g.fillText('M — закрыть · A / D — этаж', 186, 156);
  const seen = id => game.flags['map_' + id];
  const box = id => { const [ff, x, y, w] = MAP[id]; return ff === f ? { x: X0 + x * U, y: Y0 + y * U, w: w * U } : null; };
  // переходы: края — рядом, двери — линия вверх к комнате
  for (const [id, r] of Object.entries(ROOMS)) {
    const a = MAP[id] && box(id);
    if (!a || !seen(id)) continue;
    for (const d of r.doors ?? []) {
      const b = d.to && MAP[d.to] && box(d.to);
      if (!b || !seen(d.to) || b.w >= a.w) continue;  // линию рисует коридор — к боковой комнате, один раз
      const dx = a.x + (d.x / r.length) * a.w;
      rect(g, Math.round(dx), Math.min(a.y, b.y + U), 1, Math.abs(a.y - (b.y + U)) || 1, '#8a7a58');
    }
  }
  // края на разной высоте — лестница: ступеньки от конца одной комнаты к началу другой
  for (const [id, r] of Object.entries(ROOMS)) {
    const a = MAP[id] && box(id), e = r.edges?.right;
    const b = e && MAP[e.to] && box(e.to);
    if (!a || !b || !seen(id) || !seen(e.to) || a.y === b.y) continue;
    const x = Math.round(a.x + a.w), top = Math.min(a.y, b.y) + U, bot = Math.max(a.y, b.y);
    for (let y = top; y < bot; y += 2) rect(g, x - 1 + ((y - top) % 4 ? 1 : 0), y, 2, 1, '#8a7a58');
  }
  for (const id of Object.keys(MAP)) {
    const b = box(id);
    if (!b || !seen(id)) continue;
    rect(g, Math.round(b.x), b.y, Math.round(b.w), U, '#5a4632');
    rect(g, Math.round(b.x) + 1, b.y + 1, Math.round(b.w) - 2, U - 2, id === game.room ? '#c8b07a' : '#b8a478');
    const r = ROOMS[id];
    // отметки: место отдыха — огонёк, лавка — монета
    for (const s of [...(r.props ?? []), ...(r.decor ?? [])]) if (s.rest) {
      const sx = Math.round(b.x + (s.x / r.length) * b.w);
      rect(g, sx, b.y + 1, 2, 3, '#e06030'); rect(g, sx, b.y + 1, 1, 1, '#ffd070');
    }
    if (r.npcs?.some(n => NPC_TYPES[n.type]?.shop)) rect(g, Math.round(b.x + b.w / 2), b.y + 2, 2, 2, PAL.gold);
    // неоткрытый сундук — коричневый квадратик с золотой точкой
    for (const pr of r.props ?? []) if (pr.type === 'chest' && !game.flags[`chest_${id}_${pr.id}`]) {
      const cx = Math.round(b.x + (pr.x / r.length) * b.w) - 1;
      rect(g, cx, b.y + 2, 3, 2, '#6b4532'); rect(g, cx + 1, b.y + 2, 1, 1, PAL.gold);
    }
  }
  // Найт — красная точка, мигает
  const me = box(game.room);
  if (me && Math.floor(game.time * 0 + performance.now() / 300) % 2 === 0) {
    const px = Math.round(me.x + (game.player.x / room().length) * me.w);
    rect(g, px - 1, me.y + 1, 3, U - 2, '#c8303f');
  }
}

function openJournal() {
  if (!owns('journal')) { callout('Нужен журнал — его продаёт Лика', 'muted'); return; }
  if (game.mode !== 'play' || game.transition || game.cutscene) return;
  game.mode = 'journal';
  const types = Object.keys(BESTIARY).filter(t => game.bestiary[t]);
  game.journalSel = types[0] ?? null;
  ui.journal.hidden = false;
  renderJournal();
}
function closeJournal() {
  ui.journal.hidden = true;
  game.mode = 'play';
}

const journalCtx = ui.journalFig.getContext('2d');
journalCtx.imageSmoothingEnabled = false;

function renderJournal() {
  const types = Object.keys(BESTIARY).filter(t => game.bestiary[t]);
  ui.journalList.innerHTML = '';
  if (!types.length) ui.journalList.innerHTML = '<p class="equip-empty">Пока пусто — встреть врага.</p>';
  types.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = t === game.journalSel ? 'sel' : '';
    b.innerHTML = `<span>${i + 1}. ${ENEMY_TYPES[t].shortName ?? ENEMY_TYPES[t].name}</span><span class="equip-act">×${game.bestiary[t].kills}</span>`;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); game.journalSel = t; renderJournal(); });
    ui.journalList.appendChild(b);
  });
  const t = game.journalSel;
  ui.journalPage.hidden = !t;
  if (!t) return;
  const d = ENEMY_TYPES[t], page = BESTIARY[t];
  ui.journalName.textContent = d.name;
  ui.journalHow.textContent = page.how;
  ui.journalWin.textContent = page.win;
  ui.journalLore.textContent = page.lore.replace('[черновик] ', '');
  ui.journalKills.textContent = `Побеждено: ${game.bestiary[t].kills}`;
  // рисунок врага
  journalCtx.clearRect(0, 0, 48, 48);
  journalCtx.fillStyle = '#1e1a2b';
  journalCtx.fillRect(0, 0, 48, 48);
  if (d.kind === 'slime') drawSlime(journalCtx, { x: 24, ground: 40, airY: 0, size: 1.4, squash: 0, colors: d.colors, facing: -1 });
  else drawFigure(journalCtx, {
    x: 26, ground: 44, facing: -1, pose: POSES.idle, colors: d.colors, weaponLen: d.weapon ?? 17,
    skull: d.skull, shield: d.shield, bow: d.kind === 'archer', crossbow: d.crossbow, bowDraw: d.crossbow ? 1 : 0, face: t === 'duelist', rapier: t === 'duelist', robe: d.robe,
    bandit: d.bandit, axe: d.axe, plate: d.plate, spear: d.spear, halberd: d.halberd,
  });
}

function journalPress(code) {
  if (code === 'Escape' || code === 'KeyB') { closeJournal(); return; }
  const types = Object.keys(BESTIARY).filter(t => game.bestiary[t]);
  const m = /^Digit([1-9])$/.exec(code);
  if (m && types[Number(m[1]) - 1]) { game.journalSel = types[Number(m[1]) - 1]; renderJournal(); }
  if (code === 'ArrowDown' || code === 'ArrowUp' || code === 'KeyS' || code === 'KeyW') {
    const i = types.indexOf(game.journalSel) + (code === 'ArrowDown' || code === 'KeyS' ? 1 : -1);
    if (types[i]) { game.journalSel = types[i]; renderJournal(); }
  }
}

// Выбитое оружие лежит на полу: подошёл — подобрал.
function updatePickups(dt) {
  const p = game.player;
  for (const it of game.pickups) {
    if ((it.room ?? 'hall') !== game.room) continue;
    it.t += dt;
    if (it.taken || it.t < 0.6) continue;
    if (Math.abs(it.x - p.x) < 10 && Math.abs(it.z - p.z) < 8) {
      it.taken = true;
      game.unlocked.add(it.kind);
      if (!owns(it.kind)) game.bag.push(it.kind);  // вторая рапира не нужна
      equipItem(it.kind);
      callout('Рапира! Q — сменить оружие, I — снаряжение', 'perfect');
      setTimeout(save, 0);
      sfx.perfect();
    }
  }
  game.pickups = game.pickups.filter(it => !it.taken);
}

function updateArrows(dt) {
  const p = game.player;
  for (const a of game.arrows) {
    a.life -= dt;
    if (a.stuck) continue;
    a.x += a.vx * dt;
    a.z = Math.max(0, Math.min(CONFIG.depth, a.z + (a.vz ?? 0) * dt));
    if (!a.falling && !a.arc) a.y = clashY(a.height, a.z);
    if (a.falling || a.arc) {
      a.vy += ARROW_G * dt;
      a.y += a.vy * dt;
      if (a.y >= groundY(a.z) - 1) {
        // воткнулась в пол
        a.y = groundY(a.z) - 1;
        a.stuck = true;
        a.life = Math.min(a.life, 1);
        continue;
      }
      if (a.falling) continue;
    }
    const close = Math.abs(a.x - p.x) <= (a.arc ? 6 : 5) && Math.abs(a.z - p.z) <= CONFIG.depthReach - 3 && (!a.arc || a.y >= clashY('high', p.z) - 6);
    if (!a.resolved && close) {
      a.resolved = true;
      const result = applyImpact(a.height, a.damage, a.x - Math.sign(a.vx) * 20, false, false, false, a.who);
      if (result === 'perfect' || result === 'block' || result === 'warded') {
        a.falling = true;
        a.arc = false;
        a.vx = -a.vx * 0.3;
        a.vy = -60;
      } else if (result === 'hit') {
        a.life = 0;
      }
    }
  }
  game.arrows = game.arrows.filter(a => a.life > 0 && a.y < H);
  for (const w of game.waves) w.t += dt;
  game.waves = game.waves.filter(w => w.t < 0.35);
}

function updateFx(dt) {
  game.shake = Math.max(0, game.shake - dt * 12);
  game.flash = Math.max(0, game.flash - dt * 3);
  for (const s of game.particles) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 300 * dt;
    s.life -= dt;
  }
  game.particles = game.particles.filter(s => s.life > 0);
}

function step(dt) {
  updateFx(dt);
  if (game.mode === 'shop' || game.mode === 'equip' || game.mode === 'journal') {
    for (const code of input.take()) handlePress(code);
    if (game.mode === 'shop') tickShop(dt);
    return;
  }
  if (game.mode === 'talk') {
    for (const code of input.take()) handlePress(code);
    tickTalk(dt);
    return;
  }
  if (game.hitstop > 0) { game.hitstop -= dt; return; }
  update(dt);
}

// ---------- диалоги ----------

const portraitCtx = ui.talkPortrait.getContext('2d');
// Нарисованные портреты владельца: у реплики можно указать mood (настроение), иначе — default.
const FACES = {
  knight: { default: 'assets/portraits/knight.png', tired: 'assets/portraits/knight-tired.png', nohelm: 'assets/portraits/knight-nohelm.png' },
  ilia: { default: 'assets/portraits/ilia.png' },
  lika: Object.fromEntries(['default', 'happy', 'sly', 'surprised', 'sulky', 'serious', 'worried', 'angry']
    .map(m => [m, m === 'default' ? 'assets/portraits/lika.png' : `assets/portraits/lika-${m}.png`])),
};
for (const set of Object.values(FACES)) for (const src of Object.values(set)) new Image().src = src;  // загрузить заранее

const PORTRAITS = {
  knight: { colors: KNIGHT_COLORS, plume: true },
  ilia: { colors: ENEMY_TYPES.duelist.colors, face: true, rapier: true, robe: true },
  trainer: { colors: ENEMY_TYPES.trainer.colors, bun: true, ornate: true, robe: true, slim: true },
  lika: { ...NPC_TYPES.lika },
};

// after — что сделать, когда разговор закончится (или сразу, если диалоги выключены)
function startTalk(id, after = null) {
  if (!CONFIG.dialogues || !DIALOGUES[id]) { after?.(); return; }
  game.flags['seen_' + id] = true;
  game.afterTalk = after;
  game.talk = new DialogueRunner(DIALOGUES, game.flags);
  game.talk.start(id);
  game.talkShown = 0;
  game.resumeMode = game.mode === 'talk' ? game.resumeMode : game.mode;
  game.mode = 'talk';
  showLine();
}

function showLine() {
  const line = game.talk?.current;
  if (!line) {
    ui.talk.hidden = true;
    game.talk = null;
    game.mode = game.resumeMode === 'title' ? 'play' : (game.resumeMode ?? 'play');
    const after = game.afterTalk;
    game.afterTalk = null;
    after?.();
    return;
  }
  const who = SPEAKERS[line.who] ?? SPEAKERS.narrator;
  ui.talk.hidden = false;
  ui.talkName.textContent = who.name;
  const face = FACES[who.portrait];
  ui.talkFace.hidden = !face;
  if (face) {
    const src = face[line.mood] ?? face.default;
    if (!ui.talkFace.src.endsWith(src)) ui.talkFace.src = src;
  }
  ui.talkPortrait.hidden = !who.portrait || !!face;
  if (who.portrait && !face) {
    portraitCtx.clearRect(0, 0, 16, 16);
    portraitCtx.fillStyle = '#1e1a2b';
    portraitCtx.fillRect(0, 0, 16, 16);
    drawFigure(portraitCtx, { x: 7, ground: 40, facing: 1, pose: POSES.idle, bladeHidden: true, ...PORTRAITS[who.portrait] });
  }
  game.talkShown = 0;
  ui.talkText.textContent = '';
  ui.talkChoices.innerHTML = '';
  ui.talkNext.hidden = !!line.choices;
  if (line.choices) {
    line.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${i + 1}. ${c.text}`;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); chooseTalk(i); });
      ui.talkChoices.appendChild(b);
    });
  }
}

// текст печатается по буквам; нажатие во время печати показывает строку целиком
function tickTalk(dt) {
  const line = game.talk?.current;
  if (!line || !line.text) return;
  if (game.talkShown < line.text.length) {
    game.talkShown = Math.min(line.text.length, game.talkShown + dt * 45);
    ui.talkText.textContent = line.text.slice(0, Math.floor(game.talkShown));
  }
}

function advanceTalk() {
  const line = game.talk?.current;
  if (!line) return;
  if (line.choices) return;
  if (line.text && game.talkShown < line.text.length) {
    game.talkShown = line.text.length;
    ui.talkText.textContent = line.text;
    return;
  }
  game.talk.advance();
  showLine();
}

function chooseTalk(i) {
  const line = game.talk?.current;
  if (!line?.choices?.[i]) return;
  game.talk.choose(i);
  showLine();
}

// ---------- лавка ----------
// Как в Undertale: продавец, его реплика и меню «Купить / Поговорить / Уйти».

const shopCtx = ui.shopPortrait.getContext('2d');
shopCtx.imageSmoothingEnabled = false;

function openShop(npc) {
  const data = SHOPS[npc.def.shop];
  if (!data) return;
  game.shop = { npc, data, view: 'main', text: data.hello, shown: 0, mood: data.moods?.hello };
  game.mode = 'shop';
  // нарисованный портрет, если есть; иначе — пиксельная заглушка
  const face = FACES[npc.def.face]?.default;
  ui.shopFace.hidden = !face;
  ui.shopPortrait.hidden = !!face;
  if (face) shopFace();
  else drawLikaPortrait(shopCtx, npc.def.colors);
  ui.shopName.textContent = npc.def.name;
  ui.shop.hidden = false;
  hint('');
  renderShop();
}

function closeShop() {
  game.shop.text = game.shop.data.bye;
  ui.shop.hidden = true;
  callout(game.shop.data.bye.replace('[черновик] ', ''), 'muted');
  game.shop = null;
  game.mode = 'play';
}

// следующая реплика темы: Найт (knight: true) или Лика с выражением лица
function nextShopLine() {
  const sh = game.shop;
  const line = sh.queue.shift();
  if (!line) return;
  const text = typeof line === 'string' ? line : line.text;
  if (line.knight) shopSay(`Найт: ${text}`, line.mood);  // Лика слушает с обычным лицом
  else shopSay(text, line.mood);
  renderShop();
}

// реплика продавца; mood — выражение лица на портрете (без него — обычное)
function shopSay(text, mood = null) {
  game.shop.text = text;
  game.shop.shown = 0;
  game.shop.mood = mood;
  shopFace();
}

function shopFace() {
  const set = FACES[game.shop.npc.def.face];
  if (!set) return;
  const src = set[game.shop.mood] ?? set.default;
  if (!ui.shopFace.src.endsWith(src)) ui.shopFace.src = src;
}

function shopView(view) {
  game.shop.view = view;
  game.shop.queue = null;
  shopSay(game.shop.data.menu);
  renderShop();
}

function shopOptions() {
  const sh = game.shop, d = sh.data;
  const back = { label: 'Назад', go: () => shopView('main') };
  if (sh.view === 'buy') return [
    ...d.items.map(it => {
      const item = ITEMS[it.id];
      const have = onceOwned(it.id);
      return { label: item.name, right: have ? 'есть' : `${item.price} мон.`, muted: have || it.soon || item.price > game.coins, hover: it.text, mood: d.moods?.item, go: () => buyItem(it) };
    }),
    back,
  ];
  if (sh.view === 'talk') {
    // идёт разговор по теме — только «Дальше», пока не кончатся реплики
    if (sh.queue?.length) return [{ label: 'Дальше ▸', go: nextShopLine }];
    // need — тема появляется после события (флаг), например после боя с Илиа
    return [...d.talk.filter(t => !t.need || game.flags[t.need]).map(t => ({ label: t.topic, go: () => { sh.queue = t.lines.slice(); nextShopLine(); } })), back];
  }
  return [
    { label: 'Купить', go: () => shopView('buy') },
    { label: 'Поговорить', go: () => shopView('talk') },
    { label: 'Уйти', go: closeShop },
  ];
}

// вещь берут один раз (снаряжение, журнал, свиток, артефакт): уже есть — второй не продают
function onceOwned(id) {
  const item = ITEMS[id];
  return !!(item.slot || item.journal || item.learn || item.artifact || item.weapon || item.once) && (owns(id) || (item.learn && owns(item.learn)));
}

function buyItem(it) {
  const d = game.shop.data, item = ITEMS[it.id];
  if (it.soon) return shopSay(d.soon, d.moods?.soon);
  if (onceOwned(it.id)) return shopSay(d.owned, d.moods?.soon);
  if (item.price > game.coins) return shopSay(d.poor, d.moods?.poor);
  game.coins -= item.price;
  game.bag.push(it.id);
  // амулет надевается сразу, если слот пуст
  const worn = item.slot && !game.equip[item.slot] && equipItem(it.id);
  sfx.perfect();
  shopSay(d.bought + (worn ? '  (надето)' : item.use ? '  (в сумке, H — использовать)' : ''), d.moods?.bought);
  renderShop();
  save();
}

function renderShop() {
  ui.shopCoins.textContent = `Монеты: ${game.coins}`;
  ui.shopMenu.innerHTML = '';
  shopOptions().forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = o.muted ? 'muted' : '';
    b.innerHTML = `<span>${i + 1}. ${o.label}</span>${o.right ? `<span>${o.right}</span>` : ''}`;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); o.go(); });
    if (o.hover) b.addEventListener('pointerenter', () => shopSay(o.hover, o.mood));
    ui.shopMenu.appendChild(b);
  });
}

function shopPress(code) {
  if ((code === 'Enter' || code === 'Space' || code === 'Mouse0') && game.shop.queue?.length) {
    // пока печатается — показать строку целиком, потом — следующая
    if (game.shop.shown < game.shop.text.length) game.shop.shown = game.shop.text.length;
    else nextShopLine();
    return;
  }
  if (code === 'Escape' || code === 'Backspace') {
    if (game.shop.view === 'main') closeShop();
    else shopView('main');
    return;
  }
  const m = /^Digit([1-9])$/.exec(code);
  if (!m) return;
  const o = shopOptions()[Number(m[1]) - 1];
  if (!o) return;
  if (o.hover && game.shop.text !== o.hover) shopSay(o.hover, o.mood);  // с клавиатуры: сначала описание, потом покупка
  else o.go();
}

// реплика печатается по буквам
function tickShop(dt) {
  const sh = game.shop;
  if (!sh) return;
  if (sh.shown < sh.text.length) {
    sh.shown = Math.min(sh.text.length, sh.shown + dt * 50);
    ui.shopText.textContent = sh.text.slice(0, Math.floor(sh.shown));
  } else if (ui.shopText.textContent !== sh.text) ui.shopText.textContent = sh.text;
}

// ---------- эффекты ----------

function sparks(x, y, n, colors, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    game.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      life: 0.2 + Math.random() * 0.25, color: colors[i % colors.length],
    });
  }
}

function dust(x, y0, dir) {
  for (let i = 0; i < 8; i++) {
    game.particles.push({
      x: x + (Math.random() - 0.5) * 10, y: y0 - 1,
      vx: dir * (20 + Math.random() * 50), vy: -20 - Math.random() * 40,
      life: 0.25 + Math.random() * 0.2, color: i % 2 ? '#6b6377' : '#4f4868',
    });
  }
}

function shake(amount) { if (!reduceMotion) game.shake = Math.max(game.shake, amount); }
function flash(color, amount) { game.flashColor = color; game.flash = amount; }

function callout(text, kind) {
  const el = ui.callout;
  el.textContent = text;
  el.className = 'callout ' + kind;
  void el.offsetWidth;
  el.classList.add('show');
}

function hint(text) {
  if (!text) { ui.hint.hidden = true; ui.hint.textContent = ''; return; }
  if (ui.hint.textContent === text && !ui.hint.hidden) return;
  ui.hint.textContent = text;
  ui.hint.hidden = false;
}

function showOverlay(title, text, press) {
  ui.overlay.classList.remove('title');
  ui.overlayText.classList.remove('controls');
  game.controlsBack = null;
  setMenu([]);
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.overlayPress.textContent = press;
  ui.overlay.hidden = false;
}
function hideOverlay() {
  ui.overlay.hidden = true;
  ui.reportBtn.hidden = true;
  ui.reportText.hidden = true;
  ui.reportBtn.textContent = 'Скопировать отчёт для тестера';
}

function renderHearts() {
  const p = game.player;
  ui.hearts.innerHTML = Array.from({ length: CONFIG.playerHp }, (_, i) =>
    `<i class="${i < p.hp ? 'on' : ''}"></i>`).join('');
  ui.hearts.classList.toggle('low', p.hp > 0 && p.hp <= 2);  // мало здоровья — сердца мигают
}

function renderFoe() {
  const e = game.current;
  if (!e) return;
  ui.foeName.textContent = e.def.name;
  ui.foeBar.style.width = `${(e.hp / e.def.hp) * 100}%`;
}

// ---------- отрисовка ----------

function render() {
  const sx = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
  const sy = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
  g.setTransform(1, 0, 0, 1, sx, sy);
  g.fillStyle = PAL.bg;
  g.fillRect(-4, -4, W + 8, H + 8);

  if (game.mode === 'title') {
    // титульный экран: замок на горе под луной
    drawTitle(g, performance.now() / 1000);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }
  const r = room();
  const cam = Math.round(game.camX);
  g.drawImage(bgFor(game.room), cam, 0, W, H, 0, 0, W, H);
  drawTorches(g, cam, r.torches ?? [], game.time);
  if (r.flames) drawFlames(g, cam, r.flames, game.time);
  for (const d of r.decor ?? []) {
    if (d.type === 'cracks') drawCracks(g, d.x - cam, CONFIG.floorTop, { open: !!game.flags[d.secret], hits: game.wallHits }, game.time);
    else if (d.type === 'slab') drawSlab(g, d.x - cam, CONFIG.floorTop, !!game.flags[d.secret]);
    else if (d.type === 'shelfdoor') drawShelfDoor(g, d.x - cam, CONFIG.floorTop, !!game.flags[d.secret]);
    else if (d.type === 'stainedglass') drawStainedGlass(g, d.x - cam, CONFIG.floorTop, game.time, d.y);
    else if (DECOR_LIVE.has(d.type)) drawDecorLive(g, d, d.x - cam, CONFIG.floorTop, game.time);
  }
  const tr = game.transition;
  if (tr?.kind === 'door' && (!r.image || r.tile)) {
    // проём открывается, пока рыцарь входит и выходит
    const k = { turn: Math.min(1, tr.t / DOOR_PHASES.turn), walkIn: 1, fadeOut: 1, fadeIn: 1, walkOut: 1, turnOut: 1 - Math.min(1, tr.t / DOOR_PHASES.turnOut) }[tr.phase];
    drawDoorOpen(g, tr.door, CONFIG.floorTop, cam, k);
  }
  if (game.doorNear && !tr && Math.floor(game.time * 3) % 2 === 0) {
    // стрелка над дверью: можно войти
    const d = game.doorNear;
    heightIcon('high', d.x - cam, CONFIG.floorTop - 46, d.locked ? '#9f97b0' : PAL.gold);
  }
  if (r.portal) {
    const c = game.cutscene;
    const lit = c ? Math.min(1, c.t / WAKE.flash) : 1;
    const glow = c ? (c.t < WAKE.flash ? lit * 0.6 : 1.2 - Math.min(0.6, (c.t - WAKE.flash) * 0.3)) : 0.55;
    drawPortal(g, r.portal.x - cam, groundY(r.portal.z), game.time, lit, glow);
  }

  // сначала тени, потом бойцы, персонажи и вещи от дальних к ближним
  const hidePlayer = game.mode === 'title' || (game.cutscene && game.cutscene.t < WAKE.flash);
  const actors = [...game.enemies.filter(e => e.state !== 'gone'), ...game.npcs, ...(hidePlayer ? [] : [game.player])];
  for (const a of actors) {
    if (a === game.player && a.state === 'swallowed') continue;
    g.globalAlpha = a.state === 'dead' ? 0.3 : 0.55;
    const gy = groundY(Math.max(0, a.z));
    rect(g, a.x - cam - 7, gy - 1, 14, 2, '#0d0b14');
    rect(g, a.x - cam - 5, gy - 2, 10, 1, '#0d0b14');
    g.globalAlpha = 1;
  }
  for (const it of game.pickups) if ((it.room ?? 'hall') === game.room) drawPickup(g, it.x - cam, groundY(it.z), it.t);
  const things = [...actors, ...(r.props ?? []).map(pr => ({ prop: pr, z: pr.z, x: pr.x }))];
  things.sort((a, b) => a.z - b.z);
  for (const a of things) {
    if (a.prop) drawProp(g, a.prop.type, a.x - cam, groundY(a.z), a.prop.type === 'chair' ? !!a.prop.flip : a.prop.altar ? !!game.flags[a.prop.altar] : !!game.flags[chestFlag(a.prop)], game.time);
    else if (a === game.player) renderPlayer(cam);
    else if (a.npc) renderNpc(a, cam);
    else renderEnemy(a, cam);
  }
  if (game.current?.alive && !game.tutorial) {
    // отметка цели
    const c = game.current;
    rect(g, c.x - cam - 1, groundY(c.z) + 2, 3, 1, PAL.gold);
  }
  for (const a of game.arrows) drawArrow(g, a.x - cam, a.y, a.vx, a.vy, a.stuck, a.bolt);
  for (const w of game.waves) renderWave(w, cam);
  for (const s of game.particles) rect(g, s.x - cam, s.y, 1, 1, s.color);
  renderCoinFx(cam);

  // передний план: распахнутая дверь решётки
  if (r.gate === 'right') drawGatePanel(g, r.length - 26 - cam, CONFIG.floorTop, H, -1);
  if (r.gate === 'left') drawGatePanel(g, 26 - cam, CONFIG.floorTop, H, 1);

  if (r.dark) {
    // темнота: свет от портала, от выхода и немного вокруг рыцаря
    const p = game.player;
    const c = game.cutscene;
    const portalLight = c && c.t < WAKE.flash ? 30 + 40 * (c.t / WAKE.flash) : 95;
    const lights = [
      { x: r.portal.x - cam, y: groundY(r.portal.z) - 6, r: portalLight },
      { x: r.length - cam + 10, y: 110, r: 90, a: 0.8 },
    ];
    if (!hidePlayer) lights.push({ x: p.x - cam, y: groundY(p.z) - 16, r: 42, a: 0.7 });
    drawDarkness(g, W, H, lights);
    // тёмные пылинки плывут перед камерой
    for (const m of game.motes) {
      g.globalAlpha = 0.55;
      rect(g, m.x, m.y, m.s, m.s, m.s > 1 ? '#05040a' : '#2a2538');
    }
    g.globalAlpha = 1;
  }
  if (r.cobwebs) {
    drawCobweb(g, -cam, 0, 1, 1, 34);
    drawCobweb(g, r.length - cam, 0, -1, 1, 26);
    if (r.dark) {
      // свисающая цепь и камни на переднем плане — тёмный силуэт (только в тёмной камере)
      for (let y = 0; y < 52; y += 3) rect(g, 286 - cam + (y % 6 ? 0 : 1), y, 2, 2, '#07060c');
      rect(g, -cam, H - 6, 60, 6, '#07060c');
      rect(g, 8 - cam, H - 9, 26, 3, '#07060c');
    }
  }

  g.setTransform(1, 0, 0, 1, 0, 0);
  if (game.mode === 'map') renderMap();
  if (game.flash > 0) {
    g.globalAlpha = game.flash;
    g.fillStyle = game.flashColor;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  // затемнение при переходе между комнатами; в начале сцены пробуждения — почти полная тьма
  let fade = 0;
  if (tr?.kind === 'door') fade = tr.phase === 'fadeOut' ? tr.t / DOOR_PHASES.fadeOut : tr.phase === 'fadeIn' ? 1 - tr.t / DOOR_PHASES.fadeIn : 0;
  if (tr?.kind === 'edge') fade = tr.phase === 'out' ? tr.t / EDGE_PHASES.out : 1 - tr.t / EDGE_PHASES.in;
  if (game.cutscene && game.cutscene.t < WAKE.flash) fade = Math.max(fade, 0.55);
  if (fade > 0) {
    g.globalAlpha = Math.min(1, fade);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (game.debug) renderDebug(cam);
  // перезарядка вихря в HUD
  const charge = game.player.spinCharge;
  ui.skillSpinBar.style.width = `${Math.round(charge * 100)}%`;
  const rapier = game.player.weapon === 'rapier';
  const skill = rapier ? 'восьмёрка' : 'вихрь';
  if (ui.skillName.textContent !== skill) ui.skillName.textContent = skill;
  const wl = [game.bag.some(id => ITEMS[id].slot === 'weapon') ? `${game.player.arms.name} · Q` : '', game.coinsShown ? `монеты: ${game.coinsShown}` : ''].filter(Boolean).join(' · ');
  if (ui.weapon.textContent !== wl) { ui.weapon.textContent = wl; ui.weapon.hidden = !wl; }
  ui.skillSpin.classList.toggle('ready', charge >= 1);
  // навык из слота и Бубновый туз
  const sk = ITEMS[game.equip.skill];
  ui.skillG.hidden = !sk;
  if (sk) {
    const k = Math.min(1, 1 - (game.skillReadyAt - game.time) / sk.cooldown);
    ui.skillGBar.style.width = `${Math.round(k * 100)}%`;
    ui.skillG.classList.toggle('ready', k >= 1);
    if (ui.skillG.firstChild.textContent !== sk.name.toLowerCase()) ui.skillG.firstChild.textContent = sk.name.toLowerCase();
  }
  const ward = ITEMS[game.equip.amulet]?.ward;
  ui.skillWard.hidden = !ward;
  if (ward) {
    const k = Math.min(1, 1 - (game.wardReadyAt - game.time) / ward.cooldown);
    ui.skillWardBar.style.width = `${Math.round(k * 100)}%`;
    ui.skillWard.classList.toggle('ready', k >= 1);
  }
}

function renderEnemy(e, cam) {
  if (e.state === 'gone') return;
  const ex = e.x - cam;
  if (ex < -50 || ex > W + 50) return;
  if (e.state === 'dead' && e.kind !== 'slime') { renderDeath(e, ex); return; }
  let alpha = 1;
  if (e.state === 'dead') alpha = Math.max(0, 1 - (e.t - 0.6) / 0.8);
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  const GROUND = groundY(e.z);
  if (CONFIG.enemyBars && e.alive && !e.def.practice && e.hp < e.def.hp) {
    const w = 14, fill = Math.max(1, Math.round(w * e.hp / e.def.hp));
    const top = GROUND - (e.kind === 'slime' ? Math.round(14 * e.size) + 5 : 40) - e.airY;
    rect(g, ex - w / 2, top, w, 2, '#2d2838');
    rect(g, ex - w / 2, top, fill, 2, '#e8454f');
  }
  if (e.kind === 'slime') {
    const colors = e.flashT > 0 ? flashColors(e.def.colors) : e.def.colors;
    drawSlimeOutlined(g, { x: ex, ground: GROUND, airY: e.airY, size: e.size, squash: e.squash, colors, facing: e.facing, holding: e.holding });
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) rect(g, ex - 1, GROUND - e.airY - 16, 3, 3, PAL.spark);
  } else {
    const colors = e.flashT > 0 ? flashColors(e.def.colors) : e.def.colors;
    const whirl = e.state === 'strike' && e.strike?.pose === 'whirl';
    if (whirl) disc(ex, GROUND - 27 - e.airY, 20);
    const tip = drawFigureOutlined(g, {
      x: ex, ground: GROUND, facing: e.facing, pose: e.pose, colors, step: e.step, airY: e.airY,
      weaponLen: e.def.weapon ?? 17, skull: e.def.skull, shield: e.def.shield && e.alive,
      bow: e.kind === 'archer', bowDraw: e.bowDraw ?? 0, crossbow: e.def.crossbow,
      face: e.kind === 'duelist', rapier: e.kind === 'duelist', robe: e.def.robe, bladeHidden: !!e.disarmed,
      wrap: e.def.wrap, veil: e.def.veil, bun: e.def.bun, ornate: e.def.ornate, curved: e.def.curved, slim: e.def.slim, spear: e.def.spear,
      bandit: e.def.bandit, axe: e.def.axe, plate: e.def.plate, halberd: e.def.halberd,
    });
    if (CONFIG.windupHints && e.state === 'windup' && e.alive) windupHint(e, ex, GROUND - 50 - e.airY);
    if (e.def.crossbow && e.state === 'windup' && e.alive && e.t > e.windupTime * 0.35) {
      // арбалетчик целится: пунктир на высоте выстрела, к концу замаха мигает
      const y = clashY(e.height, e.z), end = game.player.x - cam;
      const late = e.t > e.windupTime - 0.3;
      if (!late || Math.floor(e.t * 20) % 2 === 0) {
        g.globalAlpha = late ? 0.8 : 0.45;
        for (let x = ex + e.facing * 12; e.facing > 0 ? x < end : x > end; x += e.facing * 4) rect(g, x, y, 2, 1, '#e8454f');
        g.globalAlpha = 1;
      }
    }
    if (e.state === 'notice') {
      // «!» над головой: заметил рыцаря
      const pop = Math.min(1, e.t / 0.15);
      const y = GROUND - 46 - Math.round(pop * 4);
      rect(g, ex - 1, y, 3, 7, '#14101e');
      rect(g, ex, y + 1, 1, 4, PAL.gold);
      rect(g, ex - 1, y + 8, 3, 3, '#14101e');
      rect(g, ex, y + 9, 1, 1, PAL.gold);
    }
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) {
      // удар, который сбивает защиту, бликует оранжевым
      const c = e.strike?.breaks || e.strike?.bypass ? PAL.flame2 : PAL.spark;
      rect(g, tip.tipX - 2, tip.tipY, 5, 1, c);
      rect(g, tip.tipX, tip.tipY - 2, 1, 5, c);
    }
  }
  g.globalAlpha = 1;
}

// смерть врага: скелет рассыпается в груду костей (лежит, пока рыцарь в комнате), живой — падает навзничь и тает
function renderDeath(e, ex) {
  const GROUND = groundY(e.z), t = e.t, f = e.facing;
  const opts = {
    x: ex, ground: GROUND, facing: f, pose: e.pose, colors: e.def.colors, weaponLen: e.def.weapon ?? 17,
    skull: e.def.skull, shield: e.def.shield, bow: e.kind === 'archer', crossbow: e.def.crossbow, bladeHidden: true,
    bandit: e.def.bandit, axe: e.def.axe, plate: e.def.plate, halberd: e.def.halberd, spear: e.def.spear,
    wrap: e.def.wrap, veil: e.def.veil, robe: e.def.robe,
  };
  if (e.def.skull) {
    if (t < 0.3) {
      // оседает: фигура сплющивается к полу
      const k = t / 0.3;
      g.save();
      g.translate(ex, GROUND);
      g.scale(1, 1 - 0.75 * k);
      g.translate(-ex, -GROUND);
      drawFigureOutlined(g, opts);
      g.restore();
    }
    if (t > 0.15) drawBonePile(ex, GROUND, f, e.def);
    return;
  }
  // падает навзничь — от рыцаря; полежал — растаял
  const k = ease(Math.min(1, t / 0.35));
  const alpha = Math.max(0, 1 - Math.max(0, t - 2.2) / 0.8);
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(ex, GROUND);
  g.rotate(-f * k * Math.PI / 2);
  g.translate(-ex, -GROUND);
  drawFigureOutlined(g, opts);
  g.restore();
  g.globalAlpha = 1;
}

function drawBonePile(x, gy, f, def) {
  x = Math.round(x);
  const B = '#e6e1d0', S = '#a39d8a', D = '#14101e';
  rect(g, x - 8, gy - 2, 16, 2, S);                          // россыпь
  rect(g, x - 6, gy - 3, 5, 1, B); rect(g, x + 2, gy - 3, 6, 1, B);   // кости
  rect(g, x - 7, gy - 4, 1, 2, B); rect(g, x + 7, gy - 4, 1, 2, B);
  for (let i = 0; i < 3; i++) rect(g, x - 3 + i * 2, gy - 5, 1, 3, S);   // рёбра
  const sx = x + f * 9;                                      // череп откатился
  rect(g, sx - 2, gy - 5, 5, 4, B); rect(g, sx - 1, gy - 1, 3, 1, B);
  rect(g, sx - 1, gy - 4, 1, 1, D); rect(g, sx + 1, gy - 4, 1, 1, D);
  if (def.plate) { rect(g, x - 4, gy - 6, 8, 3, def.colors.plate ?? '#8e98a3'); rect(g, x - 4, gy - 6, 8, 1, def.colors.plateLight ?? '#c3ccd6'); }
  if (def.shield) { rect(g, x - 12, gy - 4, 6, 4, def.colors.shield ?? '#5a2a2a'); rect(g, x - 12, gy - 4, 6, 1, '#8a8a8a'); }
  // оружие на полу
  const w = Math.min(22, def.weapon ?? 17);
  rect(g, x - f * 4 - (f > 0 ? w : 0), gy - 1, w, 1, def.kind === 'archer' ? '#8a5a3b' : (def.colors.blade ?? '#c3ccd6'));
}

function renderPlayer(cam) {
  const p = game.player;
  if (p.state === 'swallowed') return;
  const px = p.x - cam;
  const GROUND = groundY(p.z) + Math.round(game.fallY ?? 0);  // падение сквозь пролом
  const colors = p.state === 'hurt' && p.t < 0.08 ? flashColors(KNIGHT_COLORS) : KNIGHT_COLORS;
  if (p.state === 'roll') {
    // кувырок: сгруппированный рыцарь делает полный оборот
    rollCtx.clearRect(0, 0, 48, 48);
    drawFigureOutlined(rollCtx, { x: 24, ground: 44, facing: p.facing, pose: POSES.tuck, colors, plume: true, weaponLen: p.arms.length ?? 17, scabbard: p.weapon === 'sword', rapier: p.weapon === 'rapier' });
    const k = Math.min(1, p.t / WEAPON.roll.time);
    g.save();
    g.translate(Math.round(px), GROUND - 12);
    g.rotate(p.facing * k * Math.PI * 2);
    g.drawImage(rollCanvas, -24, -30);
    g.restore();
    return;
  }
  // вид спереди или со спины: у дверей и когда идёт вглубь; сжатый кадр — середина поворота
  const tr = game.transition;
  let view = game.view, squash = 1, alpha = 1;
  if (tr?.kind === 'door') {
    const k = Math.min(1, tr.t / DOOR_PHASES[tr.phase]);
    view = { turn: 'back', walkIn: 'back', fadeOut: 'back', fadeIn: 'front', walkOut: 'front', turnOut: 'front' }[tr.phase];
    if ((tr.phase === 'turn' && k < 0.5) || tr.phase === 'turnOut') squash = 0.5;
    alpha = tr.phase === 'walkIn' ? 1 - Math.max(0, (k - 0.5) * 2) : tr.phase === 'fadeOut' || tr.phase === 'fadeIn' ? 0 : tr.phase === 'walkOut' ? Math.min(1, k * 2) : 1;
  } else if (view !== 'side') {
    if (game.viewT < 0.08) squash = 0.5;
  } else if (game.viewT < 0.07 && game.viewPrev !== 'side' && !tr) {
    view = game.viewPrev;
    squash = 0.5;
  }
  if (view !== 'side') {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    drawFigureFrontOutlined(g, { x: Math.round(px), ground: GROUND, colors, back: view === 'back', step: p.step * Math.PI * 2, weapon: p.weapon, squash });
    g.globalAlpha = 1;
    return;
  }
  if (game.cutscene && game.cutscene.t < WAKE.kneel) {
    drawFigureOutlined(g, { x: px, ground: GROUND, facing: p.facing, pose: p.pose, colors, plume: true, sit: true, weaponLen: 17, scabbard: true });
    return;
  }
  if (game.rest) {
    // сидит на диване или у огня; дышит
    const breathe = Math.sin(game.rest.t * 2) > 0.5 ? 1 : 0;
    drawFigureOutlined(g, { x: px, ground: GROUND, facing: p.facing, pose: { ...POSES.sheathed, hy: 7 + breathe, lean: 0, crouch: 0 }, colors, plume: true, sit: true, seat: game.rest.spot.rest.seat ?? 0, weaponLen: 17, bladeHidden: true });
    return;
  }
  const spinning = p.state === 'attack' && p.atk.key === 'spin' && p.phase === 'active';
  const weaving = p.state === 'attack' && p.atk.weave && p.phase === 'active';
  const k = spinning ? (p.t - p.atk.windup) / p.atk.active : 0;
  const facing = spinning && k > 0.5 ? -p.facing : p.facing;
  const active = p.phase === 'active';
  const drawing = p.state === 'attack' && p.atk.draw && p.phase === 'windup';

  if (spinning) disc(px, GROUND - 27, 19);
  const rapier = p.weapon === 'rapier';
  if (game.charge) {
    // копит прыжок: под рыцарем растёт полоска
    const k = Math.min(1, (game.time - game.charge.t) / WEAPONS.rapier.chargeTime);
    rect(g, px - 6, GROUND + 3, Math.round(12 * k), 1, PAL.gold);
  }
  const tip = drawFigureOutlined(g, {
    x: px, ground: GROUND, facing, pose: p.pose, colors, step: p.step, plume: true, airY: p.airY, gaitRun: p.walking && p.state === 'ready' ? (p.gaitRun ?? 0) : null,
    weaponLen: p.arms.length ?? 17, scabbard: !rapier, rapier, offhandBack: rapier && p.state !== 'hurt',
    bladeHidden: p.sheathed || drawing,
    trail: active ? p.trail : null,
  });
  if (active) {
    p.trail.push({ tipX: tip.tipX, tipY: tip.tipY });
    if (p.trail.length > (spinning || weaving ? 6 : 3)) p.trail.shift();
  } else p.trail = [];

  if (game.wardFlash > 0) {
    // Бубновый туз: большой щит-карта встаёт перед рыцарем со стороны удара и гаснет
    const k = game.wardFlash / 0.8, grow = Math.min(1, (1 - k) * 6);
    const sx = Math.round(px + (game.wardSide ?? p.facing) * 13), sy = GROUND - 22;
    const hh = Math.round(16 * grow), hw = Math.round(9 * grow);
    g.globalAlpha = Math.min(1, k * 1.6) * 0.85;
    for (let y = -hh; y <= hh; y++) {
      const w = Math.round(hw * (1 - Math.abs(y) / (hh + 1)));
      rect(g, sx - w, sy + y, w * 2 + 1, 1, Math.abs(y) > hh - 2 || w < 2 ? '#ffb3b8' : '#c8303f');
      if (w >= 2) { rect(g, sx - w, sy + y, 1, 1, '#ffb3b8'); rect(g, sx + w, sy + y, 1, 1, '#ffb3b8'); }
    }
    // белый ромб — масть
    for (let y = -4; y <= 4; y++) { const w = 3 - Math.abs(Math.round(y * 0.75)); if (w >= 0) rect(g, sx - w, sy + y, w * 2 + 1, 1, '#ffffff'); }
    g.globalAlpha = 1;
  }
  // выбранная высота рядом с рыцарем; голубая — когда держишь защиту
  if (!game.cutscene && !tr) heightIcon(game.aim, px - p.facing * 13, GROUND - 26, held('guard') ? '#8fd3ff' : '#9f97b0');
  if (p.state === 'backdash' && p.wardActive) {
    // мерцающий заслон перед рыцарем
    g.globalAlpha = 0.5 + 0.3 * Math.sin(p.t * 40);
    for (let a = -1.1; a <= 1.1; a += 0.14) rect(g, px + p.facing * (6 + Math.cos(a) * 9), GROUND - 22 + Math.sin(a) * 14, 1, 1, '#8fd3ff');
    g.globalAlpha = 1;
  }
}

// неигровой персонаж: стоит, дышит, поворачивается к рыцарю
function renderNpc(n, cam) {
  const x = n.x - cam;
  if (x < -40 || x > W + 40) return;
  const breathe = Math.sin(game.time * 2 + n.x) > 0.6 ? 1 : 0;
  drawFigureOutlined(g, {
    x, ground: groundY(n.z), facing: n.facing, pose: { ...POSES.idle, hy: 8, angle: 80, crouch: breathe },
    colors: n.def.colors, robe: n.def.robe, hood: n.def.hood, pack: n.def.pack, bladeHidden: true,
    short: n.def.short, bob: n.def.bob, coat: n.def.coat,
  });
}

// значок высоты удара над головой врага во время замаха: крупный, с тёмной обводкой.
// Диагональ — косая черта, мигает оранжевым: обычный блок её не держит.
function windupHint(e, x, y) {
  const h = e.kind === 'archer' ? (e.height === 'arc' ? 'high' : e.height) : e.strike?.guard;
  if (!h) return;
  const pose = e.strike?.pose;
  const diag = pose === 'diagUp' || pose === 'diagDown';
  const danger = e.strike?.breaks || e.strike?.bypass || e.height === 'arc';
  const blink = Math.floor(game.time * 12) % 2 === 0;
  const c = diag ? (blink ? PAL.flame2 : '#ffffff') : danger ? PAL.flame2 : '#fff4c2';
  if (diag) {
    const up = pose === 'diagUp';
    for (const [o, col] of [[1, '#14101e'], [0, c]]) for (let i = 0; i < 9; i++) {
      const px = Math.round(x - 4 + i), py = Math.round(up ? y + 8 - i : y + i);
      rect(g, px - o, py - o, 2 + o * 2, 2 + o * 2, col);
    }
    return;
  }
  heightIcon(h, x, y, c, 2);
}

// ▲ верх, ━ середина, ▼ низ; s — масштаб (2 — с тёмной обводкой)
function heightIcon(h, x, y, c, s = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const shape = (col, o) => {
    if (h === 'mid') rect(g, x - 3 * s - o, y + 2 * s - o, 7 * s + o * 2, 2 * s + o * 2, col);
    else for (let i = 0; i < 4; i++) rect(g, x - i * s - o, (h === 'high' ? y + i * s : y + (3 - i) * s) - o, (i * 2 + 1) * s + o * 2, s + o * 2, col);
  };
  if (s > 1) shape('#14101e', 1);
  shape(c, 0);
}

// бледный диск от кругового удара
function disc(x, cy, r) {
  g.globalAlpha = 0.22;
  for (let a = 0; a < Math.PI * 2; a += 0.1) rect(g, x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1, 1, '#ffffff');
  g.globalAlpha = 1;
}

// тяжёлый взмах двуручника: дуга в воздухе и волна пыли по полу
function renderWave(w, cam) {
  const k = w.t / 0.35;
  const x = w.x - cam;
  const GROUND = groundY(w.z);
  g.globalAlpha = 1 - k;
  for (let a = -1.4; a <= 0.9; a += 0.08) {
    const r = 30 + k * 10;
    rect(g, x + w.dir * Math.cos(a) * r, GROUND - 27 + Math.sin(a) * r * 0.8, 2, 1, '#e6e1d0');
  }
  for (let i = 0; i < 10; i++) rect(g, x + w.dir * (14 + k * 44 + i * 2), GROUND - 1 - (i % 3), 2, 1, '#6b6377');
  g.globalAlpha = 1;
}

// G — отладка: полоса замаха, окно идеального парирования, защита врага.
function renderDebug(cam) {
  const e = game.current;
  if (e && e.state === 'windup') {
    const T = e.windupTime, x0 = 60, w = 200;
    rect(g, x0, 168, w, 4, '#000000');
    rect(g, x0 + w * (1 - CONFIG.perfectWindow / T), 168, Math.ceil(w * CONFIG.perfectWindow / T), 4, '#3c9a5f');
    rect(g, x0 + w * Math.min(1, e.t / T), 166, 1, 8, '#ffffff');
  }
  const p = game.player;
  let extra = `рыцарь: ${p.state}${p.atk ? ' · ' + p.atk.name + ' · ' + p.phase : ''}${p.broken ? ' · защита сбита' : ''}`;
  if (e) {
    extra += ` · враг: ${e.state}`;
    if (e.kind === 'slime') extra += ` · бить: ${HEIGHT_NAME[e.zone] ?? 'любой'}`;
    else if (e.guardHeight) extra += ` · закрыт: ${HEIGHT_NAME[e.guardHeight]}`;
    if (e.state === 'windup') extra += ` · удар: ${e.height} → защита ${HEIGHT_NAME[e.strike.guard]}${e.strike.breaks ? ', сбивает' : ''}${e.strike.bypass ? ', огибает блок — только идеально' : ''}`;
    if (e.def.shield) extra += ' · щит: верх и середина';
    rect(g, e.x - cam - 1, groundY(e.z) + 4, 2, 2, '#7bd88f');
  }
  ui.debug.textContent = (game.lastTiming || 'G — отладка') + '\n' + extra;
}

// ---------- цикл ----------

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

// ЛКМ — удар, держать ПКМ — защита; на заставке клик запускает игру
ui.box.addEventListener('pointerdown', e => {
  ui.box.focus();
  e.preventDefault();
  if (game.mode === 'title') { input.press('Enter'); return; }
  if (e.button === 0) input.setHeld('Mouse0', true);
  else if (e.button === 2) input.setHeld('Mouse2', true);
});
window.addEventListener('pointerup', e => {
  if (e.button === 0) input.setHeld('Mouse0', false);
  if (e.button === 2) input.setHeld('Mouse2', false);
});
ui.box.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  game.mouseY = (e.clientY - r.top) / r.height * H;
});
ui.box.addEventListener('contextmenu', e => e.preventDefault());
let wheelAt = 0;
ui.box.addEventListener('wheel', e => {
  e.preventDefault();
  if (game.mode !== 'play') return;
  // прокрутка колеса — вихрь; серия щелчков одной прокрутки — одно нажатие
  // вверх — приём оружия, вниз — навык из слота
  const now = performance.now();
  if (now - wheelAt > 150) input.press(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
  wheelAt = now;
}, { passive: false });

newGame();
showTitle();
ui.debug.hidden = true;
requestAnimationFrame(frame);

// для автотестов в браузере
window.knightNight = game;
