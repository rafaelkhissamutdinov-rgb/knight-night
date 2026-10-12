// Правила боя без графики — их проверяют тесты.

// Чем закончился удар врага (или стрела), который отбивают защитой height.
// defense — состояние рыцаря: guard (какую защиту держит), broken (защиту сбили), dodge (кувырок),
// ward (заслон отскока), attacking (сам атакует), vulnerable (отскок не сработал вовремя).
// breaks — удар сбивает защиту, если его отбили обычным блоком; bypass — огибает удержанный блок (захлёст).
// defense.backTurned — враг бьёт в спину: защита не действует, урон вдвое.
// lastPress / prevPress — два последних нажатия защиты: { height, time }.
// Возвращает { result: 'dodged' | 'warded' | 'perfect' | 'block' | 'broken' | 'hit', mult } — mult умножает урон.
export function resolveImpact({ height, time, defense, lastPress, prevPress, breaks = false, bypass = false }, cfg) {
  if (defense.dodge) return { result: 'dodged', mult: 0 };
  if (defense.backTurned) return { result: 'hit', mult: cfg.tradeMult };
  if (defense.ward) return { result: 'warded', mult: 0 };
  if (defense.attacking || defense.vulnerable) return { result: 'hit', mult: cfg.tradeMult };
  const guard = defense.broken ? null : defense.guard;
  if (guard !== height) return { result: 'hit', mult: 1 };
  const blocked = bypass ? { result: 'hit', mult: 1 } : { result: breaks ? 'broken' : 'block', mult: 0 };
  if (!lastPress || lastPress.height !== height) return blocked;
  const early = time - lastPress.time;
  if (early < 0 || early > cfg.perfectWindow) return blocked;
  if (prevPress && lastPress.time - prevPress.time < cfg.mashLockout) return blocked;
  return { result: 'perfect', mult: 0 };
}

// Высота, на которой сейчас можно достать слизня: на земле — низом, в прыжке — серединой или верхом.
export function slimeZone(airY, inflating) {
  if (inflating) return 'any';
  if (airY < 8) return 'low';
  if (airY < 20) return 'mid';
  return 'high';
}
