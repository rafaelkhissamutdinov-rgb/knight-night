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
  dash() { burst(0.09, 'lowpass', 600, 0.25); },
  ward() { tone(880, 0.25, 'sine', 0.15, 1320); burst(0.06, 'highpass', 2500, 0.2); },
  gulp() { tone(220, 0.35, 'square', 0.12, 70); burst(0.3, 'lowpass', 300, 0.5); },
  spit() { burst(0.15, 'lowpass', 800, 0.5); tone(160, 0.15, 'square', 0.1, 320); },
  bow() { tone(300, 0.08, 'triangle', 0.08, 600); },
  cue(height) { tone({ high: 990, mid: 660, low: 440 }[height], 0.06, 'triangle', 0.07); },
};
