import { CONFIG, ROOMS, START, MAP, EASY, NORMAL, NPC_TYPES, ITEMS, SLOTS, START_EQUIP, COINS, VERSION, STRIKES, WEAPON, WEAPONS, DAGGER, SETS } from './config.js';
import { PAL, KNIGHT_COLORS } from './palette.js';
import { createInput } from './input.js';
import { createEnemy, RISE_TIME } from './enemy.js';
import { Player, FLURRY_TOSS } from './player.js';
import { resolveImpact, isBackstab } from './combat.js';
import { drawFigure, drawFigureOutlined, drawFigureFrontOutlined, drawSlimeOutlined, drawFigureFront, drawSlime, drawArrow, drawPickup, flashColors, rect } from './draw.js';
import { POSES, approachPose, ease, strideCycle, gaitFoot } from './poses.js';
import { buildRoom, buildImageRoom, drawTorches, drawFlames, drawPortal, drawProp, drawCobweb, drawDarkness, drawGatePanel, drawDoorOpen, DOOR_W, objectsReady, pairNormals, stairsGeom, decorBounds, objImage, drawBonePileImg, drawSlimeImg, drawObjNamed, hasObj } from './background.js';
import { Tutorial } from './tutorial.js';
import { drawDecorLive, drawCracks, drawSlab, drawStainedGlass, drawShelfDoor, DECOR_LIVE } from './decor.js';
import { drawTitle } from './title.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { unlockAudio, sfx, setWind, drip, crackle, ambientOn, setAmbient, updateMusic, setMusicCalm, musicInfo, volumes, setMusicVolume, setSfxVolume } from './audio.js';
import { DialogueRunner } from './dialogue.js';
import { DIALOGUES, SPEAKERS, SHOPS, ITEM_TEXTS, STORIES } from './story/dialogues.js';
import { drawVibeFx, resetVibeFx, moonSpot } from './vibefx.js';
import { fxImpact, fxSwing, drawCombatFx, combatFxBusy } from './combatfx.js';
import { splitDamage } from './combat.js';
import { loadKnightSprites, knightReady, drawKnight, setNormalTarget, loadSpriteSet, spriteReady, drawSprite, ENEMY_SPRITES, loadWeapons, drawLyingWeapon, spriteAnim, setKnightSkin, drawWeaponWorld, drawFloorWeapon } from './sprites.js';
import { createLighting } from './lighting.js';
loadKnightSprites();
loadWeapons();
// враги в пиксель-арте (v0.64): набор по типу врага; набора нет — рисуется старая фигурка
for (const t of ENEMY_SPRITES) loadSpriteSet(t);
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
const BASE_FLOOR = CONFIG.floorTop, BASE_DEPTH = CONFIG.depth;   // у комнаты может быть своя линия пола и глубина (бар — вид сверху, v0.98)
const HIT_UP = { high: 34, mid: 22, low: 9 };
const clashY = (h, z) => groundY(z) - HIT_UP[h];
const near = (a, b) => Math.abs(a.z - b.z) <= CONFIG.depthReach;
const ATTACKING = new Set(['windup', 'strike', 'reel', 'leapIn', 'vault', 'crouch', 'leap', 'retreat', 'inflate', 'suck']);
const HEIGHT_NAME = { high: 'верх', mid: 'середина', low: 'низ' };
const RESULT_NAME = { perfect: 'идеально', block: 'блок', broken: 'защита сбита', hit: 'попадание', dodged: 'уклон', warded: 'заслон', miss: 'мимо' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const SPECIAL = new Set(['rollCut', 'dashCut', 'leap', 'spin', 'figure8', 'vaultFlick', 'flurry']);
// Управление (решение владельца после бета-теста): курсор выбирает высоту, ЛКМ — удар, держать ПКМ — защита, пробел — рывок.
const HINT_WALK = 'WASD — ходить · курсор выше / ниже рыцаря — высота · ЛКМ удар · ПКМ защита · пробел рывок';
const HINT_FIGHT = 'курсор — высота ▲ ━ ▼ · ЛКМ удар · держать ПКМ — защита · пробел рывок';
// подсказки управления — только поначалу: дальше они мешают, а управление есть в меню (Esc → Управление)
// сколько встреч побеждено хоть раз (cleared после отдыха пустеет, а опыт остаётся)
const beatCount = () => Math.max(game.cleared?.size ?? 0, Object.keys(game.flags ?? {}).filter(k => k.startsWith('beat_')).length);
const hintFight = () => beatCount() >= 3 ? '' : HINT_FIGHT;
const hintWalk = () => game.visited?.includes('gallery') || game.flags?.done_ilia || beatCount() >= 3 ? '' : HINT_WALK;

// Холст вдвое больше игрового мира (640×360): код рисует в координатах мира с масштабом S,
// спрайты из PixelLab — в родных пикселях (src/sprites.js). Логика и баланс — в прежних единицах.
const S = 2;
const canvas = document.getElementById('game');
canvas.width = W * S;
canvas.height = H * S;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
// живой свет (src/lighting.js); без WebGL — null, игра как раньше
const light = (() => { try { return createLighting(canvas); } catch { return null; } })();
// слой поверх живого света (v0.81): то, что светится само и не должно гаснуть в шейдере — живая картинка «вайбовать»
const fxCanvas = Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height, className: 'fxlayer' });
(canvas.parentElement.querySelector('canvas.lit') ?? canvas).after(fxCanvas);
const fx = fxCanvas.getContext('2d');
fx.imageSmoothingEnabled = false;
if (light) setNormalTarget(light.normalCtx);
const rollCanvas = document.createElement('canvas');
rollCanvas.width = rollCanvas.height = 48;
const rollCtx = rollCanvas.getContext('2d');

