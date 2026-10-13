import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, WEAPON, RAPIER, ENEMY_TYPES, ROOMS } from '../src/config.js';
import { resolveImpact, slimeZone } from '../src/combat.js';
import { createEnemy } from '../src/enemy.js';
import { chooseAttack, attackWindup, Player } from '../src/player.js';

const at = (height, time) => ({ height, time });
const def = (o = {}) => ({ guard: null, dodge: false, ward: false, attacking: false, vulnerable: false, ...o });
const impact = (height, time, defense, lastPress, prevPress) =>
  resolveImpact({ height, time, defense: def(defense), lastPress, prevPress }, CONFIG);

// ---------- защита ----------

test('нет защиты или не та высота — попадание', () => {
  assert.deepEqual(impact('high', 5, {}), { result: 'hit', mult: 1 });
  assert.equal(impact('high', 5, { guard: 'mid' }, at('mid', 4.95)).result, 'hit');
});

test('нажал вовремя — идеально, держал заранее — блок', () => {
  assert.equal(impact('mid', 5, { guard: 'mid' }, at('mid', 4.9)).result, 'perfect');
  assert.equal(impact('mid', 5, { guard: 'mid' }, at('mid', 4.5)).result, 'block');
});

test('частое нажатие перед ударом не даёт идеального', () => {
  assert.equal(impact('low', 5, { guard: 'low' }, at('low', 4.95), at('high', 4.85)).result, 'block');
});

test('атаковал вместо защиты — урон вдвое', () => {
  assert.deepEqual(impact('mid', 5, { attacking: true }), { result: 'hit', mult: CONFIG.tradeMult });
});

test('кувырок уклоняется, заслон отскока держит удар, поздний отскок — больно', () => {
  assert.equal(impact('high', 5, { dodge: true }).result, 'dodged');
  assert.equal(impact('high', 5, { ward: true }).result, 'warded');
  assert.deepEqual(impact('high', 5, { vulnerable: true }), { result: 'hit', mult: CONFIG.tradeMult });
});

// ---------- удары рыцаря ----------

test('выбор удара по направлению и ситуации', () => {
  const base = { vert: null, spin: false, state: 'ready', t: 0, sinceRoll: 99 };
  assert.equal(chooseAttack(base), 'side');
  assert.equal(chooseAttack({ ...base, vert: 'up' }), 'overhead');
  assert.equal(chooseAttack({ ...base, vert: 'down' }), 'low');
  assert.equal(chooseAttack({ ...base, spin: true }), 'spin');
  assert.equal(chooseAttack({ ...base, state: 'dash', t: 0.1 }), 'dashCut');
  assert.equal(chooseAttack({ ...base, sinceRoll: 0.1 }), 'rollCut');
});

test('из ножен боковой быстрее, верхний и нижний медленнее', () => {
  assert.ok(attackWindup('side', true) < attackWindup('side', false));
  assert.ok(attackWindup('overhead', true) > attackWindup('overhead', false));
  assert.ok(attackWindup('low', true) > attackWindup('low', false));
});

test('отмена удара во время замаха', () => {
  const p = new Player(0);
  p.sheathed = false;
  p.requestAttack('up', false);
  assert.equal(p.state, 'attack');
  assert.ok(p.cancel());
  assert.equal(p.state, 'ready');
});

test('рыцарь проходит все фазы удара и наносит его один раз', () => {
  const p = new Player(0);
  const c = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
  p.requestAttack(null, false);
  let strikes = 0;
  for (let i = 0; i < 60; i++) {
    p.update(1 / 60, c);
    strikes += p.events.splice(0).filter(e => e.type === 'strike').length;
  }
  assert.equal(strikes, 1);
  assert.equal(p.state, 'ready');
});

test('вихрь бьёт дважды', () => {
  const p = new Player(0);
  const c = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
  p.requestAttack(null, true);
  let strikes = 0;
  for (let i = 0; i < 90; i++) {
    p.update(1 / 60, c);
    strikes += p.events.splice(0).filter(e => e.type === 'strike').length;
  }
  assert.equal(strikes, WEAPON.attacks.spin.hits.length);
});

