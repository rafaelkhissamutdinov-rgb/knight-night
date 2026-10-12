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
  const { DIALOGUES } = await import('../src/story/dialogues.js');
  const flags = {};
  const d = new DialogueRunner(DIALOGUES, flags);
  assert.equal(d.start('ilia_meet').who, 'ilia');
  assert.ok(d.advance().choices);
  assert.equal(d.choose(0).text.includes('Илиа'), true);
  assert.equal(flags.asked_ilia_name, true);
  assert.equal(d.advance(), null);
  d.start('ilia_defeat');
  const lines = [d.current.text];
  while (d.advance()) lines.push(d.current.text);
  assert.equal(lines.length, 2, 'одна из двух прощальных реплик выпала по условию');
  assert.ok(lines[1].includes('имя'));
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
