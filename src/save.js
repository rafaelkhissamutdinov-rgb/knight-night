// Сохранение в браузере: где рыцарь, какие встречи пройдены, открытое оружие, флаги сюжета.
// Если хранилище недоступно (приватное окно, запрет), игра просто идёт без сохранения.
const KEY = 'knightNight.save.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* нет хранилища — нечего стирать */ }
}
