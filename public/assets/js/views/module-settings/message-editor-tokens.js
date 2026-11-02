// public/assets/js/views/module-settings/message-editor-tokens.js
import { UI } from '/shared/ui-strings.js';

const CATEGORY_LABELS = UI.msgEditor.categories;
const T = UI.msgEditor.tokens;

/**
 * Формат элементов: [id, description, kind?]
 *
 * kind:
 *   'text'      — обычный текст, работает везде (кроме URL-полей);
 *   'url'       — URL-значение, только для URL-полей (thumbnail/image/file/button.url);
 *   'mention'   — упоминание вида @id / #id, НЕ рендерится в V2, кнопках, title, footer;
 *   'timestamp' — Discord-тег времени, НЕ рендерится в V2, кнопках, title, footer;
 *   'markdown'  — markdown-разметка и список @user, НЕ рендерится в кнопках.
 *
 * Если kind не указан — 'text'.
 */
export const TOKENS_BY_CONTEXT = {
  /* ───────── greetings ───────── */
  greetings: {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', T.greetings.user, 'mention'],
        ['username', T.greetings.username],
        ['displayName', T.greetings.displayName],
        ['avatarUrl', T.greetings.avatarUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', T.greetings.guild],
        ['count', T.greetings.count],
        ['guildIconUrl', T.greetings.guildIconUrl, 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan',
      displayName: 'Иван', guild: 'Мой сервер', count: '1234',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── levels.levelUp ───────── */
  'levels.levelUp': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', T.levels.user, 'mention'],
        ['displayName', T.levels.displayName],
        ['avatarUrl', T.levels.avatarUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['level', T.levels.level],
        ['oldLevel', T.levels.oldLevel],
        ['title', T.levels.title],
        ['xp', T.levels.xp],
        ['nextLevelXp', T.levels.nextLevelXp],
        ['xpToNext', T.levels.xpToNext],
        ['progress', T.levels.progress],
        ['progressPercent', T.levels.progressPercent],
        ['position', T.levels.position],
        ['rewardRole', T.levels.rewardRole],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', T.levels.guild],
        ['count', T.levels.count],
        ['guildIconUrl', T.levels.guildIconUrl, 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      level: '10', oldLevel: '9', title: 'Активист',
      xp: '1100', nextLevelXp: '1500', xpToNext: '400',
      progress: '680 / 1100', progressPercent: '62',
      position: '42', rank: '42',
      rewardRole: '@Постоянный',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── levels.rank ───────── */
  'levels.rank': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', T.levels.user, 'mention'],
        ['username', T.greetings.username],
        ['displayName', T.levels.displayName],
        ['avatarUrl', T.levels.avatarUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['level', T.levels.level],
        ['title', T.levels.title],
        ['xp', T.levels.xp],
        ['nextLevelXp', T.levels.nextLevelXp],
        ['xpToNext', T.levels.xpToNext],
        ['progress', T.levels.progress],
        ['progressPercent', T.levels.progressPercent],
        ['position', T.levels.position],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', T.levels.guild],
        ['count', T.levels.count],
        ['guildIconUrl', T.levels.guildIconUrl, 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      level: '10', title: 'Активист',
      xp: '1100', nextLevelXp: '1500', xpToNext: '400',
      progress: '680 / 1100', progressPercent: '62',
      position: '42', rank: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── levels.leaderboard ───────── */
  'levels.leaderboard': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', T.levels.guild],
        ['count', T.levels.count],
        ['guildIconUrl', T.levels.guildIconUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['topUsers', T.levels.topUsers, 'markdown'],
        ['topCount', T.levels.topCount],
      ]},
    ],
    preview: {
      guild: 'Мой сервер', count: '1234', topCount: '42',
      topUsers:
        '🥇 @user1 — **1200 XP** · Ур. 12 · Активист\n' +
        '🥈 @user2 — **980 XP** · Ур. 10 · Тихоня\n' +
        '🥉 @user3 — **750 XP** · Ур. 9',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── levels.daily ───────── */
  'levels.daily': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', T.levels.user, 'mention'],
        ['displayName', T.levels.displayName],
        ['avatarUrl', T.levels.avatarUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['xpGained', 'Сколько XP получено сегодня'],
        ['newXp', 'Новый накопленный XP'],
        ['newLevel', 'Новый уровень'],
        ['nextDailyAt', T.levels.nextDailyAt, 'timestamp'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', T.levels.guild],
        ['count', T.levels.count],
        ['guildIconUrl', T.levels.guildIconUrl, 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      xpGained: '150', newXp: '1250', newLevel: '10',
      nextDailyAt: '__preview_tomorrow__',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── birthdays.announce ───────── */
  'birthdays.announce': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание именинника', 'mention'],
        ['username', 'Ник без @'],
        ['displayName', 'Отображаемое имя'],
        ['avatarUrl', 'URL аватара', 'url'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года (ДД.ММ)'],
        ['birthdayFull', 'Полная дата (ДД.ММ или ДД.ММ.ГГГГ)'],
        ['age', 'Исполняющийся возраст'],
        ['birthdaysCount', 'Сколько участников указали ДР'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
        ['guildIconUrl', 'URL иконки сервера', 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06', birthdayFull: '15.06.1995', age: '30',
      birthdaysCount: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── birthdays.cmdSet ───────── */
  'birthdays.cmdSet': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['displayName', 'Отображаемое имя'],
        ['avatarUrl', 'URL аватара', 'url'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года'],
        ['birthdayFull', 'Полная дата'],
        ['age', 'Исполняющийся возраст'],
        ['birthdaysCount', 'Сколько участников указали ДР'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06', birthdayFull: '15.06.1995', age: '30',
      birthdaysCount: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── birthdays.cmdToggle ───────── */
  'birthdays.cmdToggle': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['displayName', 'Отображаемое имя'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года'],
        ['birthdayFull', 'Полная дата'],
        ['age', 'Исполняющийся возраст'],
        ['birthdaysCount', 'Сколько участников указали ДР'],
        ['state', 'Текущее состояние: «включены» / «отключены»'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06', birthdayFull: '15.06.1995', age: '30',
      birthdaysCount: '42', state: 'включены',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── birthdays.cmdList ───────── */
  'birthdays.cmdList': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Сколько в списке'],
      ]},
      { label: 'День рождения', items: [
        ['topUsers', 'Готовый список ближайших ДР (markdown с медалями)', 'markdown'],
        ['birthdaysCount', 'Сколько участников указали ДР'],
      ]},
    ],
    preview: {
      guild: 'Мой сервер', count: '3', birthdaysCount: '42',
      topUsers:
        '**1.** @user1 — **15.06.1995** (сегодня · 30 лет)\n' +
        '**2.** @user2 — **22.06** (через 7 дн.)\n' +
        '**3.** @user3 — **01.07.2001** (через 16 дн. · 24 лет)',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── sticky ───────── */
  sticky: {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
        ['guildIconUrl', 'URL иконки сервера', 'url'],
      ]},
    ],
    preview: {
      guild: 'Мой сервер',
      count: '1234',
      guildIconUrl: '',
    },
  },

  /* ───────── scheduled ───────── */
  scheduled: {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
        ['guildIconUrl', 'URL иконки сервера', 'url'],
      ]},
    ],
    preview: {
      guild: 'Мой сервер', count: '1234', guildIconUrl: '',
    },
  },

  /* ───────── message-templates ───────── */
  'message-templates': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
        ['guildIconUrl', 'URL иконки сервера', 'url'],
      ]},
    ],
    preview: {
      guild: 'Мой сервер', count: '1234', guildIconUrl: '',
    },
  },

  /* ───────── moderation.dm ───────── */
  'moderation.dm': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['username', 'Ник без @'],
        ['displayName', 'Отображаемое имя'],
      ]},
      { label: 'Наказание', items: [
        ['reason', 'Причина'],
        ['action', 'Действие'],
        ['filter', 'Имя фильтра'],
        ['violation', 'Номер нарушения по этому фильтру'],
        ['matched', 'Найденное слово / URL'],
        ['message', 'Текст сообщения (markdown экранирован, до 1900 символов)'],
      ]},
      { label: 'Канал', items: [
        ['channel', 'Кликабельный #канал (на мобильном может показать «нет доступа»)'],
        ['channelText', 'Текст #канал — работает всегда, но без клика'],
        ['channelName', 'Имя канала без #'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
      ]},
    ],
    preview: {
      user: '@Иван', username: 'ivan', displayName: 'Иван',
      reason: 'спам: 5 за 3 с', action: 'мут', filter: 'Антиспам',
      violation: '3', matched: 'слово',
      message: 'КУПИТЕ ДЕШЕВЫЕ ПОДПИСЧИКИ!!! bit.ly/xxxxx',
      channel: '#general', channelText: '#general', channelName: 'general',
      guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── moderation.log ───────── */
  'moderation.log': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['username', 'Ник'],
        ['displayName', 'Имя'],
        ['userId', 'ID пользователя'],
      ]},
      { label: 'Наказание', items: [
        ['reason', 'Причина'],
        ['action', 'Действие'],
        ['filter', 'Имя фильтра'],
        ['violation', 'Номер нарушения по этому фильтру'],
      ]},
      { label: 'Канал', items: [
        ['channel', 'Кликабельный #канал (на мобильном может показать «нет доступа»)'],
        ['channelText', 'Текст #канал — работает всегда, но без клика'],
        ['channelName', 'Имя канала без #'],
        ['message', 'Текст сообщения (markdown экранирован, до 1900 символов)'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
      ]},
    ],
    preview: {
      user: '@Иван', username: 'ivan', displayName: 'Иван', userId: '123456',
      reason: 'спам: 5 за 3 с', action: 'мут', filter: 'Антиспам',
      violation: '3',
      channel: '#general', channelText: '#general', channelName: 'general',
      message: 'КУПИТЕ ДЕШЕВЫЕ ПОДПИСЧИКИ!!! bit.ly/xxxxx',
      guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── moderation.raid ───────── */
  'moderation.raid': {
    categories: [
      { label: 'Антирейд', items: [
        ['reason', 'Название события: «Волна входов», «Подозрительный аккаунт»'],
        ['message', 'Детали события (вошедших, raid mode, возраст аккаунта, действие)'],
        ['filter', 'Имя фильтра — «Антирейд»'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
      ]},
    ],
    preview: {
      reason: 'Обнаружена "**Волна входов**", для них будет предпринято действие: **кик всех вошедших**.',
      message: '👥 Вошедших: **15** за **10 с** · Raid mode **активен 60 мин** (новые входы — **кик**).',
      filter: 'Антирейд',
      guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },
};

export function getTokensFor(context) {
  return TOKENS_BY_CONTEXT[context] || TOKENS_BY_CONTEXT.greetings;
}

/**
 * Разрешён ли токен данного kind в поле данного контекста.
 *
 * @param {string} kind — 'text' | 'url' | 'mention' | 'timestamp' | 'markdown'
 * @param {string} fieldContext — 'rich' | 'title' | 'label' | 'footer' | 'url'
 * @param {boolean} isV2 — true, если displayMode === 'flat' (Components V2)
 */
export function isTokenAllowed(kind, fieldContext, isV2) {
  if (fieldContext === 'url')    return kind === 'url';
  if (fieldContext === 'title')  return kind === 'text';
  if (fieldContext === 'label')  return kind === 'text';
  if (fieldContext === 'footer') return kind === 'text';

  if (isV2) return kind === 'text' || kind === 'markdown';
  return true;
}

export default TOKENS_BY_CONTEXT;