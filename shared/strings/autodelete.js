// shared/strings/autodelete.js

export const autodelete = {
  pageTitle: 'Автоудаление',
  pageSubtitle: 'Автоматически удалять сообщения в выбранных каналах',

  emptyTitle: 'Пока нет правил автоудаления',
  emptyHint: 'Создайте первое правило — бот будет удалять сообщения по заданной логике',
  emptySearchTitle: 'Ничего не найдено',
  emptySearchHint: 'Попробуйте изменить поисковый запрос или создайте новое правило',

  createBtn: 'Создать правило',
  searchPlaceholder: 'Поиск по названию или каналу...',

  card: {
    modeInstant: 'Все новые сообщения',
    modeAfter: (value, unit) => `Сообщения старше ${value} ${unit}`,
    lastDeleted: 'Последнее удаление',
    neverDeleted: 'Ещё не удаляло',
  },

  actions: {
    enable: 'Включить',
    disable: 'Выключить',
    edit: 'Редактировать',
    duplicate: 'Копировать',
    remove: 'Удалить',
    removeConfirm: (name) => `Удалить правило «${name}»?`,
  },

  editor: {
    createTitle: 'Новое правило автоудаления',
    editTitle: 'Редактирование правила',
    subtitle: 'Выберите канал и режим удаления',

    nameLabel: 'Название',
    namePlaceholder: 'Например: «Чистка #general»',
    nameHint: 'Видно только вам в панели',

    channelLabel: 'Канал',
    channelHint: 'В этом канале бот будет удалять сообщения',

    modeLabel: 'Режим удаления',
    modeInstantLabel: 'Все новые сообщения',
    modeInstantHint: 'Удалять сразу после отправки — полезно для каналов-объявлений',
    modeAfterLabel: 'Удалять через время',
    modeAfterHint: 'Удалять сообщения, которые висят дольше заданного времени',

    delayLabel: 'Удалять через',
    delayValueLabel: 'Число',
    delayUnitLabel: 'Единица',
    delayHint: 'Например: 30 минут или 1 день',

    channelStatus: {
      empty: 'Канал не выбран',
      checking: (name) => `Проверка прав в #${name}...`,
      notFound: 'Канал не найден',
      ok: 'Бот может управлять сообщениями в канале',
      missing: (list) => `Не хватает прав: ${list}`,
      checkFailed: 'Не удалось проверить права',
    },
  },

  toast: {
    created: 'Правило создано',
    updated: 'Правило сохранено',
    enabled: 'Правило включено',
    disabled: 'Правило выключено',
    deleted: 'Правило удалено',
    duplicated: 'Копия создана (выключена)',
    saveFailed: 'Ошибка сохранения',
    deleteFailed: 'Ошибка удаления',
    needName: 'Введите название',
    needChannel: 'Выберите канал',
    channelConflict: 'В этом канале уже есть активное правило',
    channelConflictHint: 'Отключите существующее правило для этого канала перед созданием нового',
    noManagePermission: 'Бот не может управлять сообщениями в этом канале',
    invalidChannel: 'Канал не найден или недоступен боту',
  },

  errors: {
    loadFailed: 'Не удалось загрузить правила',
    botOffline: 'Бот офлайн — запустите его',
  },
};