// Бот-тестер Knight Night (tools/bots). Запуск: npm run bots (сервер поднимает check.sh). URL — KN_URL, снимки — KN_OUT.
// поиск зависаний: случайные действия из заданной комнаты; ловим ошибки, застрявшие переходы, остановку времени
const { chromium } = require('playwright');
const [room, xs, n] = [process.argv[2] || 'dining', +(process.argv[3] || 100), +(process.argv[4] || 700)];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  p.on('console', m => ((m.type() === 'error' && !m.text().includes('404')) || m.text().includes('thick')) && errs.push('console: ' + m.text().slice(0, 300)));
  await p.goto((process.env.KN_URL || 'http://localhost:8080/')); await p.waitForTimeout(200);
  await p.evaluate(([r, x]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: r, x, z: 10, hp: 10, coins: 200, bag: ['sword_old', 'rapier', 'map', 'key_tower'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword', 'rapier'], cleared: [], flags: { trainer_gone: true, seen_wake: true, done_ilia: true, balcony_done: true }, pickups: [] })), [room, xs]);
  await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const box = await p.locator('#game-box').boundingBox();
  const keys = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyE', 'KeyQ', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'KeyH'];
  let last = null; const issues = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.4) { const k = keys[Math.floor(Math.random() * keys.length)]; await p.keyboard.down(k); await p.waitForTimeout(30 + Math.random() * 250); await p.keyboard.up(k); }
    else if (r < 0.62) { await p.mouse.move(box.x + box.width * Math.random(), box.y + box.height * (0.3 + 0.6 * Math.random())); await p.mouse.down(); await p.waitForTimeout(40 + Math.random() * 300); await p.mouse.up(); }
    else if (r < 0.75) { await p.mouse.down({ button: 'right' }); await p.waitForTimeout(100 + Math.random() * 300); await p.mouse.up({ button: 'right' }); }
    else if (r < 0.8) { await p.mouse.wheel(0, Math.random() < 0.5 ? -120 : 120); }
    else { const k = Math.random() < 0.5 ? 'KeyD' : 'KeyA'; await p.keyboard.down(k); await p.waitForTimeout(300 + Math.random() * 900); await p.keyboard.up(k); }
    if (i % 20 === 0) {
      const s = await p.evaluate(() => { const g = window.knightNight; return { t: g.time, mode: g.mode, room: g.room, tr: g.transition ? g.transition.kind + ':' + g.transition.phase + ':' + (g.transition.t ?? 0).toFixed(1) : null, ps: g.player.state, hp: g.player.hp }; });
      if (s.mode === 'play' && last && s.t === last.t) issues.push('время стоит ' + JSON.stringify(s));
      if (s.tr && last?.tr && s.tr.split(':').slice(0, 2).join() === last.tr.split(':').slice(0, 2).join() && parseFloat(s.tr.split(':')[2]) > 6) issues.push('переход застрял ' + JSON.stringify(s));
      if (s.mode === 'dead') { await p.keyboard.press('Enter'); }
      // застрял ли: свободен, но не сдвигается ни влево, ни вправо
      const free = await p.evaluate(() => { const g = window.knightNight; return g.mode === 'play' && !g.transition && !g.rest && !g.cutscene && !g.talk && g.player.state === 'ready'; });
      if (free) {
        const x0 = await p.evaluate(() => window.knightNight.player.x);
        await p.keyboard.down('KeyD'); await p.waitForTimeout(450); await p.keyboard.up('KeyD');
        const x1 = await p.evaluate(() => window.knightNight.player.x);
        await p.keyboard.down('KeyA'); await p.waitForTimeout(450); await p.keyboard.up('KeyA');
        const x2 = await p.evaluate(() => window.knightNight.player.x);
        if (Math.abs(x1 - x0) < 1 && Math.abs(x2 - x1) < 1) {
          const info = await p.evaluate(() => { const g = window.knightNight, pl = g.player; return { room: g.room, x: pl.x, z: pl.z, st: pl.state, t: pl.t, sheathed: pl.sheathed, broken: pl.broken, arena: g.arena && { key: g.arena.key }, cur: g.current && { type: g.current.type, st: g.current.state, x: g.current.x, alive: g.current.alive }, hitstop: g.hitstop, mode: g.mode, speedMult: pl.speedMult, enemies: g.enemies.filter(e => e.alive).map(e => e.type + ':' + e.state + ':' + Math.round(e.x)) }; });
          issues.push('ЗАСТРЯЛ ' + JSON.stringify(info));
        }
      }
      const stuckState = await p.evaluate(() => { const pl = window.knightNight.player; return pl.state !== 'ready' && pl.t > 5 ? pl.state + ':' + pl.t.toFixed(1) : null; });
      if (stuckState) issues.push('СОСТОЯНИЕ ' + stuckState);
      last = s;
      if (errs.length || issues.length > 4) break;
    }
  }
  console.log(room, 'итог', JSON.stringify(last), 'issues', issues.slice(0, 3), 'errors', errs.slice(0, 3));
  await b.close();
})();
