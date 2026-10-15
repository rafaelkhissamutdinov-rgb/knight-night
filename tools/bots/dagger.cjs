// Бот: кинжал (v0.82) — лежит в Зале стражи, Q — сменить, рывок проскакивает сквозь врага, удар в спину ×3, «Шквал».
// Снимки — KN_OUT/dagger.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/dagger'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const base = { trainer_gone: true, seen_wake: true, done_ilia: true, done_commander: true };
  const load = async (room, x, z, bag, equip, cleared) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x, z, bag, equip, cleared, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z, hp: 10, coins: 0, bag, equip, unlocked: ['sword'], cleared, flags, pickups: [] })), [room, x, z, bag, equip, cleared, base]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await p.locator('#game-box').boundingBox() });
  const st = () => p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); return { room: g.room, weapon: g.player.weapon, x: Math.round(g.player.x), hint: document.querySelector('#hint')?.textContent, callout: document.querySelector('#callout')?.textContent, bag: g.bag.join(','), foe: e && { type: e.type, x: Math.round(e.x), hp: e.hp, facing: e.facing, state: e.state }, backstab: g.stats.backstab ?? 0 }; });
  const log = async t => console.log(t, JSON.stringify(await st()));
  // 1. лежит в Зале стражи: подобрать
  await load('guardhall', 286, 12, ['sword_old'], { weapon: 'sword_old', armor: 'armor_old' }, ['guardhall:0']);
  await log('near'); await shot('0_lying');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300); await log('picked');
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(400); await log('switched'); await shot('1_inhand');
  // 2. бой: проскочить сквозь врага рывком и ударить в спину
  await load('landing2', 250, 20, ['sword_old'], { weapon: 'dagger', armor: 'armor_old' }, []);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD'); await p.waitForTimeout(400); await log('fight');
  for (let i = 0; i < 8; i++) {
    const s = await st(); if (!s.foe) break;
    await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); g.player.z = e.z; g.player.facing = Math.sign(e.x - g.player.x) || 1; });
    const toward = (await st()).foe.x > (await st()).x ? 'KeyD' : 'KeyA';
    await p.keyboard.down(toward); await p.keyboard.press('Space'); await p.waitForTimeout(260); await p.keyboard.up(toward);
    await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); if (e) g.player.facing = Math.sign(e.x - g.player.x) || 1; });
    await p.keyboard.press('KeyJ'); await p.waitForTimeout(120); if (i === 0) await shot('2_backstab');
    await p.waitForTimeout(500); await log('round ' + i);
  }
  await shot('3_after');
  // 3. Шквал на колесе
  await load('landing2', 250, 20, ['sword_old'], { weapon: 'dagger', armor: 'armor_old' }, []);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD'); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); g.player.z = e.z; g.player.x = e.x - 18; g.player.facing = 1; g.player.spinCharge = 1; });
  await p.mouse.move(700, 450); await p.mouse.wheel(0, -100); await p.waitForTimeout(250); await shot('4_flurry'); await p.waitForTimeout(600); await log('flurry');
  console.log('errors', errors.filter(e => !e.includes('404')).slice(0, 10), errors.length); await b.close();
})();