test('заслон отскока работает один раз и гаснет', () => {
  const p = new Player(0);
  p.requestDash('back');
  assert.equal(p.defense().ward, true);
  p.ward.used = true;
  assert.equal(p.defense().ward, false);
  assert.equal(p.defense().vulnerable, false);
  const q = new Player(0);
  q.requestDash('back');
  const c = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
  for (let i = 0; i < 25; i++) q.update(1 / 60, c);
  assert.equal(q.defense().vulnerable, true);
});

// ---------- враги ----------

function world(px) {
  return {
    player: { x: px, z: 22 },
    impacts: [],
    engage() {},
    cue() {},
    staggered() { this.stag = true; },
    impact(e, h) { this.impacts.push(h); return this.answer ? this.answer(h) : 'perfect'; },
    spawnArrow(e, h) { this.impacts.push('arrow-' + h); },
    swallow() { return true; },
  };
}

function run(enemy, w, until, maxTime = 20) {
  const dt = 1 / 60;
  for (let t = 0; t < maxTime; t += dt) {
    enemy.update(dt, w);
    if (until(enemy)) return t;
  }
  throw new Error(`не дождались, состояние ${enemy.state}`);
}

test('мечник подходит и бьёт серией; всё идеально — ошеломлён', () => {
  const e = createEnemy('merc', 100, () => 0.99); // последняя серия: середина, низ, верх
  const w = world(30);
  run(e, w, x => x.state === 'stagger');
  assert.deepEqual(w.impacts, ['mid', 'low', 'high']);
  assert.ok(w.stag);
});

test('один блок в серии — только окно для обычных ударов', () => {
  const e = createEnemy('merc', 100, () => 0.99);
  const w = world(30);
  let n = 0;
  w.answer = () => (n++ === 0 ? 'perfect' : 'block');
  run(e, w, x => x.state === 'recover');
});

test('щит закрывает верх и середину, низ проходит', () => {
  const e = createEnemy('skelShield', 0, () => 0.99);
  e.enter('idle');
  assert.equal(e.receiveAttack(WEAPON.attacks.overhead).out, 'blocked');
  assert.equal(e.receiveAttack(WEAPON.attacks.side).out, 'blocked');
  assert.equal(e.receiveAttack(WEAPON.attacks.low).out, 'hit');
});

test('враг успевает закрыться от удара, если среагировал', () => {
  const e = createEnemy('merc', 0, () => 0);  // всегда закрывается
  e.enter('idle');
  e.notifyAttack(WEAPON.attacks.overhead);
  e.update(0.2, world(-100));
  assert.equal(e.guardHeight, 'high');
  assert.equal(e.receiveAttack(WEAPON.attacks.overhead).out, 'blocked');
  assert.equal(e.receiveAttack(WEAPON.attacks.low).out, 'hit');
});

test('размен: удар по врагу во время его замаха не прерывает замах', () => {
  const e = createEnemy('skelLong', 0);
  e.combo = ['high'];
  e.idx = 0;
  e.enter('windup');
  e.receiveAttack(WEAPON.attacks.side);
  assert.equal(e.state, 'windup');
  assert.equal(e.hp, e.def.hp - 1);
});

test('по ошеломлённому врагу урон вдвое и без защиты', () => {
  const e = createEnemy('skelShield', 0);
  e.enter('stagger');
  const r = e.receiveAttack(WEAPON.attacks.overhead);
  assert.equal(r.out, 'counter');
  assert.equal(r.dmg, WEAPON.attacks.overhead.damage * CONFIG.counterMult);
});

test('слизня бьют по высоте прыжка', () => {
  assert.equal(slimeZone(0, false), 'low');
  assert.equal(slimeZone(12, false), 'mid');
  assert.equal(slimeZone(26, false), 'high');
  assert.equal(slimeZone(0, true), 'any');
  const s = createEnemy('slime', 0);
  s.enter('hop');
  s.airY = 0;
  assert.equal(s.receiveAttack(WEAPON.attacks.overhead).out, 'miss');
  assert.equal(s.receiveAttack(WEAPON.attacks.low).out, 'hit');
});

