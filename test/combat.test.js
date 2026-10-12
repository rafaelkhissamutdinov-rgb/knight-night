import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, WEAPON } from '../src/config.js';
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
    player: { x: px },
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
