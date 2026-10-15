// Бот: души с сожалениями (v0.79) — священник и Серебряная чаша (вода, освящение, три исхода), служанка и письмо.
// Снимки — KN_OUT/souls.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/souls'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const base = { trainer_gone: true, seen_wake: true, done_ilia: true, balcony_done: true };
  const load = async (room, x, z, bag, flags) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x, z, bag, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z, hp: 10, coins: 0, bag, equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: ['hall:0', 'hall:1', 'hall:2', 'hall:3', 'hall:4', 'chapel:0'], flags, pickups: [] })), [room, x, z, bag, { ...base, ...flags }]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const box = () => p.locator('#game-box').boundingBox();
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await box() });
  const st = () => p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, room: g.room, line: g.talk?.current?.text?.slice(0, 50), hint: document.querySelector('#hint')?.textContent, bag: g.bag.join(','), npcs: (g.npcs ?? []).map(n => n.type).join(','), enemies: (g.enemies ?? []).filter(e => e.alive).map(e => e.type).join(','), flags: Object.keys(g.flags).filter(f => /cup|priest|maid|diary|path_/.test(f)).join(',') }; });
  const log = async t => console.log(t, JSON.stringify(await st()));
  const talkThrough = async () => { for (let i = 0; i < 16 && (await st()).mode === 'talk'; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(300); } };
  const untilChoice = async () => { for (let i = 0; i < 20; i++) { const s = await p.evaluate(() => ({ m: window.knightNight.mode, c: window.knightNight.talk?.current?.choices?.length ?? 0 })); if (s.m !== 'talk' || s.c) { await p.keyboard.press('Enter'); await p.waitForTimeout(300); return; } await p.keyboard.press('Enter'); await p.waitForTimeout(300); } };
  const go = async (x, z) => { await p.evaluate(([x, z]) => { const pl = window.knightNight.player; pl.x = x; pl.z = z; }, [x, z]); await p.waitForTimeout(300); };
  const door = async () => { await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(2600); };
  const npcE = async type => { await p.evaluate(t => { const g = window.knightNight, n = g.npcs.find(n => n.type === t); g.player.z = n.z; g.player.x = n.x - 6; }, type); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(600); };

  // 1. вода из лужи под капелью в Темнице
  await load('hall', 1600, 6, ['sword_old', 'silver_cup', 'sun_medallion'], {});
  await go(1640, 6); await log('puddle'); await shot('0_puddle');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400); await log('water');
  // 2. келья: знакомство
  await go(1560, 2); await door(); await log('cell'); await shot('1_cell');
  await npcE('priest'); await shot('2_meet'); await talkThrough(); await log('met');
  // 3. освящение на алтаре Часовни
  await load('chapel', 300, 4, ['sword_old', 'silver_cup', 'sun_medallion'], { cup_water: true, priest_met: true });
  await go(340, 4); await log('altar'); await p.keyboard.press('KeyE'); await p.waitForTimeout(900); await shot('3_sanctify'); await talkThrough(); await log('holy');
  // 4. исход Пилигрима: оставить чашу → уйти → вернуться: медальон очищен
  await load('priestcell', 120, 10, ['sword_old', 'silver_cup'], { cup_water: true, cup_holy: true, priest_met: true, cup_placed: true });
  await npcE('priest'); await untilChoice(); await shot('4_choice'); await p.keyboard.press('Digit1'); await p.waitForTimeout(500); await talkThrough(); await log('pilgrim');
  await go(56, 2); await door(); await log('left'); await go(1560, 2); await door(); await log('back'); await shot('5_after');
  await go(220, 10); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('pure');
  // 5. исход Призрака: злой призрак
  await load('priestcell', 120, 10, ['sword_old'], { priest_met: true, priest_done: true, priest_ghostpath: true, priest_left: true });
  await go(170, 10); await p.waitForTimeout(1500); await log('wrath'); await shot('6_wrath'); await talkThrough(); await log('fight');
  // 6. служанка: письмо из Столовой → страница IV
  await load('tower', 120, 10, ['sword_old'], {});
  await npcE('maid'); await shot('7_maid'); await talkThrough(); await log('maid asked');
  await load('dining', 260, 15, ['sword_old'], { maid_asked: true });
  await go(280, 15); await log('letter hint'); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await log('letter');
  await load('tower', 120, 10, ['sword_old', 'old_letter'], { maid_asked: true });
  await npcE('maid'); await talkThrough(); await log('итог'); await shot('8_maid_done');
  console.log('errors', errors.filter(e => !e.includes('404')).slice(0, 10), errors.length); await b.close();
})();