const $ = id => document.getElementById(id);
const ui = {
  box: $('game-box'), hearts: $('hearts'), foe: $('foe'), foeName: $('foe-name'), foeBar: $('foe-bar'),
  callout: $('callout'), hint: $('hint'), debug: $('debug'), overlay: $('overlay'), version: $('version'),
  overlayTitle: $('overlay-title'), overlayText: $('overlay-text'), overlayPress: $('overlay-press'),
  talk: $('talk'), talkPortrait: $('talk-portrait'), talkFace: $('talk-face'), talkName: $('talk-name'), talkText: $('talk-text'),
  talkChoices: $('talk-choices'), talkNext: $('talk-next'), talkSkip: $('talk-skip'), pathSign: $('path-sign'), shopClose: $('shop-close'),
  reportBtn: $('report-btn'), reportText: $('report-text'), overlayMenu: $('overlay-menu'),
  floorcard: $('floorcard'), floorcardTitle: $('floorcard-title'), floorcardRoom: $('floorcard-room'),
  journal: $('journal'), journalList: $('journal-list'), journalPage: $('journal-page'), journalFig: $('journal-fig'),
  journalName: $('journal-name'), journalHow: $('journal-how'), journalWin: $('journal-win'), journalLore: $('journal-lore'), journalKills: $('journal-kills'),
  equip: $('equip'), equipSlots: $('equip-slots'), equipBag: $('equip-bag'), equipDesc: $('equip-desc'), equipCoins: $('equip-coins'), equipDo: $('equip-do'), equipClose: $('equip-close'), journalClose: $('journal-close'),
  skillWard: $('skill-ward'), skillWardBar: $('skill-ward-bar'), skillMask: $('skill-mask'), skillMaskBar: $('skill-mask-bar'), skillG: $('skill-g'), skillGBar: $('skill-g-bar'),
  shop: $('shop'), shopScene: $('shop-scene'), shopName: $('shop-name'), shopCoins: $('shop-coins'),
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
// куски стены из PixelLab (v0.64): tiles: 'dungeon' у комнаты → assets/backgrounds/dungeon/dungeon_<n>.png
const TILE_COUNT = { dungeon: 3, castle: 4 };   // вариантов куска стены: _0 — основной, остальные — с деталью
const tileSets = {};
const farImgs = {};
for (const r of Object.values(ROOMS)) if (r.tiles && !tileSets[r.tiles]) {
  tileSets[r.tiles] = Array.from({ length: r.tileCount ?? TILE_COUNT[r.tiles] ?? 1 }, (_, n) => { const im = new Image(); im.src = `assets/backgrounds/${r.tiles}/${r.tiles}_${n}.png`; return im; });
  // нормали кусков (tools/wall_normals.py): рельеф кладки под живым светом
  tileSets[r.tiles].normals = tileSets[r.tiles].map((_, n) => { const im = new Image(); im.src = `assets/backgrounds/${r.tiles}/n/${r.tiles}_${n}.png`; return im; });
}
const tilesReady = r => r.tiles && objectsReady() && tileSets[r.tiles].every(im => im.complete && im.naturalWidth) && tileSets[r.tiles].normals.every(im => im.complete);
function bgFor(id) {
  const img = bgImages[id];
  if (img?.complete && img.naturalWidth) return (imageRooms[id] ??= buildImageRoom(ROOMS[id], img, H, CONFIG.floorTop));
  const r = ROOMS[id];
  if (tilesReady(r)) return (backgrounds[id + ':tiles'] ??= buildRoom(r, H, CONFIG.floorTop, tileSets[r.tiles]));
  return (backgrounds[id] ??= buildRoom(r, H, CONFIG.floorTop));
}
const room = () => ROOMS[game.room];
const encKey = (roomId, i) => `${roomId}:${i}`;
const ALL_ENCOUNTERS = Object.entries(ROOMS).flatMap(([id, r]) => (r.encounters ?? []).map((enc, i) => ({ key: encKey(id, i), enc })));
const held = group => KEYS[group].some(input.isDown);
const is = (code, group) => KEYS[group].includes(code);

const game = {};

function spawnGroup(roomId, i) {
  const enc = ROOMS[roomId].encounters[i];
  return enc.enemies.map(d => Object.assign(createEnemy(d.type, enc.x + d.dx, Math.random, d.z), { group: i, noRise: !!(d.noRise || enc.noRise) }));
}
// враги комнаты: непройденные встречи и наставница, если обучение ещё впереди
function spawnRoom(roomId) {
  const r = ROOMS[roomId];
  const list = (r.encounters ?? []).flatMap((enc, i) => game.cleared.has(encKey(roomId, i)) || !flagsOK(enc.needs) ? [] : spawnGroup(roomId, i));
  if (r.trainer && !game.flags.trainer_gone) list.unshift(createEnemy('trainer', r.trainer.x, Math.random, r.trainer.z));
  return list;
}

// Перейти в комнату: враги, персонажи, камера. at — { x, z, facing } прибытия.
// Обычные встречи (не боссы и не встречи с диалогом) возвращаются после отдыха (v0.86): монеты не кончаются,
// а зачищенная комната остаётся пустой, пока не сядешь отдыхать — обратный путь быстрый.
const MARAUDERS = new Set(['merc', 'axe', 'spear', 'crossbow', 'captain']);
const BOSSES = new Set(['duelist', 'captain', 'commander', 'mage']);
// сюжетные бои (story — имя) не возвращаются никогда: победа помнится флагом done_<имя>, а не номером встречи
function respawnable(enc) {
  return !enc.story && !enc.before && !enc.unique && !enc.enemies.some(e => BOSSES.has(e.type));
}

const FLOOR_NAMES = { 2: 'Второй этаж', 3: 'Третий этаж' };
function loadRoom(id, at) {
  const left = game.room && ROOMS[game.room]?.onLeave;
  if (left && left.if && game.flags[left.if] && left.set) game.flags[left.set] = true;
  game.climb = null;
  game.blueFireAt = null;
  game.coinFx = [];
  CONFIG.floorTop = ROOMS[id].floorTop ?? BASE_FLOOR;
  CONFIG.depth = ROOMS[id].depth ?? BASE_DEPTH;
  game.flags['map_' + id] = true;  // для карты: где побывал
  for (const [f, at] of Object.entries(game.flags.later ?? {})) if ((game.flags.playTime ?? 0) >= at) { game.flags[f] = true; delete game.flags.later[f]; }
  const floor = ROOMS[id].floor ?? 1;
  if (FLOOR_NAMES[floor] && !game.flags['card_' + floor]) {
    // первый раз на этом этаже — заставка
    game.flags['card_' + floor] = true;
    ui.floorcardTitle.textContent = FLOOR_NAMES[floor];
    ui.floorcardRoom.textContent = ROOMS[id].name;
    ui.floorcard.hidden = true;
    void ui.floorcard.offsetWidth;
    ui.floorcard.hidden = false;
    clearTimeout(game.floorcardTimer);
    game.floorcardTimer = setTimeout(() => { ui.floorcard.hidden = true; }, 3300);
  }
  (ROOMS[id].encounters ?? []).forEach((enc, i) => {
    const key = encKey(id, i);
    if (admin.peace && !enc.story) game.cleared.add(key);   // админка: без обычных боёв
    if (enc.story && game.flags['done_' + enc.story]) game.cleared.add(key);
  });
  game.room = id;
  game.visited.push(id);
  const r = ROOMS[id];
  game.enemies = spawnRoom(id);
  game.npcs = (r.npcs ?? []).filter(n => flagsOK(n.needs) && ![].concat(n.ifNot ?? []).some(f => game.flags[f])).map(n => ({ ...n, npc: true, def: NPC_TYPES[n.type], facing: n.facing ?? -1 }));
  // кот Фуджин (владелец): при каждом входе — в другом месте и в другой позе (spots: x, z, lift, img)
  for (const n of game.npcs) if (n.spots) {
    const ok = n.spots.filter(s => hasObj(s.img));
    if (ok.length) Object.assign(n, ok[Math.floor(Math.random() * ok.length)]);
  }
  game.arena = null;
  game.current = null;
  game.token = null;
  game.arrows = [];
  game.waves = [];
  game.puffs = [];
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
    puffs: [],
    arrows: [],
    waves: [],
    enemies: [],
    npcs: [],
    room: START.room,
    arena: null,
    cleared: new Set(),
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
  for (const k of game.cleared) game.flags['beat_' + k] = true;  // старые сохранения: побеждённые раньше — повторный бой без запирания
  game.flags = data.flags ?? {};
  game.pickups = data.pickups ?? [];
  game.coins = data.coins ?? 0;
  game.bag = data.bag ?? [];
  game.bestiary = data.bestiary ?? {};
  game.equip = { ...START_EQUIP, ...(data.equip ?? {}) };
  // v0.80: цельная броня мародёра → части по слотам (голова, тело, ноги)
  for (const set of Object.values(SETS)) {
    const worn = game.equip.armor === set.gives, held = game.bag.indexOf(set.gives);
    if (!worn && held < 0) continue;
    if (held >= 0) game.bag.splice(held, 1);
    for (const id of set.pieces) { const s = ITEMS[id].slot; if (worn) { if (game.equip[s] && game.equip[s] !== id && game.equip[s] !== set.gives) game.bag.push(game.equip[s]); game.equip[s] = id; } else game.bag.push(id); }
  }
  // старые сохранения: рапира была только в unlocked
  if (game.unlocked.has('rapier') && game.equip.weapon !== 'rapier' && !game.bag.includes('rapier')) game.bag.push('rapier');
  if (!data.equip && data.weapon === 'rapier') { game.bag = game.bag.filter(i => i !== 'rapier'); game.bag.push('sword_old'); game.equip.weapon = 'rapier'; }
  // старые сохранения: бои помнились по номеру встречи — рапира у рыцаря значит, что Илиа уже побеждён
  if (game.unlocked.has('rapier') || game.bag.includes('rapier') || game.equip.weapon === 'rapier') game.flags.done_ilia = true;
  if (game.flags.balcony_done) game.flags.done_commander = true;
  // v0.32–v0.55: рапира не выпадала после победы над Илиа — выдать её тем, кто остался без неё
  if (game.flags.done_ilia && !owns('rapier') && !game.pickups.some(it => it.kind === 'rapier')) { game.unlocked.add('rapier'); game.bag.push('rapier'); }
  game.player = new Player(data.x, ITEMS[game.equip.weapon].weapon);
  game.player.sheathed = false;
  game.player.hp = Math.max(1, Math.min(CONFIG.playerHp, data.hp ?? CONFIG.playerHp));
  game.shield = null;  // щит при загрузке — полный
  applyArmor();
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
    const [lo, hi] = game.arena.open ? roomBounds() : arenaBounds();
    return dir > 0 ? hi - e.x : e.x - lo;
  },
  dropWeapon(e, kind) {
    callout('Рапира выбита!', 'counter');
    if (owns(kind) || game.pickups.some(it => it.kind === kind)) return;  // рапира уже есть — второй не будет
    game.pickups.push({ kind, room: game.room, x: e.x - e.facing * 10, z: e.z, t: 0 });
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
  // рывок в тень (v0.71): «шух», клуб дыма там, где стоял, и тёмные клочья вслед
  vanish(e) {
    sfx.whoosh();
    sfx.dash();
    const y = groundY(e.z);
    for (let i = 0; i < 14; i++) game.puffs.push({
      x: e.x + (Math.random() - 0.5) * 14, y: y - 4 - Math.random() * 30, r: 3 + Math.random() * 4,
      vx: -e.facing * (8 + Math.random() * 20), vy: -6 - Math.random() * 10, life: 0.6 + Math.random() * 0.5, max: 1.1,
    });
    e.puffAt = 0;
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
    game.arrows.push({ who: e.def.name, x, y: clashY(height, e.z), z: e.z, vz, vx: e.facing * e.def.arrowSpeed, vy: 0, height, damage: e.def.damage, resolved: false, falling: false, life: 3, bolt: !!e.def.crossbow, stone: !!e.def.goblin });
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
  // босс: удушение. Подсказка при начале, проверка в конце: кувырок, рывок назад или далеко — ушёл
  chokeCue(e) {
    callout('Кувырок или рывок назад!', 'counter');
    if (CONFIG.audioCues) sfx.cue('high');
  },
  choke(e) {
    const p = game.player;
    if (p.defense().dodge || p.state === 'backdash' || p.state === 'roll' || Math.abs(p.x - e.x) > e.def.chokeRange + 20) {
      callout('Ушёл!', 'perfect');
      game.stats.dodged++;
      return false;
    }
    p.hp = Math.max(0, p.hp - 1);   // магия — мимо брони
    p.heldBy(e);
    renderHearts();
    shake(2);
    flash('#b07cff', 0.3);
    callout('Душит! Бей — вырвись!', 'hit');
    game.lastHitBy = e.def.name;
    game.stats.hit++;
    return true;
  },
  bossPhase() {
    callout('Маска треснула!', 'counter');
    shake(4);
    flash('#cfe8ff', 0.4);
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

  const dirIn = Math.sign(sourceX - p.x) || p.facing;   // откуда пришёл удар
  if (result === 'perfect') fxImpact('perfect', x, y, { dir: dirIn, height });
  else if (result === 'block' || result === 'warded') fxImpact('block', x, y, { dir: dirIn, height });
  else if (result === 'broken') fxImpact('broken', x, y, { dir: dirIn, height });
  else if (result === 'hit' && damage > 0) fxImpact('hit', p.x, y, { dir: -dirIn, height, big: 1.1 });
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
      // щит брони принимает удар первым
      const split = splitDamage(dmg, Math.floor(game.shield ?? 0));
      game.shield = (game.shield ?? 0) - split.absorbed;
      game.hitAt = game.time;
      p.hurt(split.hp, sourceX);
      renderHearts();
      if (split.hp > 0) sparks(p.x + 2, y, 10, [PAL.blood, '#9e2648'], 80);
      if (split.absorbed > 0) sparks(p.x + 2, y, 8, ['#6fa8dc', '#d8ecff'], 90);
      sfx.hit();
      game.hitstop = CONFIG.hitstop.hit;
      shake(mult > 1 ? 4 : 3);
      flash(split.hp > 0 ? '#e8454f' : '#6fa8dc', split.hp > 0 ? 0.3 : 0.18);
      const what = split.hp > 0 ? `−${split.hp}${split.absorbed ? `  (щит −${split.absorbed})` : ''}` : `щит −${split.absorbed}`;
      callout(backTurned ? `В спину! ${what}` : mult > 1 ? `Пропущен ×${mult}  ${what}` : `Пропущен  ${what}`, split.hp > 0 ? 'hit' : 'block');
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
    // кинжал: удар в спину — враг отвернулся или рыцарь только что проскочил мимо него рывком (v0.82)
    const back = atk.backstab && e.kind !== 'slime' && e.kind !== 'boss' && isBackstab(e.x, e.facing, p.x, game.time - (e.slipAt ?? -9), DAGGER.slipWindow);
    const pw = attackPower();
    const hitAtk = back ? { ...atk, damage: atk.damage * DAGGER.backstab * pw, pierce: true, name: 'В спину!' } : pw !== 1 ? { ...atk, damage: atk.damage * pw } : atk;
    const { out, dmg } = e.receiveAttack(hitAtk);
    if (back && (out === 'hit' || out === 'counter')) { game.stats.backstab = (game.stats.backstab ?? 0) + 1; flash('#ffffff', 0.15); }
    if (e.kind === 'trainer' && (out === 'hit' || out === 'counter')) tutorialEvent({ type: out, height: atk.height, key: atk.key });
    if (atk.key === 'vaultFlick' && (out === 'hit' || out === 'counter')) game.stats.vaultHit++;
    if (e.state === 'yield' && e.def.defeatDialogue && !e.spoke) {
      e.spoke = true;
      setTimeout(() => startTalk(e.def.defeatDialogue), 700);  // сначала встаёт на колено
    }
    const x = e.x - p.facing * 6;
    const y = e.kind === 'slime' ? groundY(e.z) - e.airY - 6 : clashY(atk.height === 'any' ? 'mid' : atk.height, e.z);
    fxImpact(out === 'counter' ? 'counter' : out === 'hit' ? 'hit' : out === 'blocked' ? 'deflect' : 'miss', out === 'hit' || out === 'counter' ? e.x : x, y,
      { dir: p.facing, height: atk.height === 'any' ? 'mid' : atk.height, big: back ? 1.5 : 1 });
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
      callout(e.def.practice ? `${atk.name} · ${HEIGHT_NAME[atk.height] ?? 'по кругу'}` : `${hitAtk.name}  −${dmg}`, back ? 'counter' : 'block');
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
  if (!touched) { sfx.swish(); if (atk.height !== 'any') fxImpact('miss', p.x + p.facing * (atk.reach * 0.8), clashY(atk.height, p.z), { dir: p.facing }); }
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
      callout(`${cap(p.arms.spinName)} не готов${p.weapon === 'rapier' ? 'а' : ''}`, 'muted');
    } else if (ev.type === 'feint') {
      callout('Отмена', 'muted');
    } else if (ev.type === 'struggle') {
      shake(1);
      if (p.struggles === 1) callout('Бей — вырвись!', 'counter');
    } else if (ev.type === 'chokeTick') {
      p.hp = Math.max(0, p.hp - 1);
      renderHearts();
      flash('#7cf0ff', 0.2);
      callout('Душит! −1', 'hit');
    } else if (ev.type === 'breakFree') {
      // вырвался: призрак отшатывается
      callout('Вырвался!', 'perfect');
      sfx.perfect();
      shake(3);
      const b = ev.by;
      if (b?.alive) { b.enter('stagger'); world.staggered(b); }
    } else if (ev.type === 'slam') {
      // босс швырнул об землю
      p.hp = Math.max(0, p.hp - 2);
      renderHearts();
      sfx.heavy();
      shake(5);
      dust(p.x, groundY(p.z), p.facing);
      callout('Об землю! −2', 'hit');
    } else if (ev.type === 'spit') {
      ev.slime.release();
      sfx.spit();
      shake(2);
    }
  }
}

// подсказка про удушье (v0.76): владелец умер от удушья 22 раза, не поняв, что делать. Пока босс тянет руку —
// «кувырок или отскок, уйди», пока душит — «бей часто» со счётом ударов
function updateChokeHint() {
  const p = game.player;
  const caster = game.enemies.find(e => e.kind === 'boss' && e.alive && e.state === 'cast');
  let text = null;
  if (p.state === 'held') {
    const need = p.holder?.def?.chokeBreak ?? 7;
    text = `ЛКМ — бей часто, вырвись! ${Math.min(p.struggles ?? 0, need)} / ${need}`;
  } else if (caster) text = 'Пробел — кувырок или отскок назад: уйди от захвата!';
  if (text) {
    if (!game.chokeHintOn) game.hintBeforeChoke = ui.hint.hidden ? '' : ui.hint.textContent;   // вернуть потом прежнюю
    hint(text); game.chokeHintOn = true;
  } else if (game.chokeHintOn) { game.chokeHintOn = false; hint(game.hintBeforeChoke ?? ''); }
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
  game.shield = null;
  applyArmor();
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
    `Knight Night ${VERSION} — отчёт тестера${easyOn ? ' (лёгкий режим)' : ''}`,
    `Время: ${mins}:${String(secs).padStart(2, '0')} · пройдено встреч: ${ALL_ENCOUNTERS.filter(({ key, enc }) => game.cleared.has(key) || game.flags['beat_' + key] || (enc.story && game.flags['done_' + enc.story])).length} из ${ALL_ENCOUNTERS.length}`,   // v0.90: после отдыха cleared пустеет — считать и побеждённые раньше
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

// ---------- погладить Фуджина (владелец, 17.10) ----------
// Подходит, опускается на колено (кот на столе — тянется стоя) и гладит: лежит на спине или на боку — по животу,
// сидит — кот поднимает голову к руке; спит — спит дальше. Сердечки и тихое мурчание.
function petCat(n) {
  const p = game.player;
  const side = Math.sign(p.x - n.x) || -1;
  const sleeping = n.img === 'cat_sleep';
  const belly = ['cat_belly', 'cat_lounge', 'cat_side'].includes(n.img);
  game.pet = { n, t: 0, from: p.x, to: n.x + side * 13, head: !sleeping && !belly, kneel: false };
  p.atk = null; p.guard = null; p.walking = false;
  if (!p.sheathed) { p.sheathed = true; p.sheatheAt = p.clock - 1; p.sheatheRun = true; }   // меч — за спину: гладят руками
  p.facing = -side;
  hint('');
}
function updatePet(dt) {
  const P = game.pet, p = game.player, n = P.n;
  P.t += dt;
  const u = Math.min(1, P.t / 0.35);
  p.x = P.from + (P.to - P.from) * u;
  p.facing = Math.sign(n.x - p.x) || p.facing;
  P.kneel = P.t > 0.35 && P.t < 2.2 && (n.lift ?? 0) < 10;
  if (P.t > 0.5 && P.t < 2.1 && Math.random() < dt * 5) game.particles.push({   // сердечки над котом
    x: n.x + (Math.random() - 0.5) * 8, y: groundY(n.z) - (n.lift ?? 0) - 14, vx: (Math.random() - 0.5) * 8, vy: -22, life: 0.9, color: Math.random() < 0.5 ? '#ff8fb0' : '#ffd0de', heart: true,
  });
  if (P.t > 0.5 && !P.purr) { P.purr = true; sfx.purr?.(); }
  if (P.t > 2.4) { game.pet = null; callout(n.img === 'cat_sleep' ? 'Фуджин сладко сопит' : 'Фуджин мурчит', 'perfect'); }
}

// ---------- маска: шаг призрака (v0.95, владелец) ----------
// F — раствориться и проявиться за спиной ближайшего врага (сначала — перед рыцарем); во время шага неуязвим.
// Враг после шага «проскочен» (slipAt) — с кинжалом следующий удар в спину (×3, как после рывка сквозь врага).
function useMask() {
  const p = game.player, bl = ITEMS[game.equip.amulet]?.blink;
  if (!bl || game.mode !== 'play') return;
  if (game.time < (game.blinkReadyAt ?? 0)) { callout('Маска ещё не готова', 'muted'); return; }
  if (!(p.ready || p.state === 'dash' || (p.state === 'attack' && p.phase !== 'active'))) return;
  const foes = game.enemies.filter(e => e.alive && e.solid !== false && e.state !== 'dormant' && Math.abs(e.x - p.x) < bl.reach);
  const dist = e => Math.hypot(e.x - p.x, (e.z - p.z) * 2);
  const ahead = foes.filter(e => Math.sign(e.x - p.x) === p.facing);
  const e = (ahead.length ? ahead : foes).sort((a, b) => dist(a) - dist(b))[0];
  if (!e) { callout('Некого обойти', 'muted'); return; }
  const side = Math.sign(e.x - p.x) || p.facing;
  const [L, R] = roomBounds();
  const to = Math.max(L + 6, Math.min(R - 6, e.x + side * bl.behind));
  if (Math.abs(to - e.x) < bl.behind * 0.6) { callout('За спиной нет места', 'muted'); return; }
  game.blink = { to, z: e.z, e, side, done: false };
  p.atk = null;
  p.buffer = null;
  p.blinkTime = bl.time;
  p.enter('blink');
  game.blinkReadyAt = game.time + bl.cooldown;
  blinkPuff(p.x, p.z, -side);
  sfx.blink();
}
function blinkPuff(x, z, dir) {
  const y = groundY(z);
  for (let i = 0; i < 12; i++) game.puffs.push({
    x: x + (Math.random() - 0.5) * 12, y: y - 4 - Math.random() * 28, r: 2 + Math.random() * 4,
    vx: dir * (6 + Math.random() * 16), vy: -8 - Math.random() * 10, life: 0.5 + Math.random() * 0.4, max: 0.9,
  });
}
function updateBlink() {
  const b = game.blink, p = game.player;
  if (!b) return;
  if (p.state !== 'blink') { game.blink = null; return; }
  if (!b.done && p.t >= p.blinkTime / 2) {
    b.done = true;
    p.x = b.to;
    p.z = b.z;
    p.facing = -b.side;          // лицом к врагу, он — спиной
    game.faceBy = 'keys';
    b.e.slipAt = game.time;
    blinkPuff(p.x, p.z, b.side);
  }
}
// прозрачность рыцаря: тает и проявляется в шаге призрака, уходит в портал в сцене конца главы
function playerAlpha() {
  const p = game.player;
  let a = 1;
  if (p.state === 'blink') { const k = Math.min(1, p.t / (p.blinkTime ?? 0.34)); a = Math.abs(1 - 2 * k) * 0.85 + 0.05; }
  if (game.ending?.knightAlpha != null) a *= game.ending.knightAlpha;
  return a;
}

// ---------- конец главы 1: сцена (v0.95, владелец) ----------
// Всё собрано (вся история капитана) — разговор boss_peace, призрак склоняется, встаёт, смотрит на нас и растворяется.
// Иначе — казнь: рыцарь заносит меч над коленопреклонённым призраком, удар — маска раскалывается, призрак рассыпается.
// Дальше у всех одинаково: портал в Камере — цветок в янтаре, волны, второй круг рун, свет; телепорт к замку днём.
const PEACE_ITEMS = ['diary_1', 'diary_2', 'diary_3', 'diary_4', 'diary_full', 'resin_flower', 'heart_half'];
const peaceReady = () => PEACE_ITEMS.every(id => owns(id));
const STILL = { fwd: false, back: false, dz: 0, guard: null, engaged: false, stroll: true, anyInput: false };
function letterbox(on) {
  let el = ui.vibe;
  if (!el) {
    el = ui.vibe = document.createElement('div');
    el.className = 'vibe';
    el.innerHTML = '<i class="vibe-bar top"></i><i class="vibe-bar bottom"></i>';
    ui.box.appendChild(el);
    void el.offsetWidth;
  }
  ui.box.classList.toggle('vibing', on);
}
function startEnding(d, peace) {
  const boss = game.enemies.find(e => e.kind === 'boss');
  if (!boss) { finish(d); return; }
  // крупное событие пути: +5 пилигриму за мирный исход; казнь — +5 лидеру среди остальных; у них поровну —
  // путь не определён (серый знак, пятый путь — владелец 17.10, свой знак придумает позже), очков никому
  const path = peace ? 'pilgrim' : executionPath();
  if (PATHS.includes(path)) addPath(path, 5);
  game.flags.ending = peace ? 'peace' : 'execution';
  const p = game.player;
  p.atk = null; p.buffer = null; p.guard = null; p.enter('ready');
  game.charge = null;
  game.ending = { phase: 'cine', t: 0, d, peace, boss, done: {}, black: 0, white: 0, glow: 0, frames: cineFrames(peace), i: 0, ft: 0, fx: [] };
  ui.foe.hidden = true;
  hint('');
  openCine();
  save();
  setTimeout(() => showPathSign(path), 300);
}
const once = (E, key, at) => E.t >= at && !E.done[key] && (E.done[key] = true);
function updateEnding(dt) {
  const E = game.ending, p = game.player;
  E.t += dt;
  tickStory(dt);
  if (E.phase === 'cine') updateCine(E, dt);
  else if (E.phase === 'leave') {   // от окна покоев — в темноту и к порталу
    E.black = Math.min(1, E.t / 0.9);
    if (E.t > 1.1) toPortalScene(E);
  } else if (E.phase === 'portal') endingPortal(E, p, dt);
}

// ---------- кат-сцена кадрами (v0.95, владелец): как story mode — нарисованные картины меняются одна за другой ----------
// Картины — PixelLab (tools/pixellab_ending.py): одна основа (рыцарь стоит, призрак на колене у двери покоев) и её правки.
// Мирный исход: на коленях — склоняется — встаёт — смотрит на нас — растворяется в свете — маска на полу.
// Казнь: на коленях — рыцарь заносит меч — удар (маска раскалывается, призрак рассыпается дымом, без крови) — маска на полу.
function cineFrames(peace) {
  return peace ? [
    { img: 'base', d: 2.0 }, { img: 'bow', d: 1.8 }, { img: 'base', d: 0.9 }, { img: 'rise', d: 1.8 }, { img: 'look', d: 2.4 },
    { img: 'fade', d: 2.4, fade: true }, { img: 'mask', d: 2.2 },
  ] : [
    { img: 'base', d: 2.0 }, { img: 'raise', d: 1.8 }, { img: 'strike', d: 2.0, shatter: true }, { img: 'mask', d: 2.2 },
  ];
}
const CINE = { W: 640, H: 360 };
const cineImgs = {};
function openCine() {
  let el = ui.cine;
  if (!el) {
    el = ui.cine = document.createElement('div');
    el.className = 'cine';
    el.innerHTML = `<canvas width="${CINE.W}" height="${CINE.H}"></canvas>`;
    ui.box.appendChild(el);
  }
  for (const n of ['base', 'bow', 'rise', 'look', 'fade', 'mask', 'raise', 'strike']) if (!cineImgs[n]) { cineImgs[n] = new Image(); cineImgs[n].src = `assets/story/ending_${n}.png`; }
  el.hidden = false;
  el.classList.remove('out');
}
function closeCine() {
  if (!ui.cine) return;
  ui.cine.classList.add('out');
  setTimeout(() => { if (ui.cine.classList.contains('out')) ui.cine.hidden = true; }, 700);
}
function updateCine(E, dt) {
  E.ft += dt;
  if (E.ft >= E.frames[E.i].d) {
    E.i++;
    E.ft = 0;
    const nx = E.frames[E.i];
    if (!nx) { endCine(E); return; }
    if (nx.shatter) { sfx.counter(); sfx.flame(); E.flash = 1; }
    else if (nx.fade) sfx.portal();
    else if (nx.img === 'raise') sfx.whoosh();
  }
  drawCine(E);
}
function drawCine(E) {
  const c = ui.cine.querySelector('canvas').getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#05040a';
  c.fillRect(0, 0, CINE.W, CINE.H);
  const fr = E.frames[E.i], im = cineImgs[fr.img];
  if (im?.complete && im.naturalWidth) c.drawImage(im, 0, 0, CINE.W, CINE.H);
  // кадр проявляется из темноты (смена кадра — короткая, как перелистывание)
  const k = Math.min(1, E.ft / 0.18);
  if (k < 1) { c.globalAlpha = 1 - k; c.fillStyle = '#05040a'; c.fillRect(0, 0, CINE.W, CINE.H); c.globalAlpha = 1; }
  if (E.flash > 0) { c.globalAlpha = E.flash; c.fillStyle = '#ffffff'; c.fillRect(0, 0, CINE.W, CINE.H); c.globalAlpha = 1; E.flash = Math.max(0, E.flash - 0.05); }
  c.fillStyle = '#000';   // кинополосы
  c.fillRect(0, 0, CINE.W, 8); c.fillRect(0, CINE.H - 8, CINE.W, 8);   // тонкие — маска на полу внизу кадра видна
}
function endCine(E) {
  closeCine();
  gainMask(E.boss, E.peace ? 'Призрак ушёл с миром. На полу — расколотая маска' : 'Расколотая маска');
  game.ending = null;
  setTimeout(() => callout('Наверх ведёт винтовая лестница — покои принцессы', 'perfect'), 2200);
  save();
}
// от большого окна в покоях принцессы (E) — к порталу: та же сцена у всех
function startPortalEnding() {
  const d = (ROOMS.mage.encounters ?? []).find(e => e.finish)?.finish ?? {};
  game.ending = { phase: 'leave', t: 0, d, peace: game.flags.ending === 'peace', done: {}, black: 0, white: 0, glow: 0 };
  letterbox(true);
  hint('');
}
function gainMask(b, text) {
  b.state = 'gone';
  if (!owns('broken_mask')) { game.bag.push('broken_mask'); game.flags.given_broken_mask = true; }
  callout(text, 'perfect');
  sfx.perfect();
}
// ---------- покои принцессы картиной (v0.97, владелец 17.10: «как в визуальных новеллах») ----------
// Рыцаря в покоях нет — на экране сама картина комнаты. Навёл на вещь — подпись и рамка, клик (или цифра) — осмотр
// (те же разговоры look_…). «Завершить миссию» — к порталу, «Спуститься» — назад к лестнице в Преддверии покоев.
const VN_SCENES = {
  princess: {
    title: 'Покои принцессы', img: 'assets/backgrounds/princess/princess_0.png', finish: 'princess_leave',
    // места на картине (640×360): x, y, ширина, высота
    spots: [
      { name: 'Кровать с балдахином', look: 'look_princess_bed', r: [4, 104, 190, 216] },
      { name: 'Тумбочка', look: 'look_princess_stand', r: [196, 226, 50, 66] },
      { name: 'Окно', look: 'look_princess_view', r: [282, 78, 96, 178] },
      { name: 'Большое окно', look: 'look_princess_window', r: [414, 78, 100, 178] },
      { name: 'Стол для записей', look: 'look_princess_desk', r: [540, 182, 100, 108] },
      { name: 'Комод', look: 'look_princess_dresser', r: [526, 290, 114, 70] },
    ],
    candle: [220, 231],
  },
  // оружейная (владелец, 22.10): картина, как покои; два продавца на выбор — клик по продавцу открывает окно торговли
  armory: {
    title: 'Оружейная', img: 'assets/vn/armory_room.png', down: '← На площадь', help: 'выбери, к кому подойти: Полли — оружие и доспехи, Захария — артефакты',
    // продавцы нарисованы прямо на картине (PixelLab, та же детальность, что комната)
    spots: [
      { name: 'Полли — оружие и доспехи', shop: 'polly', who: 'Полли', r: [112, 132, 96, 106] },
      { name: 'Захария — артефакты', shop: 'zacharia', who: 'Захария', r: [430, 126, 108, 112] },
      { name: 'Доспех на стойке', look: 'look_armor_stand', r: [196, 172, 50, 60] },
    ],
    lights: [[272, 96, 0.9], [124, 26, 0.6], [310, 26, 0.6], [500, 26, 0.6]],
  },
  // кофейня «Vertrauen» (временная картина — эскиз владельца позже): бариста за стойкой; клик — окно, как у Лики
  cafe: {
    title: 'Кофейня Vertrauen', img: 'assets/vn/cafe_room.png', down: '← На набережную', help: 'наведи на бариста — заказать; на вещи — осмотреть',
    spots: [
      { name: 'Шахбану — бариста', shop: 'cafe', who: 'Шахбану', r: [496, 150, 78, 92] },
      { name: 'Окно', look: 'look_cafe_window', r: [66, 90, 96, 146] },
      { name: 'Столик', look: 'look_cafe_table', r: [250, 236, 120, 80] },
    ],
    lights: [[134, 92, 0.7], [462, 108, 0.7], [508, 92, 0.7]],
  },
};
const vnFigs = {};
const vnFig = src => (vnFigs[src] ??= Object.assign(new Image(), { src }));
let vnImg = null;
function openVN(id) {
  const sc = VN_SCENES[id];
  let el = ui.vn;
  if (!el) {
    el = ui.vn = document.createElement('div');
    el.className = 'vn';
    el.innerHTML = `<canvas width="640" height="360"></canvas><div class="vn-title"></div><div class="vn-label" hidden></div>
      <div class="vn-help">наведи на вещь и нажми — осмотреть</div>
      <div class="vn-bar"><button type="button" class="close-btn" data-a="down">↓ Спуститься</button><button type="button" class="vn-finish" data-a="finish">Завершить миссию</button></div>`;
    ui.box.insertBefore(el, ui.talk);   // окно разговора — поверх картины
    const cv = el.querySelector('canvas');
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 360, e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointermove', e => {
      const v = game.vn; if (!v) return;
      const [x, y, px, py] = at(e);
      v.hover = game.mode === 'vn' ? VN_SCENES[v.id].spots.findIndex(s => x >= s.r[0] && x <= s.r[0] + s.r[2] && y >= s.r[1] && y <= s.r[1] + s.r[3]) : -1;
      vnLabel(px, py);
    });
    cv.addEventListener('pointerleave', () => { if (game.vn) { game.vn.hover = -1; vnLabel(); } });
    cv.addEventListener('pointerdown', e => {
      if (game.mode !== 'vn') return;   // в разговоре клик листает реплики, как везде
      e.stopPropagation(); e.preventDefault();
      ui.box.focus();
      const [x, y] = at(e);
      const i = VN_SCENES[game.vn.id].spots.findIndex(s => x >= s.r[0] && x <= s.r[0] + s.r[2] && y >= s.r[1] && y <= s.r[1] + s.r[3]);
      if (i >= 0) vnLook(i);
    });
    for (const b of el.querySelectorAll('button')) b.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      if (game.mode !== 'vn') return;
      if (b.dataset.a === 'down') vnDown(); else vnFinish();
    });
  }
  if (!vnImg || !vnImg.src.endsWith(sc.img)) { vnImg = new Image(); vnImg.src = sc.img; }
  el.querySelector('.vn-title').textContent = sc.title;
  el.querySelector('.vn-finish').hidden = !sc.finish;             // «Завершить миссию» — только у покоев
  el.querySelector('.close-btn').textContent = sc.down ?? '↓ Спуститься';
  el.querySelector('.vn-help').textContent = sc.help ?? 'наведи на вещь и нажми — осмотреть';
  el.hidden = false;
  el.classList.remove('out', 'black');
  void el.offsetWidth;
  el.classList.add('in');
  game.vn = { id, hover: -1, t: 0 };
  game.mode = 'vn';
  if (id === 'princess') game.flags.map_princess = true;
  hint('');
  sfx.door();
  requestAnimationFrame(vnLoop);
}
function vnLabel(px, py) {
  const lab = ui.vn.querySelector('.vn-label'), v = game.vn;
  const s = v && v.hover >= 0 ? VN_SCENES[v.id].spots[v.hover] : null;
  ui.vn.classList.toggle('pointing', !!s);
  lab.hidden = !s;
  if (!s) return;
  lab.textContent = s.name;
  if (px != null) { lab.style.left = px + 'px'; lab.style.top = py + 'px'; }
}
function vnLook(i) {
  const s = VN_SCENES[game.vn.id].spots[i];
  if (!s) return;
  game.vn.hover = -1; vnLabel();
  if (s.shop) openShop({ def: { shop: s.shop, name: s.who ?? s.name } });   // продавец на картине — окно торговли
  else startTalk(s.look);
}
function vnPress(code) {
  if (code === 'Escape') vnDown();
  else if (/^Digit[1-9]$/.test(code)) vnLook(+code.slice(5) - 1);
}
function vnFinish() {
  startTalk(VN_SCENES[game.vn.id].finish, () => {
    if (!game.flags.vn_leave) return;
    delete game.flags.vn_leave;
    // картина гаснет в темноту — и сразу сцена у портала (та же у всех)
    ui.vn.classList.add('black');
    game.mode = 'vnOut';
    setTimeout(() => {
      closeVN(true);
      game.mode = 'play';
      startPortalEnding();
      game.ending.t = 1.0;   // уже темно — без второго затемнения
    }, 900);
  });
}
// назад: картина тает, рыцарь стоит у нижней ступени лестницы в Преддверии
function vnDown() {
  closeVN();
  game.mode = 'play';
  game.doorLock = true;
  sfx.step();
  callout(room().name, 'muted');
  save();
}
function closeVN(now = false) {
  game.vn = null;
  const el = ui.vn;
  if (!el) return;
  el.classList.remove('in', 'pointing');
  el.querySelector('.vn-label').hidden = true;
  if (now) { el.hidden = true; return; }
  el.classList.add('out');
  setTimeout(() => { if (!game.vn) el.hidden = true; }, 600);
}
function vnLoop(now) {
  const v = game.vn;
  if (!v || !ui.vn) return;
  ui.vn.classList.toggle('talking', game.mode !== 'vn');
  const c = ui.vn.querySelector('canvas').getContext('2d'), sc = VN_SCENES[v.id], t = now / 1000;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#05040a';
  c.fillRect(0, 0, 640, 360);
  if (vnImg?.complete && vnImg.naturalWidth) c.drawImage(vnImg, 0, 0, 640, 360);
  for (const f of sc.figs ?? []) {   // продавцы на картине; clip — нижняя граница (за стойкой видно до пояса); дышат
    const im = vnFig(f.img);
    if (!im.complete || !im.naturalWidth) continue;
    const by = Math.sin(t * 1.8 + f.x) > 0.6 ? -1 : 0;
    if (f.clip) { c.save(); c.beginPath(); c.rect(0, 0, 640, f.clip); c.clip(); c.drawImage(im, f.x, f.y + by); c.restore(); }
    else c.drawImage(im, f.x, f.y + by);
  }
  // живое: свеча / лампы дрожат (lights: [x, y, сила]), в свете плавает пыль
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [cx, cy, pw = 1] of sc.lights ?? [[...sc.candle, 1]]) {
    const fl = 0.8 + 0.2 * Math.sin(t * 9 + cx) * Math.sin(t * 5.3 + 1 + cy);
    const gr = c.createRadialGradient(cx, cy, 1, cx, cy, 46 * fl * pw);
    gr.addColorStop(0, `rgba(255,190,110,${0.32 * fl * Math.min(1, pw)})`);
    gr.addColorStop(1, 'rgba(255,190,110,0)');
    c.fillStyle = gr;
    c.fillRect(cx - 50 * pw, cy - 50 * pw, 100 * pw, 100 * pw);
  }
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + t * (6 + i % 5)) % 640, y = 70 + ((i * 53 + t * (3 + i % 3) * (i % 2 ? 1 : -1)) % 260 + 260) % 260;
    c.fillStyle = `rgba(230,220,255,${0.12 + 0.1 * Math.sin(t * 1.3 + i)})`;
    c.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  c.restore();
  // наведённая вещь: мягкий свет и золотые уголки рамки
  const s = v.hover >= 0 && game.mode === 'vn' ? sc.spots[v.hover] : null;
  if (s) {
    const [x, y, w, h] = s.r, a = 0.75 + 0.25 * Math.sin(t * 4), k = 10;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,225,160,${0.07 * a})`;
    c.fillRect(x, y, w, h);
    c.restore();
    c.fillStyle = `rgba(232,196,104,${a})`;
    for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      c.fillRect(dx > 0 ? px : px - k, dy > 0 ? py : py - 2, k, 2);
      c.fillRect(dx > 0 ? px : px - 2, dy > 0 ? py : py - k, 2, k);
    }
  }
  requestAnimationFrame(vnLoop);
}
function toPortalScene(E) {
  E.phase = 'portal';
  E.t = 0;
  const pr = ROOMS.cell.portal;
  loadRoom('cell', { x: pr.x - 30, z: pr.z, facing: 1 });
  game.flags.chapter1_done = true;
  save();
}
function endingPortal(E, p, dt) {
  const t = E.t, pr = ROOMS.cell.portal;
  E.black = Math.max(0, 1 - t / 0.9);
  p.facing = 1;
  // подходит, опускается на колено и кладёт цветок в янтаре в центр знака; встаёт и отступает
  E.kneel = t >= 1.3 && t < 2.4;
  p.update(dt, STILL);
  if (t < 1.3) p.x = pr.x - 30 + Math.min(1, t / 1.2) * 12;
  if (once(E, 'flower', 1.8)) {
    E.amber = true;
    const i = game.bag.indexOf('resin_flower'); if (i >= 0) game.bag.splice(i, 1);
    sfx.coin(2);
  }
  if (t >= 2.4 && t < 3.0) p.x -= dt * 14;
  E.glow = t < 2.2 ? 0 : Math.min(1.6, (t - 2.2) * 0.45);
  if (once(E, 'hum', 2.6)) sfx.portal();
  if (once(E, 'ring', 4.2)) sfx.ward();
  // рыцарь шагает в свет — тает; вспышка — и он уже перед замком
  if (t >= 6.0 && t < 6.8) p.x += dt * 22;
  if (t >= 6.2) E.knightAlpha = Math.max(0, 1 - (t - 6.2) / 0.6);
  if (once(E, 'flare', 6.4)) { sfx.portal(); shake(2); }
  if (t >= 6.4) E.white = Math.min(1, (t - 6.4) / 0.7);
  if (t >= 7.3 && !E.day) {
    E.day = true;
    openStory('ending_day', () => {
      game.ending = null;
      letterbox(false);
      finish(E.d);
    });
  }
}
// обряд у портала: янтарь в центре, волны по знаку, второй круг с рунами дорисовывается, свет нарастает
const RITE_RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];
function drawPortalRite(cx, cy, E) {
  const t = E.t;
  if (E.amber) {
    const a = 0.7 + 0.3 * Math.sin(game.time * 6);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cx, cy - 1, 1, cx, cy - 1, 10 + 30 * E.glow);
    gr.addColorStop(0, `rgba(255,190,90,${0.5 * a + 0.3 * E.glow})`);
    gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr;
    g.fillRect(cx - 50, cy - 50, 100, 100);
    g.restore();
    rect(g, cx - 2, cy - 3, 4, 3, '#d9822b'); rect(g, cx - 1, cy - 4, 2, 1, '#f2b14a'); rect(g, cx - 1, cy - 2, 1, 1, '#c0392b'); rect(g, cx, cy - 3, 1, 1, '#ffe9a8');
  }
  // волны от янтаря по знаку
  for (const w0 of [2.6, 3.2, 3.8, 4.4]) {
    const k = (t - w0) / 1.3;
    if (k < 0 || k > 1) continue;
    const rx = 4 + 40 * k, ry = rx * 0.27;
    g.globalAlpha = 1 - k;
    for (let a = 0; a < Math.PI * 2; a += 2 / rx) rect(g, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1, '#ffd58a');
    g.globalAlpha = 1;
  }
  // второй круг: дорисовывается по кругу, на нём загораются руны
  const ring = Math.max(0, Math.min(1, (t - 3.4) / 1.8));
  if (ring > 0) {
    const rx = 36, ry = 10;
    for (let a = 0; a < Math.PI * 2 * ring; a += 0.04) rect(g, Math.round(cx + Math.cos(a - Math.PI / 2) * rx), Math.round(cy + Math.sin(a - Math.PI / 2) * ry), 1, 1, '#bff4ff');
    g.font = '7px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < RITE_RUNES.length; i++) {
      const at = i / RITE_RUNES.length;
      if (at > ring) break;
      const a = at * Math.PI * 2 - Math.PI / 2;
      g.globalAlpha = 0.7 + 0.3 * Math.sin(game.time * 4 + i);
      g.fillStyle = i % 2 ? '#ffd58a' : '#bff4ff';
      g.fillText(RITE_RUNES[i], Math.round(cx + Math.cos(a) * (rx - 4)), Math.round(cy + Math.sin(a) * (ry - 1)));
    }
    g.globalAlpha = 1;
  }
  // столб света
  if (t > 5) {
    const k = Math.min(1, (t - 5) / 1.4);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, cy - 120, 0, cy);
    gr.addColorStop(0, 'rgba(191,244,255,0)');
    gr.addColorStop(1, `rgba(255,236,190,${0.55 * k})`);
    g.fillStyle = gr;
    g.fillRect(cx - 10 - 14 * k, cy - 120, 20 + 28 * k, 122);
    g.restore();
  }
}

const SECRETS = ['secret_hall', 'cup_placed', 'secret_library'];  // замурованный проход, алтарь, стеллаж
function finish(d = {}) {
  game.mode = 'end';
  ui.reportBtn.hidden = false;
  const s = game.stats;
  // находки: сундуки и вещи на полу по всем комнатам, тайники, время в игре
  const chests = Object.entries(ROOMS).flatMap(([id, r]) => (r.props ?? []).filter(pr => pr.type === 'chest' || pr.pick).map(pr => `chest_${id}_${pr.id}`));
  const found = chests.filter(f => game.flags[f]).length;
  const secrets = SECRETS.filter(f => game.flags[f]).length;
  const t = Math.round(game.flags.playTime ?? 0), time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  showOverlay(d.finishTitle ?? 'Конец первого этажа',
    `${d.finishText ?? 'Рыцарь поднимается на второй этаж — его мы сделаем дальше.'}\nСундуки: ${found} из ${chests.length} · тайники: ${secrets} из ${SECRETS.length} · время: ${time} · монет: ${game.coins}\nИдеальных парирований: ${s.perfect} · блоков: ${s.block} · уклонов: ${s.dodged} · пропущено: ${s.hit} · контратак: ${s.counter}`,
    'R — пройти заново');
  ui.overlayText.classList.add('controls');
  setMenu([...(game.flags.chapter1_done && !ROOMS[game.room]?.chapter ? [['Глава 2 (черновик) →', startChapter2]] : []), ['Пройти заново', startNew], ['Главное меню', toTitle]]);
  hint('');
}
// глава 2 (каркас, v0.96): рыцарь — на скале с титульного вида, днём; вещи и снаряжение — с собой
function startChapter2() {
  hideOverlay();
  ui.overlayText.classList.remove('controls');
  ui.reportBtn.hidden = true;
  game.flags.chapter = 2;
  game.mode = 'play';
  game.player.hp = CONFIG.playerHp;
  loadRoom('cliff', { x: 60, z: 10, facing: 1 });
  callout('Глава 2 — Спуск', 'perfect');
  save();
}

// ---------- лёгкий режим ----------
let easyOn = false;
try { easyOn = localStorage.getItem('knightNight.easy') === 'on'; } catch { /* без хранилища — выключен */ }
function setEasy(on) {
  easyOn = on;
  Object.assign(CONFIG, on ? EASY : NORMAL);
  try { localStorage.setItem('knightNight.easy', on ? 'on' : 'off'); } catch { /* ничего */ }
}
setEasy(easyOn);

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

// кнопки меню: [подпись, действие] или { slider: подпись, get, set } — ползунок «− 70 % +»; клик по кнопке не доходит до игры
function setMenu(items) {
  ui.overlayMenu.innerHTML = '';
  const button = (label, go, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); go(); });
    return b;
  };
  for (const it of items) {
    if (!it.slider) { ui.overlayMenu.appendChild(button(it[0], it[1])); continue; }
    const row = document.createElement('div');
    row.className = 'slider';
    const text = document.createElement('span');
    const show = () => { text.textContent = `${it.slider}: ${it.get() * 10} %`; };
    const step = d => { it.set(Math.max(0, Math.min(10, it.get() + d))); show(); };
    const minus = button('−', () => step(-1), 'step'), plus = button('+', () => step(1), 'step');
    // стрелки влево / вправо на кнопке ползунка — тоже меняют
    for (const b of [minus, plus]) b.addEventListener('keydown', e => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(e.code === 'ArrowLeft' ? -1 : 1); }
    });
    show();
    row.append(minus, text, plus);
    ui.overlayMenu.appendChild(row);
  }
}

// звук (v0.89): громкость музыки и звуков отдельно, звуки окружения
function showSound(back) {
  showOverlay('Звук', '', 'Esc — назад');
  setMenu([
    { slider: 'Музыка', get: () => volumes().music, set: setMusicVolume },
    { slider: 'Звуки', get: () => volumes().sfx, set: v => { setSfxVolume(v); sfx.block(); } },   // слышно, как громко
    [`Звуки окружения: ${ambientOn ? 'вкл' : 'выкл'}`, () => { setAmbient(!ambientOn); game.ambRoom = null; showSound(back); }],
    ['Назад', back],
  ]);
  game.controlsBack = back;
}

const CONTROLS_TEXT = [
  'WASD — ходить вбок и вглубь (вне боя — бег) · Caps Lock — шагом / бегом',
  'Курсор выше рыцаря — верх, на груди — середина, ниже пояса — низ',
  'Поворот — A / D или курсор по другую сторону рыцаря · с защитой (ПКМ) смотрит на курсор — можно пятиться',
  'ЛКМ — удар на этой высоте · держать ПКМ — защита',
  'Пробел — рывок (курсор внизу — кувырок, вверху — прыжок, с «назад» — отскок)',
  'Колесо вверх — приём оружия · колесо вниз — навык · Q — сменить оружие',
  'E — говорить, лавка, сундук, осмотреть, отдохнуть · W у двери или лестницы — пройти',
  'I — снаряжение · H — зелье · B — журнал · M — карта · Esc — пауза',
  'F — шаг призрака за спину врага (если надета Расколотая маска)',
].join('\n');

// шрифт текста (v0.93, отзыв тестера): диалоги и описания — книжный (Philosopher), сказочный (Alice) или пиксельный (Tiny5)
const BODY_FONTS = [['book', 'книжный', '"Philosopher", "Tiny5", system-ui, sans-serif'], ['story', 'сказочный', '"Alice", "Tiny5", serif'], ['pixel', 'пиксельный', '"Tiny5", system-ui, sans-serif']];
let bodyFont = 'book';
try { bodyFont = localStorage.getItem('knightNight.font') ?? 'book'; } catch { /* по умолчанию */ }
function setBodyFont(id) {
  const f = BODY_FONTS.find(f => f[0] === id) ?? BODY_FONTS[0];
  bodyFont = f[0];
  document.documentElement.style.setProperty('--body', f[2]);
  try { localStorage.setItem('knightNight.font', bodyFont); } catch { /* ничего */ }
}
setBodyFont(bodyFont);

// шагом или бегом (v0.87, владелец: «нужно и ходить медленно, и бегать»): выбор в паузе, Caps Lock — переключает (и запоминает)
let strollOn = false;
try { strollOn = localStorage.getItem('knightNight.stroll') === 'on'; } catch { /* без хранилища — бегом */ }
function setStroll(on) {
  strollOn = on;
  try { localStorage.setItem('knightNight.stroll', on ? 'on' : 'off'); } catch { /* ничего */ }
}
const strolling = () => strollOn;

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
    ...(game.tutorial ? [['Пропустить обучение', () => { resumePlay(); endTutorialSkipped(); }]] : []),   // v0.91
    ['Управление', () => showControls(showPause)],
    ['Звук и музыка', () => showSound(showPause)],
    [`Шрифт текста: ${BODY_FONTS.find(f => f[0] === bodyFont)[1]}`, () => { const i = BODY_FONTS.findIndex(f => f[0] === bodyFont); setBodyFont(BODY_FONTS[(i + 1) % BODY_FONTS.length][0]); showPause(); }],
    [`Передвижение: ${strollOn ? 'шагом' : 'бегом'} (Caps Lock — сменить)`, () => { setStroll(!strollOn); showPause(); }],
    [`Лёгкий режим: ${easyOn ? 'вкл' : 'выкл'}`, () => { setEasy(!easyOn); showPause(); }],
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
  const vr = ROOMS[data.room]?.vn && ROOMS[data.room];   // старое сохранение в покоях — к лестнице и картина (v0.97)
  if (vr) data = { ...data, room: vr.vnFrom[0], x: vr.vnFrom[1], z: 2 };
  continueGame(data);
  game.mode = 'play';
  hideOverlay();
  hint(hintWalk());
  callout(ROOMS[game.room].name, 'muted');
  if (vr) openVN(vr.vn);
}

// ---------- админка (v0.72) ----------
// Для владельца: проверить одну деталь, не проходя всё заново. Включается ссылкой с ?admin (запоминается в браузере,
// ?admin=0 — выключить), открывается F2 или кнопкой «⚙». Тестеры её не видят. Всё делается через сохранение:
// собираем данные сохранения и загружаем их, как «Продолжить», — комната, вещи и флаги сюжета ставятся обычным путём.
const admin = { on: false, open: false, peace: false };
try {
  const q = new URLSearchParams(location.search).get('admin');
  if (q !== null) localStorage.setItem('knightNight.admin', q === '0' ? '' : '1');
  admin.on = !!localStorage.getItem('knightNight.admin');
  admin.peace = !!localStorage.getItem('knightNight.admin.peace');
} catch { /* без localStorage админки нет */ }

const STORY_FLAGS = {
  wake: { seen_wake: true },
  tutorial: { seen_wake: true, trainer_met: true, tutorial_done: true, trainer_gone: true },
  ilia: { done_ilia: true },
  ataman: { done_ataman: true },
  commander: { done_commander: true, balcony_done: true },
  keyguard: { done_keyguard: true },
};
// точки сюжета: откуда начать, что уже пройдено и что в сумке
const ADMIN_POINTS = [
  { name: 'После обучения', room: 'hall', x: 420, steps: ['wake', 'tutorial'], bag: ['sword_old'] },
  { name: 'Перед Илиа', room: 'hall', x: 1980, steps: ['wake', 'tutorial'], bag: ['sword_old'] },
  { name: 'После Илиа (рапира)', room: 'gallery', x: 80, steps: ['wake', 'tutorial', 'ilia'], bag: ['sword_old', 'rapier', 'map'] },
  { name: 'Перед балконом', room: 'balcony', x: 60, steps: ['wake', 'tutorial', 'ilia'], bag: ['sword_old', 'rapier', 'map'] },
  { name: 'Второй этаж', room: 'landing2', x: 200, steps: ['wake', 'tutorial', 'ilia', 'commander'], bag: ['sword_old', 'rapier', 'map'] },
  { name: 'Третий этаж', room: 'landing3', x: 180, steps: ['wake', 'tutorial', 'ilia', 'commander'], bag: ['sword_old', 'rapier', 'map'] },
  { name: 'Глава 2: город (площадь)', room: 'town_square', x: 160, steps: ['wake', 'tutorial', 'ilia', 'ataman', 'commander', 'keyguard', 'boss'], bag: ['sword_old', 'rapier', 'map', 'broken_mask'], flags: { chapter1_done: true, chapter: 2, ending: 'execution', done_boss: true } },
  { name: 'Глава 2: скала', room: 'cliff', x: 60, steps: ['wake', 'tutorial', 'ilia', 'ataman', 'commander', 'keyguard', 'boss'], bag: ['sword_old', 'rapier', 'map', 'broken_mask'], flags: { chapter1_done: true, chapter: 2, ending: 'execution', done_boss: true } },
  { name: 'Финал: покои принцессы', room: 'princess', x: 200, steps: ['wake', 'tutorial', 'ilia', 'ataman', 'commander', 'keyguard'], bag: ['sword_old', 'rapier', 'map', 'broken_mask'], flags: { done_boss: true, ending: 'execution' } },   // к окну, E — портал
  { name: 'Перед боссом (башня)', room: 'tower', x: 120, steps: ['wake', 'tutorial', 'ilia', 'ataman', 'commander', 'keyguard'], bag: ['sword_old', 'rapier', 'map', 'key_tower'] },
];
const ADMIN_LOOT = ['sword_old', 'rapier', 'dagger', 'map', 'journal', 'key_tower', 'diamond_ace', 'broken_mask', 'rosary', 'mar_scarf', 'mar_jacket', 'mar_boots', 'spell_bolt', 'skill_triple', 'skill_cleave', 'golden_skull', 'silver_cup',
  'diary_1', 'diary_2', 'diary_3', 'diary_4', 'diary_full', 'resin_flower', 'heart_half'];   // всё для мирного исхода — проверить сцену

// текущая игра → данные сохранения (как save(), но комнату и место можно подменить)
function adminSnapshot(room = game.room, x = game.player.x) {
  const p = game.player;
  return {
    version: VERSION, room, x: Math.round(x), z: 10, hp: p.hp, weapon: p.weapon,
    coins: game.coins, bag: [...game.bag], equip: { ...game.equip }, bestiary: game.bestiary, unlocked: [...game.unlocked],
    cleared: [...game.cleared], flags: { ...game.flags }, pickups: game.pickups,
  };
}
function adminLoad(data) {
  closeAdmin();
  ui.shop.hidden = true; game.shop = null;
  ui.talk.hidden = true; game.talk = null;
  writeSave(data);
  startContinue(data);
  save();
}
// где встать в комнате: у первой двери, иначе у левого края
const adminSpot = id => Math.max(40, Math.min(ROOMS[id].length - 40, (ROOMS[id].doors?.[0]?.x ?? 40) + 24));

function adminPoint(pt) {
  const flags = Object.assign({}, ...pt.steps.map(s => STORY_FLAGS[s]), pt.flags ?? {});
  const cleared = ALL_ENCOUNTERS.filter(({ enc }) => enc.story && flags['done_' + enc.story]).map(({ key }) => key);
  const unlocked = ['sword', ...(pt.bag.includes('rapier') ? ['rapier'] : [])];
  adminLoad({ version: VERSION, room: pt.room, x: pt.x, z: 10, hp: CONFIG.playerHp, coins: Math.max(game.coins ?? 0, 100),
    bag: pt.bag.filter(i => i !== 'sword_old'), equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked, cleared, flags, pickups: [] });
}

function adminGive(ids) {
  for (const id of ids) {
    if (!ITEMS[id] || id === game.equip.weapon || id === game.equip.armor || id === game.equip.amulet) continue;
    if (ITEMS[id].use || !game.bag.includes(id)) game.bag.push(id);
    if (ITEMS[id].weapon) game.unlocked.add(ITEMS[id].weapon);
  }
  checkSets();
  save();
  callout('Выдано', 'perfect');
}

// убрать врагов комнаты: бои засчитаны, сюжетные — как победа
function adminClearRoom() {
  (ROOMS[game.room].encounters ?? []).forEach((enc, i) => {
    const key = encKey(game.room, i);
    game.cleared.add(key);
    if (enc.story) game.flags['done_' + enc.story] = true;
  });
  if (game.flags.done_ilia && !owns('rapier')) adminGive(['rapier']);
  if (game.flags.done_keyguard && !owns('key_tower')) adminGive(['key_tower']);
  adminLoad(adminSnapshot());
}

function buildAdmin() {
  if (ui.admin) return ui.admin;
  const el = document.createElement('div');
  el.className = 'admin';
  el.hidden = true;
  const floors = {};
  for (const [id, r] of Object.entries(ROOMS)) (floors[r.floor ?? 1] ??= []).push(`<option value="${id}">${r.name}</option>`);
  el.innerHTML = `
    <div class="admin-head"><b>Админка</b><span>F2 — закрыть</span><button type="button" data-a="close">✕</button></div>
    <div class="admin-sec">Начать с точки сюжета (прогресс до неё — пройден)</div>
    <div class="admin-grid">${ADMIN_POINTS.map((pt, i) => `<button type="button" data-a="point" data-i="${i}">${pt.name}</button>`).join('')}</div>
    <div class="admin-sec">Перейти в комнату (с тем, что есть сейчас)</div>
    <div class="admin-row"><select id="admin-room">${Object.entries(floors).map(([f, o]) => `<optgroup label="Этаж ${f}">${o.join('')}</optgroup>`).join('')}</select>
      <button type="button" data-a="room">Перейти</button></div>
    <div class="admin-sec">Выдать</div>
    <div class="admin-grid">
      <button type="button" data-a="loot">Все вещи, оружие, ключи</button>
      <button type="button" data-a="coins">+500 монет</button>
      <button type="button" data-a="potions">5 зелий и бинтов</button>
      <button type="button" data-a="heal">Вылечить</button>
    </div>
    <div class="admin-sec">Очки путей (игроку не видны)</div>
    <div class="admin-row" id="admin-paths"></div>
    <div class="admin-sec">Бой</div>
    <div class="admin-grid">
      <button type="button" data-a="clear">Убрать врагов в комнате</button>
      <label><input type="checkbox" id="admin-god"> Бессмертие</label>
      <label><input type="checkbox" id="admin-peace"> Без обычных монстров (сюжетные бои остаются)</label>
    </div>`;
  ui.box.appendChild(el);
  // клики по панели не доходят до игры (иначе ЛКМ — удар)
  for (const t of ['pointerdown', 'pointerup', 'wheel', 'contextmenu']) el.addEventListener(t, e => e.stopPropagation());
  el.addEventListener('keydown', e => { if (e.code !== 'F2' && e.code !== 'Escape') e.stopPropagation(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') closeAdmin();
    else if (a === 'point') adminPoint(ADMIN_POINTS[+b.dataset.i]);
    else if (a === 'room') { const id = el.querySelector('#admin-room').value; adminLoad(adminSnapshot(id, adminSpot(id))); }
    else if (a === 'loot') adminGive(ADMIN_LOOT);
    else if (a === 'coins') { game.coins += 500; save(); callout('+500 монет', 'perfect'); }
    else if (a === 'potions') adminGive(['potion', 'potion', 'potion', 'potion', 'potion', 'bandage', 'bandage', 'bandage', 'bandage', 'bandage']);
    else if (a === 'heal') { game.player.hp = CONFIG.playerHp; game.shield = null; applyArmor(); renderHearts(); callout('Здоров', 'perfect'); }
    else if (a === 'clear') adminClearRoom();
  });
  el.querySelector('#admin-god').addEventListener('change', e => { game.god = e.target.checked; });
  el.querySelector('#admin-peace').addEventListener('change', e => {
    admin.peace = e.target.checked;
    try { localStorage.setItem('knightNight.admin.peace', admin.peace ? '1' : ''); } catch { /* ничего */ }
  });
  ui.admin = el;
  return el;
}
function toggleAdmin() { if (admin.open) closeAdmin(); else openAdmin(); }
function openAdmin() {
  const el = buildAdmin();
  el.querySelector('#admin-room').value = game.room;
  el.querySelector('#admin-god').checked = !!game.god;
  el.querySelector('#admin-peace').checked = admin.peace;
  el.querySelector('#admin-paths').textContent = PATHS.map(id => `${PATH_NAMES[id]} ${game.flags['path_' + id] ?? 0}`).join(' · ') + ` · мирный исход: ${peaceReady() ? 'да' : 'нет'}`;
  el.hidden = false;
  admin.open = true;
}
function closeAdmin() {
  if (ui.admin) ui.admin.hidden = true;
  admin.open = false;
  input.take();
  ui.box.focus();
}
if (admin.on) {
  // кнопка-шестерёнка в углу: открыть админку мышью
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'admin-btn';
  b.textContent = '⚙';
  b.title = 'Админка (F2)';
  b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); toggleAdmin(); });
  ui.box.appendChild(b);
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
  if (game.storyView) { storyPress(code); return; }
  if (game.mode === 'shop') { shopPress(code); return; }
  if (game.mode === 'vn') { vnPress(code); return; }
  if (game.mode === 'vnOut') return;
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
  if ((code === 'Escape' || code === 'KeyP') && game.mode !== 'talk') {   // в разговоре Esc — пропустить (ниже), не пауза
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
  if (code === 'F2' && admin.on) { toggleAdmin(); return; }
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
    if (code === 'Escape') skipTalk();
    else if (/^Digit[1-9]$/.test(code)) chooseTalk(Number(code.slice(5)) - 1);
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
  if (game.ending) return;   // сцена конца главы (v0.95) — без управления

  const p = game.player;
  if (game.rest) {
    // сидит: E или удар — встать
    if (code === 'KeyE' || is(code, 'attack')) standUp();
    return;
  }
  if (game.vibe) {   // смотрит вдаль: любое нажатие (не сразу) — вернуться
    if (game.vibe.t > 1.2 && !code.startsWith('Wheel')) endVibe();
    return;
  }
  if (code === 'KeyV' && !game.arena && !game.tutorial && nearVibe()) { startVibe(nearVibe()); return; }
  if (code === 'KeyE' && !game.arena) {
    const chest = nearChest();
    if (chest) {
      game.flags[chestFlag(chest)] = true;
      if (chest.pick) {
        // предмет просто лежит — взять
        game.bag.push(chest.pick);
        const w = ITEMS[chest.pick].weapon;
        if (w) game.unlocked.add(w);
        callout(w ? `${ITEMS[chest.pick].name}! Q — сменить оружие` : `Взято: ${ITEMS[chest.pick].name}`, 'perfect');
        sfx.perfect();
        checkSets();
        save();
        if (ITEMS[chest.pick].diary) readPage(chest.pick);   // страница дневника — сразу прочесть (потом — в сумке)
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
    // NPC рядом и ближе вещи для осмотра — сначала разговор (v0.77: Илиа сидит у костра)
    const npcNear = nearNpc(), lookNear = !game.doorNear && nearLook();
    const look = lookNear && !(npcNear && Math.abs(npcNear.x - p.x) <= Math.abs(lookNear.x - p.x) + 4) ? lookNear : null;
    if (look) {
      // у тайника выбор в разговоре ставит флаг — тогда проход открывается
      if (look.lights && !game.flags[look.lights] && look.quiet) {   // ещё одна свеча: просто зажечь, без разговора
        game.flags[look.lights] = true;
        callout('Свеча зажжена', 'perfect'); sfx.perfect(); save();
        return;
      }
      if (look.ending) { startTalk(look.look, () => { if (game.flags.ending) startPortalEnding(); }); return; }   // окно покоев принцессы — к порталу (v0.95)
      if (look.fill && hasItem('silver_cup') && !game.flags[look.fill]) {
        game.flags[look.fill] = true;
        syncCupName();
        callout('Чаша наполнена мутной водой', 'perfect'); sfx.perfect(); save();
        return;
      }
      startTalk(look.lights && game.flags[look.lights] && look.lookLit ? look.lookLit : look.look, look.secret ? () => {
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
      if (!npc.def.still) npc.facing = Math.sign(p.x - npc.x) || -1;
      if (npc.def.shop) openShop(npc);
      else if (npc.def.cat && game.flags.fujin_fed) petCat(npc);   // накормлен — можно погладить (владелец, 17.10)
      else startTalk(npcTalkId(npc.def), npc.def.cat ? () => { if (game.flags.fujin_fed && !npc.belly) { Object.assign(npc, npc.def.bellyAt); npc.belly = true; npc.img = 'cat_belly'; npc.flip = true; } } : null);   // угостил — валится на спину
      return;
    }
  }
  const engaged = !!game.current?.alive;
  const backKeys = p.facing > 0 ? KEYS.left : KEYS.right;
  if (is(code, 'left') || is(code, 'right')) game.faceBy = 'keys';
  if (code === 'CapsLock') { setStroll(!strollOn); callout(strollOn ? 'Шагом' : 'Бегом', 'muted'); }   // v0.93: сама клавиша переключает

  // высота — по курсору: ЛКМ бьёт, ПКМ защищает, пробел — рывок на этой высоте
  const vert = game.aim === 'high' ? 'up' : game.aim === 'low' ? 'down' : null;
  if (code === 'WheelUp') {
    // колесо вверх — приём оружия (вихрь или восьмёрка); пока перезаряжается, ничего не делает
    if (p.spinCharge < 1) callout(`${cap(p.arms.spinName)} не готов${p.weapon === 'rapier' ? 'а' : ''}`, 'muted');
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
  if (code === 'KeyF') useMask();
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

// сторона курсора относительно рыцаря (с запасом 10 px, чтобы у самого рыцаря не дёргался); пересёк — разворот
function updateCursorSide() {
  if (game.mouseX == null) return;
  const dx = Math.round(game.camX) + game.mouseX - game.player.x;
  const side = dx > 10 ? 1 : dx < -10 ? -1 : 0;
  if (side && side !== game.cursorSide) {
    if (game.cursorSide !== undefined) game.faceBy = 'cursor';   // первое значение — не поворот
    game.cursorSide = side;
  }
}

function controls() {
  const p = game.player;
  const engaged = !!game.current?.alive;
  const L = held('left'), R = held('right');
  const dz = (held('depthOut') ? 1 : 0) - (held('depthIn') ? 1 : 0);
  return {
    fwd: p.facing > 0 ? R : L,
    // назад — только когда взгляд держит защита (смотрит на курсор), иначе клавиша сама разворачивает
    back: (p.facing > 0 ? L : R) && !(p.facing > 0 ? R : L),
    dz,
    guard: held('guard') ? game.aim : null,
    engaged,
    stroll: strolling(),
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

// Обычные границы: где нет прохода, стена.
function roomBounds() {
  const L = room().length, edges = room().edges ?? {};
  return [edges.left ? 8 : 16, edges.right ? L - 8 : room().limitRight ?? L - 16];
}
const fleeOK = () => !!ITEMS[game.equip?.feet]?.flee;   // крестовые сапоги (v1.0): из боя можно уйти
const lockedArena = () => game.arena && !game.arena.open && !fleeOK();
// сила удара от снаряжения (червонный доспех, v1.0): произведение power надетых вещей
const attackPower = () => Object.values(game.equip ?? {}).reduce((k, id) => k * (ITEMS[id]?.power ?? 1), 1) * (game.boost?.power ?? 1);

// место для музыки (v0.89): у каждого может быть свой трек — ZONE_TRACK в src/audio.js
function musicZone() {
  if (game.mode === 'title') return 'title';
  if (game.rest || game.vibe || game.ending) return 'rest';
  if (game.arena) {
    // музыка боя — когда закончился разговор перед боем и пошла схватка (владелец, v0.93), дальше — до конца боя (и в паузе)
    const enc = (room().encounters ?? [])[game.arena.index];
    // music — свой трек боя (Илиа, владелец 17.10): с того мига, как он заметил рыцаря и обнажил рапиру
    const awake = game.enemies.some(e => e.group === game.arena.index && e.alive && e.state !== 'dormant');
    const fight = game.enemies.some(e => e.group === game.arena.index && e.kind === 'boss') ? 'boss' : enc?.story ? (enc.music ? (awake || game.arena.music ? enc.music : null) : 'duel') : null;
    if (fight && (game.arena.music || game.mode === 'play')) { game.arena.music = true; return fight; }
  }
  if (game.mode === 'shop' || (room()?.npcs ?? []).some(n => NPC_TYPES[n.type]?.shop)) return 'shop';
  return 'explore';
}

// Встреча начинается, когда рыцарь подходит; проход закрыт, пока группа жива.
function updateArena() {
  const p = game.player;
  const encs = room().encounters ?? [];
  if (!game.arena) {
    if (game.tutorial) return;
    const i = encs.findIndex((enc, i) => !game.cleared.has(encKey(game.room, i)) && flagsOK(enc.needs) && p.x > enc.x - 140 && p.x < enc.x + 150);
    if (i < 0) return;
    // повторный бой с уже побеждёнными обычными врагами не запирает: хочешь — дерись, хочешь — пробеги мимо
    const key = encKey(game.room, i);
    game.arena = { index: i, x: encs[i].x, key, t0: game.time, open: !!game.flags['beat_' + key] && respawnable(encs[i]) };
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
    game.flags['beat_' + game.arena.key] = true;
    const enc = encs[game.arena.index];
    if (enc.story) game.flags['done_' + enc.story] = true;
    const peace = !!enc.peaceTalk && peaceReady();
    if (enc.after) setTimeout(() => startTalk(peace ? enc.peaceTalk : enc.after, () => {
      if (game.room === 'balcony') {
        game.flags.balcony_done = true;
        callout('Лестница на второй этаж — в Столовой', 'perfect');
        save();
      }
      if (enc.finish) startEnding(enc.finish, peace);   // босс главы побеждён — сцена конца главы (v0.95)
    }), enc.finish ? 2200 : 900);
    else if (enc.finish) setTimeout(() => finish(enc.finish), 2200);
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
  // цель (v0.93, без автонаведения) — ближайший враг перед рыцарем; перед ним никого — ближайший вообще
  const group = game.enemies.filter(e => e.group === game.arena.index && e.alive);
  const dist = e => Math.hypot(e.x - p.x, (e.z - p.z) * 2);
  const ahead = group.filter(e => (e.x - p.x) * p.facing > -6);
  let best = null;
  for (const e of ahead.length ? ahead : group) if (!best || dist(e) < dist(best)) best = e;
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
  } else if (tut.stuck) {
    // шаг долго не даётся — наставница отпускает дальше (отзыв тестера: «пока серию не выполнишь — не пройти»)
    callout('Ладно, это придёт с опытом. Дальше!', 'muted');
    tutorialSkipStep();
    return;
  }
  if (tut.text !== before) hint(tut.text);
}

// следующий шаг без выполнения; на последнем — обучение закончено
function tutorialSkipStep() {
  const tut = game.tutorial;
  if (!tut) return;
  tut.skip();
  if (tut.done) { endTutorialSkipped(); return; }
  trainer()?.setPlan(tut.step.plan);
  hint(tut.text);
}
// пропустить обучение целиком (пауза → «Пропустить обучение»)
function endTutorialSkipped() {
  game.tutorial = null;
  game.flags.tutorial_skipped = true;
  trainer()?.setPlan(null);
  hint('');
  setTimeout(() => startTalk('trainer_skip', trainerLeave), 400);
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
  return (room().props ?? []).find(pr => (pr.type === 'chest' || pr.pick) && propOn(pr) && !game.flags[chestFlag(pr)] && Math.abs(pr.x - p.x) < 18 && Math.abs(pr.z - p.z) < 14) ?? null;
}
// декор, который можно осмотреть (look — разговор в DIALOGUES): стоять у стены напротив
function nearLook() {
  const p = game.player;
  const r = room();
  return [...(r.decor ?? []), ...(r.props ?? [])].find(d => d.look && propOn(d) && !(d.secret && game.flags[d.secret]) && !(d.lights && game.flags[d.lights]) && Math.abs(d.x - p.x) < 20 && (d.z === undefined ? p.z < 14 : Math.abs(d.z - p.z) < 12)) ?? null;
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
  const windLevel = r.balcony ? 1 : game.room === 'gallery' || game.room === 'hall3' ? 0.35 : 0;
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
// чаша стоит на алтаре (старые сохранения: поставлена — значит стоит)
const cupOnAltar = () => game.flags.cup_on_altar ?? !!game.flags.cup_placed;
const canSanctify = () => hasItem('silver_cup') && game.flags.cup_water && hasItem('sun_medallion') && !game.flags.cup_holy;
function useAltar(pr) {
  if (canSanctify()) {
    // освящение (лор владельца): вода в старой чаше, медальон Солнца — в воду; освящает не священник, но свет отвечает
    game.bag.splice(game.bag.indexOf('sun_medallion'), 1);
    game.flags.cup_holy = true;
    syncCupName();
    game.flags[pr.altar] = true;
    sparks(pr.x, groundY(pr.z) - 20, 40, ['#ffe080', '#ffffff', '#fff4c2'], 140);
    flash('#fff4c2', 0.7);
    sfx.portal();
    shake(2);
    callout('Свет ответил. Вода в чаше освящена', 'perfect');
    save();
    startTalk('altar_sanctify');
    return;
  }
  if (game.flags[pr.altar] && cupOnAltar()) {
    game.bag.push('silver_cup');
    game.flags.cup_on_altar = false;
    callout('Чаша снова у тебя', 'perfect');
    save();
    return;
  }
  if (game.flags[pr.altar]) { startTalk(hasItem('silver_cup') && game.flags.cup_water && !hasItem('sun_medallion') ? 'altar_need_sun' : 'look_altar_done'); return; }
  if (!hasItem('silver_cup')) { startTalk('look_altar'); return; }
  game.bag.splice(game.bag.indexOf('silver_cup'), 1);
  game.flags[pr.altar] = true;
  game.flags.cup_on_altar = true;
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
  // отдых возвращает обычных врагов по всему замку (появятся при следующем входе в комнату)
  for (const { key, enc } of ALL_ENCOUNTERS) if (respawnable(enc)) game.cleared.delete(key);
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
  if (game.shield < shieldMax()) { game.shield = shieldMax(); renderHearts(); }  // на отдыхе щит сразу полный
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

// «Вайбовать» (v0.81): в особом месте V — Найт останавливается и смотрит; интерфейс тает, кадр отъезжает,
// сверху и снизу — полосы, как в кино, место оживает (src/vibefx.js: птицы, лунный луч, дождь, искры). Наград нет.
function nearVibe() {
  const p = game.player;
  return (room().vibe ?? []).find(v => Math.abs(v.x - p.x) < 26 && (!v.needs || flagsOK(v.needs))) ?? null;
}
function startVibe(spot) {
  const p = game.player;
  game.vibe = { spot, t: 0, from: { x: p.x, z: p.z } };
  if (game.vibeFx?.spot !== spot) resetVibeFx();
  game.vibeFx = game.vibeFx?.spot === spot ? game.vibeFx : { spot, k: 0, t0: game.time };
  game.flags['vibe_' + spot.id] = true;
  p.walking = false;
  p.guard = null;
  if (spot.face) p.facing = spot.face;
  let el = ui.vibe;
  if (!el) {
    el = ui.vibe = document.createElement('div');
    el.className = 'vibe';
    el.innerHTML = '<i class="vibe-bar top"></i><i class="vibe-bar bottom"></i>';
    ui.box.appendChild(el);
  }
  void el.offsetWidth;
  ui.box.classList.add('vibing');
  setMusicCalm(true);
  hint('');
  save();
}
// живая картинка места: нарастает, пока Найт смотрит, и плавно гаснет, когда он отвернулся
// Фуджин в темноте (v0.85, владелец: «его плохо видно»): чёрный кот в тёмной библиотеке гаснет под живым светом.
// Поверх света — тонкий лунный ободок по силуэту и горящие жёлтые глаза (как у настоящего кота в темноте).
const catLook = new Map();
function catLookOf(name) {
  if (catLook.has(name)) return catLook.get(name);
  const im = objImage(name);
  if (!im) return null;
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h), a = i => d.data[i * 4 + 3] > 100, eyes = [];
  const rim = x.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = y * w + xx, r = d.data[i * 4], g2 = d.data[i * 4 + 1], b = d.data[i * 4 + 2];
    if (a(i) && r > 170 && g2 > 130 && b < 110) eyes.push([xx, y]);
    // ободок — край силуэта сверху и с боков (свет сверху), снизу не нужен
    if (a(i) && ((y > 0 && !a(i - w)) || (xx > 0 && !a(i - 1)) || (xx < w - 1 && !a(i + 1)))) { rim.data.set([150, 140, 190, 255], i * 4); }
  }
  x.clearRect(0, 0, w, h); x.putImageData(rim, 0, 0);
  const look = { rim: c, eyes, w, h };
  catLook.set(name, look);
  return look;
}
function catGlow(name, x, gy, flip) { (game.catGlow ??= []).push({ name, x: x + Math.round(game.camX), gy, flip }); }
function drawCatGlow(cam) {
  for (const c of game.catGlow ?? []) {
    const L = catLookOf(c.name);
    if (!L) continue;
    fx.save();
    fx.translate(Math.round(c.x - cam), 0);
    if (c.flip) fx.scale(-1, 1);
    const left = -L.w / 4, top = c.gy - L.h / 2;
    fx.globalAlpha = 0.45; fx.drawImage(L.rim, left, top, L.w / 2, L.h / 2);
    const pulse = 0.85 + 0.15 * Math.sin(game.time * 1.7);
    for (const [ex, ey] of L.eyes) {
      fx.globalAlpha = 0.18 * pulse; fx.fillStyle = '#ffd84a'; fx.fillRect(left + ex / 2 - 0.25, top + ey / 2 - 0.25, 1, 1);   // лёгкое свечение — глаза остаются двумя огоньками
      fx.globalAlpha = pulse; fx.fillStyle = '#fff0a0'; fx.fillRect(left + ex / 2, top + ey / 2, 0.5, 0.5);
    }
    fx.restore();
  }
}
// слой поверх живого света: живая картинка вайба и эффекты боя (src/combatfx.js) — светятся сами
// смена времени суток кадрами (v1.0, владелец 23.10: «покадрово, без полосы»): у места вайба frames — картины той же поляны
// на закате, в сумерках и ночью; переход — плавное смешение соседних кадров по ходу ночи (k), обратно — так же, рассветом
const timeFrameImgs = {};
function drawTimeFrames(cam) {
  const v = game.vibeFx, fr = v?.spot.frames;
  if (!fr) return;
  const imgs = fr.map(src => (timeFrameImgs[src] ??= Object.assign(new Image(), { src })));
  if (!imgs.every(im => im.complete && im.naturalWidth)) return;
  const k = Math.max(0, Math.min(1, v.k)), e = k * k * (3 - 2 * k), seg = e * imgs.length;   // 0 — день, 1 — последний кадр
  g.save();
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < imgs.length; i++) {
    const a = Math.max(0, Math.min(1, seg - i));   // кадр i проявляется поверх предыдущего
    if (a <= 0) break;
    g.globalAlpha = a;
    g.drawImage(imgs[i], -cam, 0, room().length, H);
  }
  g.restore();
}
function renderOverlayFx() {
  const busy = !!game.vibeFx || combatFxBusy() || !!game.catGlow?.length;
  if (busy || fxCanvas.dataset.dirty) { fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); delete fxCanvas.dataset.dirty; }
  if (!busy || game.mode === 'title') return;
  fxCanvas.dataset.dirty = '1';
  fx.setTransform(S, 0, 0, S, 0, 0);
  const cam = Math.round(game.camX);
  if (game.vibeFx) renderVibeFx(cam);
  drawCatGlow(cam);
  drawCombatFx(fx, cam);
}
function renderVibeFx(cam) {
  const v = game.vibeFx;
  const now = performance.now() / 1000, dt = Math.min(0.25, now - (v.last ?? now));   // по времени, а не по кадрам
  v.last = now;
  const slow = v.spot.fx === 'night';   // ночь на поляне: закат ≈ 10 с, рассвет ≈ 6 с (владелец: медленнее и красивее)
  v.k = game.vibe ? Math.min(1, v.k + dt / (slow ? 10 : 2.5)) : v.k - dt / (slow ? 6 : 1.2);
  v.dawn = !game.vibe;
  if ((v.k <= 0 && !game.vibe) || !(room().vibe ?? []).includes(v.spot)) { game.vibeFx = null; return; }
  const sp = v.spot, k = v.k * v.k * (3 - 2 * v.k);
  const src = vibeSource(sp, cam);
  drawVibeFx(fx, sp.fx, { night: v.k, dawn: v.dawn, painted: !!sp.frames, cam, sky: sp.fx === 'night' ? tileSets[room().tiles]?.[0] : null, sx: (sp.fxX ?? sp.x) - cam, fireX: (sp.fxX ?? sp.x) - cam, win: src.win, hole: src.hole, sun: sp.sun, top: sp.fxTop, z: sp.fxZ, k, t: game.time, vt: game.time - v.t0, dt, floor: CONFIG.floorTop, gy: groundY });
}
// откуда свет у места вайба (v0.83): окно — ближайшее к месту убранство-окно, пролом — убранство roofhole (их рамки на экране)
function vibeSource(sp, cam) {
  const x = sp.fxX ?? sp.x, near = type => (room().decor ?? []).filter(d => d.type === type).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  const out = {};
  if (sp.fx === 'moon') { const d = near('window'), b = d && decorBounds(d, CONFIG.floorTop); if (b) out.win = { x0: b.x0 - cam, x1: b.x1 - cam, y0: b.y0, y1: b.y1 }; }
  if (sp.fx === 'rain') { const d = near('roofhole'), b = d && decorBounds(d, CONFIG.floorTop); if (b) { const w = b.x1 - b.x0; out.hole = { x0: b.x0 + w * 0.3 - cam, x1: b.x1 - w * 0.3 - cam, y: b.y1 - 5 }; } }
  return out;
}
function updateVibe(dt) {
  const v = game.vibe, sit = v.spot.sit;
  v.t += dt;
  if (sit) {   // подходит и садится (у костра — напротив Илиа, в той же позе)
    const u = Math.min(1, v.t / 0.6), e = u * u * (3 - 2 * u), p = game.player;
    p.x = v.from.x + (sit.x - v.from.x) * e;
    p.z = v.from.z + (sit.z - v.from.z) * e;
    p.facing = sit.face ?? p.facing;
  }
  if (game.vibe.t > 1.2 && (held('left') || held('right') || held('depthIn') || held('depthOut'))) endVibe();
}
function endVibe() {
  game.vibe = null;
  ui.box.classList.remove('vibing');
  setMusicCalm(false);
  hint(hintWalk());
}

function nearNpc() {
  const p = game.player;
  return game.npcs.find(n => Math.abs(n.x - p.x) < 28 && Math.abs(n.z - p.z) < 12) ?? null;
}

// Вход в дверь: прижался к стене у двери и держит W.
function updateDoors(dt) {
  const p = game.player;
  const d = p.ready && !lockedArena() && !game.tutorial ? doorAt(p) : null;
  game.doorNear = d;
  if (game.doorLock && !held('depthIn')) game.doorLock = false;  // вышел из двери — сначала отпусти W
  if (!d || !held('depthIn') || p.z > (d.leaf ? 7 : 1) || game.doorLock) { game.doorPush = 0; return; }
  game.doorPush += dt;
  if (game.doorPush < 0.12) return;
  game.doorPush = 0;
  const opensWithKey = (d.key && hasItem(d.key)) || (d.requires && game.flags[d.requires]);
  if (opensWithKey && !game.flags['opened_' + d.id]) {
    game.flags['opened_' + d.id] = true;
    if (!d.stairs) callout('Ключ подошёл', 'perfect');
  }
  if (d.locked && !opensWithKey) {
    if (game.time - game.lockedSaidAt > 1.5) {
      game.lockedSaidAt = game.time;
      callout(d.locked, 'muted');
      sfx.block();
    }
    return;
  }
  if (d.finish) { if (d.finishTalk) startTalk(d.finishTalk, () => finish(d)); else finish(d); return; }
  if (d.fall) { game.transition = { kind: 'fall', door: d, phase: 'drop', t: 0 }; sfx.dash(); return; }
  if (d.stairs) {
    // лестница: шаг к ступеням, затемнение — и уже на другом этаже, без проёма в стене
    const up = (ROOMS[d.to].floor ?? 1) > (room().floor ?? 1);
    // наверх по нарисованной лестнице — подойти к нижней ступени и подняться по ней (v0.70); иначе — шаг и затемнение
    const geom = (up || d.climb) && stairsGeom(room(), CONFIG.floorTop);
    game.transition = { kind: 'stairs', door: d, dir: up || d.climb ? 1 : -1, phase: geom ? 'toStairs' : 'out', t: 0, geom };
    p.sheathed = true;
    return;
  }
  game.transition = { kind: 'door', door: d, phase: 'turn', t: 0, x0: p.x, z0: p.z };
  sfx.door();
}

// Выход за край комнаты (там, где есть проход).
function updateEdges() {
  const p = game.player;
  if (lockedArena() || game.tutorial || !p.ready) return;
  const edges = room().edges ?? {};
  const L = room().length;
  if (edges.left && p.x <= 10 && held('left')) game.transition = { kind: 'edge', edge: edges.left, dir: -1, phase: 'out', t: 0 };
  else if (edges.right && p.x >= L - 10 && held('right')) game.transition = { kind: 'edge', edge: edges.right, dir: 1, phase: 'out', t: 0 };
}

// Переходы по нарисованной дороге (v1.0, владелец 22.10: «идти по тропинке — отдаляться от экрана, а не в бок»):
// рыцарь идёт по тропе, лестнице или мосту так, как они нарисованы, вдали уменьшается и тает; в другой комнате выходит
// из её дали навстречу. paths у комнаты: { id, x: [x0, x1], z: [z0, z1], keys: ['depthIn'], name,
//   pts: [[x, y, масштаб], ...] — первая точка на полу, последняя в дали (y — экранная, как groundY),
//   to, at: { path: id } — выйти из дали по тропе той комнаты | { edge: 'left' | 'right', z } — войти с края | { x, z } }
// Край комнаты тоже может вести к тропе: edges.left = { to, at: { path } }.
const PATH_KEY = { depthIn: 'W ↑', depthOut: 'S ↓', right: 'D →', left: 'A ←' };
const pathHint = q => `${q.keys.map(k => PATH_KEY[k]).join(' / ')} — ${q.name}`;
const PATH_V = 38;          // шаг по тропе, px/с при масштабе 1 (вдали медленнее — так видит глаз)
const PATH_FADE = 20;       // последние px пути — тает и темнеет экран
function pathAt(p) {
  return (room().paths ?? []).find(q => (!q.needs || game.flags[q.needs]) && p.x >= q.x[0] && p.x <= q.x[1]
    && p.z >= (q.z?.[0] ?? -99) && p.z <= (q.z?.[1] ?? 99)) ?? null;
}
function updatePaths() {
  const p = game.player;
  game.pathNear = null;
  if (lockedArena() || game.tutorial || !p.ready) return;
  const q = pathAt(p);
  game.pathNear = q;
  if (game.pathLock) { if (game.pathLock.some(k => held(k))) return; game.pathLock = null; }
  if (q && q.keys.some(k => held(k))) startPath(q.pts, { kind: 'out', q });
}
// длины отрезков и точка на пути по пройденному расстоянию: x, y, масштаб и направление шага
function pathGeom(pts) {
  const seg = pts.slice(1).map((b, i) => Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]));
  return { pts, seg, len: seg.reduce((a, b) => a + b, 0) };
}
function pathPoint(G, d) {
  const { pts, seg } = G;
  let i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const a = pts[i], b = pts[i + 1] ?? a, u = seg[i] ? Math.max(0, Math.min(1, d / seg[i])) : 1;
  const sa = a[2] ?? 1, sb = b[2] ?? sa;
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, s: sa + (sb - sa) * u, dx: b[0] - a[0], dy: b[1] - a[1] };
}
function startPath(pts, o) {
  const p = game.player;
  // от того места, где стоит, — к началу тропы, дальше по ней
  const all = o.kind === 'out' ? [[p.x, groundY(p.z), 1], ...pts] : pts;
  game.transition = { kind: 'path', dir: o.kind, q: o.q, G: pathGeom(all), d: 0, t: 0, step: p.step ?? 0 };
  p.sheathed = true;
  p.walking = true;
  updatePathPos(game.transition);
}
function updatePathPos(tr) {
  const c = pathPoint(tr.G, tr.d), L = tr.G.len;
  const side = Math.abs(c.dx) >= Math.abs(c.dy) * 0.8;
  tr.pos = { x: c.x, y: c.y, s: c.s, facing: c.dx >= 0 ? 1 : -1, depth: side ? null : c.dy < 0 ? 'north' : 'south',
    alpha: tr.dir === 'out' ? Math.max(0, Math.min(1, (L - tr.d) / PATH_FADE)) : Math.min(1, tr.d / PATH_FADE) };
  tr.fade = tr.q?.blend ? 0 : 1 - tr.pos.alpha;   // blend — без темноты: кадр перетекает в следующий
  if (tr.q?.blend && tr.dir === 'in') tr.pos.alpha = Math.min(1, 0.35 + tr.d / PATH_FADE);
  game.player.x = c.x;   // камера — за рыцарем
}
function arriveAt(to, at, keys) {
  const r = ROOMS[to];
  const q = at?.path && (r.paths ?? []).find(x => x.id === at.path);
  if (q) {
    const pts = [...q.pts].reverse();
    loadRoom(to, { x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] - (CONFIG.floorTop + 6) });
    // floorTop у комнаты свой — пересчитать после загрузки
    game.player.z = Math.max(0, pts[pts.length - 1][1] - (CONFIG.floorTop + 6));
    startPath(pts, { kind: 'in', q });
  } else if (at?.door) {
    // выходит из нарисованной двери: створка открывается, шаг к нам, поворот
    const d = (r.doors ?? []).find(x => x.id === at.door);
    loadRoom(to, { x: d.x, z: -7 });
    game.transition = { kind: 'door', door: d, phase: 'fadeIn', t: 0, x0: d.x, z0: -7 };
  } else if (at?.edge) {
    const L = r.length, dir = at.edge === 'left' ? 1 : -1;
    loadRoom(to, { x: dir > 0 ? 14 : L - 14, z: at.z ?? 12, facing: dir });
    game.transition = { kind: 'edge', edge: { to }, dir, phase: 'in', t: 0 };
  } else {
    loadRoom(to, { x: at?.x ?? 40, z: at?.z ?? 10 });
    game.transition = { kind: 'edge', edge: { to }, dir: 1, phase: 'in', t: 0 };
  }
  game.pathLock = keys;   // держит клавишу, которой пришёл, — не уходить сразу обратно
  if (ui.floorcard.hidden) callout(r.name, 'muted');
}
// плавный переход (владелец 23.10: «чтобы не соединялись два кадра»): последний кадр комнаты запоминается и, наезжая
// туда, куда ушёл рыцарь, растворяется в новой комнате — без затемнения. Включается у тропы флагом blend.
const BLEND_T = 0.8;
let blendTmp = null;
function blendFrom(tr) {
  const c = document.createElement('canvas');
  c.width = g.canvas.width; c.height = g.canvas.height;
  c.getContext('2d').drawImage(g.canvas, 0, 0);
  const end = tr.G.pts[tr.G.pts.length - 1];
  game.blend = { img: c, t: 0, ox: (end[0] - game.camX) * S, oy: end[1] * S };
}
function renderBlend() {
  const b = game.blend;
  if (!b) return;
  const k = Math.min(1, b.t / BLEND_T), e0 = k * k * (3 - 2 * k), e = e0 * e0 * (3 - 2 * e0);   // круче в середине — двойной кадр мелькает коротко
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  // новая комната: камера начинает чуть ближе к тому месту, откуда выходит рыцарь, и отъезжает — одно движение с наездом старой
  const t = game.transition, from = t?.kind === 'path' && t.dir === 'in' ? t.G.pts[0] : null;
  if (from) b.nx ??= (from[0] - game.camX) * S, b.ny ??= Math.min(H, from[1]) * S;
  if (b.nx != null && e < 1) {
    blendTmp ??= document.createElement('canvas');
    if (blendTmp.width !== g.canvas.width) { blendTmp.width = g.canvas.width; blendTmp.height = g.canvas.height; }
    const tg = blendTmp.getContext('2d');
    tg.clearRect(0, 0, blendTmp.width, blendTmp.height); tg.drawImage(g.canvas, 0, 0);
    const s2 = 1 + 0.16 * (1 - e);
    g.translate(b.nx, b.ny); g.scale(s2, s2); g.translate(-b.nx, -b.ny);
    g.drawImage(blendTmp, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  g.globalAlpha = 1 - e;
  const sc = 1 + 0.3 * e;
  g.translate(b.ox, b.oy); g.scale(sc, sc); g.translate(-b.ox, -b.oy);
  g.drawImage(b.img, 0, 0);
  g.restore();
}
function updatePathTransition(tr, dt) {
  const p = game.player;
  if (tr.black != null) {   // миг полной темноты между комнатами
    tr.black += dt;
    if (tr.black >= 0.12) arriveAt(tr.q.to, tr.q.at, ['depthIn', 'depthOut', 'left', 'right'].filter(k => held(k)));
    return;
  }
  tr.d += PATH_V * Math.max(0.55, tr.pos?.s ?? 1) * dt;
  tr.step += dt * 1.6;
  if (tr.d >= tr.G.len) {
    tr.d = tr.G.len;
    updatePathPos(tr);
    if (tr.dir === 'out' && tr.q.blend) { blendFrom(tr); sfx.step(); arriveAt(tr.q.to, tr.q.at, ['depthIn', 'depthOut', 'left', 'right'].filter(k => held(k))); return; }
    if (tr.dir === 'out') { tr.black = 0; tr.fade = 1; sfx.step(); return; }
    const end = tr.G.pts[tr.G.pts.length - 1];
    p.x = end[0]; p.z = Math.max(0, Math.min(CONFIG.depth, end[1] - (CONFIG.floorTop + 6)));
    p.facing = tr.pos.facing; p.walking = false; p.step = 0;
    game.transition = null;
    save();
    return;
  }
  updatePathPos(tr);
}

const DOOR_PHASES = { turn: 0.35, walkIn: 0.5, fadeOut: 0.22, fadeIn: 0.22, walkOut: 0.5, turnOut: 0.3 };   // створка видна, пока поворачивается
const EDGE_PHASES = { out: 0.3, in: 0.3 };
const STAIR_PHASES = { out: 0.4, in: 0.35 };
// синий огонь (v0.70, владелец): пока идёт разговор — обычные факелы; когда бой начался — вспышка (огонь раздувается,
// рёв пламени) и пламя становится призрачно-синим. blueFireAt — когда вспыхнули (в этой комнате)
function bossFireTick() {
  if (game.blueFireAt != null || game.mode !== 'play' || game.talk) return;
  if (game.enemies.some(e => e.kind === 'boss' && e.alive && e.state !== 'dormant')) { game.blueFireAt = game.time; sfx.flame(); shake(2); }
}
const bossFireAge = () => (game.blueFireAt == null ? -1 : game.time - game.blueFireAt);
const bossFire = () => bossFireAge() > 0.22;                                   // цвет меняется на пике вспышки
const fireFlare = () => { const a = bossFireAge(); return a >= 0 && a < 0.7 ? Math.sin(Math.PI * a / 0.7) : 0; };
function torchUnderStairs(r, x) {
  const st = stairsGeom(r, CONFIG.floorTop);
  return !!st && x > st.x0 - 4 && x < st.x0 + st.w + 4;
}
const CLIMB_T = 1.3;   // подъём по ступеням, секунд
// точка на ломаной (по длине), k от 0 до 1
function alongPath(pts, k) {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let d = k * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const u = seg[i] ? Math.min(1, d / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function updateTransition(dt) {
  const tr = game.transition;
  const p = game.player;
  tr.t += dt;
  if (tr.kind === 'path') { updatePathTransition(tr, dt); return; }
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
  if (tr.kind === 'stairs') {
    if (tr.phase === 'toStairs') {
      // к нижней ступени: вдоль стены и к ней
      const [sx] = tr.geom.pts[0];
      const dx = sx - p.x, v = CONFIG.exploreSpeed;
      p.facing = dx >= 0 ? 1 : -1;
      p.x += Math.sign(dx) * Math.min(Math.abs(dx), v * dt);
      p.z = Math.max(0, p.z - CONFIG.exploreDepthSpeed * dt);
      p.walking = true;
      p.step += dt * v / strideCycle(0);
      if ((Math.abs(dx) < 1 && p.z <= 0.5) || tr.t > 1.4) { tr.phase = 'climb'; tr.t = 0; }
      return;
    }
    if (tr.phase === 'climb' || tr.phase === 'descend') {
      // по ступеням наискось: вверх к двери на площадке (к концу растворяется в ней), вниз — от двери к полу
      const T = tr.phase === 'climb' ? CLIMB_T : CLIMB_T * 0.85;
      const k = Math.min(1, tr.t / T);
      const pts = tr.phase === 'climb' ? tr.geom.pts : [...tr.geom.pts].reverse();
      const [x, y] = alongPath(pts, k);
      game.climb = { x, y, step: tr.t * 1.7, facing: tr.phase === 'climb' ? 1 : -1,
        alpha: tr.phase === 'climb' ? (k > 0.8 ? (1 - k) / 0.2 : 1) : Math.min(1, k / 0.2) };
      if (tr.t >= T) {
        game.climb = null;
        if (tr.phase === 'climb') { tr.phase = 'out'; tr.t = STAIR_PHASES.out; }
        else {
          p.x = pts[pts.length - 1][0]; p.z = 0; p.facing = 1;
          game.transition = null; game.doorLock = true; save();
        }
      }
      return;
    }
    if (tr.phase === 'out') {
      p.facing = tr.dir;
      p.x += tr.dir * CONFIG.exploreSpeed * 0.6 * dt;
      p.step += dt * CONFIG.exploreSpeed * 0.6 / strideCycle(0);
      p.walking = true;
      if (tr.t >= STAIR_PHASES.out && ROOMS[tr.door.to].vn) {
        // наверху — покои картиной (v0.97); рыцарь ждёт у нижней ступени, чтобы вернуться туда же
        const g0 = tr.geom ?? stairsGeom(room(), CONFIG.floorTop);
        if (g0) p.x = g0.pts[0][0] - 6;
        p.z = 2; p.facing = -1; p.walking = false; p.step = 0;
        game.transition = null;
        openVN(ROOMS[tr.door.to].vn);
        return;
      }
      if (tr.t >= STAIR_PHASES.out) {
        const to = ROOMS[tr.door.to];
        const out = to.doors.find(x => x.id === tr.door.toDoor);
        loadRoom(tr.door.to, { x: out.x, z: 8, facing: 1 });
        p.walking = false;
        p.step = 0;
        if (ui.floorcard.hidden) callout(to.name, 'muted');
        sfx.step();
        tr.phase = 'in';
        tr.t = 0;
        // пришёл сверху в комнату с нарисованной лестницей — сходит по ней
        const geom = tr.dir < 0 && out.stairs && stairsGeom(to, CONFIG.floorTop);
        if (geom) { tr.geom = geom; tr.phase = 'descend'; }
      }
    } else if (tr.t >= STAIR_PHASES.in) {
      game.transition = null;
      game.doorLock = true;
      save();
    }
    return;
  }
  if (tr.kind === 'edge') {
    const v = Math.max(CONFIG.exploreSpeed, p.speedNow ?? 0);
    p.x += tr.dir * v * dt;
    p.facing = tr.dir;
    p.step += dt * v / strideCycle(p.gaitRun ?? 0);
    p.walking = true;
    if (tr.phase === 'out' && tr.t >= EDGE_PHASES.out && tr.edge.at) {
      arriveAt(tr.edge.to, tr.edge.at, [tr.dir > 0 ? 'right' : 'left']);   // край ведёт к тропе или к краю другой комнаты
      return;
    }
    if (tr.phase === 'out' && tr.t >= EDGE_PHASES.out) {
      loadRoom(tr.edge.to, { x: tr.edge.x - tr.dir * 18, z: p.z, facing: tr.dir });
      tr.phase = 'in';
      tr.t = 0;
      if (ui.floorcard.hidden) callout(tr.edge.name && tr.dir > 0 && tr.edge.name !== room().name ? `${tr.edge.name} → ${room().name}` : room().name, 'muted');
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
  if (tr.phase === 'fadeOut' && tr.door.at) { arriveAt(tr.door.to, tr.door.at, ['depthIn']); return; }
  if (tr.phase === 'fadeOut' && ROOMS[tr.door.to]?.vn) {
    game.transition = null;
    p.x = tr.door.x; p.z = 3; p.facing = 1; p.step = 0;
    game.view = 'side';
    openVN(ROOMS[tr.door.to].vn);
    return;
  }
  if (tr.phase === 'fadeOut') {
    const to = ROOMS[tr.door.to];
    const out = to.doors.find(d => d.id === tr.door.toDoor);
    loadRoom(tr.door.to, { x: out.x, z: -7 });
    tr.door = out;
    if (ui.floorcard.hidden) callout(to.name, 'muted');  // заставка этажа уже называет комнату
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
  if (game.blend && (game.blend.t += dt) >= BLEND_T) game.blend = null;
  if (game.mode === 'play') try { updateAim(); } catch (err) { frameError(performance.now(), err); }  // высота — до нажатий этого кадра
  for (const code of input.take()) {
    try { handlePress(code); } catch (err) { frameError(performance.now(), err); }   // сбой одной клавиши не глотает остальные (Esc)
  }
  if (game.mode !== 'play') return;

  game.time += dt;
  game.flags.playTime = (game.flags.playTime ?? 0) + dt;  // время в игре — копится в сохранении
  const p = game.player;
  updateMotes(dt);
  if (game.cutscene) { updateCutscene(dt); return; }
  if (game.ending) { updateEnding(dt); updateFx(dt); updateCamera(dt); return; }
  if (game.transition) { updateTransition(dt); updateCamera(dt); return; }
  if (game.rest) { updateRest(dt); updateCoinFx(dt); updateCamera(dt); return; }
  if (game.pet) { updatePet(dt); updateFx(dt); updateCamera(dt); return; }
  if (game.vibe) { updateVibe(dt); updateCamera(dt); return; }
  updateShield(dt);
  updateEnterTalk();
  updateArena();
  updateTrainerMeet();
  if (!game.arena && !game.tutorial && game.mode === 'play') {
    const npc = nearNpc();
    const d = game.doorNear;
    const near = nearChest();
    hint(near ? (near.pick ? `E — взять: ${ITEMS[near.pick].name}` : 'E — открыть сундук') : npc ? `E — ${npc.def.shop ? npc.def.verb ?? 'лавка' : npc.def.cat && game.flags.fujin_fed ? 'погладить' : npc.def.verb ?? 'говорить'}: ${npc.def.alias && !game.flags[npc.def.known] ? npc.def.alias : npc.def.name}` : game.pathNear ? pathHint(game.pathNear) : d ? (d.locked ? `${d.locked}` : d.fall || d.stairs ? `W — ${d.name}` : `W у двери — войти: ${d.name ?? 'дверь'}`) : nearAltar() ? (canSanctify() ? 'E — освятить воду в чаше' : game.flags[nearAltar().altar] && cupOnAltar() ? 'E — взять чашу с алтаря' : game.flags[nearAltar().altar] ? 'E — осмотреть: алтарь' : hasItem('silver_cup') ? 'E — поставить Серебряную чашу на алтарь' : 'E — осмотреть: алтарь') : nearRest() ? `E — отдохнуть ${nearRest().rest.name} (сохранение)` : nearLook()?.fill && hasItem('silver_cup') && !game.flags[nearLook().fill] ? 'E — набрать воды в чашу' : nearLook() ? `E — осмотреть: ${nearLook().name}${nearLook().type === 'cracks' ? ' · ЛКМ — ударить' : ''}` : hintWalk(), nearVibe());
  } else if (game.arena?.open) {
    const d = game.doorNear;
    hint(d ? (d.locked ? d.locked : d.fall || d.stairs ? `W — ${d.name}` : `W у двери — войти: ${d.name ?? 'дверь'}`) : game.time - game.arena.t0 < 4 ? 'Можно не драться — проскочи рывком (пробел) сквозь врагов' : '');
  }
  updateToken();
  pickTarget();
  const cur = game.current?.alive ? game.current : null;

  // куда смотрит рыцарь (v0.93, решение владельца — без автонаведения): куда идёт (A / D) или где курсор.
  // Курсор перешёл на другую сторону рыцаря — разворот; держит защиту (ПКМ) — смотрит на курсор, можно пятиться,
  // прикрываясь; иначе — по клавишам. Действует последнее: нажал клавишу — она, сдвинул курсор за спину — курсор.
  const free = p.state === 'ready';
  updateCursorSide();
  if (free) {
    const L = held('left'), R = held('right');
    if (held('guard') && game.cursorSide) p.facing = game.cursorSide;
    else if (L !== R) p.facing = L ? -1 : 1;
    else if (game.faceBy === 'cursor' && game.cursorSide) p.facing = game.cursorSide;
  }
  updateView(dt, !!cur);

  updateCharge();
  updateCoinFx(dt);
  updateAmbience(dt);
  const px0 = p.x, pz0 = p.z;
  p.update(dt, controls());
  // мебель, сквозь которую не пройти (block: [полуширина, глубина] у предмета; бар — вид сверху, v0.98): шаг назад по оси, что упёрлась
  // blocks у комнаты — то же для нарисованного на картине (клумбы, кадки у ратуши): { x, z, block }
  for (const pr of [...(room().props ?? []), ...(room().blocks ?? [])]) {
    if (!pr.block) continue;
    const inside = (x, z) => Math.abs(x - pr.x) < pr.block[0] && z > pr.z - pr.block[1] && z < pr.z + 2;
    if (!inside(p.x, p.z)) continue;
    if (!inside(px0, p.z)) p.x = px0; else if (!inside(p.x, pz0)) p.z = pz0; else { p.x = px0; p.z = pz0; }
  }
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
  updateBlink();
  handlePlayerEvents();
  updateChokeHint();
  updatePickups(dt);
  for (const n of game.npcs) if (Math.abs(n.x - p.x) < 80 && !n.def.still) n.facing = Math.sign(p.x - n.x) || n.facing;   // сидящие — как сидят

  for (const e of game.enemies) {
    if ((e.state === 'dead' && e.t > 2) || e.state === 'gone') continue;
    e.update(dt, world);
    if (!e.alive && !e.paid && e.state !== 'leave' && COINS[e.type]) {
      payCoins(e);
      // задание Алкимы (v0.78): обрывок старинной ткани — у мародёра там, где их больше всего (Северное крыло)
      if (game.room === 'hall3' && MARAUDERS.has(e.type) && game.flags.alkima_quest && !owns('old_fabric') && !game.flags.alkima_done) {
        game.bag.push('old_fabric'); callout('Найдено: обрывок старинной ткани', 'perfect'); sfx.perfect(); save();
      }
    }
    if (e.state === 'rise' && !e.roseFx) {
      // кости зашевелились и собираются
      e.roseFx = true;
      sparks(e.x, groundY(e.z) - 4, 10, ['#e6e1d0', '#a39d8a'], 60);
      sfx.block();
    }
  }
  game.wardFlash = Math.max(0, game.wardFlash - dt);
  updateArrows(dt);

  // тела не проходят друг сквозь друга (если стоят на одной линии по глубине)
  const solids = game.enemies.filter(e => e.solid && e.type !== 'dummy');  // сквозь чучело можно пройти
  for (const e of solids) {
    if (p.state === 'swallowed' || p.airY > 4 || Math.abs(e.z - p.z) >= 8) continue;  // в прыжке — над врагом
    // с кинжалом рывок проскакивает сквозь врага (v0.82); в повторном бою — любой рывок и кувырок: пробежать мимо (v0.86)
    const slip = (p.state === 'dash' && p.weapon === 'dagger') || ((p.state === 'dash' || p.state === 'roll') && game.arena?.open && e.group === game.arena.index);
    if (slip) {
      const side = Math.sign(e.x - p.x);
      if (e.slipSide && side && side !== e.slipSide) e.slipAt = game.time;
      e.slipSide = side;
      continue;
    }
    e.slipSide = Math.sign(e.x - p.x);
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
  if (lockedArena()) [lo, hi] = arenaBounds();
  else if (game.tutorial) {
    // на обучении от наставницы далеко не уйти
    const t = trainer();
    if (t) [lo, hi] = [Math.max(16, t.homeX - 170), Math.min(L - 16, t.homeX + 170)];
  } else [lo, hi] = roomBounds();
  p.x = Math.max(lo, Math.min(hi, p.x));
  if (lockedArena()) for (const e of game.enemies) {
    if (e.group === game.arena.index && e.state !== 'flee' && e.state !== 'yield') e.x = Math.max(lo - 10, Math.min(hi + 10, e.x));
  }
  updatePaths();
  if (!game.transition) updateDoors(dt);
  if (!game.transition) updateEdges();

  if (game.god && p.hp < CONFIG.playerHp) { p.hp = CONFIG.playerHp; renderHearts(); }   // админка: бессмертие
  if (p.hp <= 0 && p.state !== 'swallowed') die();
  else if (room().finish && (room().encounters ?? []).every((_, i) => game.cleared.has(encKey(game.room, i))) && p.x > L - 60) finish();

  updateCamera(dt);
}

function updateCamera(dt) {
  const p = game.player;
  const L = room().length;
  const target = lockedArena() ? game.arena.x - W / 2 : p.x - (p.facing > 0 ? 120 : 200);
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
  // цель — ближайший враг впереди на линии рыцаря; нет такого — прыжок вперёд без разворота
  const ahead = game.enemies.filter(e => e.alive && near(p, e) && (e.x - p.x) * p.facing > 0 && Math.abs(e.x - p.x) < 90);
  const cur = ahead.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  if (!p.requestVault(cur ? cur.x : p.x + p.facing * 44, !!cur)) {
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
  if (['armor', 'head', 'feet'].includes(item.slot)) { applyArmor(); renderHearts(); checkSets(); }
  if (item.slot === 'weapon') {
    p.setWeapon(item.weapon);
    game.charge = null;
    game.blockStreak = 0;
  }
  return true;
}

// Снять амулет, заклинание или навык (оружие и броню — голову, тело, ноги — не снять, можно только заменить)
function unequip(slot) {
  if (['weapon', 'armor', 'head', 'feet'].includes(slot) || !game.equip[slot]) return;
  game.bag.push(game.equip[slot]);
  game.equip[slot] = null;
}

function useItem(id) {
  const item = ITEMS[id];
  const p = game.player;
  if (!item?.use) return false;
  if (item.use.heal && !item.use.boost && p.hp >= CONFIG.playerHp) { callout('Здоровье полное', 'muted'); return false; }
  game.bag.splice(game.bag.indexOf(id), 1);
  const heal = Math.min(item.use.heal ?? 0, CONFIG.playerHp - p.hp);
  p.hp += heal;
  renderHearts();
  game.stats.potions++;
  if (item.use.boost) {   // кофе и чай (v1.0): бодрость на время — быстрее шаг и / или сильнее удар
    game.boost = { ...item.use.boost, until: game.time + item.use.boost.time, name: item.name };
    applyArmor();
    sparks(p.x, groundY(p.z) - 20, 10, ['#e8c38a', '#fff1d0'], 50);
    sfx.ward();
    callout(`${item.name}${heal ? `  +${heal} ♥` : ''} · бодрость ${item.use.boost.time} с`, 'perfect');
    return true;
  }
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
  if (skill.need && p.weapon !== skill.need) { callout(`${skill.name}: ${WEAPON_NEED[skill.need] ?? 'нужно другое оружие'}`, 'muted'); return; }
  if (game.time < game.skillReadyAt) { callout(`${skill.name} не готов`, 'muted'); return; }
  if (!p.ready) return;
  p.startAttack(skill.attack);
  game.skillReadyAt = game.time + skill.cooldown;
  game.stats.skill++;
  callout(skill.name, 'muted');
}

const WEAPON_NEED = { rapier: 'нужна рапира', sword: 'нужен меч', dagger: 'нужен кинжал' };
// есть ли оружие такого вида (sword, rapier) — в руках или в сумке
const ownsWeapon = kind => [...game.bag, ...Object.values(game.equip)].some(id => id && ITEMS[id]?.weapon === kind);

// Прочитать свиток: выучить навык (если есть нужное оружие) и сразу поставить в слот
function readScroll(id) {
  const scroll = ITEMS[id];
  const skill = ITEMS[scroll.learn];
  if (skill.need && !ownsWeapon(skill.need)) { callout(`Непонятно без оружия: ${WEAPON_NEED[skill.need] ?? 'нужно другое оружие'}`, 'muted'); return false; }
  game.bag.splice(game.bag.indexOf(id), 1);
  game.bag.push(scroll.learn);
  equipItem(scroll.learn);
  sfx.perfect();
  callout(`Выучен навык: ${skill.name} (колесо вниз)`, 'perfect');
  return true;
}

// Окно снаряжения: слева — надетое, справа — сумка, внизу — описание
function openEquip() {
  syncCupName();
  if (game.mode !== 'play' || game.transition || game.cutscene) return;
  game.mode = 'equip';
  game.equipSel = null;
  hint('');   // подсказка управления не просвечивает поверх сумки
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

// иконка предмета (v0.74, assets/items/<id>.png из tools/pixellab_icons.py); нет картинки — просто текст
const itemIcon = id => (id ? `<img class="item-icon" src="assets/items/${id === 'silver_cup' && game.flags.cup_holy ? 'silver_cup_holy' : id}.png" alt="" onerror="this.remove()">` : '');
// подпись чаши по тому, что в ней (владелец, 17.10): освящённая вода с медальоном видна и в названии
function syncCupName() {
  ITEMS.silver_cup.name = game.flags.cup_holy ? 'Чаша: освящённая вода с медальоном' : game.flags.cup_water ? 'Чаша с мутной водой' : 'Серебряная чаша';
}

// v0.91 (отзыв тестера: «нажала посмотреть — а бинт сразу использовался»): клик выбирает вещь и показывает
// описание с кнопкой действия; действие — этой кнопкой или повторным кликом по той же вещи
const bagVerb = item => item.slot ? 'Надеть' : item.use ? 'Использовать' : item.learn || item.diary ? 'Прочитать' : item.journal ? 'Открыть' : '';
function equipPick(sel) {
  const same = game.equipSel && game.equipSel.id === sel.id && game.equipSel.slot === sel.slot;
  if (same) { equipDo(); return; }
  game.equipSel = sel;
  renderEquip();
}
function equipDo() {
  const sel = game.equipSel;
  if (!sel) return;
  game.equipSel = null;
  if (sel.slot) { unequip(sel.slot); renderEquip(); showEquipDesc(null); return; }
  bagAction(sel.id);
}

function renderEquip() {
  const sel = game.equipSel;
  ui.equipSlots.innerHTML = '';
  for (const [slot, label] of SLOTS) {
    const id = game.equip[slot];
    const b = document.createElement('button');
    b.type = 'button';
    if (sel?.slot === slot) b.className = 'sel';
    b.innerHTML = `<span class="equip-slot">${label}</span><span class="item-name">${itemIcon(id)}${id ? ITEMS[id].name : '—'}</span>`;
    b.addEventListener('pointerenter', () => { if (!game.equipSel) showEquipDesc(id); });
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (id) equipPick({ slot, id }); });
    ui.equipSlots.appendChild(b);
  }
  ui.equipBag.innerHTML = '';
  const stacks = bagStacks();
  if (!stacks.length) ui.equipBag.innerHTML = '<p class="equip-empty">Пусто</p>';
  stacks.forEach((s, i) => {
    const item = ITEMS[s.id];
    const b = document.createElement('button');
    b.type = 'button';
    const what = bagVerb(item).toLowerCase();
    if (!sel?.slot && sel?.id === s.id) b.className = 'sel';
    b.innerHTML = `<span class="item-name">${itemIcon(s.id)}${i + 1}. ${item.name}${s.n > 1 ? ' ×' + s.n : ''}</span><span class="equip-act">${what}</span>`;
    b.addEventListener('pointerenter', () => { if (!game.equipSel) showEquipDesc(s.id); });
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); equipPick({ id: s.id }); });
    ui.equipBag.appendChild(b);
  });
  ui.equipCoins.textContent = `Монеты: ${game.coins}`;
  // выбранная вещь: описание и кнопка действия
  if (sel) showEquipDesc(sel.id);
  const verb = sel ? (sel.slot ? 'Снять' : bagVerb(ITEMS[sel.id])) : '';
  ui.equipDo.hidden = !verb;
  ui.equipDo.textContent = verb;
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
  else if (item.diary) { closeEquip(); readPage(id); return; }   // страница дневника — прочитать
  showEquipDesc(id);
  renderEquip();
}

function equipPress(code) {
  if (code === 'Escape' && game.equipSel) { game.equipSel = null; renderEquip(); showEquipDesc(null); return; }   // сначала снять выбор
  if (code === 'Escape' || code === 'KeyI') { closeEquip(); return; }
  if ((code === 'Enter' || code === 'KeyE') && game.equipSel) { equipDo(); return; }
  const m = /^Digit([1-9])$/.exec(code);
  const s = m && bagStacks()[Number(m[1]) - 1];
  if (s) equipPick({ id: s.id });   // цифра — выбрать, та же цифра ещё раз — действие
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
const PARCHMENT = new Image();
PARCHMENT.src = 'assets/ui/parchment.png';
// карта (v0.93, владелец: «улучшить визуально, PixelLab проработать»): пергамент с рамкой и значки-жетоны из PixelLab
// (tools/pixellab_map.py → assets/ui/map_<имя>.png); нет картинки — прежний рисунок кодом
const MAP_IMG = {};
for (const n of ['parchment', 'rest', 'shop', 'boss', 'quest', 'stairs', 'lock', 'you', 'compass']) {
  const im = new Image();
  im.onload = () => { MAP_IMG[n] = im; };
  im.src = `assets/ui/map_${n}.png`;
}
const MAP_LEGEND = [['you', 'ты здесь'], ['rest', 'отдых'], ['shop', 'лавка'], ['boss', 'опасность'], ['quest', 'персонаж'], ['stairs', 'лестница'], ['lock', 'заперто']];
const INK = '#4a3622', INK_SOFT = '#8a7a58';

// значок карты: картинка 32×32 в экранных пикселях (s — размер в мире), иначе — простая метка кодом
function mapIcon(name, cx, cy, s = 8) {
  const im = MAP_IMG[name];
  if (im) {
    const t = g.getTransform(), k = t.a;
    g.save();
    g.setTransform(1, 0, 0, 1, t.e, t.f);
    g.imageSmoothingEnabled = false;
    g.drawImage(im, Math.round((cx - s / 2) * k), Math.round((cy - s / 2) * k), s * k, s * k);
    g.restore();
    return;
  }
  const c = { rest: '#e06030', shop: PAL.gold, chest: '#6b4532', boss: '#3a2a2a', quest: '#c8303f', stairs: INK, lock: '#5a5a6a', you: '#c8303f' }[name] ?? INK;
  rect(g, Math.round(cx - 1), Math.round(cy - 1), 3, 3, c);
}

// что отметить в комнате: отдых, лавка, сундуки, опасность (сюжетный бой / босс не побеждён), персонаж с делом, лестница, запертые двери
function mapMarks(id) {
  const r = ROOMS[id], f = game.flags, out = [];
  const at = x => x / r.length;
  for (const s of [...(r.props ?? []), ...(r.decor ?? [])]) if (s.rest) out.push(['rest', at(s.x)]);
  if (r.npcs?.some(n => NPC_TYPES[n.type]?.shop)) out.push(['shop', 0.5]);
  // сундуки на карте не отмечаются (владелец, v0.93: «пусть сами находят»)
  (r.encounters ?? []).forEach((e, i) => { if (e.story && !f['done_' + e.story] && !game.cleared.has(encKey(id, i))) out.push(['boss', at(e.x)]); });
  for (const n of r.npcs ?? []) {
    if (NPC_TYPES[n.type]?.shop || NPC_TYPES[n.type]?.cat || !flagsOK(n.needs) || [].concat(n.ifNot ?? []).some(k => f[k])) continue;
    const pending = n.type === 'alkima' ? !f.alkima_done : n.type === 'ilia' ? !f.ilia_healed : true;
    if (pending) out.push(['quest', at(n.x)]);
  }
  for (const d of r.doors ?? []) {
    if (d.needs && !f[d.needs]) continue;
    const other = d.to && ROOMS[d.to];
    if (d.stairs || (other && (other.floor ?? 1) !== (r.floor ?? 1))) out.push(['stairs', at(d.x)]);
    else if ((d.locked || d.requires) && !f['opened_' + d.id] && !(d.requires && f[d.requires]) && !(d.key && hasItem(d.key))) out.push(['lock', at(d.x)]);
  }
  return out;
}

function renderMap() {
  const f = game.mapFloor, U = 6, X0 = 11, Y0 = 30;
  // пергамент: рамка PixelLab (v0.93) или прежний лист, или кодом
  const parch = MAP_IMG.parchment ?? (PARCHMENT.complete && PARCHMENT.naturalWidth ? PARCHMENT : null);
  if (parch) {
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(parch, 0, 4, 320, 176);
    g.restore();
  } else {
    rect(g, 8, 12, 304, 156, '#5a4632');
    rect(g, 10, 14, 300, 152, '#d8c8a0');
    rect(g, 12, 16, 296, 148, '#e0d2ac');
  }
  g.fillStyle = INK;
  g.font = '8px "Tiny5", monospace';
  g.textBaseline = 'top';
  g.fillText(`${FLOOR_NAMES[f] ?? 'Первый этаж'}${(room().floor ?? 1) === f ? ' · ' + room().name : ''}`, 24, 18);
  g.fillText('M — закрыть · A / D — этаж', 196, 18);
  if (MAP_IMG.compass) mapIcon('compass', 292, 40, 18);
  const seen = id => game.flags['map_' + id];
  const box = id => { const [ff, x, y, w] = MAP[id]; return ff === f ? { x: X0 + x * U, y: Y0 + y * U, w: w * U } : null; };
  // соседние комнаты, где ещё не был: дверь или край из знакомой комнаты ведёт туда
  const known = new Set();
  for (const [id, r] of Object.entries(ROOMS)) {
    if (!seen(id)) continue;
    for (const d of r.doors ?? []) if (d.to && !(d.needs && !game.flags[d.needs]) && !d.locked) known.add(d.to);
    for (const e of Object.values(r.edges ?? {})) known.add(e.to);
  }
  // переходы: края — рядом, двери — линия вверх к комнате
  for (const [id, r] of Object.entries(ROOMS)) {
    const a = MAP[id] && box(id);
    if (!a || !seen(id)) continue;
    for (const d of r.doors ?? []) {
      const b = d.to && MAP[d.to] && box(d.to);
      if (!b || !(seen(d.to) || known.has(d.to)) || b.w >= a.w) continue;  // линию рисует коридор — к боковой комнате, один раз
      const dx = a.x + (d.x / r.length) * a.w;
      rect(g, Math.round(dx), Math.min(a.y, b.y + U), 1, Math.abs(a.y - (b.y + U)) || 1, INK_SOFT);
    }
  }
  // края на разной высоте — лестница: ступеньки от конца одной комнаты к началу другой
  for (const [id, r] of Object.entries(ROOMS)) {
    const a = MAP[id] && box(id), e = r.edges?.right;
    const b = e && MAP[e.to] && box(e.to);
    if (!a || !b || !seen(id) || !seen(e.to) || a.y === b.y) continue;
    const x = Math.round(a.x + a.w), top = Math.min(a.y, b.y) + U, bot = Math.max(a.y, b.y);
    for (let y = top; y < bot; y += 2) rect(g, x - 1 + ((y - top) % 4 ? 1 : 0), y, 2, 1, INK_SOFT);
  }
  // комнаты: где был — залиты, текущая — золотом; неизвестные соседи — пунктир и «?»
  for (const id of Object.keys(MAP)) {
    const b = box(id);
    if (!b) continue;
    const x = Math.round(b.x), w = Math.round(b.w);
    if (!seen(id)) {
      if (!known.has(id)) continue;
      for (let i = 0; i < w; i += 2) { rect(g, x + i, b.y, 1, 1, INK_SOFT); rect(g, x + i, b.y + U - 1, 1, 1, INK_SOFT); }
      for (let j = 0; j < U; j += 2) { rect(g, x, b.y + j, 1, 1, INK_SOFT); rect(g, x + w - 1, b.y + j, 1, 1, INK_SOFT); }
      g.fillStyle = INK_SOFT;
      g.fillText('?', x + w / 2 - 2, b.y - 1);
      continue;
    }
    rect(g, x, b.y, w, U, INK);
    rect(g, x + 1, b.y + 1, w - 2, U - 2, id === game.room ? '#d8b860' : '#b8a478');
  }
  // значки поверх комнат
  for (const id of Object.keys(MAP)) {
    const b = box(id);
    if (!b || !seen(id)) continue;
    const used = [];
    for (const [n, k] of mapMarks(id)) {
      let cx = b.x + Math.min(Math.max(k, 0.08), 0.92) * b.w;
      while (used.some(u => Math.abs(u - cx) < 7)) cx += 7;   // значки не налезают друг на друга
      used.push(cx);
      mapIcon(n, cx, b.y + U / 2);
    }
  }
  // Найт — шлем с плюмажем, мигает
  const me = box(game.room);
  if (me && Math.floor(performance.now() / 400) % 3 !== 0) mapIcon('you', me.x + (game.player.x / room().length) * me.w, me.y - 4, 9);
  // легенда — два ряда по четыре
  g.fillStyle = INK;
  MAP_LEGEND.forEach(([n, label], i) => {
    const lx = 26 + (i % 4) * 70, ly = 146 + Math.floor(i / 4) * 11;
    mapIcon(n, lx + 3, ly + 4, 8);
    g.fillText(label, lx + 9, ly);
  });
}

function openJournal() {
  if (!owns('journal')) { callout('Нужен журнал — его продаёт Лика', 'muted'); return; }
  if (game.mode !== 'play' || game.transition || game.cutscene) return;
  game.mode = 'journal';
  game.journalSel = journalKeys()[0] ?? null;
  ui.journal.hidden = false;
  renderJournal();
}
function closeJournal() {
  ui.journal.hidden = true;
  game.mode = 'play';
}

const journalCtx = ui.journalFig.getContext('2d');
journalCtx.imageSmoothingEnabled = false;

// записи журнала: враги (бестиарий) и найденные страницы дневника капитана (v0.81, «diary:<id>»)
const DIARY = Object.keys(ITEMS).filter(id => ITEMS[id].diary).sort((a, b) => ITEMS[a].diary - ITEMS[b].diary);
const journalKeys = () => [...Object.keys(BESTIARY).filter(t => game.bestiary[t]), ...DIARY.filter(id => owns(id)).map(id => 'diary:' + id)];
function renderJournal() {
  const keys = journalKeys();
  ui.journalList.innerHTML = '';
  if (!keys.length) ui.journalList.innerHTML = '<p class="equip-empty">Пока пусто — встреть врага.</p>';
  keys.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = t === game.journalSel ? 'sel' : '';
    const diary = t.startsWith('diary:') && t.slice(6);
    if (diary && (i === 0 || !keys[i - 1].startsWith('diary:'))) {
      const h = document.createElement('p'); h.className = 'journal-sep'; h.textContent = `Дневник капитана · ${DIARY.filter(id => owns(id)).length}/${DIARY.length}`;
      ui.journalList.appendChild(h);
    }
    b.innerHTML = diary ? `<span>${i + 1}. ${ITEMS[diary].name}</span>` : `<span>${i + 1}. ${ENEMY_TYPES[t].shortName ?? ENEMY_TYPES[t].name}</span><span class="equip-act">×${game.bestiary[t].kills}</span>`;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); game.journalSel = t; renderJournal(); });
    ui.journalList.appendChild(b);
  });
  const t = game.journalSel;
  ui.journalPage.hidden = !t;
  if (!t) return;
  const diaryId = t.startsWith('diary:') && t.slice(6);
  for (const el of [ui.journalHow.parentElement, ui.journalWin.parentElement, ui.journalFig]) el.hidden = !!diaryId;
  ui.journalPage.classList.toggle('diary', !!diaryId);
  if (diaryId) {   // страница дневника — только текст
    ui.journalName.textContent = ITEMS[diaryId].name;
    ui.journalLore.textContent = (ITEM_TEXTS[diaryId] ?? '').replace('[черновик] ', '');
    ui.journalKills.textContent = '';
    return;
  }
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
  const types = journalKeys();
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
    s.vy += (s.heart ? 0 : 300) * dt;   // сердечки плывут вверх
    s.life -= dt;
  }
  game.particles = game.particles.filter(s => s.life > 0);
  // дым: поднимается, расплывается, тает
  for (const s of game.puffs) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 1 - dt * 2;
    s.r += dt * 6;
    s.life -= dt;
  }
  game.puffs = game.puffs.filter(s => s.life > 0);
}

function step(dt) {
  if (admin.open) { input.take(); return; }   // админка открыта — игра стоит
  // облик по снаряжению (v0.80): куртка мародёра → кожаная броня; с треуголкой — полный мародёр
  const eq = game.equip ?? {};
  setKnightSkin(eq.armor === 'mar_jacket' || eq.armor === 'armor_marauder' ? (eq.head === 'mar_scarf' || eq.armor === 'armor_marauder' ? 'knight_marauder' : 'knight_leather') : 'knight');
  updateFx(dt);
  // музыка — в любом режиме (разговор, лавка, снаряжение, пауза): иначе трек босса не включался, пока идёт реплика перед боем
  try { updateMusic(game.mode === 'play' && !!game.arena, musicZone(), ROOMS[game.room]?.music ?? null); } catch (err) { frameError(performance.now(), err); }
  if (game.mode === 'shop' || game.mode === 'equip' || game.mode === 'journal') {
    for (const code of input.take()) handlePress(code);
    if (game.mode === 'shop') tickShop(dt);
    return;
  }
  if (game.mode === 'talk') {
    for (const code of input.take()) handlePress(code);
    tickTalk(dt);
    tickStory(dt);
    return;
  }
  if (game.hitstop > 0) { game.hitstop -= dt; return; }
  update(dt);
}

// ---------- диалоги ----------

const portraitCtx = ui.talkPortrait.getContext('2d');
// Нарисованные портреты владельца: у реплики можно указать mood (настроение), иначе — default.
const FACES = {
  // Найт (v0.80): лица не видно — настроение позой головы и светом на шлеме (down — досада, тень на шлеме; up — решимость;
  // tilt — сомнение; sad — грусть; aside — смущение; surprised — удивление; stare — смотрит прямо на нас, комичный шок; judge — осуждение)
  knight: { default: 'assets/portraits/knight.png', tired: 'assets/portraits/knight-tired.png', nohelm: 'assets/portraits/knight-nohelm.png',
    down: 'assets/portraits/knight-down.png', up: 'assets/portraits/knight-up.png', tilt: 'assets/portraits/knight-tilt.png', sad: 'assets/portraits/knight-sad.png',
    aside: 'assets/portraits/knight-aside.png', surprised: 'assets/portraits/knight-surprised.png',
    stare: 'assets/portraits/knight-stare.png', judge: 'assets/portraits/knight-judge.png' },   // v0.83: взгляд в камеру (комичный шок), осуждение   // v0.81: смущение (голова отвёрнута), удивление
  knight_marauder: { default: 'assets/portraits/knight-marauder.png' },   // в броне мародёра (v0.80); настроения — позже
  ilia: Object.fromEntries(['default', 'happy', 'surprised', 'serious', 'worried', 'sad', 'angry', 'pain', 'awkward']   // v0.80
    .map(m => [m, m === 'default' ? 'assets/portraits/ilia.png' : `assets/portraits/ilia-${m}.png`])),
  boss: { default: 'assets/portraits/boss.png' },
  // камео главы 2 (v0.98, по фото владельца; одежда — под средневековье)
  cam_glasses: { default: 'assets/portraits/cam_glasses.png', buzz: 'assets/portraits/cam_glasses-buzz.png' },
  cam_redhead: { default: 'assets/portraits/cam_redhead.png' }, cam_merc: { default: 'assets/portraits/cam_merc.png' },
  cam_tuyaa: { default: 'assets/portraits/cam_tuyaa.png' }, cam_polly: { default: 'assets/portraits/cam_polly.png' }, cam_zacharia: { default: 'assets/portraits/cam_zacharia.png' }, cam_lucia: { default: 'assets/portraits/cam_lucia.png' }, cam_stasya: { default: 'assets/portraits/cam_stasya.png' }, cam_shahbanu: { default: 'assets/portraits/cam_shahbanu.png' },
  priest: { default: 'assets/portraits/priest.png' }, maid: { default: 'assets/portraits/maid.png' },   // призраки (v0.81)
  trainer: Object.fromEntries(['default', 'happy', 'sly', 'surprised', 'serious', 'worried', 'sad', 'annoyed']   // v0.80: настроения как у Лики
    .map(m => [m, m === 'default' ? 'assets/portraits/alkima.png' : `assets/portraits/alkima-${m}.png`])),
  lika: Object.fromEntries(['default', 'happy', 'sly', 'surprised', 'sulky', 'serious', 'worried', 'angry']
    .map(m => [m, m === 'default' ? 'assets/portraits/lika.png' : `assets/portraits/lika-${m}.png`])),
};
for (const set of Object.values(FACES)) for (const src of Object.values(set)) new Image().src = src;  // загрузить заранее

const PORTRAITS = {
  knight: { colors: KNIGHT_COLORS, plume: true },
  ilia: { colors: ENEMY_TYPES.duelist.colors, face: true, rapier: true, robe: true },
  trainer: { colors: ENEMY_TYPES.trainer.colors, bun: true, ornate: true, robe: true, slim: true },
  lika: { ...NPC_TYPES.lika },
  boss: { colors: ENEMY_TYPES.boss.colors },
};

// какой разговор у NPC сейчас (v0.77): talks — список вариантов по порядку, первый подходящий:
// { id, if: флаг, ifNot: флаг, has: [предметы в сумке] }; иначе — talk
function npcTalkId(def) {
  for (const t of def.talks ?? []) {
    if (t.if && !game.flags[t.if]) continue;
    if (t.ifNot && game.flags[t.ifNot]) continue;
    if (t.has && !t.has.every(id => game.bag.includes(id))) continue;
    return t.id;
  }
  return def.talk;
}
// реплика может дать или забрать вещи (v0.77): give — в сумку (один раз за флаг given_<id>), take — из сумки
function applyLineItems(line) {
  if (!line || game.talkApplied?.has(line)) return;   // одна реплика — один раз за разговор (и при пропуске)
  (game.talkApplied ??= new WeakSet()).add(line);
  for (const id of [].concat(line.take ?? [])) { const i = game.bag.indexOf(id); if (i >= 0) game.bag.splice(i, 1); }
  for (const id of [].concat(line.give ?? [])) {
    if (game.flags['given_' + id]) continue;
    game.flags['given_' + id] = true;
    game.bag.push(id);
    callout(`Получено: ${ITEMS[id]?.name ?? id}`, 'perfect');
    sfx.perfect();
  }
  // later: [флаг, секунды] — флаг ставится позже, при входе в комнату после этого срока (стрижка у бара, v0.98)
  if (line.later) (game.flags.later ??= {})[line.later[0]] = (game.flags.playTime ?? 0) + line.later[1];
  if (line.give || line.take || line.later) save();
}

// after — что сделать, когда разговор закончится (или сразу, если диалоги выключены)
// предмет в комнате появляется после события (needs — флаг), например страница дневника после боя
const flagsOK = need => [].concat(need ?? []).every(f => game.flags[f]);
const propOn = pr => flagsOK(pr.needs) && ![].concat(pr.unless ?? []).some(f => game.flags[f]);   // unless — исчезает после флага
// страница дневника капитана (v0.78): текст — в ITEM_TEXTS (пишет владелец), читается рассказчиком
function readPage(id) {
  DIALOGUES['read_' + id] = (ITEM_TEXTS[id] ?? '').split('\n').map(text => ({ who: 'narrator', text }));   // длинный дневник — по записям
  startTalk('read_' + id);
}
function startTalk(id, after = null) {
  if (!CONFIG.dialogues || !DIALOGUES[id]) { after?.(); return; }
  game.flags['seen_' + id] = true;
  game.afterTalk = after;
  game.talk = new DialogueRunner(DIALOGUES, game.flags);
  game.talkApplied = new WeakSet();
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
  applyLineItems(line);
  if (line.story) {
    // режим рассказа: полноэкранные картины с текстом, потом разговор продолжается
    ui.talk.hidden = true;
    openStory(line.story, () => { game.talk.advance(); showLine(); });
    return;
  }
  const who = SPEAKERS[line.who] ?? SPEAKERS.narrator;
  ui.talk.hidden = false;
  ui.talkName.textContent = who.name;
  const face = who.portrait === 'knight' && game.equip?.head === 'mar_scarf' ? FACES.knight_marauder : FACES[who.portrait];   // в треуголке и платке
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
  game.lineAt = performance.now();
  game.talkPages = talkPages(line.text);
  game.talkPage = 0;
  ui.talkText.textContent = '';
  ui.talkChoices.innerHTML = '';
  ui.talkSkip.hidden = !!line.choices;
  talkChoices(line);
}
// варианты ответа — только на последней части длинной реплики
function talkChoices(line) {
  const last = game.talkPage >= game.talkPages.length - 1;
  ui.talkNext.hidden = !!line.choices && last;
  if (line.choices && last) {
    line.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${i + 1}. ${c.text}`;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); chooseTalk(i); });
      ui.talkChoices.appendChild(b);
    });
  }
}

