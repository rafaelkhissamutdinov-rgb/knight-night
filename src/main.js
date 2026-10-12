import { CONFIG, LEVEL, VERSION, STRIKES, WEAPON } from './config.js';
import { PAL, KNIGHT_COLORS } from './palette.js';
import { createInput } from './input.js';
import { createEnemy } from './enemy.js';
import { Player } from './player.js';
import { resolveImpact } from './combat.js';
import { drawFigure, drawSlime, drawArrow, flashColors, rect } from './draw.js';
import { POSES } from './poses.js';
import { buildBackground, drawTorches } from './background.js';
import { unlockAudio, sfx } from './audio.js';
import { DialogueRunner } from './dialogue.js';
import { DIALOGUES, SPEAKERS } from './story/dialogues.js';
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
const ATTACKING = new Set(['windup', 'strike', 'leapIn', 'vault', 'crouch', 'leap', 'retreat', 'inflate', 'suck']);
const HEIGHT_NAME = { high: 'верх', mid: 'середина', low: 'низ' };
const RESULT_NAME = { perfect: 'идеально', block: 'блок', broken: 'защита сбита', hit: 'попадание', dodged: 'уклон', warded: 'заслон', miss: 'мимо' };
const SPECIAL = new Set(['rollCut', 'dashCut', 'leap', 'spin']);
// Управление (решение владельца после бета-теста): курсор выбирает высоту, ЛКМ — удар, держать ПКМ — защита, пробел — рывок.
const HINT_WALK = 'WASD — ходить · курсор выше / ниже рыцаря — высота · ЛКМ удар · ПКМ защита · пробел рывок';
const HINT_FIGHT = 'курсор — высота ▲ ━ ▼ · ЛКМ удар · держать ПКМ — защита · пробел рывок';
const hintFight = () => HINT_FIGHT;
const hintWalk = () => HINT_WALK;

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
  talk: $('talk'), talkPortrait: $('talk-portrait'), talkName: $('talk-name'), talkText: $('talk-text'),
  talkChoices: $('talk-choices'), talkNext: $('talk-next'),
  reportBtn: $('report-btn'), reportText: $('report-text'),
  skillSpin: $('skill-spin'), skillSpinBar: $('skill-spin-bar'),
};
ui.reportBtn.addEventListener('pointerdown', e => e.stopPropagation());
ui.reportBtn.addEventListener('click', copyReport);
ui.reportText.addEventListener('pointerdown', e => e.stopPropagation());
ui.version.textContent = VERSION;

const input = createInput(window);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const background = buildBackground(LEVEL.length, H, CONFIG.floorTop);
const held = group => KEYS[group].some(input.isDown);
const is = (code, group) => KEYS[group].includes(code);

const game = {};

function spawnGroup(i) {
  const enc = LEVEL.encounters[i];
  return enc.enemies.map(d => Object.assign(createEnemy(d.type, enc.x + d.dx, Math.random, d.z), { group: i }));
}
function spawnAll() {
  const dummy = LEVEL.dummy ? [createEnemy('dummy', LEVEL.dummy.x, Math.random, LEVEL.dummy.z)] : [];
  return dummy.concat(LEVEL.encounters.flatMap((_, i) => spawnGroup(i)));
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
    enemies: spawnAll(),
    arena: null,
    cleared: new Set(),
    token: null,
    tokenFreeAt: 0,
    current: null,
    checkpoint: 40,
    player: new Player(40),
    lastPress: null,
    prevPress: null,
    lastTiming: '',
    aim: 'mid',
    mouseY: null,
    flags: {},
    talk: null,
    stats: { perfect: 0, block: 0, hit: 0, counter: 0, dodged: 0, broken: 0 },
    deaths: {},
    killers: {},
    lastHitBy: '',
    startedAt: performance.now(),
    debug: game.debug || false,
  });
  renderHearts();
  ui.foe.hidden = true;
}

// ---------- мир для врагов ----------

