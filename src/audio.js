// Звуки синтезируются на лету, без файлов. Браузер разрешает звук только после первого нажатия.
let ctx = null;
let master = null;

export function unlockAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);
}

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function burst(dur, filterType, freq, vol = 0.4, q = 1) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  perfect() { tone(1760, 0.45, 'triangle', 0.22); tone(2640, 0.3, 'sine', 0.12); burst(0.05, 'highpass', 3000, 0.35); },
  block() { burst(0.12, 'bandpass', 1400, 0.5, 3); tone(520, 0.08, 'square', 0.06); },
  hit() { burst(0.18, 'lowpass', 500, 0.7); tone(140, 0.2, 'sine', 0.4, 60); },
  enemyHit() { burst(0.12, 'lowpass', 900, 0.5); tone(220, 0.12, 'square', 0.08, 110); },
  counter() { burst(0.25, 'lowpass', 700, 0.8); tone(110, 0.3, 'sine', 0.5, 50); tone(1320, 0.5, 'triangle', 0.16); },
  deflected() { burst(0.08, 'bandpass', 2000, 0.35, 4); },
  stagger() { tone(330, 0.15, 'square', 0.07, 220); },
  heavy() { burst(0.3, 'lowpass', 400, 0.8); tone(90, 0.3, 'sine', 0.4, 45); },
  whip() { tone(2400, 0.18, 'sine', 0.12, 700); burst(0.12, 'highpass', 4000, 0.25); },
  swish() { burst(0.1, 'bandpass', 900, 0.18, 0.8); },
  // рёв вспыхнувшего пламени (факелы босса): низкий гул и треск
  flame() { burst(0.6, 'lowpass', 380, 0.5, 0.7); burst(0.35, 'bandpass', 1800, 0.18, 0.6); burst(0.15, 'highpass', 3000, 0.08, 0.5); },
  // «шу» — свист клинка по кругу (вихрь): шум, полоса частот плывёт вверх и вниз, мягкое нарастание
  whoosh() {
    if (!ctx) return;
    const t0 = ctx.currentTime, dur = 0.26, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(380, t0); f.frequency.exponentialRampToValueAtTime(1500, t0 + dur * 0.55); f.frequency.exponentialRampToValueAtTime(600, t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.32, t0 + dur * 0.45); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(gn).connect(master); src.start(t0); src.stop(t0 + dur);
  },
  dash() { burst(0.09, 'lowpass', 600, 0.25); },
  ward() { tone(880, 0.25, 'sine', 0.15, 1320); burst(0.06, 'highpass', 2500, 0.2); },
  gulp() { tone(220, 0.35, 'square', 0.12, 70); burst(0.3, 'lowpass', 300, 0.5); },
  spit() { burst(0.15, 'lowpass', 800, 0.5); tone(160, 0.15, 'square', 0.1, 320); },
  bow() { tone(300, 0.08, 'triangle', 0.08, 600); },
  door() { tone(180, 0.5, 'sawtooth', 0.05, 120); burst(0.35, 'bandpass', 500, 0.3, 2); },
  portal() { tone(440, 1.2, 'sine', 0.18, 1760); tone(660, 0.9, 'triangle', 0.08, 1320); burst(0.4, 'highpass', 3000, 0.2); },
  step() { burst(0.04, 'lowpass', 300, 0.12); },
  coin(k = 0) { tone(1500 + k * 90, 0.07, 'square', 0.035); tone(2250 + k * 120, 0.09, 'triangle', 0.04); },
  thud() { burst(0.25, 'lowpass', 160, 0.35); tone(55, 0.3, 'sine', 0.2, 40); },
  clink() { tone(2600, 0.03, 'triangle', 0.03); },
  cue(height) { tone({ high: 990, mid: 660, low: 440 }[height], 0.06, 'triangle', 0.07); },
};

// ---------- окружение: ветер, капли, треск огня ----------
// Ветер — петля шума через фильтр, громкость и «тон» плавно меняются; капли и треск — короткие события.
let wind = null;
export let ambientOn = true;
try { ambientOn = localStorage.getItem('knightNight.ambient') !== 'off'; } catch { /* без хранилища — включено */ }