test('раздутого слизня можно пробить, иначе он глотает', () => {
  const popped = createEnemy('slime', 0);
  popped.enter('inflate');
  popped.receiveAttack(WEAPON.attacks.side);
  popped.receiveAttack(WEAPON.attacks.side);
  assert.equal(popped.state, 'stagger');

  const s = createEnemy('slime', 0);
  s.enter('inflate');
  const w = world(40);
  let swallowed = false;
  w.swallow = () => (swallowed = true);
  run(s, w, x => x.state === 'suck' && x.done);
  assert.ok(swallowed);
  assert.ok(s.holding);
});

test('лучник отпрыгивает, если подойти близко, и стреляет', () => {
  const a = createEnemy('skelArcher', 200, () => 0.5);
  const w = world(150);
  run(a, w, x => x.state === 'hop');
  const far = world(-200);
  const b = createEnemy('skelArcher', 0, () => 0.5);
  b.rest();
  run(b, far, () => far.impacts.some(i => i.startsWith('arrow')));
});

// ---------- v0.3: сбитая защита, диагонали, мини-босс ----------

test('тяжёлый и диагональный удар сбивают защиту при обычном блоке', () => {
  const r = resolveImpact({ height: 'mid', time: 5, defense: def({ guard: 'mid' }), lastPress: at('mid', 4.5), breaks: true }, CONFIG);
  assert.equal(r.result, 'broken');
  const perfect = resolveImpact({ height: 'mid', time: 5, defense: def({ guard: 'mid' }), lastPress: at('mid', 4.9), breaks: true }, CONFIG);
  assert.equal(perfect.result, 'perfect');
});

test('со сбитой защитой следующий удар проходит', () => {
  assert.equal(impact('high', 5, { guard: 'high', broken: true }, at('high', 4.9)).result, 'hit');
  const p = new Player(0);
  p.sheathed = false;
  p.breakGuard(20);
  const c = { fwd: false, back: false, guard: 'high', engaged: true, anyInput: true };
  p.update(1 / 60, c);
  assert.equal(p.defense().guard, null);
  assert.equal(p.defense().broken, true);
});

test('диагонали отбиваются средней защитой', async () => {
  const { STRIKES } = await import('../src/config.js');
  assert.equal(STRIKES.diagUp.guard, 'mid');
  assert.equal(STRIKES.diagDown.guard, 'mid');
  assert.ok(STRIKES.diagUp.breaks && STRIKES.heavyHigh.breaks);
});

test('двуручник: после сбитой защиты второй удар серии не отбить', () => {
  const e = createEnemy('skelLong', 100, () => 0.99); // серия heavyMid → heavyLow
  const w = world(60);
  w.heavySwing = () => {};
  let broken = false;
  w.answer = () => {
    if (!broken) { broken = true; return 'broken'; }
    return 'hit';
  };
  run(e, w, x => x.state === 'recover');
  assert.equal(w.impacts.length, 2);
});

test('мини-босс не умирает, а встаёт на колено и убегает', () => {
  const e = createEnemy('duelist', 100);
  const w = world(60);
  w.heavySwing = () => {};
  let fled = false;
  w.defeated = () => (fled = true);
  e.enter('idle');
  e.receiveAttack({ ...WEAPON.attacks.overhead, damage: 99 });
  assert.equal(e.state, 'yield');
  assert.equal(e.alive, false);
  run(e, w, x => x.state === 'gone', 6);
  assert.ok(fled);
  assert.ok(e.x > 100, 'убегает прочь от рыцаря');
});

test('мини-босс врывается прыжком и сразу колет', () => {
  const e = createEnemy('duelist', 200, () => 0.3);  // 0.3 → прыжок вперёд
  const w = world(100);
  w.heavySwing = () => {};
  e.rest();
  run(e, w, x => x.state === 'leapIn', 5);
  run(e, w, x => w.impacts.includes('thrust'), 5);
});

// ---------- v0.4: захлёсты ----------

test('захлёст огибает удержанный блок, спасает только идеальное парирование', () => {
  const held = resolveImpact({ height: 'high', time: 5, defense: def({ guard: 'high' }), lastPress: at('high', 4.5), bypass: true }, CONFIG);
  assert.equal(held.result, 'hit');
  const perfect = resolveImpact({ height: 'high', time: 5, defense: def({ guard: 'high' }), lastPress: at('high', 4.9), bypass: true }, CONFIG);
  assert.equal(perfect.result, 'perfect');
});

