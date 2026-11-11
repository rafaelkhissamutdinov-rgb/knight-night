// Бот плавности (v1.11): гонит кадры вручную с частотой экрана 60–165 Гц и считает, насколько ровно едет фон при беге (кадры без движения = рывки).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [hz, jit] of [[60, 0], [60, 0.6], [75, 0], [120, 0], [144, 0], [165, 0]]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.addInitScript(() => { window.__raf = null; window.requestAnimationFrame = cb => { window.__raf = cb; return 1; }; });
    await p.goto('http://localhost:8080/'); await p.waitForTimeout(300);
    await p.evaluate(() => localStorage.setItem('knightNight.save.v1', JSON.stringify({ room: 'town_square', x: 120, z: 30, hp: 10, coins: 0, bag: ['sword_old'], equip: { weapon: 'sword_old', armor: 'armor_old' }, unlocked: ['sword'], cleared: [0, 1, 2, 3, 4, 5, 6, 7, 8], flags: { seen_wake: true, trainer_gone: true, chapter: 2, chapter1_done: true }, pickups: [] })));
    await p.reload(); await p.waitForTimeout(600);
    const pump = (n, hz, jit, t0) => p.evaluate(([n, hz, jit, t0]) => {
      const g = window.knightNight, out = []; let t = t0;
      for (let i = 0; i < n; i++) {
        t += 1000 / hz + (jit ? (Math.random() - 0.5) * 2 * jit : 0);
        const cb = window.__raf; window.__raf = null; cb(t);
        const d = window.knightNightDebug?.drawn, cam = d ? d.cam : g.camX, x = d ? d.x : g.player.x;
        const c = window.__half ? Math.round(cam * 2) / 2 : Math.round(cam);
        out.push({ bg: c, kn: Math.round((x - c) * 2) / 2 });
      }
      return [out, t];
    }, [n, hz, jit, t0]);
    let [, t] = await pump(30, 60, 0, 1000);
    await p.keyboard.press('Enter'); [, t] = await pump(90, 60, 0, t);
    await p.keyboard.down('KeyD');
    [, t] = await pump(Math.round(hz * 1.5), hz, jit, t);          // разгон и камера догоняет
    const [fr] = await pump(Math.round(hz * 2), hz, jit, t);          // 2 секунды ровного бега
    await p.keyboard.up('KeyD');
    const d = fr.slice(1).map((f, i) => +(f.bg - fr[i].bg).toFixed(1)), mean = d.reduce((a, c) => a + c, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, c) => a + (c - mean) ** 2, 0) / d.length);
    const still = d.filter(v => v === 0).length / d.length, kj = new Set(fr.map(f => f.kn)).size;
    console.log(`${hz} Гц${jit ? ' (дрожание таймера ±' + jit + ' мс)' : ''}: фон едет ${mean.toFixed(2)} px/кадр, разброс ${sd.toFixed(2)} (${(sd / mean * 100).toFixed(0)}%), кадров без движения ${(still * 100).toFixed(0)}%, рыцарь на экране в ${kj} разных точках; пример: ${d.slice(20, 44).join(' ')}`);
    await p.close();
  }
  await b.close();
})();
