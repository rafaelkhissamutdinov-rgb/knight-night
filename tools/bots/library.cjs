// Бот: Старая библиотека (v0.78) — подъём по лестнице Темницы, свеча, кот Фуджин и рыбка → страница II;
// страница I на балконе после королевского стража. Снимки — KN_OUT/library.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/library'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const load = async (room, x, bag, flags) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x, bag, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z: 2, hp: 10, coins: 0, bag, equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { trainer_gone: true, seen_wake: true, done_ilia: true, balcony_done: true, ...flags }, pickups: [] })), [room, x, bag, flags]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const box = () => p.locator('#game-box').boundingBox();
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await box() });
  const st = () => p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, room: g.room, line: g.talk?.current?.text?.slice(0, 60), hint: document.querySelector('#hint')?.textContent, bag: g.bag.join(','), flags: Object.keys(g.flags).filter(f => /fujin|lib_|diary|given/.test(f)).join(',') }; });
  const log = async t => console.log(t, JSON.stringify(await st()));
  const talkThrough = async () => { for (let i = 0; i < 12 && (await st()).mode === 'talk'; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(350); } };
  const go = async (x, z) => { await p.evaluate(([x, z]) => { const pl = window.knightNight.player; pl.x = x; pl.z = z; }, [x, z]); await p.waitForTimeout(300); };
  // 1. лестница в конце Темницы
  await load('hall', 2290, ['sword_old', 'dried_fish'], { done_ilia: true });
  await go(2306, 0); await log('stairs'); await shot('0_stairs');
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(4500);
  await log('up'); await shot('1_dark');
  // 2. свеча
  await go(240, 12.6); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('candle'); await talkThrough(); await p.waitForTimeout(400); await shot('2_lit');
  // 3. кот: знакомство, рыбка
  const cat = await p.evaluate(() => window.knightNight.npcs.find(n => n.type === 'fujin')?.x);
  await go(cat - 4, 12.5); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('meet'); await shot('3_meet'); await talkThrough();
  await go(cat - 4, 12.5); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('feed'); await talkThrough();
  await p.waitForTimeout(500); await log('fed'); await talkThrough(); await shot('4_fed');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('after'); await talkThrough();
  // 4. балкон: страница I после королевского стража
  await load('balcony', 200, ['sword_old'], { done_commander: true });
  await go(280, 20); await shot('5_balcony'); await log('balcony');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(600); await log('page1'); await shot('6_page1'); await talkThrough();
  await log('итог');
  console.log('errors', errors.filter(e => !e.includes('404')).slice(0, 10), errors.length); await b.close();
})();
