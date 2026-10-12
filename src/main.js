import { CONFIG, LEVEL } from './config.js';
import { PAL, KNIGHT_COLORS } from './palette.js';
import { createInput } from './input.js';
import { Enemy } from './enemy.js';
import { Player } from './player.js';
import { resolveImpact, attackOutcome } from './combat.js';
import { drawFigure, flashColors, rect } from './draw.js';
import { buildBackground, drawTorches } from './background.js';
import { unlockAudio, sfx } from './audio.js';

const W = CONFIG.width, H = CONFIG.height, GROUND = CONFIG.ground;
const STEP = 1 / 60;

const GUARD_KEYS = { ArrowUp: 'high', KeyW: 'high', ArrowRight: 'mid', KeyD: 'mid', ArrowDown: 'low', KeyS: 'low' };
const ATTACK_KEYS = new Set(['KeyZ', 'KeyJ', 'KeyX', 'Space']);
const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const CLASH_Y = { high: GROUND - 34, mid: GROUND - 22, low: GROUND - 9 };
const HEIGHT_NAME = { high: 'верх', mid: 'середина', low: 'низ' };

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;

const $ = id => document.getElementById(id);
const ui = {
  box: $('game-box'), hearts: $('hearts'), foe: $('foe'), foeName: $('foe-name'), foeBar: $('foe-bar'),
  callout: $('callout'), hint: $('hint'), debug: $('debug'), overlay: $('overlay'),
  overlayTitle: $('overlay-title'), overlayText: $('overlay-text'), overlayPress: $('overlay-press'),
};

const input = createInput(window);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const background = buildBackground(LEVEL.length, H, GROUND);

const game = {};

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
    enemies: LEVEL.enemies.map(e => new Enemy(e.type, e.x)),
    current: null,
    player: new Player(40),
    lastPress: null,
    prevPress: null,
    lastTiming: '',
    duels: 0,
    stats: { perfect: 0, block: 0, hit: 0, counter: 0 },
    debug: game.debug || false,
  });
  renderHearts();
  ui.foe.hidden = true;
}

// ---------- события боя ----------

function onImpact(height) {
  const p = game.player;
  const result = resolveImpact(
    { height, time: game.time, guard: p.guard, lastPress: game.lastPress, prevPress: game.prevPress },
    CONFIG,
  );
  const x = (p.x + game.current.x) / 2;
  const y = CLASH_Y[height];
  if (game.lastPress) {
    const ms = Math.round((game.time - game.lastPress.time) * 1000);
    game.lastTiming = `${HEIGHT_NAME[height]}: нажал ${HEIGHT_NAME[game.lastPress.height]} за ${ms} мс до удара → ${result}`;
  } else {
    game.lastTiming = `${HEIGHT_NAME[height]}: защиту не нажимал → ${result}`;
  }

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
  } else {
    game.stats.hit++;
    p.hurt();
    renderHearts();
    sparks(p.x + 2, y, 10, [PAL.blood, '#9e2648'], 80);
    sfx.hit();
    game.hitstop = CONFIG.hitstop.hit;
    shake(3);
    flash('#e8454f', 0.3);
    callout('Пропущен', 'hit');
    if (p.hp <= 0) die();
  }
  return result;
}

function onStaggered() {
  sfx.stagger();
  callout('Z — выпад!', 'counter');
}

function onPlayerStrike(kind) {
  const e = game.current;
  if (!e || !e.alive) return;
  const out = attackOutcome(e.state);
  const x = e.x - 6, y = GROUND - 24;
  if (out === 'counter') {
    game.stats.counter++;
    e.takeHit(CONFIG.counterDamage);
    sparks(x, y, 22, [PAL.blood, PAL.spark, PAL.sparkHot], 150);
    sfx.counter();
    game.hitstop = CONFIG.hitstop.counter;
    shake(4);
    flash('#ffffff', 0.4);
    callout(`Выпад! −${CONFIG.counterDamage}`, 'counter');
  } else if (out === 'hit') {
    e.takeHit(CONFIG.attackDamage);
    sparks(x, y, 8, [PAL.blood, '#9e2648'], 90);
    sfx.enemyHit();
    shake(2);
    callout(`−${CONFIG.attackDamage}`, 'block');
  } else {
    sparks(x, y, 5, [PAL.sparkHot], 60);
    sfx.deflected();
    callout('Отбил', 'muted');
  }
  renderFoe();
}

function onCue(height) {
  if (CONFIG.audioCues) sfx.cue(height);
}

const hooks = { impact: onImpact, staggered: onStaggered, cue: onCue };

// ---------- режимы ----------

function startDuel(enemy) {
  game.mode = 'duel';
  game.current = enemy;
  game.player.walking = false;
  enemy.engage(game.player.x + CONFIG.duelGap);
  game.duels++;
  ui.foe.hidden = false;
  renderFoe();
  hint(game.duels === 1
    ? '↑ → ↓ — защита сверху, по корпусу, снизу. Жми в момент удара. Вся серия идеально → Z — выпад'
    : '↑ → ↓ — защита · Z — удар, когда враг раскрылся');
}

function die() {
  game.mode = 'dead';
  showOverlay('Ты пал', 'Враг ещё стоит.', 'R — снова в бой');
}

function restartFight() {
  const e = game.current;
  const fresh = new Enemy(e.type, e.homeX);
  game.enemies[game.enemies.indexOf(e)] = fresh;
  game.current = null;
  const p = new Player(e.homeX - CONFIG.engageDistance - 30);
  game.player = p;
  game.lastPress = game.prevPress = null;
  game.mode = 'explore';
  ui.foe.hidden = true;
  renderHearts();
  hideOverlay();
  hint('← → — идти');
}