// длинная реплика — на несколько окон (владелец, 17.10: окно разговора не должно разрастаться на пол-экрана):
// не больше TALK_LINES строк; режется по предложениям, слишком длинное предложение — по словам. Меряется по самому
// окну, поэтому работает с любым шрифтом (Philosopher / Tiny5).
const TALK_LINES = 3;
function talkPages(text) {
  if (!text) return [text];
  const el = ui.talkText, lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
  const fits = t => { el.textContent = t; return el.scrollHeight <= lh * TALK_LINES + lh * 0.5; };
  const ok = fits(text);
  el.textContent = '';
  if (ok) return [text];
  const pages = [];
  let cur = '';
  const add = (piece, sep = ' ') => {
    const next = cur ? cur + sep + piece : piece;
    if (fits(next)) { cur = next; return true; }
    return false;
  };
  for (const sent of text.split(/(?<=[.!?…»:;])\s+/)) {
    if (add(sent)) continue;
    if (cur) { pages.push(cur); cur = ''; }
    if (add(sent)) continue;
    for (const w of sent.split(' ')) if (!add(w)) { if (cur) pages.push(cur); cur = w; }
  }
  if (cur) pages.push(cur);
  el.textContent = '';
  return pages.length ? pages : [text];
}
const talkPageText = line => game.talkPages?.[game.talkPage] ?? line.text;