const world = {
  get player() { return game.player; },
  engage() {},
  // бьёт один враг, остальные ждут своей очереди
  requestToken(e) {
    if (e.def.practice) return !game.arena;  // чучело не занимает очередь и молчит во время боя
    const t = game.token;
    if (t && t.e === e) return true;
    if (t && t.e.alive) return false;
    if (game.time < game.tokenFreeAt) return false;
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
    return applyImpact(s.guard, e.def.damage * (s.mult ?? 1), e.x, s.breaks, s.bypass, backTurned, e.def.name);
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
    game.arrows.push({ who: e.def.name, x, y: clashY(height, e.z), z: e.z, vz: 0, vx: e.facing * e.def.arrowSpeed, vy: 0, height, damage: e.def.damage, resolved: false, falling: false, life: 3 });
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
  } else if (result === 'block') {
    game.stats.block++;
    sparks(x, y, 6, [PAL.sparkHot, PAL.flame2], 70);
    sfx.block();
    shake(1);
    callout('Блок', 'block');
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
    const dmg = damage * mult;
    p.hurt(dmg, sourceX);
    renderHearts();
    sparks(p.x + 2, y, 10, [PAL.blood, '#9e2648'], 80);
    sfx.hit();
    game.hitstop = CONFIG.hitstop.hit;
    shake(mult > 1 ? 4 : 3);
    flash('#e8454f', 0.3);
    callout(backTurned ? `В спину! −${dmg}` : mult > 1 ? `Пропущен ×${mult}  −${dmg}` : `Пропущен  −${dmg}`, 'hit');
  }
  return result;
}

// Клинок рыцаря дошёл до цели.
function playerStrike(atk) {
  const p = game.player;
  let touched = false;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = (e.x - p.x) * p.facing;
    const inReach = atk.height === 'any' ? Math.abs(dx) <= atk.reach : dx >= -6 && dx <= atk.reach;
    if (!inReach || !near(p, e)) continue;
    touched = true;
    const { out, dmg } = e.receiveAttack(atk);
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
    } else if (ev.type === 'strike') {
      if (ev.atk.height === 'low') dust(p.x + p.facing * 22, groundY(p.z), p.facing);
      playerStrike(ev.atk);
    } else if (ev.type === 'dash' || ev.type === 'roll' || ev.type === 'backdash') {
      sfx.dash();
    } else if (ev.type === 'spinNotReady') {
      callout('Вихрь не готов', 'muted');
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
  const a = game.arena ? game.arena.index : -1;
  game.deaths[a] = (game.deaths[a] ?? 0) + 1;
  if (game.lastHitBy) game.killers[game.lastHitBy] = (game.killers[game.lastHitBy] ?? 0) + 1;
  showOverlay('Ты пал', `Тебя одолел: ${game.lastHitBy || 'неизвестно кто'}.`, 'R — снова в бой');
  ui.reportBtn.hidden = false;
}

