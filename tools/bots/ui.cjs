// Бот: сумка, лавка, обучение (v0.91, отзыв тестера). Клик по вещи — выбор (ничего не тратится), действие — кнопкой
// или вторым кликом; длинная сумка листается колесом; ✕ закрывает. В лавке первый клик — описание, второй — покупка.
// Обучение: пауза → «Пропустить обучение». Снимки — KN_OUT/ui.
const { chromium } = require('playwright');
const SH = (process.env.KN_OUT || __dirname + '/out') + '/ui'; require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const fail = m => { console.log('ПРОВАЛ:', m); process.exitCode = 1; };
  const url = process.env.KN_URL || 'http://localhost:8080/';
  const load = async (room, x, bag, coins = 0, flags = { trainer_gone: true }) => {
    await p.goto(url); await p.waitForTimeout(200);
    await p.evaluate(([room, x, bag, coins, flags]) => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room, x, z: 12, hp: 6, coins, bag, equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [], flags: { seen_wake: true, ...flags }, pickups: [] })), [room, x, bag, coins, flags]);
    await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  };
  const shot = async n => p.screenshot({ path: `${SH}/${n}.png`, clip: await p.locator('#game-box').boundingBox() });
  const bag = () => p.evaluate(() => window.knightNight.bag.slice());

  // 1. сумка: много вещей
  const many = ['sword_old', 'bandage', 'bandage', 'potion', 'dried_fish', 'old_letter', 'resin_flower', 'old_fabric', 'sun_medallion', 'diary_1', 'diary_2', 'diary_3', 'map', 'key_tower', 'scroll_fencing', 'golden_skull', 'silver_cup', 'rosary', 'helm_old', 'boots_old', 'mar_scarf', 'mar_boots', 'diamond_ace', 'journal'];
  await load('hall', 300, many);
  await p.keyboard.press('KeyI'); await p.waitForTimeout(300);
  const items = p.locator('#equip-bag button');
  const bandage = items.filter({ hasText: 'Бинт' }).first();
  const before = (await bag()).filter(x => x === 'bandage').length;
  await bandage.click(); await p.waitForTimeout(200);
  let after = (await bag()).filter(x => x === 'bandage').length;
  const doShown = await p.locator('#equip-do').isVisible(), doText = await p.locator('#equip-do').textContent();
  console.log('select', before, after, doShown, doText);
  if (after !== before) fail('первый клик уже потратил бинт');
  if (!doShown || !/Использовать/.test(doText)) fail('нет кнопки действия');
  await shot('0_bag_selected');
  await p.locator('#equip-do').click(); await p.waitForTimeout(200);
  after = (await bag()).filter(x => x === 'bandage').length;
  if (after !== before - 1) fail('кнопка не использовала бинт');
  // листается колесом
  const sc = await p.evaluate(() => { const el = document.querySelector('#equip-bag'); return { sh: el.scrollHeight, ch: el.clientHeight }; });
  await items.first().hover(); await p.mouse.wheel(0, 400); await p.waitForTimeout(300);
  const top = await p.evaluate(() => document.querySelector('#equip-bag').scrollTop);
  console.log('scroll', JSON.stringify(sc), 'top', top);
  if (sc.sh > sc.ch + 4 && top <= 0) fail('сумка не листается колесом');
  // ничего не вылезает за рамку
  const over = await p.evaluate(() => {
    const box = document.querySelector('#equip').getBoundingClientRect();
    return [...document.querySelectorAll('#equip *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.right > box.right + 1 || r.bottom > box.bottom + 1); })
      .filter(el => !el.closest('.shop-menu') || el.closest('.shop-menu').getBoundingClientRect().bottom > box.bottom + 1)   // строки внутри прокрутки не в счёт
      .map(el => el.id || el.className || el.tagName).slice(0, 5);
  });
  if (over.length) fail('за рамкой сумки: ' + over.join(', '));
  await shot('1_bag_scrolled');
  await p.locator('#equip-close').click(); await p.waitForTimeout(200);
  if (await p.evaluate(() => window.knightNight.mode) !== 'play') fail('✕ не закрыл сумку');

  // 2. лавка: первый клик — описание, второй — покупка
  await load('shop', 190, ['sword_old'], 200);
  await p.evaluate(() => { const g = window.knightNight; const n = g.npcs.find(n => n.def?.shop); g.player.x = n.x - 22; g.player.z = n.z; });
  await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
  await p.locator('#shop-menu button', { hasText: 'Купить' }).click(); await p.waitForTimeout(300);
  const potion = p.locator('#shop-menu button', { hasText: 'Зелье' }).first();
  const c0 = await p.evaluate(() => window.knightNight.coins);
  await potion.click(); await p.waitForTimeout(300);
  const c1 = await p.evaluate(() => window.knightNight.coins);
  await shot('2_shop_selected');
  await potion.click(); await p.waitForTimeout(300);
  const c2 = await p.evaluate(() => window.knightNight.coins);
  console.log('shop coins', c0, c1, c2);
  if (c1 !== c0) fail('первый клик в лавке уже купил');
  if (c2 >= c1) fail('второй клик не купил');

  // 3. обучение: пропустить из паузы
  await load('cell', 200, ['sword_old'], 0, {});
  for (let i = 0; i < 80 && !(await p.evaluate(() => !!window.knightNight.tutorial)); i++) {
    const s = await p.evaluate(() => ({ mode: window.knightNight.mode, ch: document.querySelectorAll('#talk-choices button').length }));
    if (s.mode === 'talk') { if (s.ch) await p.locator('#talk-choices button').first().click(); else await p.keyboard.press('Enter'); }
    else { await p.keyboard.down('KeyD'); await p.waitForTimeout(250); await p.keyboard.up('KeyD'); }
    await p.waitForTimeout(200);
  }
  const hint = await p.evaluate(() => document.querySelector('#hint')?.textContent);
  console.log('tutorial', await p.evaluate(() => !!window.knightNight.tutorial), hint);
  if (!/пропустить/.test(hint ?? '')) fail('в подсказке обучения нет «пропустить»');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#overlay-menu button', { hasText: 'Пропустить обучение' }).click(); await p.waitForTimeout(800);
  for (let i = 0; i < 8; i++) { if (await p.evaluate(() => window.knightNight.mode) === 'talk') await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
  const tf = await p.evaluate(() => ({ t: !!window.knightNight.tutorial, skipped: window.knightNight.flags.tutorial_skipped, gone: window.knightNight.flags.trainer_gone }));
  console.log('skip', JSON.stringify(tf));
  if (tf.t || !tf.skipped) fail('обучение не пропустилось');
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
