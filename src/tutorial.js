// Обучение у наставницы: шаги по порядку. Каждый шаг — задание, чего нужно добиться (need),
// и как наставница при этом бьёт (plan: null — стоит и принимает удары).
// События приходят из боя: { type: 'hit', height, key } — рыцарь попал; { type: 'counter', key } — контратака;
// { type: 'impact', result } — её удар дошёл до рыцаря (perfect / block / broken / dodged / warded / hit).

const LABEL = {
  high: 'верх', mid: 'середина', low: 'низ',
  block: 'отбито', perfect: 'идеально', counter: 'контратака', dodge: 'уклон',
  dashCut: 'удар в рывке', leap: 'прыжок с ударом', rollCut: 'подсечка', spin: 'вихрь',
};

const hitKey = ev => (ev.type === 'hit' || ev.type === 'counter') ? ev.key : null;

export const TUTORIAL = [
  {
    id: 'strike',
    text: 'Ударь меня на трёх высотах: курсор выше рыцаря — верх, на уровне груди — середина, ниже пояса — низ. ЛКМ — удар.',
    plan: null,
    need: { high: 1, mid: 1, low: 1 },
    count: ev => (ev.type === 'hit' || ev.type === 'counter') ? ev.height : null,
  },
  {
    id: 'block',
    text: 'Теперь защищайся: держи ПКМ, курсор — на высоте значка над моей головой.',
    plan: { combos: [['high'], ['mid'], ['low']], windup: 1.1, wait: [1.0, 1.4] },
    need: { block: 3 },
    count: ev => ev.type === 'impact' && (ev.result === 'block' || ev.result === 'perfect') ? 'block' : null,
  },
  {
    id: 'perfect',
    text: 'Нажми ПКМ прямо перед ударом — когда блеснёт клинок. Это идеальное парирование.',
    plan: { combos: [['high'], ['mid'], ['low']], windup: 1.0, wait: [1.0, 1.4] },
    need: { perfect: 2 },
    count: ev => ev.type === 'impact' && ev.result === 'perfect' ? 'perfect' : null,
  },
  {
    id: 'counter',
    text: 'Отбей всю серию идеально — я открыта. Тогда бей: удар вдвое сильнее.',
    plan: { combos: [['mid', 'high'], ['low', 'mid'], ['high', 'low']], windup: 1.0, comboWindup: 0.85, wait: [1.0, 1.4] },
    need: { counter: 1 },
    count: ev => ev.type === 'counter' ? 'counter' : null,
  },
  {
    id: 'dodge',
    text: 'Тяжёлый удар (оранжевый значок) сбивает блок. Уходи: пробел с курсором внизу — кувырок, пробел с шагом назад — отскок.',
    plan: { combos: [['heavyMid'], ['heavyHigh']], windup: 1.2, wait: [1.2, 1.6] },
    need: { dodge: 1 },
    count: ev => ev.type === 'impact' && (ev.result === 'dodged' || ev.result === 'warded') ? 'dodge' : null,
  },
  {
    id: 'moves',
    text: 'Приёмы. Пробел и сразу ЛКМ — удар в рывке. Пробел с курсором вверху — прыжок с ударом. После кувырка ЛКМ — подсечка.',
    plan: null,
    need: { dashCut: 1, leap: 1, rollCut: 1 },
    count: hitKey,
  },
  {
    id: 'spin',
    text: 'Прокрути колесо мыши — вихрь, бьёт вокруг. Потом он 4 секунды перезаряжается.',
    plan: null,
    need: { spin: 1 },
    count: hitKey,
  },
];

export class Tutorial {
  constructor(steps = TUTORIAL) {
    this.steps = steps;
    this.i = 0;
    this.have = {};
  }

  get step() { return this.steps[this.i] ?? null; }
  get done() { return this.i >= this.steps.length; }

  // событие боя → true, если шаг выполнен и начался следующий
  note(ev) {
    const s = this.step;
    if (!s) return false;
    const k = s.count(ev);
    if (!k || !(k in s.need)) return false;
    this.have[k] = Math.min(s.need[k], (this.have[k] ?? 0) + 1);
    if (Object.entries(s.need).every(([key, n]) => (this.have[key] ?? 0) >= n)) {
      this.i++;
      this.have = {};
      return true;
    }
    return false;
  }

  // «Обучение 2/7 · задание · отбито 1/3»
  get text() {
    const s = this.step;
    if (!s) return '';
    const progress = Object.entries(s.need)
      .map(([k, n]) => n > 1 ? `${LABEL[k]} ${this.have[k] ?? 0}/${n}` : `${(this.have[k] ?? 0) >= n ? '✓' : '·'} ${LABEL[k]}`)
      .join('  ');
    return `Обучение ${this.i + 1}/${this.steps.length} · ${s.text}  [${progress}]`;
  }
}
