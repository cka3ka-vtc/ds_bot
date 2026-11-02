// shared/strings/message-templates.js

export const messageTemplates = {
  pageTitle: 'Сообщения',
  pageSubtitle: 'Заготовленные сообщения — отправьте в канал в любой момент',

  emptyTitle: 'Пока нет заготовленных сообщений',
  emptyHint: 'Создайте первое — его можно будет отправить в канал одним кликом',
  emptySearchTitle: 'Ничего не найдено',
  emptySearchHint: 'Попробуйте изменить поисковый запрос или создайте новое сообщение',

  createBtn: 'Создать сообщение',
  searchPlaceholder: 'Поиск по названию...',

  card: {
    created: 'Создано',
    sent: 'Отправлено',
    noChannel: 'Канал не задан',
  },

  actions: {
    edit: 'Редактировать',
    duplicate: 'Копировать',
    send: 'Отправить',
    remove: 'Удалить',
    removeConfirm: (name) => `Удалить сообщение «${name}»?`,
  },

  sendModal: {
    title: 'Отправить сообщение',
    subtitle: 'Выберите канал, куда отправить шаблон',
    channelLabel: 'Канал',
    channelPlaceholder: 'Выберите канал...',
    submit: 'Отправить',
    done: 'Сообщение отправлено',
    failed: 'Не удалось отправить',
    needChannel: 'Выберите канал',
  },

  editor: {
    createTitle: 'Новое сообщение',
    editTitle: 'Редактирование сообщения',
    subtitle: 'Настройте содержимое — отправлять в канал вручную',

    nameLabel: 'Название',
    namePlaceholder: 'Например: «Приветствие»',
    nameHint: 'Видно только вам в панели',

    channelLabel: 'Канал по умолчанию',
    channelHint: 'Необязательно. При отправке можно будет выбрать другой канал.',
    channelPlaceholder: 'Не выбран — выбирать при отправке',

    messageTitle: 'Содержимое сообщения',
    messageSubtitle: 'Что увидит участник',

    channelStatus: {
      empty: 'Канал не выбран — при отправке выберете',
      checking: (name) => `Проверка прав в #${name}...`,
      notFound: 'Канал не найден',
      ok: 'Бот может писать в этот канал',
      missing: (list) => `Не хватает прав: ${list}`,
      checkFailed: 'Не удалось проверить права',
    },
  },

  toast: {
    created: 'Сообщение создано',
    updated: 'Сообщение сохранено',
    deleted: 'Сообщение удалено',
    duplicated: 'Копия создана',
    saveFailed: 'Ошибка сохранения',
    deleteFailed: 'Ошибка удаления',
    needName: 'Введите название',
    needContent: 'Настройте содержимое сообщения',
  },

  errors: {
    loadFailed: 'Не удалось загрузить сообщения',
    botOffline: 'Бот офлайн — запустите его',
  },
};