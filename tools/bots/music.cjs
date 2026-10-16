// Бот: музыка и громкость (v0.89). Трек владельца грузится и играет, место (zone) меняется — заставка, замок, лавка,
// бой; пауза → «Звук и музыка»: ползунки меняют громкость и запоминаются. Снимок — KN_OUT/music.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/music'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  const info = () => p.evaluate(() => window.knightNightDebug.musicInfo());
  const load = async (room, x) => {
    await p.goto(process.env.KN_URL || 'http://localhost:8080/'); await p.waitForTimeout(200);
    await p.evaluate(([room, x]) => { localStorage.removeItem('knightNight.musicVol'); localStorage.removeItem('knightNight.sfxVol');
      localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z: 14, hp: 10, coins: 0, bag: ['sword_old'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { trainer_gone: true, seen_wake: true }, pickups: [] })); }, [room, x]);
    await p.reload(); await p.waitForTimeout(900);
  };
  await load('hall', 500);
  // первое нажатие включает звук (так требует браузер) и сразу начинает игру
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  let m = await info(); console.log('hall', JSON.stringify(m));
  if (!m.loaded) fail('трек не загрузился');
  if (m.zone !== 'explore' || !m.playing) fail('в замке трек не играет');
  await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD'); await p.waitForTimeout(300);
  m = await info(); console.log('fight', JSON.stringify(m), await p.evaluate(() => window.knightNight.arena?.key));
  // пауза → Звук и музыка: музыка −2, звуки −3
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#overlay-menu button', { hasText: 'Звук и музыка' }).click(); await p.waitForTimeout(200);
  const steps = p.locator('#overlay-menu .slider button');
  await steps.nth(0).click(); await steps.nth(0).click();
  for (let i = 0; i < 3; i++) await steps.nth(2).click();
  await p.screenshot({ path: `${SH}/sound_menu.png`, clip: await p.locator('#game-box').boundingBox() });
  const texts = await p.locator('#overlay-menu .slider span').allTextContents();
  m = await info(); console.log('menu', JSON.stringify(texts), JSON.stringify(m.volumes));
  if (m.volumes.music !== 5 || m.volumes.sfx !== 7) fail('ползунки не сработали');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const stored = await p.evaluate(() => [localStorage.getItem('knightNight.musicVol'), localStorage.getItem('knightNight.sfxVol')]);
  if (stored[0] !== '5' || stored[1] !== '7') fail('громкость не запомнилась: ' + stored);
  // главное меню — место «заставка» (Esc из «Звука» вернул в паузу)
  await p.locator('#overlay-menu button', { hasText: 'Главное меню' }).click(); await p.waitForTimeout(800);
  m = await info(); console.log('title', JSON.stringify(m));
  if (m.zone !== 'title' || !m.playing) fail('в главном меню трек не играет');
  // лавка — своё место
  await load('shop', 160);
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  m = await info(); console.log('shop', JSON.stringify(m));
  if (m.zone !== 'shop' || m.track !== 'shop') fail('в лавке не тот трек: ' + m.zone + ' / ' + m.track);
  // босс главы — свой трек (v0.91, «Captive of Love»)
  await load('mage', 120);
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  await p.keyboard.down('KeyD');
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.knightNight.arena)); i++) {
    if (await p.evaluate(() => window.knightNight.mode) === 'talk') {
      await p.waitForTimeout(500);
      const z = await info();
      if (z.zone === 'boss') fail('музыка босса началась ещё в разговоре');
      await p.keyboard.up('KeyD');
      if (await p.locator('#talk-choices button').count()) await p.locator('#talk-choices button').first().click(); else await p.keyboard.press('Escape');
      await p.keyboard.down('KeyD');
    }
    await p.waitForTimeout(150);
  }
  await p.keyboard.up('KeyD');
  for (let i = 0; i < 12; i++) {
    if (await p.evaluate(() => window.knightNight.mode) === 'talk') {
      if (await p.locator('#talk-choices button').count()) await p.locator('#talk-choices button').first().click(); else await p.keyboard.press('Escape');
    }
    await p.waitForTimeout(250);
  }
  await p.evaluate(() => { window.knightNight.player.hp = 99; });
  await p.waitForTimeout(4000);
  m = await info(); console.log('boss', JSON.stringify(m));
  if (m.zone !== 'boss' || m.track !== 'boss') fail('у босса не его трек: ' + m.zone + ' / ' + m.track);
  await p.evaluate(() => { localStorage.removeItem('knightNight.musicVol'); localStorage.removeItem('knightNight.sfxVol'); });
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
