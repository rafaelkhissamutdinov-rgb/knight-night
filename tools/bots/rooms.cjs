// Бот-тестер Knight Night (tools/bots). Запуск: npm run bots (сервер поднимает check.sh). URL — KN_URL, снимки — KN_OUT.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/rooms'; require('fs').mkdirSync(SH, { recursive: true });
const rooms = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  for (const room of rooms) {
    const [id, x] = room.split(':');
    await p.goto((process.env.KN_URL || 'http://localhost:8080/')); await p.waitForTimeout(200);
    await p.evaluate(([id, x]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: id, x: +(x ?? 160), z: 10, hp: 10, coins: 0, bag: ['sword_old','rapier','map','key_tower'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { trainer_gone: true, seen_wake: true, done_ilia: true, balcony_done: true }, pickups: [] })), [id, x]);
    await p.reload(); await p.waitForTimeout(700); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    for (let i = 0; i < 30 && await p.evaluate(() => window.knightNight.mode === 'talk'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
    const box = await p.locator('#game-box').boundingBox();
    await p.screenshot({ path: `${SH}/${id}_${x}.png`, clip: box });
  }
  console.log("errors", errors.filter(e => !e.includes("404")).slice(0, 10), errors.length); await b.close();
})();
