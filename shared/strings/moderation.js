// shared/strings/moderation.js

export const moderation = {
  pageTitle: 'Модерация',
  pageSubtitle: 'Журнал наказаний, активные санкции и ручные действия',

  punish: 'Выдать наказание',

  kinds: {
    warn: 'Предупреждение',
    mute: 'Мут',
    ban:  'Бан',
    kick: 'Кик',
    auto: 'Автодействие',
  },

  verbs: {
    warn: 'Получил предупреждение',
    mute: 'Получил мут',
    ban:  'Забанен',
    kick: 'Кикнут',
  },

  status: {
    active:  'Активно',
    expired: 'Истекло',
    removed: 'Снято',
    executed: 'Выполнено',
  },

  kpi: {
    activeMutes: 'Активные муты',
    activeBans:  'Активные баны',
    warns7d:     'Предупреждения',
    auto7d:      'Автодействия',
    hintActiveMutes: 'Муты, которые сейчас действуют в Discord.',
    hintActiveBans:  'Баны, которые сейчас действуют в Discord.',
    hintWarns7d:     'Все предупреждения за последние 7 дней.',
    hintAuto7d:      'Наказания, выданные автомодерацией за последние 7 дней.',
  },

  tabs: {
    active:  'Активные',
    journal: 'Журнал',
  },

  toolbar: {
    search: 'Поиск: пользователь, модератор, причина...',
    kindAll: 'Все типы',
    sinceAll: 'Всё время',
    since24h: 'За 24 часа',
    since7d: 'За 7 дней',
    since30d: 'За 30 дней',
    reset: 'Сбросить фильтры',
  },

  list: {
    emptyTitle: 'Ничего не найдено',
    emptyHint: 'Попробуйте изменить фильтры или выдайте наказание',
    emptyJournal: 'Журнал пуст',
    emptyJournalHint: 'Здесь появятся все наказания — автоматические и ручные',
    emptyActive: 'Нет активных санкций',
    emptyActiveHint: 'Все наказания истекли или были сняты',
    unknownUser: 'Неизвестный пользователь',
    unknownModerator: 'Неизвестный модератор',
    forever: 'Бессрочно',
    until: 'До',
    created: 'Создано',
    expires: 'Истекает',
    remaining: 'осталось',
    progressLabel: (percent, remaining) => `${percent}% · осталось ${remaining}`,

    /* Шаблоны фраз для сборки описания */
    byRule: (name) => `по правилу «${name}»`,
    byReason: (reason) => `по причине «${reason}»`,
    violation: (n) => `нарушение №${n}`,
    groupedTimes: (n) => `×${n}`,
    groupedSuffix: (n) => ` (×${n} подряд)`,
    groupAria: (n) => `Развернуть ${n} наказаний`,
  },

  actions: {
    detail: 'Подробнее',
    remove: 'Снять наказание',
    removeConfirm: (kind, user) => `Снять наказание «${kind}» с ${user}?`,
    removed: 'Наказание снято',
    removeFailed: 'Не удалось снять наказание',
    cannotRevert: 'Кик нельзя снять — пользователь уже покинул сервер',
    alreadyRemoved: 'Наказание уже снято',
  },

  pagination: {
    prev: 'Назад',
    next: 'Вперёд',
    pageInfo: (page, pages) => `Стр. ${page} из ${pages}`,
  },

  punishModal: {
    title: 'Выдать наказание',
    subtitle: 'Предупреждение, мут или бан',
    userId: 'ID пользователя',
    userIdPlaceholder: 'Правый клик → Копировать ID',
    kind: 'Тип наказания',
    reason: 'Причина',
    reasonPlaceholder: 'Например: спам, оскорбления, нарушение правил',
    duration: 'Длительность',
    durationMinutes: 'Минут',
    forever: 'Бессрочно',
    foreverHint: 'Для мута и бана: если не указана длительность — наказание будет действовать до снятия вручную.',
    durationDisabled: 'Для предупреждений длительность не применяется',
    submit: 'Применить',
    userIdRequired: 'Введите ID пользователя',
    done: 'Наказание выдано',
    discordFailed: 'Discord не принял действие',
  },

  detailModal: {
    title: 'Детали наказания',
    user: 'Пользователь',
    moderator: 'Модератор',
    reason: 'Причина',
    rule: 'Правило',
    violation: 'Нарушение',
    kind: 'Тип',
    status: 'Статус',
    createdAt: 'Создано',
    expiresAt: 'Истекает',
    removedAt: 'Снято',
    removedBy: 'Снял',
    removedBySystem: 'Система (истёк срок)',
    removedByUnknown: 'Неизвестно',
    id: 'ID записи',
    remaining: 'Осталось',
    progress: 'Прогресс',
    close: 'Закрыть',
    removeAction: 'Снять наказание',
    kickNote: 'Кик — мгновенное действие, снять его нельзя',
    expiredNote: 'Наказание уже истекло',
    removedNote: 'Наказание уже снято',
    auto: 'Автоматически',
    timesSuffix: (n) => ` · ${n} ${n === 1 ? 'раз' : 'раз'}`,
  },

  errors: {
    loadFailed: 'Не удалось загрузить данные модерации',
    botOffline: 'Бот офлайн — запустите его',
  },
};