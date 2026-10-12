// Тексты диалогов. ВСЁ НИЖЕ — ЧЕРНОВИК-ЗАГЛУШКА: настоящий сюжет пишет владелец (см. docs/story.md).
// Формат описан в src/dialogue.js. who — кто говорит (ключ из SPEAKERS), narrator — рассказчик без портрета.

export const SPEAKERS = {
  narrator: { name: '' },
  knight: { name: 'Рыцарь', portrait: 'knight' },
  ilia: { name: 'Илиа', portrait: 'ilia' },
};

export const DIALOGUES = {
  intro: [
    { who: 'narrator', text: '[черновик] Здесь будет вступление: кто рыцарь и зачем он спускается в подземелье.' },
    { who: 'narrator', text: 'Курсор выше или ниже рыцаря выбирает высоту. ЛКМ — удар, держать ПКМ — защита, пробел — рывок.' },
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
