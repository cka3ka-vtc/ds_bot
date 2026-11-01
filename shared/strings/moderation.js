// shared/strings/moderation.js

export const moderation = {
  punish: 'Выдать наказание',
  kinds: { warn: 'Предупреждение', mute: 'Мут', ban: 'Бан', auto: 'Автодействие' },
  kpi: { warns: 'Предупреждения', mutes: 'Муты', bans: 'Баны', auto: 'Автодействия' },
  log: {
    title: 'Журнал действий',
    searchPlaceholder: 'Поиск...',
    filterAll: 'Все типы',
    emptyTitle: 'Журнал пуст',
    emptyHint: 'Наказания будут появляться здесь',
    notFoundTitle: 'Ничего не найдено',
    removeConfirm: 'Снять наказание?',
    removed: 'Наказание снято',
    expires: 'истекает',
    noReason: 'без причины',
    removeLabel: 'Снять',
    unknown: 'неизвестно',
  },
  active: {
    title: 'Активные санкции',
    mutes: 'Муты', bans: 'Баны', warns: 'Предупреждения',
    empty: 'Нет',
    until: 'до',
    forever: 'бессрочно',
    noReason: 'без причины',
  },
  punishModal: {
    title: 'Выдать наказание',
    subtitle: 'Предупреждение, мут или бан',
    userId: 'ID пользователя', userIdPlaceholder: '123456789',
    kind: 'Тип', reason: 'Причина', reasonPlaceholder: 'Спам',
    duration: 'Длительность (минут, пусто = навсегда)', submit: 'Выдать',
    done: 'Наказание выдано', userIdRequired: 'Введите ID',
  },
  emptyTitle: 'Выберите сервер',
  emptyHint: 'Сначала выберите сервер в сайдбаре',
};