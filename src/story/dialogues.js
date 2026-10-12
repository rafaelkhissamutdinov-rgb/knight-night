// Тексты диалогов. ВСЁ НИЖЕ — ЧЕРНОВИК-ЗАГЛУШКА: настоящий сюжет пишет владелец (см. docs/story.md).
// Формат описан в src/dialogue.js. who — кто говорит (ключ из SPEAKERS), narrator — рассказчик без портрета.
// mood — настроение для нарисованного портрета (у рыцаря: tired — прищур, nohelm — без шлема; без mood — обычный), см. assets/portraits/.

export const SPEAKERS = {
  narrator: { name: '' },
  knight: { name: 'Рыцарь', portrait: 'knight' },
  ilia: { name: 'Илиа', portrait: 'ilia' },
  trainer: { name: 'Незнакомка', portrait: 'trainer' },  // имя даст владелец
  lika: { name: 'Лика', portrait: 'lika' },
};

export const DIALOGUES = {
  // рыцарь очнулся у портала в заброшенном замке
  wake: [
    { who: 'knight', mood: 'tired', text: '[черновик] Голова гудит... Этот портал я ещё не отмечал.' },
    { who: 'knight', text: '[черновик] Заброшенный замок. Посмотрим, куда меня занесло.' },
  ],

  // наставница у выхода из камеры: обучение вместо чучела
  trainer_meet: [
    { who: 'trainer', text: '[черновик] Очнулся? Без клинка в этом замке долго не протянешь.' },
    { who: 'trainer', text: '[черновик] Покажи, что умеешь. Я не буду бить всерьёз.' },
    {
      who: 'knight',
      choices: [
        { text: 'Давай.', goto: 'trainer_start' },
        { text: 'Я справлюсь сам. (пропустить обучение)', set: 'tutorial_skipped', goto: 'trainer_skip' },
      ],
    },
  ],
  trainer_start: [
    { who: 'trainer', text: '[черновик] Смотри на мой клинок и на значок над головой.' },
  ],
  trainer_skip: [
    { who: 'trainer', text: '[черновик] Как знаешь. У меня в этом замке свои дела. Если пути пересекутся — ещё увидимся.' },
  ],
  trainer_done: [
    { who: 'trainer', text: '[черновик] Неплохо. Дальше я пойду одна — я ищу здесь кое-что своё.' },
    { who: 'trainer', text: '[черновик] Если наши пути пересекутся, мы ещё встретимся.' },
  ],

  ilia_meet: [
    { who: 'ilia', text: '[черновик] Далеко же ты зашёл, рыцарь.' },
    {
      who: 'knight',
      choices: [
        { text: 'Кто ты?', set: 'asked_ilia_name', goto: 'ilia_name' },
        { text: 'Уйди с дороги.', goto: 'ilia_fight' },
      ],
    },
  ],
  ilia_name: [
    { who: 'ilia', text: '[черновик] Илиа. Священный рыцарь. Посмотрим, чего стоит твой клинок.' },
  ],
  ilia_fight: [
    { who: 'ilia', text: '[черновик] Тогда проходи. Если сможешь.' },
  ],

  ilia_defeat: [
    { who: 'ilia', text: '[черновик] ...Ты сильнее, чем кажешься.' },
    { who: 'ilia', if: 'asked_ilia_name', text: '[черновик] Запомни моё имя. Мы ещё встретимся.' },
    { who: 'ilia', ifNot: 'asked_ilia_name', text: '[черновик] Мы ещё встретимся, безымянный.' },
  ],
};

// Лавки: что говорит продавец, что продаёт (ключи из ITEMS в src/config.js) и о чём с ним поговорить.
export const SHOPS = {
  lika: {
    hello: '[черновик] О, покупатель! Не стой в дверях, смотри.',
    menu: '[черновик] Чего желаешь?',
    items: [
      { id: 'potion', text: '[черновик] Зелье лечения. Горькое, но работает.' },
      { id: 'bandage', text: '[черновик] Бинт. Лучше, чем ничего.' },
      { id: 'map', text: '[черновик] Карта замка. Пока не продаю — сама дорисовываю.', soon: true },
    ],
    talk: [
      { topic: 'О себе', mood: 'sly', lines: ['[черновик] Лика. Торгую тем, что нахожу. А нахожу я многое.'] },
      { topic: 'Об этом замке', mood: 'serious', lines: ['[черновик] Здесь давно никто не живёт. Кроме тех, кто уже не живой.'] },
      { topic: 'О порталах', mood: 'surprised', lines: ['[черновик] Порталы? Видела один знак на полу внизу. Говорят, он светится.'] },
    ],
    bought: '[черновик] Спасибо! Заходи ещё.',
    poor: '[черновик] Монет не хватает. Приходи, когда разбогатеешь.',
    soon: '[черновик] Это пока не продаётся.',
    bye: '[черновик] Береги себя, рыцарь!',
    // выражение лица Лики (assets/portraits/lika-*.jpg): happy, sly, surprised, sulky, serious, worried, angry; без — обычное
    moods: { hello: 'happy', item: 'sly', bought: 'happy', poor: 'sulky', soon: 'sly' },
  },
};