// текст печатается по буквам; нажатие во время печати показывает строку целиком
function tickTalk(dt) {
  const line = game.talk?.current;
  if (!line || !line.text) return;
  const text = talkPageText(line);
  if (game.talkShown < text.length) {
    game.talkShown = Math.min(text.length, game.talkShown + dt * 45);
    ui.talkText.textContent = text.slice(0, Math.floor(game.talkShown));
  }
}

// новая реплика не пролистывается сразу: клики, которыми только что били, не съедают текст
const TALK_GUARD = 350;

function advanceTalk() {
  const line = game.talk?.current;
  if (!line) return;
  if (performance.now() - (game.lineAt ?? 0) < TALK_GUARD) return;
  const text = talkPageText(line);
  if (text && game.talkShown < text.length) {
    game.talkShown = text.length;
    ui.talkText.textContent = text;
    return;
  }
  if (game.talkPages && game.talkPage < game.talkPages.length - 1) {   // следующая часть длинной реплики
    game.talkPage++;
    game.talkShown = 0;
    game.lineAt = performance.now();
    ui.talkText.textContent = '';
    talkChoices(line);
    return;
  }
  if (line.choices) return;
  game.talk.advance();
  showLine();
}

function chooseTalk(i) {
  const line = game.talk?.current;
  if (!line?.choices?.[i]) return;
  if (game.talkPage < game.talkPages.length - 1) return;   // длинная реплика ещё не дочитана
  if (performance.now() - (game.lineAt ?? 0) < TALK_GUARD) return;
  // путь (v0.78, лор владельца): pilgrim — солнце, ghost — Уроборос, monarch — корона, egoist — закрытый глаз; копится тихо
  const path = line.choices[i].path;
  if (path) addPath(path, line.choices[i].points ?? 1);
  game.talk.choose(i);
  showLine();
  if (path) showPathSign(path);
}

