import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { resolveImpact, attackOutcome } from '../src/combat.js';
import { Enemy } from '../src/enemy.js';

const at = (height, time) => ({ height, time });

test('нет защиты или не та высота — попадание', () => {
  assert.equal(resolveImpact({ height: 'high', time: 5, guard: null }, CONFIG), 'hit');
  assert.equal(resolveImpact({ height: 'high', time: 5, guard: 'mid', lastPress: at('mid', 4.95) }, CONFIG), 'hit');
});

test('нажал вовремя — идеальное парирование', () => {
  assert.equal(resolveImpact({ height: 'mid', time: 5, guard: 'mid', lastPress: at('mid', 4.9) }, CONFIG), 'perfect');
});

test('держал защиту заранее — обычный блок', () => {
  assert.equal(resolveImpact({ height: 'mid', time: 5, guard: 'mid', lastPress: at('mid', 4.5) }, CONFIG), 'block');
});

test('частое нажатие перед ударом не даёт идеального', () => {
  const r = resolveImpact({ height: 'low', time: 5, guard: 'low', lastPress: at('low', 4.95), prevPress: at('high', 4.85) }, CONFIG);
  assert.equal(r, 'block');
});

test('атака рыцаря зависит от состояния врага', () => {
  assert.equal(attackOutcome('stagger'), 'counter');
  assert.equal(attackOutcome('recover'), 'hit');
  assert.equal(attackOutcome('windup'), 'blocked');
  assert.equal(attackOutcome('idle'), 'blocked');
});

function run(enemy, hooks, until, maxTime = 20) {
  const dt = 1 / 60;
  for (let t = 0; t < maxTime; t += dt) {
    enemy.update(dt, hooks);
    if (until(enemy)) return t;
  }
  throw new Error(`не дождались, состояние ${enemy.state}`);
}

test('вся серия идеально — враг ошеломлён', () => {
  const e = new Enemy('guard', 100, () => 0.99); // последняя серия: две атаки
  const impacts = [];
  let staggered = false;
  e.engage(100);
  run(e, { impact: h => (impacts.push(h), 'perfect'), staggered: () => (staggered = true) }, x => x.state === 'stagger');
  assert.deepEqual(impacts, ['high', 'mid']);
  assert.ok(staggered);
});

test('хотя бы один блок в серии — только обычное окно для удара', () => {
  const e = new Enemy('guard', 100, () => 0.99);
  let n = 0;
  e.engage(100);
  run(e, { impact: () => (n++ === 0 ? 'perfect' : 'block') }, x => x.state === 'recover');
  assert.equal(n, 2);
});

test('враг не повторяет одну серию дважды подряд', () => {
  const e = new Enemy('merc', 0, () => 0);
  const a = e.pickCombo();
  const b = e.pickCombo();
  assert.notDeepEqual(a, b);
});

test('выпад добивает стражника за одну идеальную серию', () => {
  const e = new Enemy('guard', 0);
  e.takeHit(CONFIG.counterDamage);
  run(e, { impact: () => 'hit' }, x => x.state === 'dead');
  assert.equal(e.alive, false);
});
