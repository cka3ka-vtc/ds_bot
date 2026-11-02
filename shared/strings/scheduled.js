// shared/strings/scheduled.js

export const scheduled = {
  pageTitle: 'Отложенные сообщения',
  pageSubtitle: 'Автоматическая отправка сообщений в заданную дату и время',

  emptyTitle: 'Пока нет отложенных сообщений',
  emptyHint: 'Создайте первое — бот отправит его в канал в указанное время',
  emptySearchTitle: 'Ничего не найдено',
  emptySearchHint: 'Попробуйте изменить поисковый запрос или создайте новое сообщение',

  createBtn: 'Создать сообщение',
  searchPlaceholder: 'Поиск по названию или каналу...',

  status: {
    pending: 'Ожидает',
    sent:    'Отправлено',
    error:   'Ошибка',
  },

  card: {
    planned: 'Запланировано',
    sent: 'Отправлено',
  },

  actions: {
    enable: 'Включить',
    disable: 'Выключить',
    edit: 'Редактировать',
    duplicate: 'Копировать',
    sendNow: 'Отправить сейчас',
    sendNowConfirm: (name) => `Отправить сообщение «${name}» прямо сейчас?`,
    sendNowDone: 'Сообщение отправлено',
    sendNowFailed: 'Не удалось отправить',
    remove: 'Удалить',
    removeConfirm: (name) => `Удалить отложенное сообщение «${name}»?`,
  },

  editor: {
    createTitle: 'Новое отложенное сообщение',
    editTitle: 'Редактирование отложенного сообщения',
    subtitle: 'Выберите канал, дату и настройте содержимое',

    nameLabel: 'Название',
    namePlaceholder: 'Например: «Анонс ивента»',
    nameHint: 'Видно только вам в панели — участники его не увидят',

    channelLabel: 'Канал',
    channelHint: 'Куда отправить сообщение в указанное время',

    whenLabel: 'Дата и время',
    whenHint: 'Время в вашем часовом поясе',

    messageTitle: 'Содержимое сообщения',
    messageSubtitle: 'Что увидит участник в назначенное время',

    channelStatus: {
      empty: 'Канал не выбран',
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
    enabled: 'Сообщение включено',
    disabled: 'Сообщение выключено',
    deleted: 'Сообщение удалено',
    duplicated: 'Копия создана (выключена)',
    saveFailed: 'Ошибка сохранения',
    deleteFailed: 'Ошибка удаления',
    needName: 'Введите название',
    needChannel: 'Выберите канал',
    needContent: 'Настройте содержимое сообщения',
    needDate: 'Укажите дату и время',
    pastDate: 'Дата должна быть минимум через 1 минуту',
    noSendPermission: 'Бот не может писать в этот канал',
    invalidChannel: 'Канал не найден или недоступен боту',
  },

  errors: {
    loadFailed: 'Не удалось загрузить сообщения',
    botOffline: 'Бот офлайн — запустите его',
  },
};