// очки путей (v0.95, владелец): обычный выбор — +1 (points у варианта — другое число), крупное событие — +5.
// Игроку не видны; в сохранении — flags.path_<путь>, админу — в админке (F2).
const PATHS = ['pilgrim', 'ghost', 'monarch', 'egoist'];
const PATH_NAMES = { pilgrim: 'пилигрим', ghost: 'призрак', monarch: 'монарх', egoist: 'эгоист' };
function addPath(path, n = 1) {
  game.flags['path_' + path] = (game.flags['path_' + path] ?? 0) + n;
  game.flags.path_last = path;
}
// кто лидирует среди путей; ничья — последний выбранный из них; очков нет — null
function pathLeader(among = PATHS) {
  const pts = id => game.flags['path_' + id] ?? 0;
  const top = Math.max(...among.map(pts));
  if (top <= 0) return null;
  const lead = among.filter(id => pts(id) === top);
  return lead.includes(game.flags.path_last) ? game.flags.path_last : lead[0];
}

function executionPath() {
  const dark = ['ghost', 'monarch', 'egoist'], pts = dark.map(id => game.flags['path_' + id] ?? 0);
  return pts.every(n => n === pts[0]) ? 'undecided' : pathLeader(dark);
}
// знак пути (v0.94, владелец): только после выбора — в вариантах ответа его нет, игрок выбирает сам
function showPathSign(path) {
  if (!PATHS.includes(path) && path !== 'undecided') return;
  const el = ui.pathSign;
  el.src = `assets/ui/sign_${path}.png`;
  el.className = 'path-sign ' + path;
  el.hidden = false;
  void el.offsetWidth;            // перезапуск анимации, если знаки идут подряд
  el.classList.add('show');
  game.pathSign = { path, t: performance.now() };
  sfx.sign(path);
}
ui.pathSign.addEventListener('animationend', () => { ui.pathSign.hidden = true; ui.pathSign.classList.remove('show'); });

// пропустить разговор (кнопка ✕ или Esc): реплики проматываются до выбора или до конца — флаги реплик
// ставятся как обычно, сюжет не ломается; на выборе — остановка (выбор за игроком)
function skipTalk() {
  if (!game.talk?.current) return;
  let n = 0;
  while (game.talk.current && !game.talk.current.choices && n++ < 500) { applyLineItems(game.talk.current); game.talk.advance(); }
  showLine();
}
ui.talkSkip.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); skipTalk(); });
ui.shopClose.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (game.shop) closeShop(); });
// ✕ у снаряжения и журнала (v0.91): выйти можно не только клавишей
ui.equipClose.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (game.mode === 'equip') closeEquip(); });
ui.journalClose.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (game.mode === 'journal') closeJournal(); });
ui.equipDo.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (game.mode === 'equip') equipDo(); });

// ---------- режим рассказа (v0.78) ----------
// Сюжетная вставка: картина во весь экран, текст снизу печатается; ЛКМ / Enter — дальше, Esc — пропустить.
function openStory(id, after) {
  const pages = STORIES[id];
  if (!pages?.length) { after?.(); return; }
  let el = ui.story;
  if (!el) {
    el = ui.story = document.createElement('div');
    el.className = 'storymode';
    el.innerHTML = '<img class="story-img" alt=""><div class="story-band"><p class="story-text"></p><div class="story-keys">ЛКМ или Enter — дальше · Esc — пропустить</div></div>';
    el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); storyPress('Enter'); });
    const im = el.querySelector('.story-img'); im.onerror = () => { im.style.visibility = 'hidden'; }; im.onload = () => { im.style.visibility = ''; };
    ui.box.appendChild(el);
  }
  game.storyView = { pages, i: -1, after, shown: 0 };
  el.hidden = false;
  storyNext();
}
function storyNext() {
  const v = game.storyView;
  v.i++;
  if (v.i >= v.pages.length) { closeStory(); return; }
  const pg = v.pages[v.i], img = ui.story.querySelector('.story-img');
  if (pg.img && !img.src.endsWith(pg.img)) { img.classList.remove('in'); img.src = pg.img; void img.offsetWidth; img.classList.add('in'); }
  v.shown = 0;
  ui.story.querySelector('.story-text').textContent = '';
}
function storyPress(code) {
  const v = game.storyView;
  if (!v) return;
  if (code === 'Escape') { closeStory(); return; }
  if (code !== 'Enter' && code !== 'Space' && code !== 'KeyE' && !is(code, 'attack')) return;
  const text = v.pages[v.i].text;
  if (v.shown < text.length) { v.shown = text.length; ui.story.querySelector('.story-text').textContent = text; }
  else storyNext();
}
function tickStory(dt) {
  const v = game.storyView;
  if (!v || v.i < 0 || v.i >= v.pages.length) return;
  const text = v.pages[v.i].text;
  if (v.shown < text.length) { v.shown = Math.min(text.length, v.shown + dt * 38); ui.story.querySelector('.story-text').textContent = text.slice(0, Math.floor(v.shown)); }
}
function closeStory() {
  const v = game.storyView;
  game.storyView = null;
  if (ui.story) ui.story.hidden = true;
  v?.after?.();
}