test('удар в спину — защита не действует, урон вдвое; кувырок спасает', () => {
  assert.deepEqual(impact('high', 5, { guard: 'high', backTurned: true }, at('high', 4.9)), { result: 'hit', mult: CONFIG.tradeMult });
  assert.equal(impact('high', 5, { dodge: true, backTurned: true }).result, 'dodged');
});

test('Илиа перепрыгивает через рыцаря и хлещет в спину', () => {
  const e = createEnemy('duelist', 140, () => 0.45);  // 0.45 → прыжок через рыцаря
  const w = world(110);
  w.heavySwing = () => {};
  e.enter('idle');
  e.waitFor = 0;
  run(e, w, x => x.state === 'vault', 2);
  run(e, w, x => w.impacts.includes('flickBack'), 3);
  assert.ok(e.x < 110, 'приземлился по другую сторону от рыцаря');
});

// ---------- диалоги ----------

test('диалог: условия, флаги и выбор с переходом', async () => {
  const { DialogueRunner } = await import('../src/dialogue.js');
  const D = {
    meet: [{ who: 'a', text: 'Кто ты?' }, { who: 'b', choices: [{ text: 'Друг', set: 'friend', goto: 'friend' }, { text: 'Уйди' }] }],
    friend: [{ who: 'a', text: 'Рад видеть' }],
    bye: [{ who: 'a', text: 'Пока' }, { who: 'a', if: 'friend', text: 'Ещё увидимся, друг' }, { who: 'a', ifNot: 'friend', text: 'Не возвращайся' }],
  };
  const flags = {};
  const d = new DialogueRunner(D, flags);
  assert.equal(d.start('meet').text, 'Кто ты?');
  assert.ok(d.advance().choices);
  assert.equal(d.choose(0).text, 'Рад видеть');
  assert.equal(flags.friend, true);
  assert.equal(d.advance(), null);
  d.start('bye');
  const lines = [d.current.text];
  while (d.advance()) lines.push(d.current.text);
  assert.deepEqual(lines, ['Пока', 'Ещё увидимся, друг']);
});

test('во всех диалогах переходы ведут на существующие диалоги', async () => {
  const { DIALOGUES, SPEAKERS } = await import('../src/story/dialogues.js');
  for (const [id, lines] of Object.entries(DIALOGUES)) {
    for (const l of lines) {
      assert.ok(SPEAKERS[l.who], `${id}: неизвестный говорящий ${l.who}`);
      for (const c of l.choices ?? []) if (c.goto) assert.ok(DIALOGUES[c.goto], `${id}: нет диалога ${c.goto}`);
    }
  }
});

test('вихрь перезаряжается: второй сразу не выйдет', () => {
  const p = new Player(0);
  p.sheathed = false;
  const c = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
  p.requestAttack(null, true);
  assert.equal(p.atk.key, 'spin');
  for (let i = 0; i < 90; i++) p.update(1 / 60, c);
  p.events.length = 0;
  p.requestAttack(null, true);
  assert.equal(p.atk.key, 'side');
  assert.ok(p.events.some(e => e.type === 'spinNotReady'));
  for (let i = 0; i < 60 * CONFIG.spinCooldown; i++) p.update(1 / 60, c);
  assert.equal(p.spinCharge, 1);
  p.requestAttack(null, true);
  assert.equal(p.atk.key, 'spin');
});

test('идеальное парирование посреди серии выбивает врага из ритма', () => {
  const e = createEnemy('merc', 100, () => 0.99);  // серия из трёх ударов
  const w = world(30);
  const states = new Set();
  let n = 0;
  w.answer = () => (n++ === 0 ? 'perfect' : 'block');
  const dt = 1 / 60;
  for (let t = 0; t < 20 && e.state !== 'recover'; t += dt) { e.update(dt, w); states.add(e.state); }
  assert.ok(states.has('reel'), 'после идеального — пауза');
  assert.equal(e.state, 'recover');
  // удар в паузу прерывает серию
  const f = createEnemy('merc', 100, () => 0.99);
  f.combo = ['mid', 'high']; f.idx = 1; f.enter('reel');
  f.receiveAttack(WEAPON.attacks.side);
  assert.equal(f.state, 'hurt');
  assert.equal(f.combo, null);
});