function finish() {
  game.mode = 'end';
  const s = game.stats;
  showOverlay('Конец прототипа',
    `Идеальных парирований: ${s.perfect} · блоков: ${s.block} · пропущено: ${s.hit} · выпадов: ${s.counter}`,
    'R — пройти заново');
}

// ---------- ввод ----------

function handlePress(code) {
  if (code === 'KeyG') {
    game.debug = !game.debug;
    ui.debug.hidden = !game.debug;
    return;
  }
  if (game.mode === 'title') {
    unlockAudio();
    game.mode = 'explore';
    hideOverlay();
    hint('← → — идти');
    return;
  }
  if (game.mode === 'dead') {
    if (code === 'KeyR' || code === 'Enter') restartFight();
    return;
  }
  if (game.mode === 'end') {
    if (code === 'KeyR' || code === 'Enter') { newGame(); game.mode = 'explore'; hideOverlay(); hint('← → — идти'); }
    return;
  }
  if (game.mode !== 'duel') return;
  if (code in GUARD_KEYS) {
    game.prevPress = game.lastPress;
    game.lastPress = { height: GUARD_KEYS[code], time: game.time };
  } else if (ATTACK_KEYS.has(code) && game.player.ready && game.current?.alive) {
    game.player.startAttack(game.current.state === 'stagger' ? 'lunge' : 'attack');
  }
}

// ---------- обновление ----------

function update(dt) {
  for (const code of input.take()) handlePress(code);
  if (game.mode === 'title' || game.mode === 'dead' || game.mode === 'end') return;

  game.time += dt;
  const p = game.player;
  const guard = game.mode === 'duel' ? input.latest(GUARD_KEYS) : null;
  const strike = p.update(dt, guard);
  if (strike) onPlayerStrike(strike);

  if (game.mode === 'explore') {
    const dir = (RIGHT_KEYS.some(input.isDown) ? 1 : 0) - (LEFT_KEYS.some(input.isDown) ? 1 : 0);
    p.walking = dir !== 0;
    p.x = Math.max(16, Math.min(LEVEL.length - 16, p.x + dir * CONFIG.walkSpeed * dt));
    const next = game.enemies.find(e => e.alive);
    if (next && next.x - p.x < CONFIG.engageDistance) startDuel(next);
    else if (!next && p.x > LEVEL.length - 60) finish();
    game.camTarget = p.x - 120;
  } else if (game.mode === 'duel') {
    const e = game.current;
    e.update(dt, hooks);
    if (!e.alive && e.t > 1) {
      game.mode = 'explore';
      game.current = null;
      ui.foe.hidden = true;
      hint('← → — идти');
    }
    game.camTarget = (p.x + e.x) / 2 - W / 2;
  }
  for (const e of game.enemies) if (e !== game.current && e.state === 'dead') e.update(dt, hooks);

  const maxCam = LEVEL.length - W;
  const target = Math.max(0, Math.min(maxCam, game.camTarget ?? 0));
  game.camX += (target - game.camX) * Math.min(1, dt * 6);
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

  for (const e of game.enemies) {
    const ex = e.x + e.offset - cam;
    if (ex < -40 || ex > W + 40) continue;
    let alpha = 1;
    if (e.state === 'dead') alpha = Math.max(0, 1 - (e.t - 0.6) / 0.8);
    if (alpha <= 0) continue;
    g.globalAlpha = alpha;
    const colors = e.state === 'hurt' && e.t < 0.08 ? flashColors(e.def.colors) : e.def.colors;
    const tip = drawFigure(g, { x: ex, ground: GROUND, facing: -1, pose: e.pose, colors, step: e.step });
    g.globalAlpha = 1;
    if (CONFIG.glint && e.glint && Math.floor(e.t * 30) % 2 === 0) {
      rect(g, tip.tipX - 2, tip.tipY, 5, 1, PAL.spark);
      rect(g, tip.tipX, tip.tipY - 2, 1, 5, PAL.spark);
    }
  }

  const p = game.player;
  const pc = p.state === 'hurt' && p.t < 0.08 ? flashColors(KNIGHT_COLORS) : { ...KNIGHT_COLORS };
  drawFigure(g, { x: p.x + p.offset - cam, ground: GROUND, facing: 1, pose: p.pose, colors: pc, step: p.step, plume: true });

  for (const s of game.particles) rect(g, s.x - cam, s.y, 1, 1, s.color);

  g.setTransform(1, 0, 0, 1, 0, 0);
  if (game.flash > 0) {
    g.globalAlpha = game.flash;
    g.fillStyle = game.flashColor;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (game.debug) renderDebug();
}

// G — отладка: полоса замаха и зелёное окно идеального парирования.
function renderDebug() {
  const e = game.current;
  if (e && e.state === 'windup') {
    const T = e.windupTime, x0 = 60, w = 200;
    rect(g, x0, 168, w, 4, '#000000');
    rect(g, x0 + w * (1 - CONFIG.perfectWindow / T), 168, Math.ceil(w * CONFIG.perfectWindow / T), 4, '#3c9a5f');
    rect(g, x0 + w * Math.min(1, e.t / T), 166, 1, 8, '#ffffff');
  }
  ui.debug.textContent = game.lastTiming || 'G — отладка. Здесь появится тайминг последнего удара.';
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

ui.box.addEventListener('pointerdown', () => {
  ui.box.focus();
  if (game.mode === 'title') input.press('Enter');
});

newGame();
ui.debug.hidden = true;
requestAnimationFrame(frame);

// для автотестов в браузере
window.knightNight = game;
