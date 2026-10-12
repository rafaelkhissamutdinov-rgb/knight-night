// Все числа, которые влияют на ощущение боя, собраны здесь.
// Время — в секундах, расстояния — в пикселях игрового экрана (320×180).

export const CONFIG = {
  width: 320,
  height: 180,
  ground: 150,

  // Парирование
  perfectWindow: 0.16,  // нажал защиту не раньше чем за столько до удара → идеальное парирование
  mashLockout: 0.3,     // если перед этим жал защиту чаще, идеального не будет (защита от «спама»)
  counterWindow: 1.3,   // сколько враг открыт для выпада после идеально отбитой серии

  // Урон
  attackDamage: 1,      // обычный удар, пока враг восстанавливается после серии
  counterDamage: 3,     // выпад после идеальной серии
  playerHp: 5,

  // Передвижение
  walkSpeed: 64,
  engageDistance: 110,  // на каком расстоянии враг вызывает на бой
  duelGap: 40,          // расстояние между бойцами в дуэли

  // Ощущения
  hitstop: { perfect: 0.07, hit: 0.1, counter: 0.12 },
  glint: true,          // блик на клинке в момент, когда пора жать защиту
  audioCues: true,      // короткий звук на высоте замаха: верх звучит выше, низ ниже
};

// Враги. windup — замах первого удара серии, comboWindup — замах следующих,
// gap — пауза между ударами, recover — сколько враг открыт после серии,
// wait — пауза перед новой серией (от и до), combos — серии ударов.
export const ENEMY_TYPES = {
  guard: {
    name: 'Стражник',
    hp: 3,
    windup: 0.8,
    comboWindup: 0.55,
    gap: 0.12,
    recover: 1.1,
    wait: [0.9, 1.4],
    combos: [['mid'], ['high'], ['mid', 'high'], ['high', 'mid']],
    colors: { armor: '#6d6a7a', armorDark: '#45424f', tabard: '#8e2b3a', helm: '#7d7a8a', visor: '#14101e', blade: '#c9d2dc', hilt: '#8a5a3b', boots: '#3b2a26' },
  },
  merc: {
    name: 'Наёмник',
    hp: 4,
    windup: 0.65,
    comboWindup: 0.45,
    gap: 0.1,
    recover: 0.95,
    wait: [0.7, 1.1],
    combos: [['low'], ['mid', 'high'], ['high', 'low'], ['mid', 'low', 'high']],
    colors: { armor: '#7a5a3a', armorDark: '#4d3826', tabard: '#4a6b3a', helm: '#8f7a5a', visor: '#14101e', blade: '#d6dde6', hilt: '#5a3726', boots: '#2e2420' },
  },
  captain: {
    name: 'Капитан стражи',
    hp: 6,
    windup: 0.55,
    comboWindup: 0.38,
    gap: 0.08,
    recover: 0.85,
    wait: [0.6, 1.0],
    combos: [['high', 'high'], ['mid', 'high', 'low'], ['low', 'low', 'high'], ['high', 'mid', 'low', 'mid']],
    colors: { armor: '#3b3550', armorDark: '#25212f', tabard: '#c99a2e', helm: '#4f4868', visor: '#ff7a2f', blade: '#f4f8ff', hilt: '#f2c14e', boots: '#1c1828' },
  },
};

// Коридор прототипа: длина и враги по порядку.
export const LEVEL = {
  length: 1400,
  enemies: [
    { type: 'guard', x: 420 },
    { type: 'merc', x: 800 },
    { type: 'captain', x: 1200 },
  ],
};