export function setAmbient(on) {
  ambientOn = on;
  try { localStorage.setItem('knightNight.ambient', on ? 'on' : 'off'); } catch { /* ничего */ }
  if (!on) setWind(0);
}

function ensureWind() {
  if (wind || !ctx) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; data[i] = last * 6; }  // бурый шум — мягкий
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  wind = { filter, gain };
}

// level 0…1: 0 — тихо; gust — порыв (0…1) меняет тон
export function setWind(level, gust = 0) {
  if (!ctx) return;
  ensureWind();
  const t = ctx.currentTime;
  wind.gain.gain.setTargetAtTime(ambientOn ? level * 0.12 : 0, t, 0.8);
  wind.filter.frequency.setTargetAtTime(300 + 700 * gust, t, 1.2);
}

export function drip() {
  if (!ctx || !ambientOn) return;
  const f = 900 + Math.random() * 700;
  tone(f, 0.12, 'sine', 0.035, f * 0.55);
  setTimeout(() => tone(f * 0.8, 0.1, 'sine', 0.012, f * 0.45), 160);  // отзвук под сводом
}

export function crackle(vol = 1) {
  if (!ctx || !ambientOn) return;
  burst(0.02 + Math.random() * 0.03, 'highpass', 1800 + Math.random() * 2500, 0.06 * vol, 0.7);
  if (Math.random() < 0.3) burst(0.15, 'lowpass', 250, 0.05 * vol);
}

// ---------- музыка: тихий эмбиент ----------
// Медленные аккорды (Dm — B♭ — C — Am) мягким треугольником, редкие колокольные ноты с отзвуком под сводами;
// в бою — глухой ритм, как литавры. Всё синтезом, без файлов.
export let musicOn = true;
try { musicOn = localStorage.getItem('knightNight.music') !== 'off'; } catch { /* включена */ }
let mus = null;
const CHORDS = [[146.8, 174.6, 220.0], [116.5, 146.8, 174.6], [130.8, 164.8, 196.0], [110.0, 130.8, 164.8]];
const BELL = [293.7, 349.2, 392.0, 440.0, 523.3, 587.3];

function ensureMusic() {
  if (mus || !ctx) return;
  const out = ctx.createGain();
  out.gain.value = musicOn ? 1 : 0;
  // отзвук: задержка с обратной связью через фильтр
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.38;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  out.connect(master);
  out.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(master);
  mus = { out, chord: -1, nextChord: 0, nextBell: 2, nextDrum: 0 };
}

function pad(freq, t0, dur) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.018, t0 + 1.6);
  gain.gain.setValueAtTime(0.018, t0 + dur - 1.8);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.4);
  osc.connect(gain).connect(mus.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.5);
}

function bell(freq, t0) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.03, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
  osc.connect(gain).connect(mus.out);
  osc.start(t0);
  osc.stop(t0 + 2.3);
}

function drum(t0, accent) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(accent ? 90 : 70, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.3);
  gain.gain.setValueAtTime(accent ? 0.09 : 0.06, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.connect(gain).connect(mus.out);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}

// вызывать каждый кадр: combat — идёт бой
export function updateMusic(combat) {
  if (!ctx) return;
  ensureMusic();
  const t = ctx.currentTime;
  if (t >= mus.nextChord) {
    mus.chord = (mus.chord + 1) % CHORDS.length;
    for (const f of CHORDS[mus.chord]) pad(f, t, 6);
    mus.nextChord = t + 6;
  }
  if (t >= mus.nextBell) {
    if (Math.random() < 0.6) bell(BELL[Math.floor(Math.random() * BELL.length)], t);
    mus.nextBell = t + 2.5 + Math.random() * 4;
  }
  if (combat && t >= mus.nextDrum) {
    mus.beat = ((mus.beat ?? 0) + 1) % 4;
    drum(t, mus.beat === 0);
    mus.nextDrum = t + 0.75;
  }
}

export function setMusic(on) {
  musicOn = on;
  try { localStorage.setItem('knightNight.music', on ? 'on' : 'off'); } catch { /* ничего */ }
  if (mus) mus.out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.3);
}
