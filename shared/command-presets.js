// shared/command-presets.js
// Шаблоны для редактора пользовательских команд.
// build() возвращает ТОЛЬКО те поля, которые нужно переопределить —
// остальные (каналы, роли, кулдаун, ephemeral) остаются как у пользователя.

export const COMMAND_PRESETS = [
  /* ─── Приветствие ─── */
  {
    key: 'greeting',
    icon: 'fa-hand',
    label: 'Приветствие',
    description: 'Простое приветствие с упоминанием',
    build: () => ({
      name: 'hello',
      description: 'Поздороваться с участником',
      response: 'Привет, {user}! 👋 Добро пожаловать на **{guild}**.',
      responseMode: 'text',
      cooldownSeconds: 10,
    }),
  },

  /* ─── Пинг ─── */
  {
    key: 'ping',
    icon: 'fa-satellite-dish',
    label: 'Пинг',
    description: 'Проверка отклика бота',
    build: () => ({
      name: 'ping',
      description: 'Проверить отклик бота',
      response: '🏓 Понг! Я на связи.',
      responseMode: 'text',
      cooldownSeconds: 5,
    }),
  },

  /* ─── Правила ─── */
  {
    key: 'rules',
    icon: 'fa-scroll',
    label: 'Правила сервера',
    description: 'Embed со списком правил',
    build: () => ({
      name: 'rules',
      description: 'Правила сервера',
      response:
        '**1.** Уважайте других участников.\n' +
        '**2.** Запрещён спам, реклама и флуд.\n' +
        '**3.** Не публикуйте NSFW-контент.\n' +
        '**4.** Слушайте модераторов.\n\n' +
        'Нарушение правил — предупреждение или бан без предупреждения.',
      responseMode: 'embed',
      responseEmbedColor: '#dc2626',
      cooldownSeconds: 30,
    }),
  },

  /* ─── О сервере ─── */
  {
    key: 'about',
    icon: 'fa-circle-info',
    label: 'О сервере',
    description: 'Информация с автосчётчиком',
    build: () => ({
      name: 'about',
      description: 'Информация о сервере',
      response:
        '**{guild}**\n' +
        'Участников: **{count}**\n' +
        'Команду вызвал: {user}\n\n' +
        'Добро пожаловать в наше сообщество!',
      responseMode: 'embed',
      responseEmbedColor: '#5865F2',
      cooldownSeconds: 15,
    }),
  },

  /* ─── Помощь ─── */
  {
    key: 'help',
    icon: 'fa-circle-question',
    label: 'Помощь',
    description: 'Список доступных команд',
    build: () => ({
      name: 'help',
      description: 'Список доступных команд',
      response:
        '**Доступные команды:**\n\n' +
        '`/rank` — ваш уровень\n' +
        '`/leaderboard` — топ участников\n' +
        '`/daily` — ежедневная награда\n' +
        '`/ticket` — создать тикет\n\n' +
        'Нужна помощь? Пинг <@&{guild}>.',
      responseMode: 'embed',
      responseEmbedColor: '#16a34a',
      cooldownSeconds: 30,
    }),
  },

  /* ─── FAQ ─── */
  {
    key: 'faq',
    icon: 'fa-comments',
    label: 'FAQ',
    description: 'Частые вопросы',
    build: () => ({
      name: 'faq',
      description: 'Частые вопросы и ответы',
      response:
        '**❓ Как получить роли?**\n' +
        'Открой канал <#rules> и выбери роль через кнопки.\n\n' +
        '**❓ Как связаться с админом?**\n' +
        'Создай тикет командой `/ticket`.\n\n' +
        '**❓ Почему я не получаю XP?**\n' +
        'XP начисляется за сообщения, команды и голосовую активность.',
      responseMode: 'embed',
      responseEmbedColor: '#8b5cf6',
      cooldownSeconds: 30,
    }),
  },

  /* ─── Опрос ─── */
  {
    key: 'poll',
    icon: 'fa-square-poll-vertical',
    label: 'Опрос',
    description: 'Заготовка для голосования',
    build: () => ({
      name: 'poll',
      description: 'Создать опрос',
      response:
        '📊 **Вопрос:** ...\n\n' +
        '1️⃣ вариант 1\n' +
        '2️⃣ вариант 2\n' +
        '3️⃣ вариант 3\n\n' +
        '_Поставьте реакцию, чтобы проголосовать._',
      responseMode: 'text',
      cooldownSeconds: 0,
    }),
  },

  /* ─── Розыгрыш ─── */
  {
    key: 'giveaway',
    icon: 'fa-gift',
    label: 'Розыгрыш',
    description: 'Анонс розыгрыша',
    build: () => ({
      name: 'giveaway',
      description: 'Объявить розыгрыш',
      response:
        '🎁 **РОЗЫГРЫШ** 🎁\n\n' +
        'Приз: **...**\n' +
        'Условия: **...**\n' +
        'Окончание: **{date}**\n\n' +
        'Поставь реакцию 🎉, чтобы участвовать!\n' +
        '_Организатор: {user}_',
      responseMode: 'embed',
      responseEmbedColor: '#f59e0b',
      cooldownSeconds: 0,
    }),
  },

  /* ─── Контакты ─── */
  {
    key: 'contacts',
    icon: 'fa-address-book',
    label: 'Контакты',
    description: 'Связь с администрацией',
    build: () => ({
      name: 'contacts',
      description: 'Связь с администрацией',
      response:
        '**Связаться с нами:**\n\n' +
        '📧 Email: admin@example.com\n' +
        '💬 Discord: @admin\n' +
        '🎟 Тикет: `/ticket`\n\n' +
        'Отвечаем в течение 24 часов.',
      responseMode: 'embed',
      responseEmbedColor: '#3b82f6',
      cooldownSeconds: 60,
    }),
  },

  /* ─── Соцсети ─── */
  {
    key: 'social',
    icon: 'fa-globe',
    label: 'Соцсети',
    description: 'Ссылки на наши ресурсы',
    build: () => ({
      name: 'social',
      description: 'Наши соцсети',
      response:
        '**Наши соцсети:**\n\n' +
        '🌐 Сайт: [example.com](https://example.com)\n' +
        '📺 YouTube: [YouTube-канал](https://youtube.com)\n' +
        '💬 Discord: [Наш сервер](https://discord.gg/example)\n' +
        '📸 Instagram: [@example](https://instagram.com/example)',
      responseMode: 'embed',
      responseEmbedColor: '#ec4899',
      cooldownSeconds: 60,
    }),
  },
];

export function getCommandPresets() {
  return COMMAND_PRESETS;
}

export function findCommandPreset(key) {
  return COMMAND_PRESETS.find((p) => p.key === key) || null;
}

export default COMMAND_PRESETS;