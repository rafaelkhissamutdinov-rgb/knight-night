// Бот: обратный путь (v0.86). Зачищенная комната пустая до отдыха; повторный бой не запирает — можно пробежать мимо;
// отдых возвращает обычных врагов. Снимки — KN_OUT/backtrack.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/backtrack'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const base = { trainer_gone: true, seen_wake: true, card_2: true, card_3: true };
  const load = async (room, x, cleared, flags = {}) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x, cleared, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z: 14, hp: 10, coins: 0, bag: ['sword_old'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared, flags, pickups: [] })), [room, x, cleared, { ...base, ...flags }]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    await p.evaluate(() => { window.knightNightDebug.timeScale = 2; });
  };
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await p.locator('#game-box').boundingBox() });
  const st = () => p.evaluate(() => { const g = window.knightNight; return { room: g.room, x: Math.round(g.player.x), arena: g.arena && { key: g.arena.key, open: !!g.arena.open }, alive: g.enemies.filter(e => e.alive).map(e => e.group), cleared: [...g.cleared].join(','), hint: document.querySelector('#hint')?.textContent }; });
  const log = async t => { const s = await st(); console.log(t, JSON.stringify(s)); return s; };
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  const run = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };

  // 1. Первая встреча — арена заперта
  await load('gallery', 380, []);
  await run('KeyD', 1400); let s = await log('first');
  if (!s.arena || s.arena.open) fail('первый бой должен запирать');
  await run('KeyD', 2500); s = await log('first_run');
  if (s.x > 700 + 150 + 2) fail('из запертой арены вышел за край: ' + s.x);
  await shot('0_locked');

  // 2. Повторная встреча (побеждена раньше, вернулась после отдыха) — открыта: пробежать мимо до края комнаты
  await load('gallery', 380, [], { 'beat_gallery:0': true });
  await run('KeyD', 1400); s = await log('repeat');
  if (!s.arena?.open) fail('повторный бой не должен запирать');
  await shot('1_open');
  for (let i = 0; i < 12 && (await st()).room === 'gallery'; i++) { await p.keyboard.down('KeyD'); await p.keyboard.press('Space'); await p.waitForTimeout(500); await p.keyboard.up('KeyD'); }
  await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD');
  s = await log('ran_past');
  if (s.room === 'gallery' && s.x < 860) fail('не пробежал мимо: x ' + s.x);

  // 3. Зачищено — пусто, даже после долгого времени; отдых возвращает
  await load('gallery', 380, ['gallery:0'], { 'beat_gallery:0': true });
  await p.evaluate(() => { window.knightNight.time += 1000; });
  s = await log('cleared');
  if (s.alive.length) fail('зачищенная комната не пустая');
  await load('shop', 122, ['gallery:0', 'hall:1', 'lair:1'], { 'beat_gallery:0': true, done_ataman: true });
  await p.keyboard.press('KeyE'); await p.waitForTimeout(500); s = await log('rest');
  if (s.cleared.includes('gallery:0') || s.cleared.includes('hall:1')) fail('отдых не вернул обычных врагов');
  if (!s.cleared.includes('lair:1')) fail('сюжетный бой вернулся после отдыха');
  await shot('2_rest');
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