// ---------- лавка ----------
// Как в Undertale: продавец, его реплика и меню «Купить / Поговорить / Уйти».

// сцена лавки (v0.67): фон из PixelLab, Лика по пояс за прилавком с настроениями, живые огоньки и пылинки
const shopCtx = ui.shopScene.getContext('2d');
shopCtx.imageSmoothingEnabled = false;
const SHOP_MOODS = ['default', 'happy', 'sly', 'surprised', 'sulky', 'serious', 'worried', 'angry', 'blink'];
// картинки лавки: у SHOPS[id].art — свой фон и продавец по пояс (оружейная главы 2, v0.98); без art — лавка Лики
const shopArts = {};
function artFor(id) {
  const a = SHOPS[id]?.art;
  if (shopArts[id]) return shopArts[id];
  const img = src => Object.assign(new Image(), { src });
  const out = shopArts[id] = { scene: img(a?.scene ?? 'assets/shop/scene.png'), fg: a?.fg && img(a.fg) };
  for (const m of a?.moods ?? SHOP_MOODS) out[m] = img(`${a?.bust ?? 'assets/shop/lika'}_${m}.png`);
  return out;
}
const SHOP_FLAMES = [[186, 50, 1.2], [32, 106, 0.8], [94, 164, 0.8], [252, 186, 0.7]];   // фонарь и свечи на картине: x, y, сила
const shopMotes = Array.from({ length: 24 }, () => ({ x: Math.random() * 256, y: Math.random() * 220, v: 2 + Math.random() * 5, p: Math.random() * 6.3 }));
function drawShopScene(t) {
  const c = shopCtx, sh = game.shop;
  const ok = im => im?.complete && im.naturalWidth;
  c.clearRect(0, 0, 256, 288);
  const shopArt = artFor(sh.npc.def.shop), flames = sh.data.art ? sh.data.art.flames ?? [] : SHOP_FLAMES;
  if (ok(shopArt.scene)) c.drawImage(shopArt.scene, 0, 0);
  // Лика: дышит (на пиксель вверх-вниз), моргает раз в несколько секунд
  const blink = (!sh.mood || sh.mood === 'default') && (t % 4.3) < 0.13;
  const bust = shopArt[blink ? 'blink' : sh.mood] ?? shopArt.default;
  const im = ok(bust) ? bust : shopArt.default;
  const [bx, by] = sh.data.art?.at ?? [48, 109];   // где стоит продавец; стойка (fg) рисуется поверх — он за ней, а не перед
  if (ok(im)) c.drawImage(im, bx, by + (!sh.data.art?.still && Math.sin(t * 1.8) > 0.6 ? -1 : 0));
  if (ok(shopArt.fg)) c.drawImage(shopArt.fg, 0, 0);
  // огонь свечей и фонаря дрожит, вокруг — тёплый свет
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [x, y, k] of flames) {
    const f = 0.75 + 0.25 * Math.sin(t * 9 + x) * Math.sin(t * 5.3 + y);
    const gr = c.createRadialGradient(x, y, 0, x, y, 26 * k);
    gr.addColorStop(0, `rgba(255,170,80,${0.32 * f * k})`);
    gr.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = gr;
    c.fillRect(x - 26 * k, y - 26 * k, 52 * k, 52 * k);
    c.fillStyle = `rgba(255,236,170,${0.55 * f})`;
    c.fillRect(x, y - 1 - Math.round(f * 2), 1, 2);
  }
  // пылинки в тёплом свете
  for (const m of shopMotes) {
    m.y -= m.v / 60; m.x += Math.sin(t * 0.7 + m.p) * 0.05;
    if (m.y < 0) { m.y = 220; m.x = Math.random() * 256; }
    c.fillStyle = `rgba(255,214,150,${0.25 + 0.2 * Math.sin(t * 2 + m.p)})`;
    c.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
  }
  c.restore();
}

function openShop(npc) {
  const data = SHOPS[npc.def.shop];
  if (!data) return;
  game.shop = { npc, data, view: 'main', text: data.hello, shown: 0, mood: data.moods?.hello, back: game.mode === 'vn' ? 'vn' : 'play' };
  game.mode = 'shop';
  ui.shopName.textContent = npc.def.name;
  ui.shop.hidden = false;
  hint('');
  renderShop();
}

function closeShop() {
  game.shop.text = game.shop.data.bye;
  ui.shop.hidden = true;
  callout(game.shop.data.bye.replace('[черновик] ', ''), 'muted');
  const back = game.shop.back;
  game.shop = null;
  game.mode = back ?? 'play';   // из картины лавки (оружейная) — обратно в картину
}

// следующая реплика темы: Найт (knight: true) или Лика с выражением лица
function nextShopLine() {
  const sh = game.shop;
  const line = sh.queue.shift();
  if (!line) return;
  const text = typeof line === 'string' ? line : line.text;
  shopSay(text, line.mood, !!line.knight);  // говорит Найт — Лика слушает, над репликой его имя
  renderShop();
}

// реплика продавца; mood — выражение лица на портрете (без него — обычное); knight — реплика Найта
function shopSay(text, mood = null, knight = false) {
  game.shop.text = text;
  game.shop.shown = 0;
  game.shop.mood = mood;   // лицо Лики на сцене меняется в drawShopScene
  ui.shopName.textContent = knight ? SPEAKERS.knight.name : game.shop.npc.def.name;
  ui.shopName.classList.toggle('knight', knight);
}

function shopView(view) {
  game.shop.view = view;
  game.shop.sel = null;
  game.shop.queue = null;
  shopSay(game.shop.data.menu);
  renderShop();
}

function shopOptions() {
  const sh = game.shop, d = sh.data;
  const back = { label: 'Назад', go: () => shopView('main') };
  if (d.guide) return guideOptions(sh, d, back);
  if (sh.view === 'buy') return [
    ...d.items.map(it => {
      const item = ITEMS[it.id];
      const have = onceOwned(it.id);
      return { label: item.name, icon: it.id, right: have ? 'есть' : `${item.price} мон.`, muted: have || it.soon || item.price > game.coins, hover: it.text, mood: d.moods?.item, go: () => buyItem(it) };
    }),
    back,
  ];
  if (sh.view === 'talk') {
    // идёт разговор по теме — только «Дальше», пока не кончатся реплики
    if (sh.queue?.length) return [{ label: 'Дальше ▸', go: nextShopLine }, { label: 'Хватит', go: () => shopView('talk') }];
    // need — тема появляется после события (флаг), например после боя с Илиа
    return [...d.talk.filter(t => !t.need || game.flags[t.need]).map(t => ({ label: t.topic, go: () => { sh.queue = t.lines.slice(); nextShopLine(); } })), back];
  }
  return [
    { label: 'Купить', go: () => shopView('buy') },
    { label: 'Поговорить', go: () => shopView('talk') },
    { label: 'Уйти', go: closeShop },
  ];
}

// библиотекарша Жанет (владелец 23.10): ничего не продаёт — рассказывает о механике игры по разделам.
// Вещи, которых рыцарь ещё не видел (нет в сумке и не продаются в лавках), — «???»: книги о них Жанет пока не нашла
function guideSeen(id) {
  return owns(id) || Object.values(SHOPS).some(s => s.items?.some(it => it.id === id));
}
function guideEntries(cat) {
  if (cat.facts) return cat.facts.map(f => ({ label: f.name, icon: f.icon, text: f.text }));
  if (cat.sets) return Object.entries(SETS).map(([k, st]) => {
    const seen = st.pieces.some(guideSeen);
    return { label: seen ? st.name : '???', icon: seen ? st.pieces[0] : null, text: seen ? `${game.shop.data.setText?.[k] ?? ''} Части: ${st.pieces.map(id => ITEMS[id].name).join(', ')}.${st.worn ? ' Вместе — ' + st.worn + '.' : ''}` : null };
  });
  return Object.keys(ITEMS).filter(cat.has).map(id => {
    const seen = guideSeen(id);
    return { label: seen ? ITEMS[id].name : '???', icon: seen ? id : null, text: seen ? (ITEM_TEXTS[id] ?? ITEMS[id].name) : null };
  });
}
function guideOptions(sh, d, back) {
  if (sh.view === 'talk') {
    if (sh.queue?.length) return [{ label: 'Дальше ▸', go: nextShopLine }, { label: 'Хватит', go: () => shopView('talk') }];
    return [...d.talk.map(t => ({ label: t.topic, go: () => { sh.queue = t.lines.slice(); nextShopLine(); } })), back];
  }
  const cat = d.guide.find(c => c.id === sh.view);
  if (cat) return [...guideEntries(cat).map(e => ({ label: e.label, icon: e.icon, muted: !e.text, guide: true,
    go: () => shopSay(e.text ?? d.unknown, e.text ? null : d.moods?.unknown) })), back];
  return [
    { label: 'Поговорить', go: () => shopView('talk') },
    ...d.guide.map(c => ({ label: c.name, icon: c.icon, go: () => { shopView(c.id); shopSay(c.intro, c.mood); } })),
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
  ui.shopCoins.textContent = game.shop.data.guide ? '' : `Монеты: ${game.coins}`;
  ui.shopMenu.innerHTML = '';
  ui.shopMenu.classList.toggle('dense', shopOptions().length > 8);
  shopOptions().forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const picked = o.hover && game.shop.sel === i;
    b.className = (o.muted ? 'muted' : '') + (picked ? ' sel' : '');
    const right = picked && !o.muted && o.right ? `купить · ${o.right}` : o.right;
    b.innerHTML = `<span class="item-name">${itemIcon(o.icon)}${i + 1}. ${o.label}</span>${right ? `<span>${right}</span>` : ''}`;
    // v0.91 (отзыв тестера: «нажала — сразу купилось»): товар — первый клик выбирает и показывает описание, второй — покупка
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); shopPick(o, i); });
    if (o.hover) b.addEventListener('pointerenter', () => { if (game.shop.sel == null) shopSay(o.hover, o.mood); });
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
    if (game.shop.queue?.length) shopView('talk');
    else if (game.shop.view === 'main') closeShop();
    else shopView('main');
    return;
  }
  const m = /^Digit([1-9])$/.exec(code);
  if (!m) return;
  const i = Number(m[1]) - 1, o = shopOptions()[i];
  if (o) shopPick(o, i);   // с клавиатуры так же: сначала описание, потом покупка
}
function shopPick(o, i) {
  if (o.hover && game.shop.sel !== i) {
    game.shop.sel = i;
    shopSay(o.hover, o.mood);
    renderShop();
    return;
  }
  game.shop.sel = null;
  o.go();
}

// реплика печатается по буквам
function tickShop(dt) {
  const sh = game.shop;
  if (!sh) return;
  drawShopScene(performance.now() / 1000);
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

function hint(text, vibe) {
  if (vibe) text = text ? `${text} · V\u00a0—\u00a0вайбовать` : 'V\u00a0—\u00a0вайбовать';   // место для «вайбовать»
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

// разговор при первом входе в комнату (enterTalk: { id, needs })
function updateEnterTalk() {
  const t = room().enterTalk;
  if (!t || game.flags['seen_' + t.id] || (t.needs && !game.flags[t.needs]) || game.arena) return;
  startTalk(t.id);
}

// Собран сет — части превращаются в вещь (сет мародёра → снаряжение мародёра)
// сеты (v0.80): части надеваются по одной; надеты все — бонус и одна надпись
const setWorn = set => set.pieces.every(id => Object.values(game.equip).includes(id));
function checkSets() {
  for (const [key, set] of Object.entries(SETS)) {
    const all = set.pieces.every(id => owns(id));
    if (all && !game.flags['set_found_' + key]) { game.flags['set_found_' + key] = true; setTimeout(() => callout(`${set.name}: все части у тебя! Надень их (I)`, 'counter'), 900); }
    if (setWorn(set) && !game.flags['set_worn_' + key]) { game.flags['set_worn_' + key] = true; setTimeout(() => callout(`${set.name} надет целиком: ${set.worn ?? 'бонус'}`, 'counter'), 300); }
  }
}

// скорость ходьбы от брони (ITEMS[...].speed)
const WORN = ['head', 'armor', 'feet'];
const applyArmor = () => {
  let k = WORN.reduce((m, s) => m * (ITEMS[game.equip[s]]?.speed ?? 1), 1);
  for (const set of Object.values(SETS)) if (set.bonus?.speed && setWorn(set)) k *= set.bonus.speed;
  game.player.speedMult = k * (game.boost?.speed ?? 1);
};

// Щит — от надетой брони (ITEMS[...].shield)
const shieldMax = () => WORN.reduce((n, s) => n + (ITEMS[game.equip[s]]?.shield ?? 0), 0);

// Шкалы жизни и щита (раньше — сердечки)
function renderHearts() {
  const p = game.player;
  const max = CONFIG.playerHp, sm = shieldMax();
  game.shield = Math.min(game.shield ?? sm, sm);
  $('hp-fill').style.width = `${100 * p.hp / max}%`;
  $('hp-fill').parentElement.style.setProperty('--seg', `${100 / max}%`);
  $('hp-text').textContent = `${p.hp}/${max}`;
  $('shield-bar').hidden = sm <= 0;
  $('shield-fill').style.width = sm ? `${100 * game.shield / sm}%` : '0';
  $('shield-bar').style.setProperty('--seg', sm ? `${100 / sm}%` : '100%');
  $('shield-text').textContent = sm ? `щит ${Math.floor(game.shield)}/${sm}` : '';
  ui.hearts.classList.toggle('low', p.hp > 0 && p.hp <= 2);  // мало жизни — шкала мигает
}

// щит восстанавливается, если по рыцарю какое-то время не попадали
function updateShield(dt) {
  if (game.boost && game.time > game.boost.until) { game.boost = null; applyArmor(); callout('Бодрость прошла', 'muted'); }
  const sm = shieldMax();
  if (game.shield >= sm || game.time - (game.hitAt ?? -99) < CONFIG.shieldRegenDelay) return;
  const before = Math.floor(game.shield);
  game.shield = Math.min(sm, game.shield + dt / CONFIG.shieldRegenTime);
  if (Math.floor(game.shield) !== before) renderHearts();
}

function renderFoe() {
  const e = game.current;
  if (!e) return;
  ui.foeName.textContent = e.def.name;
  ui.foeBar.style.width = `${(e.hp / e.def.hp) * 100}%`;
}

// ---------- отрисовка ----------

function render() {
  game.catGlow = [];   // кот в темноте: заново каждый кадр (рисует drawCatGlow поверх света)
  const sx = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
  const sy = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
  g.setTransform(S, 0, 0, S, sx * S, sy * S);
  g.fillStyle = PAL.bg;
  g.fillRect(-4, -4, W + 8, H + 8);

  if (game.mode === 'title') {
    // титульный экран: замок на горе под луной
    drawTitle(g, performance.now() / 1000);
    g.setTransform(S, 0, 0, S, 0, 0);
    return;
  }
  const r = room();
  const cam = Math.round(game.camX);
  // даль под открытым небом (балкон): неподвижный дальний план за полом и перилами
  const farImg = r.far && (farImgs[r.far] ??= Object.assign(new Image(), { src: r.far }));
  if (farImg?.complete && farImg.naturalWidth && (bgFor(game.room).k ?? 1) === 2) {
    g.drawImage(farImg, 0, 0, farImg.width / 2, farImg.height / 2);
  }
  const bg = bgFor(game.room), bk = bg.k ?? 1;
  g.drawImage(bg, cam * bk, 0, W * bk, H * bk, 0, 0, W, H);
  drawTimeFrames(cam);   // «вайбовать» на поляне: закат → сумерки → ночь — настоящими кадрами картины (PixelLab)
  // карта объёма фона (рельеф стен, нормали предметов) — под живой свет; предметы на полу допишут свои по ходу кадра
  if (light && bg.normal) light.normalCtx.drawImage(bg.normal, cam * bk, 0, W * bk, H * bk, 0, 0, W * S, H * S);
  if (light) pairNormals(g, light.normalCtx);
  // бой с боссом — факелы вспыхивают призрачным синим (v0.70); факел, который закрыла бы лестница, не рисуется
  bossFireTick();
  drawTorches(g, cam, (r.torches ?? []).filter(x => !torchUnderStairs(r, x)), game.time, bossFire(), fireFlare());
  if (r.flames) drawFlames(g, cam, r.flames, game.time);
  for (const d of r.decor ?? []) {
    if (d.type === 'cracks') drawCracks(g, d.x - cam, CONFIG.floorTop, { open: !!game.flags[d.secret], hits: game.wallHits }, game.time);
    else if (d.type === 'slab') drawSlab(g, d.x - cam, CONFIG.floorTop, !!game.flags[d.secret]);
    else if (d.type === 'shelfdoor') drawShelfDoor(g, d.x - cam, CONFIG.floorTop, !!game.flags[d.secret]);
    else if (d.type === 'stainedglass') drawStainedGlass(g, d.x - cam, CONFIG.floorTop, game.time, d.y);
    else if (DECOR_LIVE.has(d.type)) drawDecorLive(g, d, d.x - cam, CONFIG.floorTop, game.time);
  }
  if (r.gate === 'left') drawGatePanel(g, 26 - cam, CONFIG.floorTop, H, 1, true);   // дверь камеры — у стены, за бойцами
  const tr = game.transition;
  if (tr?.kind === 'door' && (!r.image || r.tile)) {
    // проём открывается, пока рыцарь входит и выходит
    const k = { turn: Math.min(1, tr.t / DOOR_PHASES.turn), walkIn: 1, fadeOut: 1, fadeIn: 1, walkOut: 1, turnOut: 1 - Math.min(1, tr.t / DOOR_PHASES.turnOut) }[tr.phase];
    if (tr.door.leaf) drawPaintedDoor(g, bgFor(game.room), tr.door, cam, k);
    else drawDoorOpen(g, tr.door, CONFIG.floorTop, cam, k);
  }
  for (const d of r.doors ?? []) if (d.mat && (!d.needs || game.flags[d.needs])) drawDoormat(g, d, cam);
  if (tr?.kind === 'path' && tr.q?.leaf) {   // тропа к нарисованной двери: створка открывается, пока подходит (и закрывается за спиной)
    const u = tr.d / tr.G.len, kk = tr.dir === 'out' ? Math.min(1, Math.max(0, (u - 0.45) / 0.35)) : Math.min(1, Math.max(0, 1 - (u - 0.1) / 0.4));
    drawPaintedDoor(g, bgFor(game.room), tr.q, cam, kk);
  }
  if (game.pathNear && !tr && Math.floor(game.time * 3) % 2 === 0) {
    // стрелка над началом тропы / лестницы: туда можно пройти
    const q = game.pathNear, a = q.pts[Math.min(1, q.pts.length - 1)];
    heightIcon(q.keys.includes('depthOut') && !q.keys.includes('depthIn') ? 'low' : 'high', a[0] - cam, a[1] - 22 * (a[2] ?? 1), PAL.gold);
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
    const E = game.ending?.phase === 'portal' ? game.ending : null;
    drawPortal(g, r.portal.x - cam, groundY(r.portal.z), game.time, lit, E ? glow + E.glow : glow);
    if (E) drawPortalRite(r.portal.x - cam, groundY(r.portal.z), E);
  }

  // сначала тени, потом бойцы, персонажи и вещи от дальних к ближним
  const hidePlayer = game.mode === 'title' || (game.cutscene && game.cutscene.t < WAKE.flash);
  const actors = [...game.enemies.filter(e => e.state !== 'gone'), ...game.npcs, ...(hidePlayer ? [] : [game.player])];
  for (const a of actors) {
    if (a === game.player && (a.state === 'swallowed' || tr?.kind === 'path')) continue;
    g.globalAlpha = a.state === 'dead' ? 0.3 : 0.55;
    const gy = groundY(Math.max(0, a.z));
    rect(g, a.x - cam - 7, gy - 1, 14, 2, '#0d0b14');
    rect(g, a.x - cam - 5, gy - 2, 10, 1, '#0d0b14');
    g.globalAlpha = 1;
  }
  for (const it of game.pickups) if ((it.room ?? 'hall') === game.room) { if (!drawLyingWeapon(g, it.kind, it.x - cam, groundY(it.z), it.t)) drawPickup(g, it.x - cam, groundY(it.z), it.t); }
  renderChokeAura(cam);
  const things = [...actors, ...(r.props ?? []).filter(pr => propOn(pr) && !(pr.pick && (pr.type === 'letter' || pr.type === 'weapon') && game.flags[chestFlag(pr)])).map(pr => ({ prop: pr, z: pr.z, x: pr.x }))];
  things.sort((a, b) => (a.prop?.flat ? -999 : a.z) - (b.prop?.flat ? -999 : b.z));   // ковёр (flat) — под всеми
  for (const a of things) {
    if (a.prop?.type === 'puddle') {
      // лужа под капелью: тёмное пятно, блик, круги от капель; капля падает с потолка
      const px = Math.round(a.x - cam), py = Math.round(groundY(a.z));
      for (let i = -3; i <= 3; i++) { const w = 12 - Math.abs(i) * 2.5; rect(g, px - w, py + i * 0.6, w * 2, 1, '#141a26'); }
      rect(g, px - 6, py - 1, 5, 1, '#3a4a5e');
      const ph = (game.time * 0.8 + a.x * 0.01) % 1, rr = Math.round(2 + ph * 7);
      if (ph < 0.8) { g.globalAlpha = 0.6 * (1 - ph); rect(g, px - rr, py, rr * 2, 1, '#6f87a3'); g.globalAlpha = 1; }
      // капля — из пролома в крыше (если он есть, v0.81: дождь гуще — три капли вразнобой) или с потолка
      const hole = (r.decor ?? []).some(d => d.type === 'roofhole'), top = hole ? 22 : CONFIG.floorTop - 70;
      for (let i = 0; i < (hole ? 3 : 1); i++) {
        const dy = ((game.time * 0.8 + a.x * 0.01 + 0.85 + i * 0.37) % 1) * 1.25;
        if (dy < 1 && a.prop.fill) rect(g, px + (i ? (i % 2 ? 4 : -5) : 0), Math.round(top + dy * (py - top)), 1, 2, '#8fb0cc');
      }
      continue;
    }
    if (a.prop?.type === 'weapon') { drawLyingWeapon(g, ITEMS[a.prop.pick].weapon, a.x - cam, groundY(a.z), game.time); continue; }   // оружие лежит на полу
    if (a.prop?.lights && !game.flags[a.prop.lights] && drawObjNamed(g, 'prop_candles_out', a.x - cam, groundY(a.z) + 1 - (a.prop.lift ?? 0))) continue;   // потухшая свеча
    if (a.prop) drawProp(g, a.prop.type, a.x - cam, groundY(a.z) - (a.prop.lift ?? 0), a.prop.type === 'chair' ? !!a.prop.flip : a.prop.altar ? (game.flags[a.prop.altar] && cupOnAltar() ? (game.flags.cup_holy ? 2 : 1) : 0) : !!game.flags[chestFlag(a.prop)], game.time, a.x);
    else if (a === game.player) {
      const fa = playerAlpha();
      if (fa > 0.02) { g.globalAlpha = fa; renderPlayer(cam); g.globalAlpha = 1; }
    }
    else if (a.npc) renderNpc(a, cam);
    else renderEnemy(a, cam);
  }
  if (game.current?.alive && !game.tutorial) {
    // отметка цели
    const c = game.current;
    rect(g, c.x - cam - 1, groundY(c.z) + 2, 3, 1, PAL.gold);
  }
  if (light) pairNormals(g, null);
  renderChokeHold(cam);
  for (const a of game.arrows) {
    if (a.stone) {   // камень из рогатки гоблина (v1.0): серый камешек с тенью и коротким следом
      const x = Math.round(a.x - cam), y = Math.round(a.y);
      if (!a.stuck) { g.globalAlpha = 0.35; rect(g, x - Math.sign(a.vx) * 3, y, 2, 1, '#c9c2b4'); g.globalAlpha = 1; }
      rect(g, x - 1, y - 1, 3, 3, '#3a3530'); rect(g, x, y - 1, 2, 2, '#8a8478'); rect(g, x, y - 1, 1, 1, '#c9c2b4');
    } else drawArrow(g, a.x - cam, a.y, a.vx, a.vy, a.stuck, a.bolt);
  }
  for (const w of game.waves) renderWave(w, cam);
  for (const s of game.particles) {
    if (!s.heart) { rect(g, s.x - cam, s.y, 1, 1, s.color); continue; }
    const hx = Math.round(s.x - cam), hy = Math.round(s.y);   // сердечко 3×3
    rect(g, hx - 1, hy, 1, 1, s.color); rect(g, hx + 1, hy, 1, 1, s.color); rect(g, hx - 1, hy + 1, 3, 1, s.color); rect(g, hx, hy + 2, 1, 1, s.color);
  }
  renderPuffs(cam);
  renderCoinFx(cam);
  if (light && !r.dark) renderDust(cam);

  // передний план: распахнутая дверь решётки
  if (r.gate === 'right') drawGatePanel(g, r.length - 26 - cam, CONFIG.floorTop, H, -1);

  if (r.dark && light) {
    // живой свет сам затемняет комнату (applyLight); остаются тёмные пылинки перед камерой
    for (const m of game.motes) {
      g.globalAlpha = 0.55;
      rect(g, m.x, m.y, m.s, m.s, m.s > 1 ? '#05040a' : '#2a2538');
    }
    g.globalAlpha = 1;
  } else if (r.dark) {
    // темнота без WebGL: свет от портала, от выхода и немного вокруг рыцаря
    const p = game.player;
    const c = game.cutscene;
    const portalLight = c && c.t < WAKE.flash ? 30 + 40 * (c.t / WAKE.flash) : 95;
    const lights = [];
    if (r.portal) lights.push({ x: r.portal.x - cam, y: groundY(r.portal.z) - 6, r: portalLight });
    if (r.gate) lights.push({ x: r.length - cam + 10, y: 110, r: 90, a: 0.8 });
    // костры и прочие огни на полу (light у пропа) — мерцают
    for (const pr of r.props ?? []) if (pr.light) lights.push({ x: pr.x - cam, y: groundY(pr.z) - 8, r: 120 + 8 * Math.sin(game.time * 9 + pr.x) + 5 * Math.sin(game.time * 23) });
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

  g.setTransform(S, 0, 0, S, 0, 0);
  if (game.mode === 'map') renderMap();
  if (game.flash > 0) {
    g.globalAlpha = game.flash;
    g.fillStyle = game.flashColor;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  renderBlend();
  // затемнение при переходе между комнатами; в начале сцены пробуждения — почти полная тьма
  let fade = 0;
  if (tr?.kind === 'door') fade = tr.phase === 'fadeOut' ? tr.t / DOOR_PHASES.fadeOut : tr.phase === 'fadeIn' ? 1 - tr.t / DOOR_PHASES.fadeIn : 0;
  if (tr?.kind === 'edge') fade = tr.phase === 'out' ? tr.t / EDGE_PHASES.out : 1 - tr.t / EDGE_PHASES.in;
  if (tr?.kind === 'path') fade = tr.black != null ? 1 : tr.fade ?? 0;
  if (tr?.kind === 'stairs') fade = tr.phase === 'out' ? tr.t / STAIR_PHASES.out : tr.phase === 'in' ? 1 - tr.t / STAIR_PHASES.in : tr.phase === 'climb' ? Math.max(0, (tr.t / CLIMB_T - 0.85) / 0.15) : 0;
  if (game.cutscene && game.cutscene.t < WAKE.flash) fade = Math.max(fade, 0.55);
  if (game.ending) fade = Math.max(fade, game.ending.black ?? 0);
  if (fade > 0) {
    g.globalAlpha = Math.min(1, fade);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (game.ending?.white > 0) {   // вспышка портала
    g.globalAlpha = Math.min(1, game.ending.white);
    g.fillStyle = '#fff8e6';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (game.debug) renderDebug(cam);
  // перезарядка вихря в HUD
  const charge = game.player.spinCharge;
  ui.skillSpinBar.style.width = `${Math.round(charge * 100)}%`;
  const skill = game.player.arms.spinName ?? 'вихрь';
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
  const blink = ITEMS[game.equip.amulet]?.blink;
  ui.skillMask.hidden = !blink;
  if (blink) {
    const k = Math.min(1, 1 - ((game.blinkReadyAt ?? 0) - game.time) / blink.cooldown);
    ui.skillMaskBar.style.width = `${Math.round(k * 100)}%`;
    ui.skillMask.classList.toggle('ready', k >= 1);
  }
  const ward = ITEMS[game.equip.amulet]?.ward;
  ui.skillWard.hidden = !ward;
  if (ward) {
    const k = Math.min(1, 1 - (game.wardReadyAt - game.time) / ward.cooldown);
    ui.skillWardBar.style.width = `${Math.round(k * 100)}%`;
    ui.skillWard.classList.toggle('ready', k >= 1);
  }
}

// удушение: под рыцарем лиловый круг, сжимается к концу заклинания
function renderChokeAura(cam) {
  const b = game.enemies.find(e => e.kind === 'boss' && (e.state === 'cast' || e.state === 'choking'));
  if (!b) return;
  const p = game.player, x = p.x - cam, y = groundY(p.z);
  const k = b.state === 'cast' ? Math.min(1, b.t / (b.def.chokeCast * (b.phase === 2 ? b.def.phase2Speed : 1))) : 1;
  const r = Math.round(18 - 8 * k);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.35 + 0.3 * k + 0.15 * Math.sin(game.time * 20);
  for (let a = 0; a < 40; a++) {
    const t = a / 40 * Math.PI * 2 + game.time * 2;
    rect(g, Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r * 0.3), 1, 1, a % 4 ? '#b07cff' : '#e6d4ff');
  }
  g.restore();
}

// захлёст рапирой: серебряная дуга сверху вперёд, яркая у кончика, и щелчок на конце
function whipArc(x, ground, f, k) {
  k = Math.max(0, Math.min(1, k));
  const cx = x + f * 4, cy = ground - 30, R = 24;
  const head = -110 + 150 * k, tail = Math.max(-110, head - 110);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let a = tail; a <= head; a += 3) {
    const u = (a - tail) / Math.max(1, head - tail), r = a * Math.PI / 180;
    g.globalAlpha = 0.15 + 0.85 * u * u;
    g.fillStyle = u > 0.85 ? '#ffffff' : '#bcd6f0';
    g.fillRect(Math.round((cx + f * Math.cos(r) * R) * 2) / 2, Math.round((cy + Math.sin(r) * R * 0.85) * 2) / 2, u > 0.6 ? 1 : 0.5, 0.5);
  }
  if (k > 0.7) {   // щелчок
    const r = head * Math.PI / 180, tx = cx + f * Math.cos(r) * R, ty = cy + Math.sin(r) * R * 0.85;
    g.globalAlpha = (1 - k) * 3;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; g.fillRect(Math.round((tx + Math.cos(an) * 3) * 2) / 2, Math.round((ty + Math.sin(an) * 3) * 2) / 2, 0.5, 0.5); }
  }
  g.restore();
}

// Бубновый туз (v0.70): щит-заклинание. Вспышка (звезда, лучи, кольцо) → ромб раскрывается, как переворачиваемая карта,
// с отскоком → держится: алое тело, сияющая золотая кайма, бегущие руны, пульсирующая масть, искры вверх →
// рассыпается осколками. a — сколько прошло (0…0,8 с). Свет на сцену — в sceneLights.
function renderAceWard(cx, cy, a) {
  const T = 0.8;
  if (a < 0 || a > T) return;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const HW = 12, HH = 20;
  g.save();
  g.globalCompositeOperation = 'lighter';
  // 1. вспышка: звезда, лучи, кольцо
  if (a < 0.22) {
    const f = a / 0.22;
    g.globalAlpha = 1 - f;
    const R = 6 + 30 * ease(f);
    for (let i = 0; i < 12; i++) {
      const an = i / 12 * Math.PI * 2 + 0.2, len = (i % 2 ? 0.55 : 1) * R;
      for (let r = 2; r < len; r += 1.5) { g.fillStyle = r < len * 0.5 ? '#fff6e0' : '#ffb070'; g.fillRect(Math.round((cx + Math.cos(an) * r) * 2) / 2, Math.round((cy + Math.sin(an) * r * 0.9) * 2) / 2, 0.5, 0.5); }
    }
    for (let i = 0; i < 48; i++) {
      const an = i / 48 * Math.PI * 2;
      g.fillStyle = '#ff9aa6';
      g.fillRect(Math.round((cx + Math.cos(an) * R * 0.8) * 2) / 2, Math.round((cy + Math.sin(an) * R * 0.5) * 2) / 2, 0.5, 0.5);
    }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 14);
    gr.addColorStop(0, 'rgba(255,250,235,0.9)'); gr.addColorStop(1, 'rgba(255,120,120,0)');
    g.fillStyle = gr; g.fillRect(cx - 14, cy - 14, 28, 28);
  }
  // 2–4. ромб: раскрытие, держится, рассыпается
  const open = back((a - 0.04) / 0.2);                       // 0 → 1 с отскоком
  const flip = Math.abs(Math.sin(Math.min(1, Math.max(0, (a - 0.04) / 0.2)) * Math.PI / 2));   // карта переворачивается
  const fade = a > 0.62 ? 1 - (a - 0.62) / 0.18 : 1;
  const hw = HW * open * flip, hh = HH * Math.min(1.15, 0.35 + 0.65 * open);
  if (open > 0.02 && a < 0.62) {
    // ореол
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, HH * 1.4);
    gr.addColorStop(0, `rgba(255,90,100,${0.32 * fade})`); gr.addColorStop(1, 'rgba(255,60,80,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(cx - HH * 1.4, cy - HH * 1.4, HH * 2.8, HH * 2.8);
    g.globalCompositeOperation = 'source-over';
    // тело ромба: построчно, от тёмно-алого по краю к яркому к середине
    for (let y = -hh; y <= hh; y += 0.5) {
      const w = hw * (1 - Math.abs(y) / hh);
      if (w < 0.5) continue;
      const d = Math.abs(y) / hh;
      g.globalAlpha = 0.82 * fade;
      g.fillStyle = d > 0.75 ? '#7a1426' : d > 0.45 ? '#a81d33' : '#c8303f';
      g.fillRect(Math.round((cx - w) * 2) / 2, y + cy, Math.round(w * 4) / 2, 0.5);
      // кайма — светлая, с бликом наверху слева
      g.globalAlpha = fade;
      g.fillStyle = y < 0 ? '#ffe6a8' : '#ffb3b8';
      g.fillRect(Math.round((cx - w) * 2) / 2, y + cy, 0.5, 0.5);
      g.fillRect(Math.round((cx + w) * 2) / 2 - 0.5, y + cy, 0.5, 0.5);
    }
    g.globalCompositeOperation = 'lighter';
    // руны бегут по кромке внутри
    for (let i = 0; i < 16; i++) {
      const u = (i / 16 + a * 0.9) % 1, side = Math.floor(u * 4), f = (u * 4) % 1;
      const P = [[0, -hh * 0.72], [hw * 0.72, 0], [0, hh * 0.72], [-hw * 0.72, 0]];
      const [x0, y0] = P[side], [x1, y1] = P[(side + 1) % 4];
      g.globalAlpha = (0.5 + 0.5 * Math.sin(a * 30 + i)) * fade;
      g.fillStyle = i % 4 ? '#ffd27a' : '#ffffff';
      g.fillRect(Math.round((cx + x0 + (x1 - x0) * f) * 2) / 2, Math.round((cy + y0 + (y1 - y0) * f) * 2) / 2, 0.5, 0.5);
    }
    // масть посередине — пульсирует
    const pul = 0.75 + 0.25 * Math.sin(a * 22);
    g.globalAlpha = fade * pul;
    for (let y = -4.5; y <= 4.5; y += 0.5) { const w = 3 * (1 - Math.abs(y) / 4.5) * flip; if (w > 0.2) { g.fillStyle = Math.abs(y) < 1.5 ? '#ffffff' : '#ffe0e4'; g.fillRect(Math.round((cx - w) * 2) / 2, cy + y, Math.round(w * 4) / 2, 0.5); } }
    // искры вверх
    for (let i = 0; i < 6; i++) {
      const u = (a * 2.2 + i * 0.17) % 1;
      g.globalAlpha = (1 - u) * fade;
      g.fillStyle = i % 2 ? '#ffd27a' : '#ff9aa6';
      g.fillRect(Math.round((cx + Math.sin(i * 2.3 + a * 6) * hw * 0.9) * 2) / 2, Math.round((cy + hh * 0.4 - u * hh * 1.8) * 2) / 2, 0.5, 0.5);
    }
  }
  // 4. осколки
  if (a >= 0.6) {
    const f = (a - 0.6) / 0.2;
    for (let i = 0; i < 14; i++) {
      const an = i / 14 * Math.PI * 2 + i, r = 4 + f * (18 + (i % 4) * 5);
      const x = cx + Math.cos(an) * r * 0.8, y = cy + Math.sin(an) * r + f * f * 6;
      g.globalAlpha = 1 - f;
      g.fillStyle = i % 3 ? '#c8303f' : '#ffb3b8';
      g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 1, i % 2 ? 1 : 0.5);
    }
  }
  g.restore();
}

// удушение (v0.69): на шее рыцаря — светящийся обод с рунами, от руки призрака к нему тянется дрожащая нить,
// по ней бегут искры; рыцарь висит в воздухе и хватается за горло (кадры held). Рисуется поверх бойцов.
function renderChokeHold(cam) {
  // удушение (v0.70, по просьбе владельца — без нити): вокруг шеи рыцаря разгорается голубой свет, пульсирует и сжимается
  const p = game.player;
  const b = game.enemies.find(e => e.kind === 'boss' && (e.state === 'cast' || e.state === 'choking'));
  if (!b || (b.state === 'cast' && b.t < 0.3)) return;
  const k = b.state === 'cast' ? Math.min(1, b.t / (b.def.chokeCast * (b.phase === 2 ? b.def.phase2Speed : 1))) : 1;
  const nx = p.x - cam + p.facing * 1, ny = groundY(p.z) - (p.airY ?? 0) - 24;      // шея рыцаря
  const t = game.time, pul = 0.8 + 0.2 * Math.sin(t * 14);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const R = 13 - 4 * k;
  const gr = g.createRadialGradient(nx, ny, 0, nx, ny, R);
  gr.addColorStop(0, `rgba(170,240,255,${0.55 * k * pul})`);
  gr.addColorStop(0.45, `rgba(90,190,255,${0.3 * k * pul})`);
  gr.addColorStop(1, 'rgba(60,140,255,0)');
  g.fillStyle = gr;
  g.fillRect(nx - R, ny - R, R * 2, R * 2);
  // светлый обод у самого горла — мягкий, без точек-рун
  const rx = 5 - 1.5 * k, ry = 1.6;
  g.globalAlpha = 0.7 * k * pul;
  g.fillStyle = '#d8f6ff';
  for (let a = 0; a < Math.PI * 2; a += 0.12) g.fillRect(Math.round((nx + Math.cos(a) * rx) * 2) / 2, Math.round((ny + Math.sin(a) * ry) * 2) / 2, 0.5, 0.5);
  g.restore();
}

// клубы тёмного дыма (рывок в тень): пиксельные круги, тёмно-лиловые, к концу жизни прозрачнее
function renderPuffs(cam) {
  for (const s of game.puffs) {
    const a = Math.min(1, s.life / s.max * 1.6) * 0.55;
    const r = Math.round(s.r), cx = Math.round(s.x - cam), cy = Math.round(s.y);
    g.globalAlpha = a;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(g, cx - hw, cy + dy, hw * 2 + 1, 1, dy < -r / 3 ? '#6a5f8a' : dy < r / 3 ? '#4a4068' : '#2e2744');
    }
  }
  g.globalAlpha = 1;
}

