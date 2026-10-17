// Бот: каркас главы 2 (v0.96) — скала → лес (гоблины, мародёры, боковая тропа к лагерю) → ворота деревни → конец каркаса.
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
  for (let i = 0; i < 900; i++) {
    const s = await st();
    if (!seen.has(s.room)) { seen.add(s.room); await p.waitForTimeout(400); await p.screenshot({ path: `${SH}/${s.room}.png`, clip: box }); console.log('room', s.room); }
    if (s.mode === 'end') break;
    if (s.mode === 'talk') { await p.keyboard.press('Enter'); await p.waitForTimeout(200); continue; }
    if (s.arena) { await p.evaluate(() => { for (const e of window.knightNight.enemies) if (e.alive && e.group === window.knightNight.arena?.index) e.damage(99); }); await p.waitForTimeout(300); continue; }
    if (s.room === 'forest2' && !seen.has('forest_camp') && Math.abs(s.x - 330) < 8) { await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW'); await p.waitForTimeout(1500); continue; }
    if (s.room === 'forest_camp') {   // лагерь: зачистить и назад на поляну
      const x = s.x; if (x > 60) { await p.keyboard.down('KeyA'); await p.waitForTimeout(200); await p.keyboard.up('KeyA'); continue; }
      await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW'); await p.waitForTimeout(1500); continue;
    }
    if ((s.room === 'village_gate' && s.x > 330) || (s.room === 'village' && s.x > 284)) { await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW'); await p.waitForTimeout(800); continue; }
    const key = s.room === 'forest2' && !seen.has('forest_camp') && s.x > 330 ? 'KeyA' : 'KeyD';
    await p.keyboard.down(key); await p.waitForTimeout(160); await p.keyboard.up(key);
  }
  const s = await st();
  console.log('end', JSON.stringify(s), [...seen].join(' '), await p.locator('#overlay-title').textContent());
  for (const r of ['cliff', 'forest1', 'forest2', 'forest_camp', 'forest3', 'village_gate', 'village']) if (!seen.has(r)) fail('не дошёл: ' + r);
  if (s.mode !== 'end') fail('нет конца каркаса');
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
