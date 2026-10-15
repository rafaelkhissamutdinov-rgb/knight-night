// Бот-тестер Knight Night (tools/bots). Запуск: npm run bots (сервер поднимает check.sh). URL — KN_URL, снимки — KN_OUT.
// Полный проход первого этажа: камера → … → балкон → лестница. Бой ускорен: враги на встрече добиваются.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/full'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await p.goto((process.env.KN_URL || 'http://localhost:8080/')); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const box = await p.locator('#game-box').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const st = () => p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, room: g.room, x: Math.round(g.player.x), z: Math.round(g.player.z), hp: g.player.hp, arena: !!g.arena, coins: g.coins, tr: g.transition?.phase, talk: g.talk?.current?.text?.slice(0, 40), choices: document.querySelectorAll('#talk-choices button').length }; });
  const log = [];
  const tick = async () => {
    const s = await st();
    if (s.mode === 'talk') { await p.keyboard.press(s.choices ? 'Digit2' : 'Enter'); await p.waitForTimeout(150); return s; }
    if (s.arena) await p.evaluate(() => { const g = window.knightNight; g.player.hp = 10; for (const e of g.enemies) if (e.alive && e.state !== 'dormant') e.damage?.(99); });
    return s;
  };
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const route = ['cell', 'hall', 'gallery', 'corridor', 'dining', 'balcony'];
  let lastRoom = '';
  await p.keyboard.down('KeyD');
  for (let i = 0; i < 3000; i++) {
    const s = await tick();
    if (s.room !== lastRoom) { log.push(`${s.room} hp${s.hp} coins${s.coins}`); lastRoom = s.room; await p.screenshot({ path: `${SH}/${s.room}.png`, clip: box }); }
    if (s.room === 'balcony' && s.x > 330) break;
    if (s.mode === 'dead' || s.mode === 'end') { log.push('mode ' + s.mode); break; }
    await p.waitForTimeout(40);
  }
  await p.keyboard.up('KeyD');
  // добить командира, дослушать
  for (let i = 0; i < 200; i++) { const s = await tick(); if (!s.arena && s.mode === 'play' && i > 20) break; await p.waitForTimeout(60); }
  const flags = await p.evaluate(() => Object.keys(window.knightNight.flags));
  log.push('balcony_done ' + flags.includes('balcony_done'));
  // назад в столовую и наверх
  await p.keyboard.down('KeyA'); for (let i = 0; i < 300; i++) { const s = await tick(); if (s.room === 'dining') break; await p.waitForTimeout(40); } await p.keyboard.up('KeyA');
  await p.waitForTimeout(800);
  await p.evaluate(() => { const g = window.knightNight; g.player.x = 60; g.player.z = 0; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2200); await p.keyboard.up('KeyW'); await p.waitForTimeout(400);
  log.push('floor2 ' + (await st()).room);
  // второй этаж до лестницы на третий
  await p.keyboard.down('KeyD');
  for (let i = 0; i < 2000; i++) {
    const s = await tick();
    if (s.room !== lastRoom) { log.push(`${s.room} hp${s.hp} coins${s.coins}`); lastRoom = s.room; await p.screenshot({ path: `${SH}/${s.room}.png`, clip: box }); }
    if (s.room === 'stairs3' && s.x > 200) break;
    await p.waitForTimeout(40);
  }
  await p.keyboard.up('KeyD');
  await p.evaluate(() => { const g = window.knightNight; g.player.x = 220; g.player.z = 0; });
  const shot = n => p.screenshot({ path: `${SH}/${n}.png`, clip: box });
  const st3 = () => p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, room: g.room, x: Math.round(g.player.x), arena: !!g.arena, tr: g.transition?.kind, bag: g.bag.join(','), hint: document.getElementById('hint').textContent }; });
  const kill = () => p.evaluate(() => { const g = window.knightNight; g.player.hp = 10; for (const e of g.enemies) if (e.alive && e.awake) e.damage?.(99); });
  const talk = async () => { for (let i = 0; i < 8; i++) { if ((await st3()).mode !== 'talk') return; await p.keyboard.press('Enter'); await p.waitForTimeout(150); } };
  const walkTo = async (x) => { for (let i = 0; i < 600; i++) { const s = await st3(); if (s.mode === 'talk') { await talk(); continue; } if (s.arena) { await kill(); } if (Math.abs(s.x - x) < 6 && !s.arena) break; const k = s.x < x ? 'KeyD' : 'KeyA'; await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); } };
  const door = async () => { await p.evaluate(() => { window.knightNight.player.z = 0; }); await p.keyboard.down('KeyW'); await p.waitForTimeout(2300); await p.keyboard.up('KeyW'); await p.waitForTimeout(300); };
  await door(); console.log('1', (await st3()).room); await shot('1-landing3');
  await p.keyboard.down('KeyD'); for (let i = 0; i < 400; i++) { const s = await st3(); if (s.mode === 'talk') { await p.keyboard.up('KeyD'); await talk(); await p.keyboard.down('KeyD'); } if (s.arena) await kill(); if (s.room === 'hall3') break; await p.waitForTimeout(40); } await p.keyboard.up('KeyD');
  await p.waitForTimeout(500); console.log('2', (await st3()).room);
  await walkTo(420); await door(); console.log('3', (await st3()).room);
  await walkTo(300); await p.waitForTimeout(500); await talk(); for (let i = 0; i < 30; i++) { await kill(); await p.waitForTimeout(100); if (!(await st3()).arena && i > 5) break; }
  await shot('3-guardhall'); await walkTo(446); await p.evaluate(() => { window.knightNight.player.z = 3; }); await p.keyboard.press('KeyE'); await p.waitForTimeout(300); console.log('key', (await st3()).bag);
  await walkTo(56); await door(); console.log('4', (await st3()).room);
  await walkTo(1240); await door(); console.log('rubble', (await st3()).hint, await p.locator('#callout').textContent()); await shot('4-rubble');
  await walkTo(780); console.log('pit hint', (await st3()).hint); await shot('5-pit');
  await p.evaluate(() => { window.knightNight.player.z = 0; }); await p.keyboard.down('KeyW'); await p.waitForTimeout(300); await p.keyboard.up('KeyW'); await p.waitForTimeout(350); await shot('6-falling'); await p.waitForTimeout(800);
  console.log('5', await st3()); await shot('7-landed');
  await walkTo(1114); await door(); console.log('6', (await st3()).room);
  await walkTo(194); await p.evaluate(() => { window.knightNight.player.z = 0; }); await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW'); await p.waitForTimeout(2600);
  await p.waitForTimeout(1200); console.log('7', (await st3()).room); await p.evaluate(() => { window.knightNight.player.x = 140; });
  for (let i = 0; i < 120; i++) { const s = await st3(); if (s.mode === 'end') break; if (s.mode === 'talk') { await talk(); continue; } if (s.arena) await kill(); await p.waitForTimeout(150); }
  console.log('end', (await st3()).mode, await p.locator('#overlay-title').textContent());
  log.push('chapter end ' + await p.locator('#overlay-title').textContent());
  const end = await st(); log.push('end mode ' + end.mode + ' ' + await p.locator('#overlay-title').textContent());
  await p.screenshot({ path: `${SH}/end.png`, clip: box });
  console.log(log.join('\n')); console.log('errors', errors);
  await b.close();
})();