test('враг из группы не просыпается раньше своей встречи', () => {
  const e = createEnemy('skelShort', 100);
  e.group = 1;
  const w = world(90);
  for (let i = 0; i < 30; i++) e.update(1 / 60, w);
  assert.equal(e.state, 'dormant');
  e.awake = true;
  e.update(1 / 60, w);
  assert.notEqual(e.state, 'dormant');
});

test('после удара защита сразу отменяет восстановление, а не только замах', () => {
  const p = new Player(0);
  p.sheathed = false;
  const c = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
  p.requestAttack(null, false);
  while (p.phase !== 'recover') p.update(1 / 60, c);
  assert.ok(p.cancel());
  assert.equal(p.state, 'ready');
  p.requestAttack(null, false);
  p.update(1 / 60, c);
  while (p.phase === 'windup') p.update(1 / 60, c);
  assert.equal(p.phase, 'active');
  assert.equal(p.cancel(), false, 'сам удар отменить нельзя');
});

// ---------- v0.12: рапира, загнанный лучник ----------

const idle = { fwd: false, back: false, guard: null, engaged: true, anyInput: false };
function tick(p, sec, onEvent = () => {}) {
  for (let t = 0; t < sec; t += 1 / 60) {
    p.update(1 / 60, idle);
    for (const ev of p.events.splice(0)) onEvent(ev);
  }
}

test('Илиа выбивают рапиру: она падает на пол', () => {
  const e = createEnemy('duelist', 100);
  const w = world(60);
  w.heavySwing = () => {};
  w.defeated = () => {};
  const drops = [];
  w.dropWeapon = (who, kind) => drops.push(kind);
  e.enter('idle');
  e.receiveAttack({ ...WEAPON.attacks.overhead, damage: 99 });
  run(e, w, x => x.disarmed, 3);
  assert.deepEqual(drops, ['rapier']);
});

test('рапира: быстрые клики — до трёх уколов, после третьего пауза', () => {
  const p = new Player(0, 'rapier');
  let strikes = 0;
  const count = ev => { if (ev.type === 'strike') strikes++; };
  p.requestAttack(null, false);
  tick(p, RAPIER.attacks.side.windup + 0.02, count);
  p.requestAttack(null, false);
  tick(p, RAPIER.attacks.side.windup + 0.02, count);
  p.requestAttack(null, false);
  assert.equal(p.atk.chainIdx, 2);
  assert.ok(p.atk.recover > RAPIER.attacks.side.recover, 'после серии — задержка');
  tick(p, 0.03, count);
  p.requestAttack(null, false);   // четвёртый клик серию не продлевает
  assert.equal(p.atk.chainIdx, 2);
  tick(p, 1, count);
  assert.equal(strikes, 3);
  assert.equal(p.state, 'ready');
});

test('рапира: колесо — восьмёрка, бьёт трижды и отбивает лёгкие удары, но не тяжёлые', () => {
  const p = new Player(0, 'rapier');
  p.requestAttack(null, true);
  assert.equal(p.atk.key, 'figure8');
  let strikes = 0, weave = false;
  tick(p, 0.3, ev => { if (ev.type === 'strike') strikes++; });
  weave = p.defense().weave;
  assert.ok(weave);
  const d = { ...p.defense() };
  assert.equal(resolveImpact({ height: 'mid', time: 5, defense: d, breaks: false }, CONFIG).result, 'block');
  assert.equal(resolveImpact({ height: 'high', time: 5, defense: d, breaks: false, bypass: false }, CONFIG).result, 'block');
  assert.equal(resolveImpact({ height: 'mid', time: 5, defense: d, breaks: true }, CONFIG).result, 'hit');
  tick(p, 1.2, ev => { if (ev.type === 'strike') strikes++; });
  assert.equal(strikes, RAPIER.attacks.figure8.hits.length);
});

