// Бот: глава 2 (v1.0) — скала → лес → тропа в деревню → город прямо (ремёсла, рынок, ворота) → лес за городом с боковыми комнатами → конец.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/chapter2'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
  await p.evaluate(() => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: 'cliff', x: 60, z: 10, hp: 10, coins: 0, bag: ['sword_old', 'broken_mask'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { seen_wake: true, trainer_gone: true, chapter: 2, chapter1_done: true }, pickups: [] })));
  await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const box = await p.locator('#game-box').boundingBox();
  const st = () => p.evaluate(() => { const g = window.knightNight; return { room: g.room, x: Math.round(g.player.x), mode: g.mode, arena: !!g.arena, tr: !!g.transition }; });
  const seen = new Set();
  await p.evaluate(() => { window.knightNight.god = true; });
  for (let i = 0; i < 2400; i++) {
    const s = await st();
    if (!seen.has(s.room)) { seen.add(s.room); await p.waitForTimeout(400); await p.screenshot({ path: `${SH}/${s.room}.png`, clip: box }); console.log('room', s.room); }
    if (s.mode === 'end') break;
    if (s.mode === 'talk') { await p.keyboard.press('Enter'); await p.waitForTimeout(200); continue; }
    if (s.arena) { await p.evaluate(() => { for (const e of window.knightNight.enemies) if (e.alive && e.group === window.knightNight.arena?.index) e.damage(99); }); await p.waitForTimeout(300); continue; }
    // v1.0: тропы по картинке — W в зоне тропы; боковые комнаты леса за городом: зайти, зачистить, вернуться
    const W = async () => { await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW'); await p.waitForTimeout(1800); };
    const side = { forest_e1: ['forest_brook', 230], forest_e3: ['forest_camp', 120] }[s.room];
    if (side && !seen.has(side[0]) && Math.abs(s.x - side[1]) < 10) { await W(); continue; }
    if (['forest_brook', 'forest_camp'].includes(s.room)) {
      const back = s.room === 'forest_camp' ? 50 : 60;
      if (s.x > back + 8) { await p.keyboard.down('KeyA'); await p.waitForTimeout(200); await p.keyboard.up('KeyA'); continue; }
      await W(); continue;
    }
    if ((s.room === 'village_gate' && s.x > 246) || (s.room === 'town_gate' && s.x > 222) || (s.room === 'forest_e3' && s.x > 600)) { await W(); continue; }
    const key = (s.room === 'village_gate' && s.x > 262) || (s.room === 'town_gate' && s.x > 236) ? 'KeyA' : 'KeyD';
    await p.keyboard.down(key); await p.waitForTimeout(160); await p.keyboard.up(key);
  }
  const s = await st();
  console.log('end', JSON.stringify(s), [...seen].join(' '), await p.locator('#overlay-title').textContent());
  for (const r of ['cliff', 'forest1', 'forest2', 'forest3', 'village_gate', 'village', 'town_cross', 'town_crafts', 'town_market', 'town_gate', 'forest_e1', 'forest_brook', 'forest_e2', 'forest_e3', 'forest_camp']) if (!seen.has(r)) fail('не дошёл: ' + r);
  if (s.mode !== 'end') fail('нет конца каркаса');
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
