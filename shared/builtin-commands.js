// shared/builtin-commands.js
export const BUILTIN_COMMANDS = [
  {
    name: 'rank',
    description: 'Уровень, опыт и место в топе сервера',
    category: 'Утилиты',
    moduleKey: 'levels',
    icon: 'fa-ranking-star',
    color: 'orange',
    options: [
      { type: 6, name: 'user', description: 'Чей профиль показать', required: false },
    ],
  },
  {
    name: 'leaderboard',
    description: 'Топ участников сервера по опыту',
    category: 'Утилиты',
    moduleKey: 'levels',
    icon: 'fa-trophy',
    color: 'orange',
  },
  {
    name: 'daily',
    description: 'Ежедневная награда опыта',
    category: 'Утилиты',
    moduleKey: 'levels',
    icon: 'fa-gift',
    color: 'green',
  },
  {
    name: 'birthday_set',
    description: 'Установить дату дня рождения (ДД.ММ или ДД.ММ.ГГГГ)',
    category: 'Дни рождения',
    moduleKey: 'birthdays',
    icon: 'fa-cake-candles',
    color: 'pink',
    options: [
      { type: 3, name: 'date', description: 'Дата: ДД.ММ или ДД.ММ.ГГГГ (например, 15.06 или 15.06.1995)', required: true },
    ],
  },
  {
    name: 'birthday_toggle',
    description: 'Включить или отключить поздравления с днём рождения',
    category: 'Дни рождения',
    moduleKey: 'birthdays',
    icon: 'fa-bell',
    color: 'pink',
  },
  {
    name: 'birthdays',
    description: 'Ближайшие дни рождения участников',
    category: 'Дни рождения',
    moduleKey: 'birthdays',
    icon: 'fa-list',
    color: 'pink',
  },
];

export const BUILTIN_NAMES = new Set(BUILTIN_COMMANDS.map((c) => c.name));

export function getBuiltinCommand(name) {
  return BUILTIN_COMMANDS.find((c) => c.name === name) || null;
}

export function isReservedCommandName(name) {
  return BUILTIN_NAMES.has(String(name || '').toLowerCase().trim());
}

export function toDiscordCommand(cmd) {
  const out = { name: cmd.name, description: cmd.description };
  if (cmd.options) out.options = cmd.options;
  return out;
}