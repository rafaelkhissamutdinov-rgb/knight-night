// Бот: бой без автонаведения (v0.93, решение владельца). Рыцарь сам не разворачивается к врагу; A / D и курсор
// поворачивают; с защитой (ПКМ) смотрит на курсор — можно пятиться; пробел — рывок туда, куда смотрит.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
  await p.evaluate(() => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: 'gallery', x: 520, z: 14, hp: 10, coins: 0, bag: ['sword_old'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { trainer_gone: true, seen_wake: true }, pickups: [] })));
  await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const box = await p.locator('#game').boundingBox();
  const st = () => p.evaluate(() => { const g = window.knightNight; const e = g.enemies.find(e => e.alive); return { x: Math.round(g.player.x), facing: g.player.facing, state: g.player.state, arena: !!g.arena, ex: e && Math.round(e.x), cam: Math.round(g.camX) }; });
  const mouseAt = async dxWorld => { const s = await st(); await p.mouse.move(box.x + (s.x - s.cam + dxWorld) / 320 * box.width, box.y + box.height * 0.62); };
  await p.evaluate(() => { window.knightNight.player.hp = 99; });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD'); await p.waitForTimeout(200);
  let s = await st(); console.log('start', JSON.stringify(s));
  if (!s.arena) fail('бой не начался');
  // 1. A — смотрит влево и не разворачивается сам, хотя враг справа
  await p.keyboard.down('KeyA'); await p.waitForTimeout(120); await p.keyboard.up('KeyA');
  await p.evaluate(() => { window.knightNight.player.hp = 99; });
  await p.waitForTimeout(1500);
  s = await st(); console.log('keyA', JSON.stringify(s));
  if (s.facing !== -1) fail('после A рыцарь развернулся сам (автонаведение)');
  // 2. курсор вправо от рыцаря — разворот
  await mouseAt(-14); await p.waitForTimeout(150); await mouseAt(60); await p.waitForTimeout(200);
  s = await st(); console.log('cursor', JSON.stringify(s), JSON.stringify(await p.evaluate(() => ({ mx: window.knightNight.mouseX, side: window.knightNight.cursorSide, by: window.knightNight.faceBy, my: window.knightNight.mouseY }))));
  if (s.facing !== 1) fail('курсор справа не развернул');
  // 3. защита + A: пятится, глядя вправо (на курсор)
  const x0 = s.x;
  await p.mouse.down({ button: 'right' }); await p.keyboard.down('KeyA'); await p.waitForTimeout(500);
  s = await st(); await p.keyboard.up('KeyA'); await p.mouse.up({ button: 'right' });
  console.log('backpedal', JSON.stringify(s));
  if (s.facing !== 1 || s.x >= x0) fail('с защитой не пятится лицом к курсору');
  // 4. D + пробел — рывок вправо (туда, куда смотрит); у стены арены слева места нет, поэтому вправо
  await p.evaluate(() => { window.knightNight.player.hp = 99; });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(200);
  const x1 = (await st()).x;
  await p.keyboard.press('Space'); await p.waitForTimeout(350); await p.keyboard.up('KeyD');
  s = await st(); console.log('dash', JSON.stringify(s), 'from', x1);
  if (s.facing !== 1 || s.x < x1 + 15) fail('рывок не туда, куда смотрит');
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