test('рапира: прыжок через врага — приземляется за спиной и разворачивается', () => {
  const p = new Player(0, 'rapier');
  assert.ok(p.requestVault(40));
  assert.equal(p.cancel(), false, 'в полёте не отменить');
  let top = 0, strikes = 0;
  for (let t = 0; t < 1.5; t += 1 / 60) {
    p.update(1 / 60, idle);
    top = Math.max(top, p.airY);
    strikes += p.events.splice(0).filter(e => e.type === 'strike').length;
  }
  assert.ok(top > 20);
  assert.equal(p.airY, 0);
  assert.ok(p.x > 40, 'за спиной врага');
  assert.equal(p.facing, -1);
  assert.equal(strikes, 1);
  assert.equal(p.requestVault(40), false, 'перезарядка');
  const s = new Player(0);
  assert.equal(s.requestVault(40), false, 'с мечом прыжка нет');
});

test('рапира: прыжок без цели — без разворота, бьёт вперёд', () => {
  const p = new Player(0, 'rapier');
  assert.ok(p.requestVault(44, false));
  for (let t = 0; t < 1.5; t += 1 / 60) p.update(1 / 60, idle);
  assert.equal(p.facing, 1);
});

test('захлёст и рипост рапиры проходят сквозь защиту врага', () => {
  for (const atk of [RAPIER.attacks.overhead, RAPIER.attacks.riposte]) {
    const e = createEnemy('skelShield', 100);
    e.enter('idle');
    e.guardHeight = atk.height;
    const { out } = e.receiveAttack({ ...atk });
    assert.notEqual(out, 'blocked', atk.name);
  }
});

test('лучник, прижатый к краю, не прыгает в стену, а уходит вглубь', () => {
  const a = createEnemy('skelArcher', 100, () => 0.5);
  const w = world(80);
  w.roomBehind = () => 5;
  a.rest?.();
  a.awake = true;
  const z0 = a.z;
  let hopped = false;
  for (let t = 0; t < 2; t += 1 / 60) {
    a.update(1 / 60, w);
    if (a.state === 'hop') hopped = true;
  }
  assert.equal(hopped, false);
  assert.notEqual(a.z, z0);
});

// ---------- v0.13: обучение, наставница, комнаты ----------

test('обучение: шаг засчитывается, только когда выполнено всё', async () => {
  const { Tutorial, TUTORIAL } = await import('../src/tutorial.js');
  const t = new Tutorial();
  assert.equal(t.step.id, 'strike');
  assert.equal(t.note({ type: 'hit', height: 'high', key: 'overhead' }), false);
  assert.equal(t.note({ type: 'hit', height: 'high', key: 'overhead' }), false, 'повтор той же высоты не помогает');
  assert.equal(t.note({ type: 'hit', height: 'mid', key: 'side' }), false);
  assert.equal(t.note({ type: 'impact', result: 'block' }), false, 'чужое событие не считается');
  assert.equal(t.note({ type: 'hit', height: 'low', key: 'low' }), true);
  assert.equal(t.step.id, 'block');
  for (let i = 0; i < 2; i++) t.note({ type: 'impact', result: 'block' });
  assert.match(t.text, /отбито 2\/3/);
  t.note({ type: 'impact', result: 'perfect' });
  assert.equal(t.step.id, 'perfect');
  // дойти до конца
  const events = {
    perfect: [{ type: 'impact', result: 'perfect' }, { type: 'impact', result: 'perfect' }],
    counter: [{ type: 'counter', height: 'mid', key: 'side' }],
    dodge: [{ type: 'impact', result: 'warded' }],
    moves: ['dashCut', 'leap', 'rollCut'].map(key => ({ type: 'hit', height: 'mid', key })),
    spin: [{ type: 'hit', height: 'any', key: 'spin' }],
  };
  while (!t.done) for (const ev of events[t.step.id]) t.note(ev);
  assert.equal(t.i, TUTORIAL.length);
});

