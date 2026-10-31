// public/assets/js/views/module-settings/message-editor-tokens.js
import { UI } from '/shared/ui-strings.js';

const CATEGORY_LABELS = UI.msgEditor.categories;

export const TOKENS_BY_CONTEXT = {
  /* ─────── greetings ─────── */
  greetings: {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', UI.msgEditor.tokens.greetings.user],
        ['username', UI.msgEditor.tokens.greetings.username],
        ['displayName', UI.msgEditor.tokens.greetings.displayName],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', UI.msgEditor.tokens.greetings.guild],
        ['count', UI.msgEditor.tokens.greetings.count],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan',
      displayName: 'Иван', guild: 'Мой сервер', count: '1234',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ─────── levels.levelUp ─────── */
  'levels.levelUp': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', UI.msgEditor.tokens.levels.user],
        ['displayName', UI.msgEditor.tokens.levels.displayName],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['level', UI.msgEditor.tokens.levels.level],
        ['oldLevel', UI.msgEditor.tokens.levels.oldLevel],
        ['title', UI.msgEditor.tokens.levels.title],
        ['xp', UI.msgEditor.tokens.levels.xp],
        ['nextLevelXp', UI.msgEditor.tokens.levels.nextLevelXp],
        ['xpToNext', UI.msgEditor.tokens.levels.xpToNext],
        ['progress', UI.msgEditor.tokens.levels.progress],
        ['progressPercent', UI.msgEditor.tokens.levels.progressPercent],
        ['position', UI.msgEditor.tokens.levels.position],
        ['rewardRole', UI.msgEditor.tokens.levels.rewardRole],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', UI.msgEditor.tokens.levels.guild],
        ['count', UI.msgEditor.tokens.levels.count],
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

  /* ─────── levels.rank ─────── */
  'levels.rank': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', UI.msgEditor.tokens.levels.user],
        ['username', UI.msgEditor.tokens.greetings.username],
        ['displayName', UI.msgEditor.tokens.levels.displayName],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['level', UI.msgEditor.tokens.levels.level],
        ['title', UI.msgEditor.tokens.levels.title],
        ['xp', UI.msgEditor.tokens.levels.xp],
        ['nextLevelXp', UI.msgEditor.tokens.levels.nextLevelXp],
        ['xpToNext', UI.msgEditor.tokens.levels.xpToNext],
        ['progress', UI.msgEditor.tokens.levels.progress],
        ['progressPercent', UI.msgEditor.tokens.levels.progressPercent],
        ['position', UI.msgEditor.tokens.levels.position],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', UI.msgEditor.tokens.levels.guild],
        ['count', UI.msgEditor.tokens.levels.count],
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

  /* ─────── levels.leaderboard ─────── */
  'levels.leaderboard': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', UI.msgEditor.tokens.levels.guild],
        ['count', UI.msgEditor.tokens.levels.count],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['topUsers', 'Готовый список участников с медалями (markdown)'],
        ['topCount', 'Сколько участников в топе'],
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

  /* ─────── levels.daily ─────── */
  'levels.daily': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', UI.msgEditor.tokens.levels.user],
        ['displayName', UI.msgEditor.tokens.levels.displayName],
      ]},
      { label: CATEGORY_LABELS.levels, items: [
        ['xpGained', 'Сколько XP получено сегодня'],
        ['newXp', 'Новый накопленный XP'],
        ['newLevel', 'Новый уровень'],
        ['nextDailyAt', 'Когда снова можно будет получить'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', UI.msgEditor.tokens.levels.guild],
        ['count', UI.msgEditor.tokens.levels.count],
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

  /* ─────── birthdays.announce ─────── */
  'birthdays.announce': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание именинника'],
        ['username', 'Ник без @'],
        ['displayName', 'Отображаемое имя'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года (ДД.ММ)'],
        ['birthdayFull', 'Полная дата (ДД.ММ или ДД.ММ.ГГГГ)'],
        ['age', 'Исполняющийся возраст (пусто, если год не указан)'],
        ['birthdaysCount', 'Сколько участников указали ДР на сервере'],
      ]},
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Всего участников'],
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06',
      birthdayFull: '15.06.1995',
      age: '30',
      birthdaysCount: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ─────── birthdays.cmdSet ─────── */
  'birthdays.cmdSet': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание'],
        ['displayName', 'Отображаемое имя'],
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
      ]},
    ],
    preview: {
      user: '@Иван', mention: '@Иван', username: 'ivan', displayName: 'Иван',
      guild: 'Мой сервер', count: '1234',
      birthday: '15.06',
      birthdayFull: '15.06.1995',
      age: '30',
      birthdaysCount: '42',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ─────── birthdays.cmdToggle ─────── */
  'birthdays.cmdToggle': {
    categories: [
      { label: CATEGORY_LABELS.user, items: [
        ['user', 'Упоминание'],
        ['displayName', 'Отображаемое имя'],
      ]},
      { label: 'День рождения', items: [
        ['birthday', 'Дата без года (ДД.ММ)'],
        ['birthdayFull', 'Полная дата (ДД.ММ или ДД.ММ.ГГГГ)'],
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
      birthday: '15.06',
      birthdayFull: '15.06.1995',
      age: '30',
      birthdaysCount: '42',
      state: 'включены',
      avatarUrl: '', guildIconUrl: '',
    },
  },

  /* ─────── birthdays.cmdList ─────── */
  'birthdays.cmdList': {
    categories: [
      { label: CATEGORY_LABELS.server, items: [
        ['guild', 'Имя сервера'],
        ['count', 'Сколько в списке'],
      ]},
      { label: 'День рождения', items: [
        ['topUsers', 'Готовый список ближайших ДР (markdown с медалями)'],
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
};

export function getTokensFor(context) {
  return TOKENS_BY_CONTEXT[context] || TOKENS_BY_CONTEXT.greetings;
}

export default TOKENS_BY_CONTEXT;