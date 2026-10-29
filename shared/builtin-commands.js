// shared/builtin-commands.js
// Единый источник истины для встроенных команд бота.

export const BUILTIN_COMMANDS = [
  {
    name: 'rank',
    description: 'Уровень, опыт и место в топе сервера',
    category: 'Утилиты',
    moduleKey: 'levels',
    options: [
      { type: 6, name: 'user', description: 'Чей профиль показать', required: false },
    ],
  },
  {
    name: 'leaderboard',
    description: 'Топ участников сервера по опыту',
    category: 'Утилиты',
    moduleKey: 'levels',
  },
  {
    name: 'daily',
    description: 'Ежедневная награда опыта',
    category: 'Утилиты',
    moduleKey: 'levels',
  },
];

export const BUILTIN_NAMES = new Set(BUILTIN_COMMANDS.map((c) => c.name));

/** Проверяет, зарезервировано ли имя под встроенную команду. */
export function isReservedCommandName(name) {
  return BUILTIN_NAMES.has(String(name || '').toLowerCase().trim());
}

/** Discord-формат (name + description + options). */
export function toDiscordCommand(cmd) {
  const out = { name: cmd.name, description: cmd.description };
  if (cmd.options) out.options = cmd.options;
  return out;
}