// покадровые враги (v1.0, гоблины): анимации PixelLab по состояниям — стойка, шаг, замах → удар, боль, смерть.
// assets/sprites/<тип>/<анимация>_<n>.png (смотрят вправо) + <тип>.json: { anims: { key: { n, w, h, foot, cx } } }
const ANIM_ENEMIES = {
  gobWarrior: { strikeAt: 7 },
  gobJumper: { strikeAt: 7 },
  gobShooter: { windup: [0, 8, 7, 6, 5, 4, 3, 2], strike: [1, 1, 0] },   // рогатка: тянет резинку, выстрел — кадр 1
};
const animSets = {};
function animSet(type) {
  if (!ANIM_ENEMIES[type]) return null;
  const s = animSets[type] ??= { meta: null, imgs: {} };
  if (!s.meta && !s.loading) {
    s.loading = true;
    fetch(`assets/sprites/${type}/${type}.json`).then(r => r.json()).then(m => {
      for (const [k, a] of Object.entries(m.anims)) for (let i = 0; i < a.n; i++) s.imgs[k + i] = Object.assign(new Image(), { src: `assets/sprites/${type}/${k}_${i}.png` });
      s.meta = m;
    }).catch(() => {});
  }
  return s.meta && Object.values(s.imgs).every(im => im.complete) ? s : null;
}
for (const t in ANIM_ENEMIES) animSet(t);   // заранее, чтобы враг не появлялся с запозданием
function animFrame(e, s) {
  const A = s.meta.anims, cfg = ANIM_ENEMIES[e.type], at = cfg.strikeAt ?? Math.floor(A.attack.n * 0.7);
  const pick = (k, i) => [k, Math.max(0, Math.min(A[k].n - 1, Math.floor(i)))];
  if (e.state === 'dead') return pick('death', e.t * 12);
  const wk = Math.min(0.999, e.t / Math.max(0.05, e.windupTime ?? e.def.windup));
  if (e.state === 'windup') return cfg.windup ? pick('attack', cfg.windup[Math.floor(wk * cfg.windup.length)]) : pick('attack', Math.min(at - 1, wk * at));
  if (e.state === 'strike') return cfg.strike ? pick('attack', cfg.strike[Math.min(cfg.strike.length - 1, Math.floor(e.t / 0.08))]) : pick('attack', at + (e.t / 0.16) * (A.attack.n - at));
  if (e.state === 'stagger' || e.state === 'hurt' || e.state === 'reel') return pick('hurt', e.t * 12);
  const walking = e.step !== e.animStep; e.animStep = e.step;
  if (walking || e.state === 'approach') return pick('walk', ((e.step / 6.3) % 1 + 1) % 1 * A.walk.n);
  return pick('idle', (game.time * 5 + e.x * 0.1) % A.idle.n);
}
function drawAnimEnemy(e, s, ex, GROUND, alpha) {
  const [k, i] = animFrame(e, s), a = s.meta.anims[k], im = s.imgs[k + i];
  const S2 = 1 / S;   // картинка — в пикселях экрана (как у Найта), мир — вдвое крупнее
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(ex), Math.round(GROUND - (e.airY ?? 0)));
  if (e.facing < 0) g.scale(-1, 1);
  g.drawImage(im, -a.cx * S2, -a.foot * S2, a.w * S2, a.h * S2);
  if (e.flashT > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * 0.55; g.drawImage(im, -a.cx * S2, -a.foot * S2, a.w * S2, a.h * S2); }
  g.restore();
  return { tipX: ex + e.facing * 14, tipY: GROUND - 18 };
}

