// Бот-тестер Knight Night (tools/bots). Запуск: npm run bots (сервер поднимает check.sh). URL — KN_URL, снимки — KN_OUT.
// Бот-защитник против босса: видит замах, через «реакцию» ставит защиту на нужной высоте, бьёт в паузах.
// Записывает каждое пропущенное: что за удар, какая была защита — чтобы отличить баг от сложности.
const { chromium } = require('playwright');
const REACT = +(process.argv[2] || 0.2), TURN = process.argv[3] !== 'noturn', SECS = +(process.argv[4] || 120);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto((process.env.KN_URL || 'http://localhost:8080/')); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: 'mage', x: 90, z: 20, hp: 10, coins: 0, bag: ['rapier'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword', 'rapier'], cleared: [], flags: { seen_wake: true, trainer_gone: true, done_ilia: true, done_commander: true, balcony_done: true, done_keyguard: true, seen_boss_intro: true }, pickups: [] })));
  await p.reload(); await p.waitForTimeout(900); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  await p.evaluate(([REACT, TURN]) => {
    const g = window.knightNight, D = window.knightNightDebug, inp = D.input;
    const log = window.botLog = { hits: [], blocks: 0, perfect: 0, events: [] };
    let lastHit = g.stats.hit, lastBlock = g.stats.block, lastPerf = g.stats.perfect, guardOn = false, dirKey = null, atkAt = 0;
    const AIM = { high: -20, mid: 0, low: 20 };
    const setGuard = on => { if (on !== guardOn) { inp.setHeld('Mouse2', on); guardOn = on; } };
    const setDir = k => { if (k === dirKey) return; if (dirKey) inp.setHeld(dirKey, false); if (k) inp.setHeld(k, true); dirKey = k; };
    function tick() {
      requestAnimationFrame(tick);
      if (g.mode === 'talk') { inp.press('Escape'); return; }
      if (g.mode === 'dead') { log.events.push('dead@' + g.time.toFixed(1)); inp.press('KeyR'); return; }
      if (g.mode !== 'play') return;
      const pl = g.player, e = g.enemies.find(x => x.kind === 'boss');
      if (!e) return;
      const dx = e.x - pl.x;
      if (e.state === 'dormant' || (!e.alive && false)) { setDir('KeyD'); return; }
      // повернуться к боссу, если он за спиной (как сделал бы игрок стрелкой)
      setDir(TURN && Math.sign(dx) !== pl.facing && Math.abs(dx) > 3 ? (dx > 0 ? 'KeyD' : 'KeyA') : null);
      if (e.state === 'windup' && e.strike) {
        const h = e.strike.guard;
        g.mouseY = D.groundY(pl.z) - 22 + AIM[h];
        setGuard(e.t >= Math.min(REACT, Math.max(0, e.windupTime - 0.06)));
      } else if (e.state === 'strike') {
        // держим до конца удара
      } else {
        setGuard(false);
        if ((e.state === 'recover' || e.state === 'stagger' || e.state === 'reel') && Math.abs(dx) < 40 && pl.state === 'ready' && g.time - atkAt > 0.5) {
          g.mouseY = D.groundY(pl.z) - 22; inp.setHeld('Mouse0', true); inp.setHeld('Mouse0', false); atkAt = g.time;
        }
      }
      if (g.stats.hit > lastHit) {
        log.hits.push({ t: +g.time.toFixed(2), timing: g.lastTiming, boss: e.state + ':' + (e.strike ? e.strike.guard + (e.strike.breaks ? '/breaks' : '') + (e.strike.bypass ? '/bypass' : '') : '') + ':' + (e.pat?.id ?? ''),
          pstate: pl.state, guard: pl.guard, aim: g.aim, facing: pl.facing, behind: Math.sign(dx) !== pl.facing, dx: Math.round(dx), broken: pl.broken });
        lastHit = g.stats.hit;
      }
      log.blocks += g.stats.block - lastBlock; lastBlock = g.stats.block;
      log.perfect += g.stats.perfect - lastPerf; lastPerf = g.stats.perfect;
    }
    tick();
  }, [REACT, TURN]);
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    await p.waitForTimeout(5000);
    const s = await p.evaluate(() => { const g = window.knightNight, e = g.enemies.find(x => x.kind === 'boss'); return { t: g.time.toFixed(0), mode: g.mode, bossHp: e?.hp, hp: g.player.hp, hits: window.botLog.hits.length, blocks: window.botLog.blocks, perfect: window.botLog.perfect, chokes: g.stats.chokes }; });
    console.log(JSON.stringify(s));
    if (s.mode === 'end' || (s.bossHp !== undefined && s.bossHp <= 0)) break;
  }
  const log = await p.evaluate(() => window.botLog);
  console.log('HITS'); for (const h of log.hits) console.log(JSON.stringify(h));
  console.log('events', log.events, 'errors', errs);
  await b.close();
})();
