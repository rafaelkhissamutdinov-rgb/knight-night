// Правила боя без графики — их проверяют тесты.

// Чем закончился удар врага на высоте height.
// guard — какую защиту держит рыцарь сейчас (null, если не держит или атакует).
// lastPress / prevPress — два последних нажатия защиты: { height, time }.
export function resolveImpact({ height, time, guard, lastPress, prevPress }, cfg) {
  if (guard !== height) return 'hit';
  if (!lastPress || lastPress.height !== height) return 'block';
  const early = time - lastPress.time;
  if (early < 0 || early > cfg.perfectWindow) return 'block';
  if (prevPress && lastPress.time - prevPress.time < cfg.mashLockout) return 'block';
  return 'perfect';
}

// Что будет, если рыцарь бьёт, пока враг в состоянии enemyState.
export function attackOutcome(enemyState) {
  if (enemyState === 'stagger') return 'counter';
  if (enemyState === 'recover') return 'hit';
  return 'blocked';
}