function renderEnemy(e, cam) {
  if (e.state === 'gone') return;
  const ex = e.x - cam;
  if (ex < -50 || ex > W + 50) return;
  const as = animSet(e.type);
  if (ANIM_ENEMIES[e.type] && !as) return;   // кадры ещё грузятся — не показывать старую фигурку-заглушку
  if (e.state === 'dead' && as) { if (e.t < 2) drawAnimEnemy(e, as, ex, groundY(e.z), Math.max(0, Math.min(1, 1 - (e.t - 1.2) / 0.8))); return; }
  if (e.state === 'dead' && e.kind !== 'slime') { renderDeath(e, ex); return; }
  // спящий скелет лежит грудой костей; проснулся — встаёт (фигура вытягивается вверх)
  const riser = e.def.skull && e.kind !== 'ghost' && !e.def.noRise && !e.noRise;
  if (riser && e.state === 'dormant') { drawBonePile(ex, groundY(e.z), e.facing, e.def, enemyWeapon(e)); return; }
  const riseK = riser && e.state === 'rise' ? Math.min(1, e.t / RISE_TIME) : 1;
  let alpha = e.kind === 'ghost' ? (0.55 + 0.15 * Math.sin(game.time * 5 + e.x)) * (e.ghost ?? 1) : 1;  // призрак полупрозрачный и мерцает
  if (e.state === 'dead') alpha = Math.max(0, 1 - (e.t - 0.6) / 0.8);
  if (e.endFade != null) alpha *= e.endFade;   // сцена конца главы: растворяется
  const vanishing = (e.state === 'leave' || e.state === 'flee') && e.vanishFx;
  if (vanishing) {
    // рывок в тень: шлейф полупрозрачных теней позади, сам тает; по пути — клочья дыма
    alpha *= e.fade ?? 1;
    if ((e.puffAt = (e.puffAt ?? 0) + 1) % 3 === 0) game.puffs.push({ x: e.x - e.facing * 6, y: groundY(e.z) - 6 - Math.random() * 26, r: 2 + Math.random() * 3, vx: -e.facing * 30, vy: -8, life: 0.5, max: 0.5 });
  }
  if (alpha <= 0.02) return;
  g.globalAlpha = alpha;
  const GROUND = groundY(e.z);
  if (CONFIG.enemyBars && e.alive && !e.def.practice && e.hp < e.def.hp) {
    const w = 14, fill = Math.max(1, Math.round(w * e.hp / e.def.hp));
    const top = GROUND - (e.kind === 'slime' ? Math.round(14 * e.size) + 5 : spriteReady(e.type) ? 34 : 40) - e.airY;
    rect(g, ex - w / 2, top, w, 2, '#2d2838');
    rect(g, ex - w / 2, top, fill, 2, '#e8454f');
  }
  if (e.kind === 'slime') {
    const colors = e.flashT > 0 ? flashColors(e.def.colors) : e.def.colors;
    if (!drawSlimeImg(g, { x: ex, ground: GROUND, airY: e.airY, size: e.size, squash: e.squash, facing: e.facing, holding: e.holding, flash: e.flashT > 0 }))
      drawSlimeOutlined(g, { x: ex, ground: GROUND, airY: e.airY, size: e.size, squash: e.squash, colors, facing: e.facing, holding: e.holding });
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) rect(g, ex - 1, GROUND - e.airY - 16, 3, 3, PAL.spark);
  } else {
    const colors = e.flashT > 0 ? flashColors(e.def.colors) : e.def.colors;
    const whirl = e.state === 'strike' && e.strike?.pose === 'whirl';
    // вихрь врага — тот же шлейф, что у рыцаря: задняя половина за ним, передняя — поверх (после спрайта)
    const whirlK = whirl ? Math.min(0.5, e.t / 0.36) : 0;   // один оборот за удар
    if (whirl) spinTrail(ex, GROUND - 24 - e.airY, whirlK, e.facing, true);
    if (e.kind === 'ghost') g.globalCompositeOperation = 'lighter';  // призрак светится, а не темнеет
    if (riseK < 1 && !spriteReady(e.type)) {
      g.save();
      g.translate(ex, GROUND);
      g.scale(1, 0.25 + 0.75 * ease(riseK));
      g.translate(-ex, -GROUND);
    }
    const sprite = spriteReady(e.type);
    // как у Найта: разворот — кадрами поворота (не мгновенным отражением), шаг вглубь — шаги спереди/со спины
    const mv = e.mv ??= { x: e.x, z: e.z, dx: 0, dz: 0 };
    mv.dx = mv.dx * 0.8 + (e.x - mv.x) * 0.2; mv.dz = mv.dz * 0.8 + (e.z - mv.z) * 0.2; mv.x = e.x; mv.z = e.z;
    const walking = e.step !== e.lastDrawStep || Math.abs(mv.dz) > 0.04;
    e.lastDrawStep = e.step;
    const depth = walking && Math.abs(mv.dz) > Math.abs(mv.dx) * 1.3 && Math.abs(mv.dz) > 0.04 ? (mv.dz > 0 ? 'south' : 'north') : null;
    if (e.drawFacing !== undefined && e.drawFacing !== e.facing && e.state !== 'windup' && e.state !== 'strike' && e.state !== 'reel') e.turnFx = { t: game.time, toLeft: e.facing < 0 };
    e.drawFacing = e.facing;
    const turn = e.turnFx && game.time - e.turnFx.t < 0.22 ? { k: (game.time - e.turnFx.t) / 0.22, toLeft: e.turnFx.toLeft } : null;
    if (vanishing && sprite) {
      // тени-отпечатки рывка: через одну, тающие
      e.trail?.forEach((t, i) => {
        if (i % 2 || Math.abs(t.x - e.x) < 6) return;
        g.globalAlpha = t.a * 0.7;
        drawSprite(e.type, g, { x: t.x - cam, ground: groundY(t.z), facing: e.facing, pose: e.pose, state: 'ready', walking: true, step: t.step / 6.3,
          time: game.time, airY: 0, weaponLen: e.def.weapon ?? 17, weapon: enemyWeapon(e), bladeHidden: true, shade: i % 4 ? '#2a2140' : '#4a3d6e' });
      });
      g.globalAlpha = alpha;
    }
    const tip = as ? drawAnimEnemy(e, as, ex, GROUND, alpha) : sprite ? drawSprite(e.type, g, {
      x: ex, ground: GROUND, facing: e.facing, pose: e.pose, state: walking ? 'ready' : 'attack', walking, step: depth ? game.time * 1.5 : e.step / 6.3, turn, depth,
      time: game.time, airY: e.airY, weaponLen: e.def.weapon ?? 17, weapon: enemyWeapon(e), bowDraw: e.bowDraw ?? 0,
      bladeHidden: !!e.disarmed, flash: e.flashT > 0, frame: e.endFrame ?? (riseK < 1 ? 'pose_kneel' : undefined), anim: e.endFrame ? undefined : enemyAnim(e),
      cloth: e.kind === 'boss' ? bossCloth(e) : undefined,
    }) ?? { tipX: ex, tipY: GROUND - 20 } : drawFigureOutlined(g, {
      x: ex, ground: GROUND, facing: e.facing, pose: e.pose, colors, step: e.step, airY: e.airY,
      breathe: (e.state === 'idle' || e.state === 'dormant') && !e.def.skull && Math.sin(game.time * 2.2 + e.x * 0.37) > 0.3 ? 1 : 0,  // живые дышат, скелеты — нет
      weaponLen: e.def.weapon ?? 17, skull: e.def.skull, shield: e.def.shield && e.alive,
      bow: e.kind === 'archer', bowDraw: e.bowDraw ?? 0, crossbow: e.def.crossbow,
      face: e.kind === 'duelist', rapier: e.kind === 'duelist', robe: e.def.robe, bladeHidden: !!e.disarmed,
      wrap: e.def.wrap, veil: e.def.veil, bun: e.def.bun, ornate: e.def.ornate, curved: e.def.curved, slim: e.def.slim, spear: e.def.spear,
      bandit: e.def.bandit, axe: e.def.axe, plate: e.def.plate, halberd: e.def.halberd,
    });
    if (riseK < 1 && !sprite) g.restore();
    if (whirl) spinTrail(ex, GROUND - 24 - e.airY, whirlK, e.facing, false);
    // читаемые удары врага (v0.83): блеск на клинке в начале замаха и красный росчерк при ударе
    if (e.kind !== 'archer' && e.kind !== 'slime' && !e.disarmed && e.alive) {
      if (e.state === 'windup' && !e.glinted) {
        e.glinted = true;
        const danger = e.strike?.breaks || e.strike?.bypass || e.strike?.pose === 'diagUp' || e.strike?.pose === 'diagDown';
        fxImpact('glint', tip.tipX + cam, tip.tipY, { color: danger ? '#ffb05a' : '#ffffff' });
      } else if (e.state !== 'windup') e.glinted = false;
      if (e.state === 'strike' && !whirl) {
        const bx = ex, by = GROUND - 24 - e.airY;
        fxSwing(e, tip.tipX + cam, tip.tipY, bx + cam, by, e.kind === 'boss' || e.kind === 'ghost' ? '#9fd4ff' : '#ff7a5a');
      }
    }
    if (e.kind === 'boss' && e.eyes > 0) {
      // глаза вспыхивают под маской
      const hy = GROUND - 31 - e.airY, hx = ex + e.facing * 2;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 9);
      gr.addColorStop(0, `rgba(180,240,255,${0.6 * e.eyes})`);
      gr.addColorStop(1, 'rgba(180,240,255,0)');
      g.fillStyle = gr;
      g.fillRect(hx - 9, hy - 9, 18, 18);
      g.restore();
      rect(g, hx - 1, hy, 1, 1, '#e8fbff');
      rect(g, hx + 1, hy, 1, 1, '#e8fbff');
    }
    g.globalCompositeOperation = 'source-over';
    if (CONFIG.windupHints && e.state === 'windup' && e.alive) windupHint(e, ex, GROUND - 50 - e.airY);
    if (e.def.crossbow && e.state === 'windup' && e.alive && e.t > e.windupTime * 0.35) {
      // арбалетчик целится: пунктир на высоте выстрела, к концу замаха мигает
      const y = clashY(e.height, e.z), end = game.player.x - cam;
      const late = e.t > e.windupTime - 0.3;
      if (!late || Math.floor(e.t * 20) % 2 === 0) {
        g.globalAlpha = late ? 0.8 : 0.45;
        for (let x = ex + e.facing * 12, n = 0; (e.facing > 0 ? x < end : x > end) && n < 200; x += (e.facing || 1) * 4, n++) rect(g, x, y, 2, 1, '#e8454f');
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

// чем бьёт враг со спрайтом: оружие рисуется кодом от кисти
// приёмы кадрами PixelLab (v0.70): выпад Илии, кулак/полёт/вскинутые руки босса. null — обычные позы.
// На этих кадрах оружие нарисовано (или руки пусты) — точки кисти нет, своё оружие кодом не рисуется.
function enemyAnim(e) {
  const A = key => spriteAnim(e.type, key);
  const cl = x => Math.max(0, Math.min(1, x));
  if (e.kind === 'duelist' && A('lunge') && e.alive) {
    const thrust = e.strike?.pose === 'thrust' || e.height === 'mid';
    if (e.state === 'leapIn') return { key: 'lunge', k: 0.1 + 0.3 * cl(e.t / 0.3) };
    if (e.state === 'windup' && thrust) { e.lunging = true; return { key: 'lunge', k: 0.28 * cl(e.t / e.windupTime) }; }
    if (e.state === 'strike' && thrust) return { key: 'lunge', k: 0.3 + 0.35 * cl(e.t / 0.16) };
    if (e.state === 'recover' && e.lunging) return { key: 'lunge', k: 0.65 + 0.35 * cl(e.t / (e.def.recover ?? 0.6)) };
    if (e.state !== 'recover') e.lunging = false;
  }
  if (e.kind === 'boss' && e.alive) {
    const d = e.def;
    if (e.state === 'cast' && A('clench')) return { key: 'clench', k: 0.75 * cl(e.t / d.chokeCast) };
    if (e.state === 'choking' && A('clench')) return { key: 'clench', k: 0.75 + 0.24 * ((e.t * 2) % 1) };   // сжимает кулак, рука дрожит
    if (e.state === 'dash' && A('dash')) return { key: 'dash', k: cl(e.t / 0.35) };
    if (e.state === 'stance' && A('raise')) return { key: 'raise', k: cl(e.t / (e.pat?.stance ?? 0.9)) };
  }
  return null;
}

// сюрко и призрачный хвост босса — ткань на пружинах (v0.70): строки ниже пояса — цепочка, каждая тянется за верхней,
// по инерции отстаёт при разгоне и торможении, сопротивляется воздуху на ходу, низ колышет призрачный ветерок; всё затухает
const CLOTH_ROWS = 36;
function bossCloth(e) {
  const now = game.time;
  const dt = Math.min(1 / 30, Math.max(1 / 240, now - (e._clothT ?? now - 1 / 60)));
  const v = (e.x - (e._clothX ?? e.x)) / dt;
  e._clothX = e.x; e._clothT = now;
  const c = e._cloth ?? (e._cloth = { off: new Float32Array(CLOTH_ROWS), vel: new Float32Array(CLOTH_ROWS), v: 0 });
  const acc = (v - c.v) / dt;   // ускорение корпуса
  c.v = v;
  const busy = e.state === 'stance' || e.state === 'cast' || e.state === 'choking';
  const steps = Math.ceil(dt / (1 / 120)), h = dt / steps;
  for (let s = 0; s < steps; s++) {
    for (let i = 1; i < CLOTH_ROWS; i++) {
      const f = i / CLOTH_ROWS;
      const spring = 260 * (c.off[i - 1] - c.off[i]) - 18 * c.off[i];            // за верхней строкой и к телу
      const inertia = -acc * 0.035 * f;                                           // отстаёт при разгоне
      const drag = -v * 0.9 * f * f;                                              // сопротивление воздуха на ходу
      const wind = Math.sin(now * (busy ? 7 : 2.6) - i * 0.35) * (busy ? 90 : 38) * f;   // призрачный ветерок
      c.vel[i] += (spring + inertia + drag + wind - 7 * c.vel[i]) * h;
      c.off[i] += c.vel[i] * h;
      c.off[i] = Math.max(-9, Math.min(9, c.off[i]));
    }
  }
  return { cut: 40, offs: c.off };
}

function enemyWeapon(e) {
  const d = e.def;
  if (d.crossbow) return 'crossbow';   // арбалетчик тоже стрелок — проверять раньше лука
  if (e.kind === 'archer') return 'bow';
  if (e.kind === 'duelist') return 'rapier';
  if (e.kind === 'ghost' || e.kind === 'boss') return 'ghostsword';
  return d.axe ? 'axe' : d.halberd ? 'halberd' : d.spear ? 'spear' : 'sword';
}

// смерть врага: скелет рассыпается в груду костей (лежит, пока рыцарь в комнате), живой — падает навзничь и тает
function renderDeath(e, ex) {
  const GROUND = groundY(e.z), t = e.t, f = e.facing;
  if (spriteReady(e.type)) { renderSpriteDeath(e, ex, GROUND, t, f); return; }
  const opts = {
    x: ex, ground: GROUND, facing: f, pose: e.pose, colors: e.def.colors, weaponLen: e.def.weapon ?? 17,
    skull: e.def.skull, shield: e.def.shield, bow: e.kind === 'archer', crossbow: e.def.crossbow, bladeHidden: true,
    bandit: e.def.bandit, axe: e.def.axe, plate: e.def.plate, halberd: e.def.halberd, spear: e.def.spear,
    wrap: e.def.wrap, veil: e.def.veil, robe: e.def.robe,
  };
  if (e.kind === 'ghost') {
    // призрак не оставляет костей: тает, поднимаясь
    const a = Math.max(0, 0.6 * (1 - t / 0.7));
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = 'lighter';
    drawFigureOutlined(g, { ...opts, ground: GROUND - Math.round(t * 30) });
    g.restore();
    return;
  }
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

// то же для врага в пиксель-арте: скелет оседает и рассыпается, призрак тает вверх, живой падает навзничь
function renderSpriteDeath(e, ex, GROUND, t, f) {
  const o = { x: ex, ground: GROUND, facing: f, pose: e.pose, bladeHidden: true };
  if (e.kind === 'ghost' || e.kind === 'boss') {
    const a = Math.max(0, (e.kind === 'boss' ? 0.9 : 0.6) * (1 - t / (e.kind === 'boss' ? 2 : 0.7)));
    if (a <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    drawSprite(e.type, g, { ...o, ground: GROUND - Math.round(t * 30), frame: 'pose_hurt', alpha: a });
    g.restore();
    return;
  }
  if (e.def.skull) {
    if (t < 0.3) drawSprite(e.type, g, { ...o, frame: t < 0.12 ? 'pose_kneel' : 'pose_dead' });
    if (t > 0.15) drawBonePile(ex, GROUND, f, e.def, enemyWeapon(e));
    return;
  }
  const k = ease(Math.min(1, t / 0.35));
  const alpha = Math.max(0, 1 - Math.max(0, t - 2.2) / 0.8);
  if (alpha <= 0) return;
  drawSprite(e.type, g, { ...o, frame: 'pose_hurt', rotate: -f * k * Math.PI / 2, ground: GROUND + Math.round(k * 10), alpha });
}

function drawBonePile(x, gy, f, def, kind = null) {
  x = Math.round(x);
  if (drawBonePileImg(g, x, gy, f)) {
    // оружие на полу — картинкой того, что было в руке; рукоять у костей, клинок — от рыцаря
    if (def.kind !== 'archer' && !(kind && drawFloorWeapon(g, kind, x - f * 4, gy, -f, def.weapon ?? 17))) {
      const w = Math.min(22, def.weapon ?? 17);
      rect(g, x - f * 4 - (f > 0 ? w : 0), gy, w, 1, def.colors.blade ?? '#c3ccd6');
    }
    return;
  }
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
  const sprite = knightReady();
  if (game.transition?.kind === 'path' && game.transition.pos && sprite) {
    // по нарисованной тропе: вдаль — меньше и бледнее, шаги со спины / спереди / сбоку по направлению дороги
    const c = game.transition.pos;
    if (c.alpha <= 0.01) return;
    drawKnight(g, { x: c.x - cam, ground: c.y, facing: c.facing, depth: c.depth, pose: POSES.sheathed, state: 'ready', walking: true,
      step: game.transition.step, time: game.time, alpha: c.alpha, scale: c.s, sheathed: true, sheath: c.depth ? null : { kind: p.weapon, len: (p.arms.length ?? 17) * 2 } });
    return;
  }
  if (game.climb && sprite) {
    // по ступеням: шаги сбоку, наискось вверх или вниз; оружие в ножнах
    const c = game.climb;
    drawKnight(g, { x: c.x - cam, ground: c.y, facing: c.facing, pose: POSES.sheathed, state: 'ready', walking: true, step: c.step, time: game.time,
      alpha: c.alpha, sheathed: true, sheath: { kind: p.weapon, len: (p.arms.length ?? 17) * 2 } });
    return;
  }
  // оружие за спиной (v0.69): любое, и рапира; sheath.k — сколько прошло от руки до ножен
  const sheathKind = p.weapon, sheathLen = (p.arms.length ?? 17) * 2;
  if (p.state === 'roll' && sprite) {
    const k = Math.min(1, p.t / WEAPON.roll.time);
    if (spriteAnim('knight', 'roll')) drawKnight(g, { x: px, ground: GROUND, facing: p.facing, anim: { key: 'roll', k }, sheath: p.sheathed ? { kind: sheathKind, len: sheathLen } : null });
    else drawKnight(g, { x: px, ground: GROUND, facing: p.facing, frame: 'pose_tuck', rotate: p.facing * k * Math.PI * 2 });
    return;
  }
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
  if (view !== 'side' && sprite) {
    if (alpha > 0) drawKnight(g, { x: px, ground: GROUND, view: view === 'back' ? 'back' : 'front', squash, alpha });
    return;
  }
  if (view !== 'side') {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    drawFigureFrontOutlined(g, { x: Math.round(px), ground: GROUND, colors, back: view === 'back', step: p.step * Math.PI * 2, weapon: p.weapon, squash });
    g.globalAlpha = 1;
    return;
  }
  if (((game.cutscene && game.cutscene.t < WAKE.kneel) || game.ending?.kneel || game.pet?.kneel) && sprite) {
    drawKnight(g, { x: px, ground: GROUND, facing: p.facing, frame: 'pose_kneel' });
    return;
  }
  // посадка по месту (владелец, 17.10): на скамье, диване, в кресле — сидит на сиденье; у костра и камина — на земле, как Илиа
  const sitImg = game.rest ? ((game.rest.spot.rest.seat ?? 0) > 0 ? 'knight_sit_seat' : 'knight_sit_ground') : game.vibe?.spot.sit ? game.vibe.spot.sitImg ?? 'knight_sit_ground' : null;
  if (game.vibe && sprite && game.vibe.t > (game.vibe.spot.sit ? 0.6 : 0.25)) {   // «вайбовать»: сидит (sit у места) или стоит спиной к нам и смотрит вдаль
    if (sitImg && drawObjNamed(g, sitImg, px, GROUND, p.facing < 0)) return;
    drawKnight(g, game.vibe.spot.sit ? { x: px, ground: GROUND, facing: p.facing, frame: 'pose_kneel' } : { x: px, ground: GROUND, facing: 1, frame: 'back' });
    return;
  }
  if (game.rest && sprite) {
    if (drawObjNamed(g, sitImg, px, GROUND, p.facing < 0)) return;
    drawKnight(g, { x: px, ground: GROUND, facing: p.facing, frame: 'pose_kneel' });
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
  const spinFrames = spinning && spriteAnim('knight', 'spin');   // есть кадры вращения — разворот рисуют они
  const facing = spinning && k > 0.5 && !spinFrames ? -p.facing : p.facing;
  const active = p.phase === 'active';
  const drawing = p.state === 'attack' && p.atk.draw && p.phase === 'windup';

  const spinK = spinning ? Math.min(1, (p.t - p.atk.windup) / p.atk.active) : 0;
  if (spinning) {
    spinTrail(px, GROUND - 24, spinK, p.facing, true);
    // «шу» на каждый оборот
    const turn = spinK < 0.5 ? 0 : 1;
    if (game.spinTurn !== turn + p.clock - p.t) { game.spinTurn = turn + p.clock - p.t; sfx.whoosh(); }
  }
  const rapier = p.weapon === 'rapier';
  if (game.charge) {
    // копит прыжок: под рыцарем растёт полоска
    const k = Math.min(1, (game.time - game.charge.t) / WEAPONS.rapier.chargeTime);
    rect(g, px - 6, GROUND + 3, Math.round(12 * k), 1, PAL.gold);
  }
  // разворот: взгляд сменился — 0,2 с проигрывается поворот через вид спереди (только картинка, логика уже развернулась)
  if (game.lastFacing !== undefined && game.lastFacing !== facing && !spinning && p.state !== 'attack') game.turnFx = { t: game.time, toLeft: facing < 0 };
  game.lastFacing = facing;
  const TURN = 0.2;
  const turn = game.turnFx && game.time - game.turnFx.t < TURN ? { k: (game.time - game.turnFx.t) / TURN, toLeft: game.turnFx.toLeft } : null;
  // идёт больше вглубь, чем вбок — шаги спереди или со спины (сглажено, чтобы не мигало)
  const mv = game.lastMove ?? { x: p.x, z: p.z, dx: 0, dz: 0 };
  mv.dx = mv.dx * 0.8 + (p.x - mv.x) * 0.2; mv.dz = mv.dz * 0.8 + (p.z - mv.z) * 0.2; mv.x = p.x; mv.z = p.z;
  game.lastMove = mv;
  const depth = p.walking && Math.abs(mv.dz) > Math.abs(mv.dx) * 1.3 && Math.abs(mv.dz) > 0.05 ? (mv.dz > 0 ? 'south' : 'north') : null;
  // убирает в ножны: стоя — кадры «рука за спину», на бегу — оружие просто уплывает за спину; достаёт — обратно
  const SHEATHE_T = 0.5;
  const sk = p.sheathed ? (p.sheatheAt != null ? Math.min(1, (p.clock - p.sheatheAt) / SHEATHE_T) : 1)
    : drawing ? Math.max(0, 1 - p.t / Math.max(0.05, p.atk.windup)) : null;
  const rapierKey = rapier && p.state === 'attack' ? (p.atk.pose === 'thrust' ? 'lunge' : p.atk.pose === 'flick' ? 'whip' : null) : null;
  const rapierAnim = rapierKey && spriteAnim('knight', rapierKey) ? { key: rapierKey, k: Math.min(1, p.t / (p.atk.windup + p.atk.active + p.atk.recover)) } : null;
  const sheathing = p.sheathed && sk < 1 && !p.walking && !p.sheatheRun && p.state === 'ready' && !rapier && spriteAnim('knight', 'sheathe');
  // кинжал (v0.84): у каждого удара своё движение — уколы цепочки под разными углами, удар сверху обратным хватом,
  // «Шквал» — подброс с вращением и ловля обратным хватом (раскадровка FLURRY в src/player.js)
  let weaponAngle, toss = null;
  if (p.weapon === 'dagger' && p.state === 'attack' && p.atk) {
    const lt = p.t - p.atk.windup;
    if (p.atk.key === 'flurry' && lt >= 0) {
      if (lt >= FLURRY_TOSS[0] && lt < FLURRY_TOSS[1]) toss = (lt - FLURRY_TOSS[0]) / (FLURRY_TOSS[1] - FLURRY_TOSS[0]);
      else if (lt >= FLURRY_TOSS[1]) {
        weaponAngle = 180 - p.pose.angle;   // поймал обратным хватом: клинок вдоль предплечья
        if (!p.atk.caught) { p.atk.caught = true; sfx.clink(); sfx.deflected(); }   // звон ловли
      }
    } else if (p.atk.key === 'overhead') weaponAngle = p.phase === 'windup' ? 100 : 62;   // как ледоруб: клинок вниз
    else if (p.atk.chain) weaponAngle = p.pose.angle + [0, -16, 12, -6][p.atk.chainIdx ?? 0];   // тык-тык: каждый укол — свой угол
  }   // кадры «рука за спину» — только для меча
  const tip = sprite ? drawKnight(g, {
    x: px, ground: GROUND, facing, pose: p.pose, state: p.state, walking: p.walking, step: p.step, time: game.time, airY: p.airY,
    turn, run: (p.gaitRun ?? 0) > 0.5, depth,
    sheath: sk != null ? { kind: sheathKind, len: sheathLen, k: sk } : null,
    anim: rapierAnim ?? (sheathing ? { key: 'sheathe', k: sk } : null) ?? (spinFrames ? { key: 'spin', k: (spinK * 2) % 1 }   // два оборота
      : p.state === 'held' && spriteAnim('knight', 'held') ? { key: 'held', k: (p.t * 0.9) % 1 } : null),   // висит, хватается за горло
    weaponLen: p.arms.length ?? 17, rapier, weapon: p.weapon === 'dagger' ? 'dagger' : undefined, weaponAngle, sheathed: p.sheathed && p.state === 'ready', bladeHidden: drawing || !!spinFrames || !!rapierAnim || p.state === 'held' || toss != null,   // у кадров вихря свой меч с росчерком; в удушье руки у горла
    alpha: p.state === 'hurt' && p.t < 0.08 ? 0.55 : 1,
  }) ?? { tipX: px, tipY: GROUND - 20 } : drawFigureOutlined(g, {
    x: px, ground: GROUND, facing, pose: p.pose, colors, step: p.step, plume: true, airY: p.airY, gaitRun: p.walking && p.state === 'ready' ? (p.gaitRun ?? 0) : null,
    breathe: p.state === 'ready' && !p.walking && Math.sin(game.time * 2.4) > 0.3 ? 1 : 0,  // дышит, когда стоит
    weaponLen: p.arms.length ?? 17, scabbard: !rapier, rapier, offhandBack: rapier && p.state !== 'hurt',
    bladeHidden: p.sheathed || drawing,
    trail: active ? p.trail : null,
  });
  if (spinning) spinTrail(px, GROUND - 24, spinK, p.facing, false);   // передняя половина диска — поверх рыцаря
  if (rapierAnim && rapierKey === 'whip' && active) whipArc(px, GROUND, p.facing, (p.t - p.atk.windup) / p.atk.active);
  if (toss != null && tip.handX != null) {
    // подброшенный кинжал: летит над кулаком по дуге и делает два оборота; в верхней точке — блеск
    const h = 17 * 4 * toss * (1 - toss), hx = tip.handX + p.facing * 2, hy = tip.handY - h;
    drawWeaponWorld(g, 'dagger', hx, hy, -90 + toss * 720, p.facing, p.arms.length ?? 10);
    if (toss > 0.45 && !p.atk.glinted) { p.atk.glinted = true; fxImpact('glint', hx + cam, hy - 4, { color: '#ffffff' }); }
    if (!p.atk.tossed) { p.atk.tossed = true; sfx.whip(); }   // свист подброса
  }
  // росчерк клинка (v0.83): от конца замаха через удар — светлая дуга по следу острия
  if (p.state === 'attack' && p.atk && toss == null && !spinning && !rapierAnim && !p.atk.weave && (active || (p.phase === 'windup' && p.t > p.atk.windup - 0.05))) {
    const sx0 = px, sy0 = GROUND - 24;
    fxSwing(p, tip.tipX + cam, tip.tipY, sx0 + cam, sy0, '#fff1c8');
  }
  if (active && !spinning && !rapierAnim) {   // у вихря свой шлейф-диск, у рапиры — кадры с клинком
    p.trail.push({ tipX: tip.tipX, tipY: tip.tipY });
    if (p.trail.length > (spinning || weaving ? 6 : 3)) p.trail.shift();
  } else p.trail = [];

  if (game.wardFlash > 0) renderAceWard(px + (game.wardSide ?? p.facing) * 15, GROUND - 22, 0.8 - game.wardFlash);
  // выбранная высота рядом с рыцарем; голубая — когда держишь защиту
  const foes = game.tutorial || held('guard') || game.enemies.some(e => e.state !== 'dead' && e.state !== 'gone');   // в мирных местах значок не нужен и закрывает лица горожан
  if (!game.cutscene && !tr && foes) heightIcon(game.aim, px - p.facing * 13, GROUND - 26, held('guard') ? '#8fd3ff' : '#9f97b0');
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
  const gy = groundY(n.z) + 1 - (n.lift ?? 0);   // lift — сидит на столе (кот)
  if (n.def.ghost) {
    // душа с сожалением (v0.79): полупрозрачная, чуть парит и мерцает
    g.save();
    g.globalAlpha = 0.68 + 0.12 * Math.sin(game.time * 2.3 + n.x);
    const ok = drawObjNamed(g, n.def.img, x, gy - Math.round(0.6 + 0.6 * Math.sin(game.time * 1.6)), n.facing > 0);   // чуть парит, ниже Найта (владелец)
    g.restore();
    if (ok) return;
  }
  if (n.def.hidden) return;   // рисуется вместе с другим (общая картинка)
  if (n.def.img && !n.def.ghost) {
    // горожане главы 2 (v0.98): картинка PixelLab смотрит влево; imgAlt — другой облик после флага (стрижка)
    const img = n.def.imgAlt && game.flags[n.def.imgAlt[0]] ? n.def.imgAlt[1] : n.def.img;
    if (n.def.cut) { g.save(); g.beginPath(); g.rect(x - 40, 0, 80, gy - n.def.cut); g.clip(); }   // за стойкой: видно до пояса
    const flipX = n.def.faceRight ? n.facing < 0 : n.facing > 0;
    drawObjNamed(g, img, x + (n.def.imgDx ?? 0), gy, flipX);   // faceRight — картинка смотрит вправо; imgDx — сдвиг картинки
    const nu = n.def.imgNight ? Math.max(0, Math.min(1, (nightK() - 0.45) / 0.25)) : 0;   // ночью (вайб на поляне) — смотрят на звёзды
    if (nu > 0) { g.globalAlpha = nu; drawObjNamed(g, n.def.imgNight, x + (n.def.imgDx ?? 0), gy, flipX); g.globalAlpha = 1; }
    if (n.def.cut) g.restore();
    return;   // картинки ещё нет (камео рисуется) — пусто, без фигуры-заглушки
  }
  if (n.def.sitImgs) {
    // сидит (Лика на бочке): в покое кадры медленно меняются, рыцарь подошёл — машет рукой
    const near = Math.abs(game.player.x - n.x) < 50;
    const img = n.def.cat ? (game.pet?.n === n && game.pet.head ? 'cat_sit' : n.img) : n.img;   // гладят — поднимает голову к руке
    if (n.def.cat && img && img !== 'cat_sit' && drawObjNamed(g, img, x, gy, n.flip ? n.facing < 0 : n.facing > 0)) { catGlow(img, x, gy, n.flip ? n.facing < 0 : n.facing > 0); return; }   // другая поза (flip — картинка смотрит вправо)
    const name = n.def.cat ? ((game.time + n.x) % 4.3 < 0.16 ? 'cat_sit_1' : 'cat_sit')   // кот моргает
      : near ? n.def.sitImgs.wave : n.def.sitImgs.idle[Math.floor(game.time / 3.2) % n.def.sitImgs.idle.length];
    if (drawObjNamed(g, name, x, gy, n.def.cat ? n.facing > 0 : n.facing < 0)) { if (n.def.cat) catGlow(name, x, gy, n.facing > 0); return; }   // кот на картинке смотрит влево
  }
  if (n.def.cat) {   // без картинки — силуэт кота кодом: тело, голова, уши, хвост, жёлтые глаза
    const f = n.facing < 0 ? -1 : 1, X = v => Math.round(x + v * f);
    rect(g, Math.min(X(-5), X(5)), gy - 8, 10, 8, '#121018'); rect(g, Math.min(X(2), X(8)), gy - 13, 6, 6, '#121018');
    rect(g, X(3), gy - 15, 1, 2, '#121018'); rect(g, X(6), gy - 15, 1, 2, '#121018');
    rect(g, Math.min(X(-9), X(-5)), gy - 2, 5, 2, '#121018');
    if (Math.floor(game.time * 0.7 + n.x) % 9) { rect(g, X(5), gy - 11, 1, 1, '#ffd23a'); rect(g, X(7), gy - 11, 1, 1, '#ffd23a'); }
    return;
  }
  if (n.def.sprite && spriteReady(n.def.sprite)) {
    // NPC в пиксель-арте (v0.64): сидит у костра — на колене, иначе стоит без оружия
    drawSprite(n.def.sprite, g, { x, ground: groundY(n.z), facing: n.facing, pose: POSES.idle, weapon: 'none', frame: n.def.sit ? 'pose_kneel' : 'pose_idle' });
    return;
  }
  drawFigureOutlined(g, {
    x, ground: groundY(n.z), facing: n.facing, pose: n.def.sit ? { ...POSES.sheathed, hy: 7 + breathe, lean: 0, crouch: 0 } : { ...POSES.idle, hy: 8, angle: 80, crouch: breathe },
    colors: n.def.colors, robe: n.def.robe, hood: n.def.hood, pack: n.def.pack, bladeHidden: true,
    short: n.def.short, bob: n.def.bob, coat: n.def.coat, face: !!n.def.human, sit: !!n.def.sit, seat: 0,
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
// дверь, нарисованная на картине (v1.0): створка вырезается из самой картины (leaf: [x, y, w, h]) и поворачивается на петлях,
// за ней — тёплый свет комнаты
function drawPaintedDoor(g, bg, d, cam, k) {
  if (k <= 0.02 || !bg) return;
  const [x, y, w, h] = d.leaf, K = bg.k ?? 1, X = Math.round(x - cam);
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = d.inside ?? '#1c130b';
  g.fillRect(X, y, w, h);
  const gl = g.createLinearGradient(0, y + h, 0, y);
  gl.addColorStop(0, `rgba(255,196,120,${0.45 * k})`); gl.addColorStop(1, 'rgba(255,196,120,0.05)');
  g.fillStyle = gl; g.fillRect(X, y, w, h);
  const e = k * k * (3 - 2 * k), th = e * 1.32, ww = Math.max(1, Math.round(w * Math.cos(th)));
  const lx = d.hinge === 'right' ? X + w - ww : X;
  g.drawImage(bg, x * K, y * K, w * K, h * K, lx, y, ww, h);
  g.globalAlpha = 0.55 * Math.sin(th); g.fillStyle = '#000'; g.fillRect(lx, y, ww, h);
  g.globalAlpha = 1;
  if (th > 0.2) { g.fillStyle = '#2a1a10'; g.fillRect(d.hinge === 'right' ? lx - 1 : lx + ww, y, 1, h); }   // торец створки
  g.restore();
}
// коврик у входа (v1.0, владелец: «понятнее, где дверь»): на мостовой перед нарисованной дверью
function drawDoormat(g, d, cam) {
  const m = d.mat, w = m.w ?? 24, x = Math.round(d.x - cam - w / 2), y = groundY(m.z ?? 1) - 3;
  const c = m.color ?? '#8a3b2e', dk = m.dark ?? '#4a1f1a', lt = m.light ?? '#c9774a';
  rect(g, x + 1, y, w - 2, 1, dk);                       // дальний край уже — пол виден чуть сверху
  rect(g, x, y + 1, w, 4, dk);
  rect(g, x + 1, y + 1, w - 2, 3, c);
  rect(g, x + 3, y + 2, w - 6, 1, lt);                   // узор
  for (let i = 0; i < w; i += 2) rect(g, x + i, y + 5, 1, 1, lt);   // бахрома
}
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
// вихрь (v0.69): два оборота — два «диска»-шлейфа за клинком. Клинок идёт по эллипсу (вид сбоку, круг в глубину),
// за ним — полумесяц света: яркий у острия, гаснет к хвосту, ступенями (пиксель-арт). back — задняя половина (за рыцарем).
function spinTrail(x, cy, k, facing, back) {
  const turns = 2, R = 23, RY = 7;
  const head = k * turns * Math.PI * 2;                 // где сейчас клинок
  const tail = Math.max(0, head - Math.PI * 1.15);      // длина шлейфа — чуть больше полукруга
  g.save();
  g.globalCompositeOperation = 'lighter';
  const N = 26;
  for (let i = 0; i < N; i++) {
    const a = tail + (head - tail) * (i / (N - 1));
    const behind = Math.sin(a) < 0;                       // дальняя сторона круга — за рыцарем
    if (behind !== back) continue;
    const f = i / (N - 1);                                // 0 — хвост, 1 — у клинка
    const step = f > 0.85 ? 1 : f > 0.6 ? 0.7 : f > 0.35 ? 0.45 : 0.22;
    const px = x + facing * Math.cos(a) * R, py = cy + Math.sin(a) * RY;
    const w = f > 0.6 ? 3 : 2;
    g.globalAlpha = step * (back ? 0.55 : 0.9);
    g.fillStyle = f > 0.85 ? '#ffffff' : f > 0.5 ? '#d8ecff' : '#8fb8e8';
    g.fillRect(Math.round(px * 2) / 2 - w / 4, Math.round(py * 2) / 2 - 0.5, w / 2, f > 0.6 ? 1.5 : 1);
  }
  g.restore();
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
// --- живой свет: источники в комнате и пыль в воздухе (выбор владельца: ступени, пыль, тёплое настроение) ---
const WARM = [1, 0.68, 0.38];
const AMBIENT = [0.74, 0.67, 0.7];
function sceneLights() {
  const r = room(), cam = Math.round(game.camX), t = game.time;
  const L = [];
  const add = (x, y, rad, color, power, z = 30) => { const sx = (x - cam) * S; if (sx > -rad * S && sx < (W + rad) * S) L.push({ x: sx, y: y * S, z, r: rad * S, color, power }); };
  const blueFire = bossFire();
  const flare = fireFlare();
  for (const x of r.torches ?? []) if (!torchUnderStairs(r, x)) add(x, 69, 150 * (1 + flare * 0.35), blueFire ? [0.45, 0.7, 1] : WARM, ((blueFire ? 1.05 : 0.85) + 0.1 * Math.sin(t * 9 + x) + 0.05 * Math.sin(t * 23 + x * 0.3)) * (1 + flare * 0.9));
  for (const n of game.npcs ?? []) if (n.def?.ghost) add(n.x, groundY(n.z) - 14, 90, [0.55, 0.8, 1], 0.7 + 0.1 * Math.sin(t * 2.3 + n.x), 16);   // душа светится
  for (const n of game.npcs ?? []) if (n.def?.cat && r.dark) add(n.x, groundY(n.z) - 8 - (n.lift ?? 0), 38, [0.72, 0.72, 0.95], 0.4, 12);   // Фуджин виден в темноте (v0.85)
  for (const pr of r.props ?? []) {
    if (pr.light || pr.type === 'campfire' || (pr.lights && game.flags[pr.lights])) add(pr.x, groundY(pr.z) - 8 - (pr.lift ?? 0), r.dark ? 180 : 130 + 60 * nightK(), WARM, (r.dark ? 1.5 : 1 + 0.6 * nightK()) + (0.12 + 0.1 * nightK()) * Math.sin(t * 9 + pr.x) + 0.06 * nightK() * Math.sin(t * 23 + 1), 20);
    // костёр в тёмной комнате (v0.89): тёплое пятно и на стене за ним — иначе светится только пол у огня
    if ((pr.type === 'campfire' || pr.type === 'campfire_pot') && r.dark) add(pr.x, CONFIG.floorTop - 14, 150, WARM, 0.75 + 0.1 * Math.sin(t * 7 + pr.x * 0.7), 40);
    else if (pr.type === 'candles' && !pr.lights) add(pr.x, groundY(pr.z) - 8, 60, WARM, 0.6, 14);
  }
  for (const d of r.decor ?? []) if (d.type === 'fireplace') add(d.x, CONFIG.floorTop - 14, 150, WARM, 1 + 0.12 * Math.sin(t * 8 + d.x), 26);
  if (r.portal) {
    const c = game.cutscene, k = c && c.t < WAKE.flash ? 0.3 + 0.7 * (c.t / WAKE.flash) : 1;   // портал разгорается, когда рыцарь очнулся
    add(r.portal.x, groundY(r.portal.z) - 8, r.dark ? 140 : 120, [0.55, 0.85, 1], (r.dark ? 1.3 : 0.9) * k, 20);
    const E = game.ending?.phase === 'portal' ? game.ending : null;
    if (E?.amber) add(r.portal.x, groundY(r.portal.z) - 4, 60 + 120 * E.glow, WARM, 0.6 + 1.2 * E.glow, 16);   // янтарь разгорается
  }
  if (r.dark) {
    if (r.gate) add(r.gate === 'right' ? r.length + 10 : -10, 100, 110, WARM, 0.9);   // свет факелов из-за решётки
    const p = game.player;
    add(p.x, groundY(p.z) - 16, 48, [0.75, 0.75, 0.9], 0.35, 40);                      // чуть видно самого рыцаря
  }
  // призраки светятся холодным; босс — сильнее, при удушении — ярче
  for (const e of game.enemies) if ((e.kind === 'ghost' || e.kind === 'boss') && (e.alive || e.state === 'defeated') && e.state !== 'dormant') {
    const k = (e.ghost ?? 1) * (e.endFade ?? 1) * (e.kind === 'boss' ? 0.7 + 0.5 * e.eyes : 0.45);
    add(e.x, groundY(e.z) - 20 - e.airY, e.kind === 'boss' ? 90 : 60, [0.6, 0.85, 1], k * (0.9 + 0.1 * Math.sin(t * 5 + e.x)), 18);
  }
  // удушение: голубой свет вокруг шеи рыцаря
  const choker = game.enemies.find(e => e.kind === 'boss' && (e.state === 'choking' || (e.state === 'cast' && e.t > 0.3)));
  if (choker) { const p = game.player; add(p.x, groundY(p.z) - (p.airY ?? 0) - 24, 70, [0.45, 0.8, 1], choker.state === 'choking' ? 1.3 : 0.6, 16); }
  // бубновый туз: вспышка и алое сияние щита
  if (game.wardFlash > 0) {
    const p = game.player, a = 0.8 - game.wardFlash;
    const pw = a < 0.15 ? 2.4 * (1 - a / 0.15) + 1 : a < 0.6 ? 1 : Math.max(0, 1 - (a - 0.6) / 0.2);
    add(p.x + (game.wardSide ?? p.facing) * 15, groundY(p.z) - 22, 90, [1, 0.42, 0.45], pw, 22);
  }
  // «вайбовать»: место оживает и светится (лунный луч, свет из пролома, костёр ярче)
  const vf = game.vibeFx;
  if (vf?.spot.fx) {
    const sp = vf.spot, x = sp.fxX ?? sp.x, k = vf.k;
    const src = vibeSource(sp, 0);
    if (sp.fx === 'moon' && src.win) { const m = moonSpot(src.win, CONFIG.floorTop); add(m.x, m.y, 80, [0.6, 0.75, 1], 0.7 * k, 16); }   // пятно луны на полу
    if (sp.fx === 'rain') add(src.hole ? (src.hole.x0 + src.hole.x1) / 2 : x, groundY(sp.fxZ ?? 22) - 10, 90, [0.7, 0.82, 1], 0.55 * k, 30);
    if (sp.fx === 'embers') add(x, groundY(sp.fxZ ?? 20) - 24, 140, WARM, 0.5 * k * (0.9 + 0.1 * Math.sin(t * 7)), 30);
  }
  // ближние к центру экрана — вперёд
  return L.sort((a, b) => Math.abs(a.x - W) - Math.abs(b.x - W));
}
// тёмные комнаты (камера, привал) — тоже живым светом (v0.67): почти ночь, светят портал, костёр и выход
const DARK_AMBIENT = [0.16, 0.14, 0.2];
const DAY_AMBIENT = [1.02, 1, 0.96];
const NIGHT_AMBIENT = [0.5, 0.56, 0.78];   // ночь нарисована на самой картине — свет только чуть приглушает людей и даёт место костру
const nightK = () => { const v = game.vibeFx; if (v?.spot.fx !== 'night') return 0; const k = Math.max(0, Math.min(1, v.k)); return k * k * (3 - 2 * k); };
// свет поляны по времени: день → закат (тёплый) → ночь; обратно — через розовый рассвет
const SUNSET_AMBIENT = [1.02, 0.9, 0.8], DAWN_AMBIENT = [0.96, 0.88, 0.92];
function nightAmbient(base, k, dawn) {
  const mid = dawn ? DAWN_AMBIENT : SUNSET_AMBIENT, m = dawn ? 0.42 : 0.36;
  const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  return k < m ? lerp(base, mid, k / m) : lerp(mid, NIGHT_AMBIENT, (k - m) / (1 - m));
}
function applyLight() {
  if (!light) return;
  const r = game.mode === 'title' || game.mode === 'map' ? null : room();
  if (!r) { light.off(); return; }
  // тёмная комната с ambient (v0.80, библиотека): полутьма видна и без свечей, каждая зажжённая свеча (lights) светлеет
  let amb = r.day ? DAY_AMBIENT : r.dark ? (r.ambient ?? DARK_AMBIENT) : AMBIENT;   // глава 2 — день
  const nk = nightK(); if (nk > 0) amb = nightAmbient(amb, nk, !!game.vibeFx?.dawn);   // «вайбовать» на поляне — закат, ночь, рассвет
  if (r.ambient) { const lit = (r.props ?? []).filter(pr => pr.lights && game.flags[pr.lights]).length; amb = amb.map(v => Math.min(0.62, v + lit * 0.045)); }
  light.draw(sceneLights(), amb, true);
}
// пыль в воздухе: пылинки видны у огня (сами светлее там, где свет сильнее)
const dustMotes = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: 20 + Math.random() * 100, v: 1 + Math.random() * 3, p: Math.random() * 6.28 }));
function renderDust(cam) {
  const ls = sceneLights();
  for (const d of dustMotes) {
    d.y -= d.v * (1 / 60) * 0.5; d.x += Math.sin(game.time * 0.6 + d.p) * 0.03;
    if (d.y < 10) { d.y = 118; d.x = Math.random() * W; }
    let b = 0;
    for (const l of ls) { const k = 1 - Math.hypot(l.x / S - d.x, l.y / S - d.y) / (l.r / S * 0.5); if (k > 0) b += k * k * l.power; }
    if (b < 0.05) continue;
    g.globalAlpha = Math.min(0.8, b * 0.8);
    g.fillStyle = '#ffd696';
    g.fillRect(Math.round(d.x * S) / S, Math.round(d.y * S) / S, 1 / S, 1 / S);
  }
  g.globalAlpha = 1;
}

// Ошибка в одном кадре не должна вешать игру: цикл продолжается, ошибка — в консоль (раз в секунду)
let lastErrAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000) * (window.knightNightDebug?.timeScale ?? 1);   // timeScale — замедление для раскадровок ботов
  last = now;
  // логика и рисование — порознь: ошибка в одном не замораживает другое (картинка идёт, Esc и меню работают)
  try {
    while (acc >= STEP) {
      acc -= STEP;
      step(STEP);
    }
  } catch (err) {
    acc = 0;
    frameError(now, err);
  }
  try {
    light?.clearNormals();
    render();
  } catch (err) {
    resetCtx(g);   // упавший посреди кадра рисунок не оставляет холст прозрачным, «светящимся» или сдвинутым
    if (light) resetCtx(light.normalCtx);
    frameError(now, err);
  }
  try {
    applyLight();
  } catch (err) {
    light?.off();
    frameError(now, err);
  }
  try { renderOverlayFx(); } catch (err) { game.vibeFx = null; frameError(now, err); }
}
function resetCtx(c) {
  for (let i = 0; i < 64; i++) c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  c.imageSmoothingEnabled = false;
}
function frameError(now, err) {
  if (now - lastErrAt > 1000) { lastErrAt = now; console.error(err); }
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
  game.mouseX = (e.clientX - r.left) / r.width * W;
});
ui.box.addEventListener('contextmenu', e => e.preventDefault());
let wheelAt = 0;
ui.box.addEventListener('wheel', e => {
  if (game.mode !== 'play') return;   // в лавке, сумке, журнале колесо листает списки (v0.91)
  e.preventDefault();
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
window.knightNightDebug = { groundY, input, ROOMS, bgFor, musicInfo, startTalk, readPage, openShop: (shop, name) => openShop({ def: { shop, name } }) };   // для ботов-тестеров
