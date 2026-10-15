// Бот: «вайбовать» (v0.81) — места, отъезд кадра, живая картинка места. Снимки — KN_OUT/vibe.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/vibe'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const base = { trainer_gone: true, seen_wake: true, done_ilia: true, done_commander: true, balcony_done: true, seen_ilia_camp: true };
  const load = async (room, x, z, flags) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x, z, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z, hp: 10, coins: 0, bag: ['sword_old', 'journal'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: ['hall3:0', 'hall3:1', 'balcony:0', 'chapel:0', 'chapel:1'], flags, pickups: [] })), [room, x, z, { ...base, ...flags }]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await p.locator('#game-box').boundingBox() });
  const st = () => p.evaluate(() => { const g = window.knightNight; return { x: Math.round(g.player.x), z: Math.round(g.player.z), mode: g.mode, room: g.room, vibe: !!g.vibe, hint: document.querySelector('#hint')?.textContent, flags: Object.keys(g.flags).filter(f => f.startsWith('vibe_')).join(',') }; });
  const log = async t => console.log(t, JSON.stringify(await st()));
  const spots = [['hall3', 660, 20], ['chapel', 200, 10], ['camp', 160, 20], ['balcony', 300, 20]];
  let flags = {};
  for (const [room, x, z] of spots) {
    await load(room, x, z, flags); await p.waitForTimeout(400); await log(room + ' near');
    await p.keyboard.press('KeyV'); await p.waitForTimeout(1500); await shot(room + '_a'); await p.waitForTimeout(2500); await log(room + ' vibe'); await shot(room);
    await p.keyboard.press('Enter'); await p.waitForTimeout(1200); await log(room + ' back');
    flags = await p.evaluate(() => window.knightNight.flags);
  }
  console.log('errors', errors.filter(e => !e.includes('404')).slice(0, 10), errors.length); await b.close();
})();
