// Бот: конец главы 1 (v0.95) — сцена после победы над боссом (мирный исход и казнь), портал, дневной замок;
// маска — шаг призрака (F) за спину врага. Снимки — KN_OUT/ending.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/ending'; require('fs').mkdirSync(SH, { recursive: true });
const PEACE = ['diary_1', 'diary_2', 'diary_3', 'diary_4', 'diary_full', 'resin_flower', 'heart_half'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  const url = process.env.KN_URL || 'http://localhost:8080/';
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await p.locator('#game-box').boundingBox() });
  const load = async (room, x, bag, equip = {}, flags = {}) => {
    await p.goto(url); await p.waitForTimeout(200);
    await p.evaluate(([room, x, bag, equip, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z: 20, hp: 10, coins: 0, bag, equip: { weapon: 'sword_old', armor: 'armor_old', ...equip }, unlocked: ['sword'], cleared: [], flags: { seen_wake: true, trainer_gone: true, ...flags }, pickups: [] })), [room, x, bag, equip, flags]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const st = () => p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, room: g.room, ending: g.ending && { phase: g.ending.phase, t: +g.ending.t.toFixed(1), bt: g.ending.at == null ? -1 : g.ending.t - g.ending.at + 0.8, peace: g.ending.peace }, story: !!g.storyView, x: Math.round(g.player.x), flags: { pilgrim: g.flags.path_pilgrim, ghost: g.flags.path_ghost, egoist: g.flags.path_egoist, ending: g.flags.ending }, mask: g.bag.includes('broken_mask') }; });

  for (const peace of [true, false]) {
    const tag = peace ? 'peace' : 'exec';
    await load('mage', 120, ['sword_old', ...(peace ? PEACE : ['resin_flower'])], {}, { path_ghost: 2, path_last: 'ghost' });
    await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
    for (let i = 0; i < 30 && (await st()).mode === 'talk'; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
    await p.evaluate(() => { const e = window.knightNight.enemies.find(e => e.kind === 'boss'); window.knightNight.god = true; e.damage(999); });
    let s;
    for (let i = 0; i < 60; i++) {   // разговор после боя: листать
      s = await st();
      if (s.ending) break;
      if (s.mode === 'talk') await p.keyboard.press((await p.locator('#talk-choices button').count()) ? 'Digit1' : 'Enter');   // в конце разговора — выбор
      await p.waitForTimeout(250);
    }
    console.log(tag, 'start', JSON.stringify(s));
    if (!s.ending || s.ending.peace !== peace) { fail(`${tag}: сцена конца не началась`); continue; }
    // кат-сцена кадрами: снимки кадров, потом — снова игра, лестница наверх, покои, окно (E)
    for (let f = 0; f < (peace ? 7 : 4); f++) {
      for (let i = 0; i < 100; i++) { const c = await p.evaluate(() => window.knightNight.ending?.i ?? 99); if (c >= f) break; await p.waitForTimeout(50); }
      await p.waitForTimeout(300); await shot(`${tag}_cine_${f}`);
    }
    for (let i = 0; i < 200 && (await st()).ending; i++) await p.waitForTimeout(50);
    s = await st(); console.log(tag, 'after cine', JSON.stringify(s));
    if (!s.mask) fail(`${tag}: маска не получена`);
    await p.waitForTimeout(800);
    // к лестнице наверх и в покои
    await p.evaluate(() => { const g = window.knightNight; g.player.x = 420; g.player.z = 10; });
    await p.waitForTimeout(300);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW');
    for (let i = 0; i < 80 && (await st()).room !== 'princess'; i++) await p.waitForTimeout(100);
    await p.waitForTimeout(1500);
    s = await st(); console.log(tag, 'princess', JSON.stringify(s));
    if (s.room !== 'princess') { fail(`${tag}: не поднялся в покои принцессы`); await p.evaluate(() => window.knightNightDebug.goRoom?.('princess')); }
    await shot(`${tag}_princess`);
    await p.evaluate(() => { const g = window.knightNight; g.player.x = 262; g.player.z = 8; });
    await p.waitForTimeout(400);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    console.log(tag, 'after E', JSON.stringify(await p.evaluate(() => { const g = window.knightNight; return { mode: g.mode, cur: g.talk?.current?.text?.slice(0, 30), hidden: document.querySelector('#talk').hidden, story: !!g.storyView, vibe: !!g.vibe }; })));
    for (let i = 0; i < 40 && (await st()).mode === 'talk'; i++) { await p.keyboard.press((await p.locator('#talk-choices button').count()) ? 'Digit1' : 'Enter'); await p.waitForTimeout(300);
      if (process.env.DBG) console.log(JSON.stringify(await p.evaluate(() => ({ m: window.knightNight.mode, cur: window.knightNight.talk?.current?.text?.slice(0, 20), dom: document.querySelector('#talk-text').textContent.slice(0, 20), shown: window.knightNight.talkShown, la: performance.now() - window.knightNight.lineAt, af: document.activeElement?.className })))); }
    console.log(tag, 'window talk', await p.evaluate(() => document.querySelector('#talk-text').textContent.slice(0, 60)));
    for (let i = 0; i < 200 && (await st()).ending?.phase !== 'portal'; i++) await p.waitForTimeout(50);
    s = await st(); console.log(tag, 'portal', JSON.stringify(s));
    if (s.room !== 'cell') fail(`${tag}: не перенёсся к порталу`);
    for (const at of [2.0, 3.6, 4.8, 5.8, 6.6]) {
      for (let i = 0; i < 200; i++) { s = await st(); if (!s.ending || s.ending.t >= at) break; await p.waitForTimeout(50); }
      await shot(`${tag}_portal_${at}`);
    }
    for (let i = 0; i < 100 && !(await st()).story; i++) await p.waitForTimeout(50);
    await p.waitForTimeout(1500); await shot(`${tag}_day`);
    for (let i = 0; i < 10 && (await st()).story; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(500); }   // на экране конца Enter — новая игра: жать только в рассказе
    for (let i = 0; i < 20 && (await st()).mode !== 'end'; i++) await p.waitForTimeout(100);
    s = await st(); console.log(tag, 'end', JSON.stringify(s));
    if (s.mode !== 'end') fail(`${tag}: нет экрана конца главы`);
    if (!s.mask) fail(`${tag}: маска не получена`);
    if (peace && s.flags.pilgrim !== 5) fail('мирный исход не дал +5 пилигриму');
    if (!peace && s.flags.ghost !== 7) fail('казнь не дала +5 лидеру (призрак)');
    await shot(`${tag}_end`);
  }

  // маска: F — за спину врага
  await load('hall', 250, ['sword_old', 'broken_mask'], { amulet: 'broken_mask' });
  await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); g.player.x = e.x - 90; g.player.z = e.z; });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(300); await p.keyboard.up('KeyD'); await p.waitForTimeout(300);
  const before = await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); g.player.hp = 99; return { px: g.player.x, ex: e && e.x, arena: !!g.arena, hud: !document.querySelector('#skill-mask').hidden }; });
  console.log('mask before', JSON.stringify(before));
  if (!before.hud) fail('нет шкалы маски в HUD');
  await p.keyboard.press('KeyF'); await p.waitForTimeout(80);
  const mid = await p.evaluate(() => ({ state: window.knightNight.player.state, dodge: window.knightNight.player.defense().dodge }));
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(e => e.alive); return { px: g.player.x, ex: e && e.x, facing: g.player.facing, ready: g.blinkReadyAt - g.time }; });
  console.log('mask', JSON.stringify(mid), JSON.stringify(after));
  if (mid.state !== 'blink' || !mid.dodge) fail('шаг призрака не начался или рыцаря можно задеть');
  if (before.ex != null && Math.sign(after.px - after.ex) === Math.sign(before.px - before.ex)) fail('рыцарь не оказался за спиной врага');
  if (Math.sign(after.ex - after.px) !== after.facing) fail('после шага не смотрит на врага');
  if (!(after.ready > 5)) fail('нет перезарядки маски');
  await shot('mask');
  console.log('errors', JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
  await b.close();
})();
