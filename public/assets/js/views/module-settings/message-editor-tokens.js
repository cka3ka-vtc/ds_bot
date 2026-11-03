// public/assets/js/views/module-settings/message-editor-tokens.js
import { UI } from '/shared/ui-strings.js';

const CATEGORY_LABELS = UI.msgEditor.categories;
const T = UI.msgEditor.tokens;

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

  /* ───────── 🆕 role-button-response ───────── */
  'role-button-response': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание пользователя', 'mention'],
        ['username', 'Ник'],
        ['displayName', 'Отображаемое имя'],
        ['avatarUrl', 'URL аватара', 'url'],
      ]},
      { label: 'Роль', items: [
        ['roleName', 'Название роли'],
        ['roleMention', 'Упоминание роли', 'mention'],
        ['roleState', 'Состояние (выдана / снята)'],
        ['roleAction', 'Следующее действие (выдать / снять)'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['guildIconUrl', 'URL иконки сервера', 'url'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', guildIconUrl: '',
      roleName: 'Награда', roleMention: '@Награда',
      roleState: 'выдана', roleAction: 'снять',
      avatarUrl: '',
    },
  },

  /* ───────── levels ───────── */
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
      level: '10', oldLevel: '9', title: 'Легенда',
      xp: '1100', nextLevelXp: '1500', xpToNext: '400',
      progress: '680 / 1100', progressPercent: '62',
      position: '42', rank: '42',
      rewardRole: '@Награда',
      avatarUrl: '', guildIconUrl: '',
    },
  },

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
      level: '10', title: 'Легенда',
      xp: '1100', nextLevelXp: '1500', xpToNext: '400',
      progress: '680 / 1100', progressPercent: '62',
      position: '42', rank: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

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
      topUsers: '🥇 @user1 — **1200 XP** · Ур. 12 · Легенда\n🥈 @user2 — **980 XP** · Ур. 10',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  'levels.daily': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', T.levels.user, 'mention'],
        ['displayName', T.levels.displayName],
        ['avatarUrl', T.levels.avatarUrl, 'url'],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['xpGained', 'Сколько XP получено сегодня'],
        ['newXp', 'Текущий накопленный XP'],
        ['newLevel', 'Текущий уровень'],
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

  /* ───────── birthdays ───────── */
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
        ['birthdaysCount', 'Сколько участников узнали ДР'],
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
        ['age', 'Возраст'],
        ['birthdaysCount', 'Всего ДР'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06', birthdayFull: '15.06.1995', age: '30', birthdaysCount: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  'birthdays.cmdToggle': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['displayName', 'Отображаемое имя'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года'],
        ['birthdayFull', 'Полная дата'],
        ['age', 'Возраст'],
        ['birthdaysCount', 'Всего ДР'],
        ['state', 'Состояние (включена / отключена)'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06', birthdayFull: '15.06.1995', age: '30',
      birthdaysCount: '42', state: 'включена',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  'birthdays.cmdList': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
      ]},
      { label: 'День рождения', items: [
        ['topUsers', 'Топ ДР (markdown)', 'markdown'],
        ['birthdaysCount', 'Всего ДР'],
      ]},
    ],
    preview: {
      guild: 'Мой сервер', count: '3', birthdaysCount: '42',
      topUsers: '**1.** @user1 — **15.06.1995**\n**2.** @user2 — **22.06**',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ───────── sticky / scheduled / message-templates ───────── */
  sticky: {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
        ['guildIconUrl', 'URL иконки', 'url'],
      ]},
    ],
    preview: { guild: 'Мой сервер', count: '1234', guildIconUrl: '' },
  },

  scheduled: {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
        ['guildIconUrl', 'URL иконки', 'url'],
      ]},
    ],
    preview: { guild: 'Мой сервер', count: '1234', guildIconUrl: '' },
  },

  'message-templates': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'], ['count', 'Участников'],
        ['guildIconUrl', 'URL иконки', 'url'],
      ]},
    ],
    preview: { guild: 'Мой сервер', count: '1234', guildIconUrl: '' },
  },

  /* ───────── moderation ───────── */
  'moderation.dm': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'],
        ['username', 'Ник'], ['displayName', 'Имя'],
      ]},
      { label: 'Наказание', items: [
        ['reason', 'Причина'], ['action', 'Действие'],
        ['filter', 'Имя фильтра'], ['violation', 'Нарушение'],
        ['matched', 'Слово/URL'],
        ['message', 'Текст сообщения'],
      ]},
      { label: 'Канал', items: [
        ['channel', 'Упоминание #'], ['channelText', 'Имя #'],
        ['channelName', 'Имя без #'],
      ]},
      { label: CATEGORY_LABELS.server, items: [['guild', 'Имя сервера']] },
    ],
    preview: {
      user: '@Иван', username: 'ivan', displayName: 'Иван',
      reason: 'спам', action: 'мут', filter: 'Спам',
      violation: '3', matched: 'слово',
      message: 'текст', channel: '#general', channelText: '#general',
      channelName: 'general', guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  'moderation.log': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание', 'mention'], ['username', 'Ник'],
        ['displayName', 'Имя'], ['userId', 'ID'],
      ]},
      { label: 'Наказание', items: [
        ['reason', 'Причина'], ['action', 'Действие'],
        ['filter', 'Фильтр'], ['violation', 'Нарушение'],
      ]},
      { label: 'Канал', items: [
        ['channel', 'Упоминание'], ['channelText', 'Имя #'],
        ['channelName', 'Имя'], ['message', 'Сообщение'],
      ]},
      { label: CATEGORY_LABELS.server, items: [['guild', 'Имя сервера']] },
    ],
    preview: {
      user: '@Иван', username: 'ivan', displayName: 'Иван', userId: '123456',
      reason: 'спам', action: 'мут', filter: 'Спам', violation: '3',
      channel: '#general', channelText: '#general', channelName: 'general',
      message: 'текст', guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  'moderation.raid': {
    categories: [
      { label: 'Обнаружение', items: [
        ['reason', 'Причина рейда'],
        ['message', 'Текст лога'],
        ['filter', 'Фильтр'],
      ]},
      { label: CATEGORY_LABELS.server, items: [['guild', 'Имя сервера']] },
    ],
    preview: {
      reason: 'обнаружена волна',
      message: 'текст',
      filter: 'Рейд',
      guild: 'Мой сервер',
      avatarUrl: '', guildIconUrl: '',
    },
  },
};

export function getTokensFor(context) {
  return TOKENS_BY_CONTEXT[context] || TOKENS_BY_CONTEXT.greetings;
}

export function isTokenAllowed(kind, fieldContext, isV2) {
  if (fieldContext === 'url')    return kind === 'url';
  if (fieldContext === 'title')  return kind === 'text';
  if (fieldContext === 'label')  return kind === 'text';
  if (fieldContext === 'footer') return kind === 'text';
  if (isV2) return kind === 'text' || kind === 'markdown';
  return true;
}

export default TOKENS_BY_CONTEXT;