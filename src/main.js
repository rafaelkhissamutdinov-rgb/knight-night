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

const W = CONFIG.width, H = CONFIG.height;
const STEP = 1 / 60;
const ARROW_G = 300;

// Вариант A: WASD / стрелки — ходьба по полу с глубиной, защита — на мыши.
const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  depthIn: ['ArrowUp', 'KeyW'],     // к стене
  depthOut: ['ArrowDown', 'KeyS'],  // к краю экрана
  high: ['WheelUp', 'KeyQ'],
  mid: ['Mouse1', 'KeyE'],
  low: ['WheelDown', 'ShiftLeft'],
  attack: ['Mouse0', 'KeyJ'],
  dash: ['Mouse2', 'Space', 'KeyK'],
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
const HINT_WALK = 'WASD — ходить по полу · ЛКМ удар · ПКМ рывок';
const HINT_FIGHT = 'колесо вверх / зажать / вниз — защита · ЛКМ удар · ПКМ рывок · W S — уйти с линии';

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
};
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
function spawnAll() { return LEVEL.encounters.flatMap((_, i) => spawnGroup(i)); }

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
    dirHistory: [],
    lastTiming: '',
    stats: { perfect: 0, block: 0, hit: 0, counter: 0, dodged: 0 },
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
    return applyImpact(s.guard, e.def.damage * (s.mult ?? 1), e.x, s.breaks, s.bypass, backTurned);
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
      game.arrows.push({ x, y: y0, z: e.z, vz: (pz - e.z) / T, vx, vy, arc: true, height: 'high', damage: e.def.damage, resolved: false, falling: false, life: 4 });
      return;
    }
    game.arrows.push({ x, y: clashY(height, e.z), z: e.z, vz: 0, vx: e.facing * e.def.arrowSpeed, vy: 0, height, damage: e.def.damage, resolved: false, falling: false, life: 3 });
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
function applyImpact(height, damage, sourceX, breaks = false, bypass = false, backTurned = false) {
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
    game.stats.block++;
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
  } else {
    game.stats.hit++;
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
      callout(`${atk.name}  −${dmg}`, 'block');
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
  showOverlay('Ты пал', 'Враг ещё стоит.', 'R — снова в бой');
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
  hint(HINT_WALK);
}

function finish() {
  game.mode = 'end';
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

function spinRequested() {
  const h = game.dirHistory;
  if (h.length < 2) return false;
  const [a, b] = h.slice(-2);
  const ok = a.d === 'fwd' && b.d === 'back' && game.time - a.t <= CONFIG.spinWindow;
  if (ok) game.dirHistory = [];
  return ok;
}

function handlePress(code) {
  if (code === 'KeyG') {
    game.debug = !game.debug;
    ui.debug.hidden = !game.debug;
    return;
  }
  if (game.mode === 'title') {
    unlockAudio();
    game.mode = 'play';
    hideOverlay();
    hint(HINT_WALK);
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
      hint(HINT_WALK);
    }
    return;
  }

  const p = game.player;
  const engaged = !!game.current?.alive;
  const fwdKeys = p.facing > 0 ? KEYS.right : KEYS.left;
  const backKeys = p.facing > 0 ? KEYS.left : KEYS.right;

  if (is(code, 'high')) { recordGuard('high'); p.cancel(); }
  if (is(code, 'low')) { recordGuard('low'); p.cancel(); }
  if (is(code, 'mid')) { recordGuard('mid'); p.cancel(); }
  if (backKeys.includes(code)) game.dirHistory.push({ d: 'back', t: game.time });
  if (fwdKeys.includes(code)) game.dirHistory.push({ d: 'fwd', t: game.time });
  if (game.dirHistory.length > 4) game.dirHistory.shift();

  if (is(code, 'attack')) {
    const vert = held('high') ? 'up' : held('low') ? 'down' : null;
    p.requestAttack(vert, spinRequested());
  }
  if (is(code, 'dash')) {
    const back = backKeys.some(input.isDown);
    const dir = held('high') ? 'up' : held('low') ? 'down' : back && engaged ? 'back' : null;
    p.requestDash(dir);
  }
}

function controls() {
  const p = game.player;
  const engaged = !!game.current?.alive;
  const L = held('left'), R = held('right');
  const map = {};
  for (const c of KEYS.high) map[c] = 'high';
  for (const c of KEYS.low) map[c] = 'low';
  for (const c of KEYS.mid) map[c] = 'mid';
  const dz = (held('depthOut') ? 1 : 0) - (held('depthIn') ? 1 : 0);
  return {
    fwd: p.facing > 0 ? R : L,
    back: engaged && (p.facing > 0 ? L : R) && !(p.facing > 0 ? R : L),
    dz,
    guard: input.latest(map),
    engaged,
    anyInput: L || R || dz !== 0,
  };
}

// ---------- обновление ----------

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
    hint(HINT_FIGHT);
    return;
  }
  const alive = game.enemies.some(e => e.group === game.arena.index && (e.alive || e.state === 'yield'));
  if (!alive) {
    game.cleared.add(game.arena.index);
    game.arena = null;
    game.current = null;
    game.token = null;
    ui.foe.hidden = true;
    hint(HINT_WALK);
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
  const solids = game.enemies.filter(e => e.solid);
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
  else if (!game.enemies.some(e => e.alive) && p.x > LEVEL.length - 60) finish();

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
      const result = applyImpact(a.height, a.damage, a.x - Math.sign(a.vx) * 20);
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
  if (game.hitstop > 0) { game.hitstop -= dt; return; }
  update(dt);
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
function hideOverlay() { ui.overlay.hidden = true; }

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

  if (p.state === 'backdash' && p.wardActive) {
    // мерцающий заслон перед рыцарем
    g.globalAlpha = 0.5 + 0.3 * Math.sin(p.t * 40);
    for (let a = -1.1; a <= 1.1; a += 0.14) rect(g, px + p.facing * (6 + Math.cos(a) * 9), GROUND - 22 + Math.sin(a) * 14, 1, 1, '#8fd3ff');
    g.globalAlpha = 1;
  }
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

// ЛКМ — удар, ПКМ — рывок; на заставке клик запускает игру
// ЛКМ — удар, ПКМ — рывок, средняя кнопка (зажать) или прокрутка колёсика — средняя защита
ui.box.addEventListener('pointerdown', e => {
  ui.box.focus();
  e.preventDefault();
  if (game.mode === 'title') { input.press('Enter'); return; }
  if (e.button === 0) input.press('Mouse0');
  else if (e.button === 2) input.press('Mouse2');
  else if (e.button === 1) input.setHeld('Mouse1', true);
});
window.addEventListener('pointerup', e => { if (e.button === 1) input.setHeld('Mouse1', false); });
ui.box.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });  // без автопрокрутки
ui.box.addEventListener('auxclick', e => e.preventDefault());
ui.box.addEventListener('contextmenu', e => e.preventDefault());
const wheelTimers = {};
ui.box.addEventListener('wheel', e => {
  e.preventDefault();
  if (game.mode !== 'play' || !e.deltaY) return;
  // колесо вверх — верхняя защита, вниз — нижняя; одна прокрутка — одно нажатие
  const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
  if (!wheelTimers[code]) input.setHeld(code, true);
  clearTimeout(wheelTimers[code]);
  wheelTimers[code] = setTimeout(() => { wheelTimers[code] = null; input.setHeld(code, false); }, CONFIG.wheelGuard * 1000);
}, { passive: false });

newGame();
ui.debug.hidden = true;
requestAnimationFrame(frame);

// для автотестов в браузере
window.knightNight = game;