function restartFight() {
  const a = game.arena;
  if (a) {
    game.enemies = game.enemies.filter(e => e.group !== a.index).concat(spawnGroup(a.index));
    game.arena = null;
  }
  game.current = null;
  game.token = null;
  game.arrows = [];
  game.player = new Player(game.checkpoint);
  game.player.sheathed = false;
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
  const names = i => i < 0 ? 'коридор' : LEVEL.encounters[i].enemies.map(e => ENEMY_TYPES[e.type].shortName ?? ENEMY_TYPES[e.type].name).join(' + ');
  const deaths = Object.entries(game.deaths).map(([i, n]) => `  ${Number(i) + 1}. ${names(Number(i))} — ${n}`).join('\n') || '  ни одной';
  const killers = Object.entries(game.killers).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ') || '—';
  const total = s.perfect + s.block + s.broken + s.hit + s.dodged;
  const pct = total ? Math.round(s.perfect / total * 100) : 0;
  return [
    `Knight Night ${VERSION} — отчёт тестера`,
    `Время: ${mins}:${String(secs).padStart(2, '0')} · пройдено встреч: ${game.cleared.size} из ${LEVEL.encounters.length}`,
    `Смерти по встречам:`,
    deaths,
    `Кто убивал: ${killers}`,
    `Удары врагов: идеально ${s.perfect} (${pct}%), блок ${s.block}, сбита защита ${s.broken}, уклон ${s.dodged}, пропущено ${s.hit}`,
    `Контратак: ${s.counter}`,
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

function finish() {
  game.mode = 'end';
  ui.reportBtn.hidden = false;
  const s = game.stats;
  showOverlay('Конец прототипа',
    `Идеальных парирований: ${s.perfect} · блоков: ${s.block} · уклонов: ${s.dodged} · пропущено: ${s.hit} · контратак: ${s.counter}`,
    'R — пройти заново');
}

// ---------- ввод ----------

function recordGuard(height) {
  game.prevPress = game.lastPress;
  game.lastPress = { height, time: game.time };
}


function handlePress(code) {
  if (code === 'Escape' || code === 'KeyP') {
    if (game.mode === 'play') {
      game.mode = 'paused';
      showOverlay('Пауза', 'R — начать встречу заново · Esc — продолжить', 'Esc — продолжить');
      ui.reportBtn.hidden = false;
    } else if (game.mode === 'paused') {
      game.mode = 'play';
      hideOverlay();
    }
    return;
  }
  if (game.mode === 'paused') {
    if (code === 'KeyR') restartFight();
    return;
  }
  if (code === 'KeyG') {
    game.debug = !game.debug;
    ui.debug.hidden = !game.debug;
    return;
  }
  if (game.mode === 'title') {
    unlockAudio();
    game.mode = 'play';
    hideOverlay();
    hint(hintWalk());
    startTalk('intro');
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
    if (code === 'KeyR' || code === 'Enter') {
      newGame();
      game.mode = 'play';
      hideOverlay();
      hint(hintWalk());
    }
    return;
  }

  const p = game.player;
  const engaged = !!game.current?.alive;
  const backKeys = p.facing > 0 ? KEYS.left : KEYS.right;

  // высота — по курсору: ЛКМ бьёт, ПКМ защищает, пробел — рывок на этой высоте
  const vert = game.aim === 'high' ? 'up' : game.aim === 'low' ? 'down' : null;
  if (code === 'Wheel') {
    // прокрутка колеса — вихрь; пока перезаряжается, колесо ничего не делает
    if (p.spinCharge < 1) callout('Вихрь не готов', 'muted');
    else p.requestAttack(null, true);
  }
  if (is(code, 'guard')) { recordGuard(game.aim); p.cancel(); }
  if (is(code, 'attack')) p.requestAttack(vert, false);
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
  const aim = dy < -9 ? 'high' : dy > 8 ? 'low' : 'mid';
  if (aim !== game.aim) {
    game.aim = aim;
    if (input.isDown('Mouse2')) { recordGuard(aim); p.cancel(); }
  }
}

// Встреча начинается, когда рыцарь подходит; коридор закрыт, пока группа жива.
function updateArena() {
  const p = game.player;
  if (!game.arena) {
    const i = LEVEL.encounters.findIndex((enc, i) => !game.cleared.has(i) && p.x > enc.x - 140 && p.x < enc.x + 150);
    if (i < 0) return;
    game.arena = { index: i, x: LEVEL.encounters[i].x };
    game.checkpoint = Math.max(40, LEVEL.encounters[i].x - 140);
    for (const e of game.enemies) if (e.group === i) e.awake = true;
    ui.foe.hidden = false;
    hint(hintFight());
    const before = LEVEL.encounters[i].before;
    if (before && !game.flags['seen_' + before]) startTalk(before);
    return;
  }
  const alive = game.enemies.some(e => e.group === game.arena.index && (e.alive || e.state === 'yield'));
  if (!alive) {
    game.cleared.add(game.arena.index);
    // отдых после победы над группой
    const p = game.player;
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
    game.token = null;
    game.tokenFreeAt = game.time + CONFIG.tokenPause;
  }
}

// Цель рыцаря: тот, кто сейчас бьёт, иначе ближайший.
function pickTarget() {
  const p = game.player;
  if (!game.arena) return;
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

function update(dt) {
  for (const code of input.take()) handlePress(code);
  if (game.mode !== 'play') return;

  game.time += dt;
  const p = game.player;
  updateAim();
  updateArena();
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

  p.update(dt, controls());
  handlePlayerEvents();

  for (const e of game.enemies) {
    if ((e.state === 'dead' && e.t > 2) || e.state === 'gone') continue;
    e.update(dt, world);
  }
  updateArrows(dt);

  // тела не проходят друг сквозь друга (если стоят на одной линии по глубине)
  const solids = game.enemies.filter(e => e.solid && !e.def.practice);  // сквозь чучело можно пройти
  for (const e of solids) {
    if (p.state === 'swallowed' || Math.abs(e.z - p.z) >= 8) continue;
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
  const lo = game.arena ? game.arena.x - 150 : 16, hi = game.arena ? game.arena.x + 150 : LEVEL.length - 16;
  p.x = Math.max(lo, Math.min(hi, p.x));
  if (game.arena) for (const e of game.enemies) {
    if (e.group === game.arena.index && e.state !== 'flee' && e.state !== 'yield') e.x = Math.max(lo - 10, Math.min(hi + 10, e.x));
  }

  if (p.hp <= 0 && p.state !== 'swallowed') die();
  else if (!game.enemies.some(e => e.alive && !e.def.practice) && p.x > LEVEL.length - 60) finish();

  const target = game.arena ? game.arena.x - W / 2 : p.x - (p.facing > 0 ? 120 : 200);
  const clamped = Math.max(0, Math.min(LEVEL.length - W, target));
  game.camX += (clamped - game.camX) * Math.min(1, dt * 5);
}

function updateArrows(dt) {
  const p = game.player;
  for (const a of game.arrows) {
    a.life -= dt;
    if (a.stuck) continue;
    a.x += a.vx * dt;
    a.z += (a.vz ?? 0) * dt;
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
    const close = Math.abs(a.x - p.x) <= (a.arc ? 6 : 4) && Math.abs(a.z - p.z) <= CONFIG.depthReach - 3 && (!a.arc || a.y >= clashY('high', p.z) - 6);
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
const PORTRAITS = {
  knight: { colors: KNIGHT_COLORS, plume: true },
  ilia: { colors: ENEMY_TYPES.duelist.colors, face: true, rapier: true, robe: true },
};

function startTalk(id) {
  if (!CONFIG.dialogues || !DIALOGUES[id]) return;
  game.flags['seen_' + id] = true;
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
    return;
  }
  const who = SPEAKERS[line.who] ?? SPEAKERS.narrator;
  ui.talk.hidden = false;
  ui.talkName.textContent = who.name;
  ui.talkPortrait.hidden = !who.portrait;
  if (who.portrait) {
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
  ui.hint.textContent = text;
  ui.hint.hidden = false;
}

function showOverlay(title, text, press) {
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

  const cam = Math.round(game.camX);
  g.drawImage(background, cam, 0, W, H, 0, 0, W, H);
  drawTorches(g, cam, game.time, W);

  // сначала тени, потом бойцы от дальних к ближним
  const actors = [...game.enemies.filter(e => e.state !== 'gone'), game.player];
  for (const a of actors) {
    if (a === game.player && a.state === 'swallowed') continue;
    g.globalAlpha = a.state === 'dead' ? 0.3 : 0.55;
    const gy = groundY(a.z);
    rect(g, a.x - cam - 7, gy - 1, 14, 2, '#0d0b14');
    rect(g, a.x - cam - 5, gy - 2, 10, 1, '#0d0b14');
    g.globalAlpha = 1;
  }
  actors.sort((a, b) => a.z - b.z);
  for (const a of actors) a === game.player ? renderPlayer(cam) : renderEnemy(a, cam);
  if (game.current?.alive) {
    // отметка цели
    const c = game.current;
    rect(g, c.x - cam - 1, groundY(c.z) + 2, 3, 1, PAL.gold);
  }
  for (const a of game.arrows) drawArrow(g, a.x - cam, a.y, a.vx, a.vy, a.stuck);
  for (const w of game.waves) renderWave(w, cam);
  for (const s of game.particles) rect(g, s.x - cam, s.y, 1, 1, s.color);

  g.setTransform(1, 0, 0, 1, 0, 0);
  if (game.flash > 0) {
    g.globalAlpha = game.flash;
    g.fillStyle = game.flashColor;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (game.debug) renderDebug(cam);
  // перезарядка вихря в HUD
  const charge = game.player.spinCharge;
  ui.skillSpinBar.style.width = `${Math.round(charge * 100)}%`;
  ui.skillSpin.classList.toggle('ready', charge >= 1);
}

function renderEnemy(e, cam) {
  if (e.state === 'gone') return;
  const ex = e.x - cam;
  if (ex < -50 || ex > W + 50) return;
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
    drawSlime(g, { x: ex, ground: GROUND, airY: e.airY, size: e.size, squash: e.squash, colors, facing: e.facing, holding: e.holding });
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) rect(g, ex - 1, GROUND - e.airY - 16, 3, 3, PAL.spark);
  } else {
    const colors = e.flashT > 0 ? flashColors(e.def.colors) : e.def.colors;
    const whirl = e.state === 'strike' && e.strike?.pose === 'whirl';
    if (whirl) disc(ex, GROUND - 27 - e.airY, 20);
    const tip = drawFigure(g, {
      x: ex, ground: GROUND, facing: e.facing, pose: e.pose, colors, step: e.step, airY: e.airY,
      weaponLen: e.def.weapon ?? 17, skull: e.def.skull, shield: e.def.shield && e.alive,
      bow: e.kind === 'archer', bowDraw: e.bowDraw ?? 0,
      face: e.kind === 'duelist', rapier: e.kind === 'duelist', robe: e.def.robe,
    });
    if (CONFIG.windupHints && e.state === 'windup' && e.alive) windupHint(e, ex, GROUND - 44 - e.airY);
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) {
      // удар, который сбивает защиту, бликует оранжевым
      const c = e.strike?.breaks || e.strike?.bypass ? PAL.flame2 : PAL.spark;
      rect(g, tip.tipX - 2, tip.tipY, 5, 1, c);
      rect(g, tip.tipX, tip.tipY - 2, 1, 5, c);
    }
  }
  g.globalAlpha = 1;
}

function renderPlayer(cam) {
  const p = game.player;
  if (p.state === 'swallowed') return;
  const px = p.x - cam;
  const GROUND = groundY(p.z);
  const colors = p.state === 'hurt' && p.t < 0.08 ? flashColors(KNIGHT_COLORS) : KNIGHT_COLORS;
  if (p.state === 'roll') {
    // кувырок: сгруппированный рыцарь делает полный оборот
    rollCtx.clearRect(0, 0, 48, 48);
    drawFigure(rollCtx, { x: 24, ground: 44, facing: p.facing, pose: POSES.tuck, colors, plume: true, weaponLen: 17, scabbard: true });
    const k = Math.min(1, p.t / WEAPON.roll.time);
    g.save();
    g.translate(Math.round(px), GROUND - 12);
    g.rotate(p.facing * k * Math.PI * 2);
    g.drawImage(rollCanvas, -24, -30);
    g.restore();
    return;
  }
  const spinning = p.state === 'attack' && p.atk.key === 'spin' && p.phase === 'active';
  const k = spinning ? (p.t - p.atk.windup) / p.atk.active : 0;
  const facing = spinning && k > 0.5 ? -p.facing : p.facing;
  const active = p.phase === 'active';
  const drawing = p.state === 'attack' && p.atk.draw && p.phase === 'windup';

  if (spinning) disc(px, GROUND - 27, 19);
  const tip = drawFigure(g, {
    x: px, ground: GROUND, facing, pose: p.pose, colors, step: p.step, plume: true,
    weaponLen: 17, scabbard: true, bladeHidden: p.sheathed || drawing,
    trail: active ? p.trail : null,
  });
  if (active) {
    p.trail.push({ tipX: tip.tipX, tipY: tip.tipY });
    if (p.trail.length > (spinning ? 6 : 3)) p.trail.shift();
  } else p.trail = [];

  // выбранная высота рядом с рыцарем; голубая — когда держишь защиту
  heightIcon(game.aim, px - p.facing * 13, GROUND - 26, held('guard') ? '#8fd3ff' : '#9f97b0');
  if (p.state === 'backdash' && p.wardActive) {
    // мерцающий заслон перед рыцарем
    g.globalAlpha = 0.5 + 0.3 * Math.sin(p.t * 40);
    for (let a = -1.1; a <= 1.1; a += 0.14) rect(g, px + p.facing * (6 + Math.cos(a) * 9), GROUND - 22 + Math.sin(a) * 14, 1, 1, '#8fd3ff');
    g.globalAlpha = 1;
  }
}

// значок высоты удара над головой врага во время замаха
function windupHint(e, x, y) {
  const h = e.kind === 'archer' ? (e.height === 'arc' ? 'high' : e.height) : e.strike?.guard;
  if (!h) return;
  const c = e.strike?.breaks || e.strike?.bypass || e.height === 'arc' ? PAL.flame2 : '#fff4c2';
  heightIcon(h, x, y, c);
}

// ▲ верх, ━ середина, ▼ низ
function heightIcon(h, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (h === 'mid') rect(g, x - 3, y + 2, 7, 2, c);
  else for (let i = 0; i < 4; i++) rect(g, x - i, h === 'high' ? y + i : y + 3 - i, i * 2 + 1, 1, c);
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
  if (e.button === 0) input.press('Mouse0');
  else if (e.button === 2) input.setHeld('Mouse2', true);
});
window.addEventListener('pointerup', e => { if (e.button === 2) input.setHeld('Mouse2', false); });
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
  const now = performance.now();
  if (now - wheelAt > 150) input.press('Wheel');
  wheelAt = now;
}, { passive: false });

newGame();
ui.debug.hidden = true;
requestAnimationFrame(frame);

// для автотестов в браузере
window.knightNight = game;
