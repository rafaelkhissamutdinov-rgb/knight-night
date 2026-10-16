// Клавиатура: какие клавиши зажаты, в каком порядке нажаты, и очередь новых нажатий.
const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export function createInput(target = window) {
  const order = [];   // зажатые клавиши, последняя — самая свежая
  const queue = [];   // новые нажатия с прошлого кадра

  let caps = false;   // Caps Lock включён (браузер сообщает его с каждой клавишей и кнопкой мыши)
  const readCaps = e => { if (e.getModifierState) caps = e.getModifierState('CapsLock'); };
  target.addEventListener('mousedown', readCaps);
  target.addEventListener('keydown', e => {
    readCaps(e);
    if (BLOCKED.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    const i = order.indexOf(e.code);
    if (i >= 0) order.splice(i, 1);
    order.push(e.code);
    queue.push(e.code);
  });
  target.addEventListener('keyup', e => {
    readCaps(e);
    const i = order.indexOf(e.code);
    if (i >= 0) order.splice(i, 1);
  });
  target.addEventListener('blur', () => { order.length = 0; });

  return {
    isDown: code => order.includes(code),
    caps: () => caps,
    // самая свежая зажатая клавиша из map → её значение
    latest(map) {
      for (let i = order.length - 1; i >= 0; i--) if (order[i] in map) return map[order[i]];
      return null;
    },
    take: () => queue.splice(0),
    press: code => queue.push(code),
    // кнопки мыши: зажатие и отпускание приходят не с клавиатуры
    setHeld(code, down) {
      const i = order.indexOf(code);
      if (i >= 0) order.splice(i, 1);
      if (down) {
        order.push(code);
        queue.push(code);
      }
    },
  };
}