test('наставница бьёт только по плану шага и не наносит урона', () => {
  const e = createEnemy('trainer', 100, () => 0.5);
  const w = world(80);
  w.heavySwing = () => {};
  e.awake = true;
  for (let t = 0; t < 3; t += 1 / 60) {
    e.update(1 / 60, w);
    assert.notEqual(e.state, 'windup', 'без плана не бьёт');
  }
  e.setPlan({ combos: [['heavyMid']], windup: 0.5, wait: [0.2, 0.2] });
  run(e, w, x => x.state === 'windup', 5);
  assert.equal(e.windupTime, 0.5);
  run(e, w, x => x.state === 'strike', 2);
  assert.equal(e.def.damage, 0);
  e.leave();
  assert.equal(e.alive, false);
  run(e, w, x => x.state === 'gone', 10);
  assert.ok(e.x > 300, 'ушла вперёд');
});

test('комнаты: двери ведут друг к другу, края и встречи на месте', async () => {
  const { ROOMS, START } = await import('../src/config.js');
  assert.ok(ROOMS[START.room]);
  for (const [id, r] of Object.entries(ROOMS)) {
    for (const d of r.doors ?? []) {
      if (d.finish || (d.locked && !d.key && !d.requires && !d.needs)) continue;  // глухие запертые двери и выход-финиш
      if (d.oneWay) { assert.ok(ROOMS[d.to]?.doors?.find(x => x.id === d.toDoor), `${id}:${d.id} → ${d.to}:${d.toDoor}`); continue; }  // пролом — только вниз
      const back = ROOMS[d.to]?.doors?.find(x => x.id === d.toDoor);
      assert.ok(back, `${id}:${d.id} → ${d.to}:${d.toDoor}`);
      assert.equal(back.to, id, `обратная дверь ${d.to}:${back.id} ведёт в ${id}`);
      assert.ok(d.x > 16 && d.x < r.length - 16);
    }
    for (const [side, edge] of Object.entries(r.edges ?? {})) {
      const to = ROOMS[edge.to];
      assert.ok(to, `${id} ${side}`);
      assert.ok(to.edges?.[side === 'left' ? 'right' : 'left']?.to === id, `край ${id} ${side} — обратный проход`);
    }
    for (const enc of r.encounters ?? []) for (const en of enc.enemies) assert.ok(ENEMY_TYPES[en.type], en.type);
  }
});

test('наставница: шаг сменился посреди серии — удар не ломается', () => {
  const e = createEnemy('trainer', 100, () => 0.5);
  const w = world(80);
  w.heavySwing = () => {};
  e.awake = true;
  e.setPlan({ combos: [['mid', 'high']], windup: 0.4, comboWindup: 0.4, wait: [0.1, 0.1] });
  w.answer = () => { e.setPlan(null); return 'perfect'; };  // как будто этот удар закрыл шаг обучения
  for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60, w);
  assert.equal(w.impacts.length, 1, 'серия оборвалась после первого удара');
  assert.notEqual(e.state, 'windup');
});

test('копейщик: тык-тык — диск, нижних ударов нет, снизу не закрывается', () => {
  const d = ENEMY_TYPES.spear;
  assert.ok(d.combos.every(c => c.every(h => h === 'thrust' || h === 'whirl')));
  const e = createEnemy('spear', 100);
  e.enter('idle');
  e.guardHeight = 'low';
  assert.equal(e.receiveAttack({ ...WEAPON.attacks.low }).out, 'hit');
  const f = createEnemy('spear', 100);
  f.enter('idle');
  f.guardHeight = 'mid';
  f.guardT = 1;
  assert.equal(f.receiveAttack({ ...WEAPON.attacks.side }).out, 'blocked');
});

test('предметы: всё, что продаёт Лика и лежит в сундуках, существует; навыки ссылаются на настоящие удары', async () => {
  const { ITEMS, ROOMS, START_EQUIP, WEAPONS } = await import('../src/config.js');
  const { SHOPS, ITEM_TEXTS } = await import('../src/story/dialogues.js');
  for (const it of SHOPS.lika.items) assert.ok(ITEMS[it.id], it.id);
  for (const r of Object.values(ROOMS)) for (const pr of r.props ?? []) if (pr.item) assert.ok(ITEMS[pr.item], pr.item);
  for (const id of Object.values(START_EQUIP)) if (id) assert.ok(ITEMS[id], id);
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.ok(ITEM_TEXTS[id], `описание ${id}`);
    if (item.attack) assert.ok(WEAPONS[item.need].attacks[item.attack], item.attack);
    if (item.learn) assert.ok(ITEMS[item.learn], item.learn);
    if (item.weapon) assert.ok(WEAPONS[item.weapon], item.weapon);
  }
});

