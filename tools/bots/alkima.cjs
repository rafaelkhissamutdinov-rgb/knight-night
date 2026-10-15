// Бот: квест Алкимы (v0.78) — встреча в гардеробной, выбор пути, сказание (режим рассказа), задание,
// ткань с мародёра Северного крыла, награда. Снимки — KN_OUT/alkima.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/alkima'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const URL = process.env.KN_URL || 'http://localhost:8080/';
  await p.goto(URL); await p.waitForTimeout(200);
  await p.evaluate(() => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: 'hall3', x: 150, z: 4, hp: 10, coins: 0, bag: ['sword_old', 'rapier'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword', 'rapier'], cleared: [], flags: { trainer_gone: true, seen_wake: true, done_ilia: true, balcony_done: true }, pickups: [] })));
  await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const box = await p.locator('#game-box').boundingBox();
  const shot = n => p.screenshot({ path: `${SH}/${n}.png`, clip: box });
  const st = () => p.evaluate(() => { const g = window.knightNight, l = g.talk?.current; return { mode: g.mode, room: g.room, story: g.storyView ? g.storyView.i : null, who: l?.who, line: l?.text?.slice(0, 50), choices: l?.choices?.length ?? 0, bag: g.bag.join(','), flags: Object.keys(g.flags).filter(f => /alkima|path_|erinner/.test(f)).map(f => f + '=' + g.flags[f]).join(',') }; });
  const log = async t => console.log(t, JSON.stringify(await st()));
  // до выбора: Enter, пока у реплики нет вариантов (выход — если разговор кончился)
  const untilChoice = async () => { for (let i = 0; i < 40; i++) { const s = await st(); if (s.mode !== 'talk' || s.story !== null) return s; if (s.choices) { await p.keyboard.press('Enter'); await p.waitForTimeout(300); return st(); } await p.keyboard.press('Enter'); await p.waitForTimeout(350); } return st(); };
  const choose = async n => { await p.keyboard.press('Digit' + n); await p.waitForTimeout(500); };
  // дверь гардеробной в Северном крыле
  await p.evaluate(() => { window.knightNight.player.x = 205; window.knightNight.player.z = 2; }); await p.waitForTimeout(300);
  await shot('0_hall3_door'); await log('door hint ' + await p.evaluate(() => window.knightNight.hint));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(2500);
  await log('enter'); await shot('1_meet');
  await untilChoice(); await shot('2_trust'); await choose(3);                 // путь Пилигрима
  await untilChoice(); await log('hub'); await choose(2);                      // редкие ткани
  await untilChoice(); await choose(1);                                        // впитывать магию?
  await untilChoice(); await choose(1);                                        // да, послушать
  await p.waitForTimeout(1500); await log('story');
  for (let i = 0; i < 12 && (await st()).story !== null; i++) {
    await p.waitForTimeout(1600); await p.keyboard.press('Enter'); await p.waitForTimeout(300); await shot('3_story_' + i); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  }
  await log('after story');
  await untilChoice(); await log('hub2'); await choose(4);                     // помощь → задание
  await untilChoice(); await choose(5);                                        // пойду
  await p.waitForTimeout(600); await log('quest'); await shot('4_room');
  // мародёр в Северном крыле роняет ткань
  await p.evaluate(() => { const g = window.knightNight; g.player.x = 56; g.player.z = 2; }); await p.waitForTimeout(200);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(2500);
  await log('back in hall3');
  await p.evaluate(() => { const g = window.knightNight; g.player.x = 560; }); await p.waitForTimeout(2500);
  await p.evaluate(() => { for (const e of window.knightNight.enemies) if (e.alive && ['merc', 'spear', 'crossbow'].includes(e.type)) { e.hp = 1; } });
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.knightNight.bag.includes('old_fabric'))); i++) {
    await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive && ['merc', 'spear', 'crossbow'].includes(e.type)); if (e) { e.hp = 1; g.player.x = e.x - 26; g.player.z = e.z; g.player.facing = 1; } });
    await p.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.6); await p.waitForTimeout(400);
  }
  await log('fabric?'); await shot('5_fabric');
  // назад к Алкиме
  await p.evaluate(() => { const g = window.knightNight; g.enemies.forEach(e => { e.alive = false; }); g.player.x = 205; g.player.z = 2; }); await p.waitForTimeout(300);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.knightNight, n = g.npcs[0]; g.player.z = n.z; g.player.x = n.x - 18; }); await p.waitForTimeout(300);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800); await log('found'); await shot('6_found');
  await untilChoice(); await choose(1); await untilChoice(); await p.waitForTimeout(500);
  await log('итог');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800); await log('after'); await p.keyboard.press('Escape');
  console.log('errors', errors.filter(e => !e.includes('404')).slice(0, 10), errors.length); await b.close();
})();
