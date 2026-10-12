// Правила боя без графики — их проверяют тесты.

// Чем закончился удар врага (или стрела) на высоте height.
// defense — состояние рыцаря: guard (какую защиту держит), dodge (кувырок), ward (заслон отскока),
// attacking (сам атакует), vulnerable (отскок не сработал вовремя).
// lastPress / prevPress — два последних нажатия защиты: { height, time }.
// Возвращает { result: 'dodged' | 'warded' | 'perfect' | 'block' | 'hit', mult } — mult умножает урон.
export function resolveImpact({ height, time, defense, lastPress, prevPress }, cfg) {
  if (defense.dodge) return { result: 'dodged', mult: 0 };
  if (defense.ward) return { result: 'warded', mult: 0 };
  if (defense.attacking || defense.vulnerable) return { result: 'hit', mult: cfg.tradeMult };
  if (defense.guard !== height) return { result: 'hit', mult: 1 };
  if (!lastPress || lastPress.height !== height) return { result: 'block', mult: 0 };
  const early = time - lastPress.time;
  if (early < 0 || early > cfg.perfectWindow) return { result: 'block', mult: 0 };
  if (prevPress && lastPress.time - prevPress.time < cfg.mashLockout) return { result: 'block', mult: 0 };
  return { result: 'perfect', mult: 0 };
}

// Высота, на которой сейчас можно достать слизня: на земле — низом, в прыжке — серединой или верхом.
export function slimeZone(airY, inflating) {
  if (inflating) return 'any';
  if (airY < 8) return 'low';
  if (airY < 20) return 'mid';
  return 'high';
}