test('тройной выпад: три укола за один приём', () => {
  const p = new Player(0, 'rapier');
  p.startAttack('tripleLunge');
  let strikes = 0;
  tick(p, 1, ev => { if (ev.type === 'strike') strikes++; });
  assert.equal(strikes, 3);
  assert.ok(p.x > 10, 'выпад вперёд');
});

test('сюжетные бои помечены story и не повторяются по имени', () => {
  const story = [];
  for (const r of Object.values(ROOMS)) for (const enc of r.encounters ?? []) {
    if (enc.enemies.some(e => ['duelist', 'captain', 'commander'].includes(e.type))) assert.ok(enc.story, `нет story у встречи с ${enc.enemies.map(e => e.type)}`);
    if (enc.story) story.push(enc.story);
  }
  assert.deepEqual(story.sort(), ['ataman', 'commander', 'ilia', 'keyguard']);
});

test('предметы: свитки учат навыки, у навыков есть удар нужного оружия, у всех вещей есть описание', async () => {
  const { ITEMS } = await import('../src/config.js');
  const { ITEM_TEXTS } = await import('../src/story/dialogues.js');
  const attacks = { sword: WEAPON.attacks, rapier: RAPIER.attacks };
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(ITEM_TEXTS[id], `нет описания у ${id}`);
    if (it.learn) assert.equal(ITEMS[it.learn]?.slot, 'skill', `${id} учит не навык`);
    if (it.slot === 'skill' && it.attack) {
      assert.ok(it.need, `навык ${id} без нужного оружия`);
      assert.ok(attacks[it.need]?.[it.attack], `у ${it.need} нет удара ${it.attack} (навык ${id})`);
    }
    if (it.slot === 'weapon') assert.ok(attacks[it.weapon], `${id}: неизвестное оружие ${it.weapon}`);
  }
});

test('призрак: после серии растворяется, неуязвим, проявляется у рыцаря в пределах арены', () => {
  const e = createEnemy('ghost', 140, () => 0.1);
  const w = world(100);
  w.answer = () => 'block';
  w.roomBehind = (en, dir) => dir > 0 ? 300 - en.x : en.x - 20;  // арена 20…300
  e.awake = true;
  run(e, w, en => en.state === 'fade', 30);
  assert.equal(e.receiveAttack({ height: 'mid', damage: 1 }).out, 'miss', 'прозрачного не задеть');
  assert.equal(e.solid, false);
  run(e, w, en => en.state === 'appear');
  assert.ok(Math.abs(e.x - w.player.x) <= ENEMY_TYPES.ghost.reach, `проявился далеко: ${e.x}`);
  assert.ok(e.x >= 32 && e.x <= 288, 'вне арены');
  run(e, w, en => en.state === 'idle');
  assert.equal(e.ghost, 1);
});

test('щит брони принимает урон первым', async () => {
  const { splitDamage } = await import('../src/combat.js');
  assert.deepEqual(splitDamage(2, 3), { absorbed: 2, hp: 0 });
  assert.deepEqual(splitDamage(2, 1), { absorbed: 1, hp: 1 });
  assert.deepEqual(splitDamage(1, 0), { absorbed: 0, hp: 1 });
});

test('сеты: части и награда есть в ITEMS, части лежат в комнатах', async () => {
  const { SETS, ITEMS, ROOMS } = await import('../src/config.js');
  const picks = Object.values(ROOMS).flatMap(r => (r.props ?? []).map(p => p.pick).filter(Boolean));
  for (const set of Object.values(SETS)) {
    assert.ok(ITEMS[set.gives]?.slot, set.gives);
    for (const id of set.pieces) { assert.ok(ITEMS[id], id); assert.ok(picks.includes(id), 'часть лежит в комнате: ' + id); }
  }
});
