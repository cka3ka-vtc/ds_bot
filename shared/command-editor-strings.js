// shared/command-editor-strings.js
export const CMD_EDITOR = {
  sections: {
    basic: 'Основное',
    response: 'Ответ',
    access: 'Где и кому доступна',
    behavior: 'Поведение',
  },
  fields: {
    name: 'Имя команды',
    nameHint: 'Только буквы, цифры, _ и -. 2–32 символа.',
    namePlaceholder: 'hello',
    description: 'Описание',
    descriptionPlaceholder: 'Краткое описание для Discord',
    responseMode: 'Формат ответа',
    responseModeText: 'Текст',
    responseModeEmbed: 'Embed',
    response: 'Текст ответа',
    responsePlaceholder: 'Привет, {user}!',
    responseHint: 'Поддерживает Discord markdown и переменные.',
    embedColor: 'Цвет embed',
    channelsMode: 'Где работает',
    channelsModeAll: 'Везде',
    channelsModeWhitelist: 'Только в выбранных',
    channelsModeBlacklist: 'Кроме выбранных',
    channels: 'Каналы',
    channelsAdd: 'Добавить канал',
    channelsEmpty: 'Каналы не выбраны',
    channelsPlaceholder: 'Выберите канал...',
    cooldown: 'Кулдаун, секунд',
    cooldownHint: 'Пауза между вызовами для одного пользователя. 0 — без ограничений.',
    ephemeral: 'Ответ только вызывающему',
    ephemeralHint: 'Сообщение увидит только тот, кто вызвал команду (ephemeral).',
    requireRoles: 'Требуемые роли',
    requireRolesHint: 'Хотя бы одна из выбранных ролей должна быть у участника.',
    requireRolesEmpty: 'Любой участник может вызывать',
    requireRolesAdd: 'Добавить роль',
    requireRolesPlaceholder: 'Выберите роль...',
    excludeRoles: 'Запрещённые роли',
    excludeRolesHint: 'Участники с любой из этих ролей не могут вызывать команду.',
    excludeRolesEmpty: 'Нет ограничений',
    excludeRolesAdd: 'Добавить роль',
    excludeRolesPlaceholder: 'Выберите роль...',
  },
  toolbar: {
    bold: 'Жирный', italic: 'Курсив', underline: 'Подчёркнутый', strike: 'Зачёркнутый',
    code: 'Код', spoiler: 'Спойлер', quote: 'Цитата',
    tokens: 'Переменные', tokensTitle: 'Вставить переменную',
  },
  tokens: [
    { label: 'Пользователь', items: [
      ['user', 'Упоминание вызвавшего'],
      ['username', 'Ник без @'],
      ['displayName', 'Отображаемое имя'],
    ]},
    { label: 'Сервер', items: [
      ['guild', 'Имя сервера'],
      ['count', 'Участников (без ботов)'],
      ['memberCount', 'Всего участников'],
    ]},
    { label: 'Канал', items: [
      ['channel', 'Упоминание канала'],
      ['channelName', 'Имя канала без #'],
    ]},
    { label: 'Время', items: [
      ['date', 'Текущая дата'],
      ['time', 'Текущее время'],
      ['dateFull', 'Полная дата и время'],
    ]},
    { label: 'Другое', items: [['command', 'Имя этой команды']] },
  ],
  presets: {
    title: 'Шаблоны',
    subtitle: 'Начните с готового — поля заполнятся автоматически',
    collapse: 'Свернуть шаблоны',
    expand: 'Развернуть шаблоны',
    confirmReplaceTitle: 'Применить шаблон',
    confirmReplace: 'Текущие поля будут заменены шаблоном. Продолжить?',
    confirmYes: 'Применить',
  },
  warnings: {
    whitelistEmpty: 'Команда будет работать везде, пока не выбран хотя бы один канал.',
    bothModes: 'Если каналы не выбраны — команда работает везде.',
  },
  table: {
    usage: 'Использований',
    neverUsed: 'Ещё не вызывалась',
    channelsAll: 'Везде',
    channelsLimited: (n) => `${n} ${n === 1 ? 'канал' : n < 5 ? 'канала' : 'каналов'}`,
    rolesRestricted: 'По ролям',
    cooldownShort: (s) => `${s} сек`,
    ephemeral: 'Только вызывающему',
    embed: 'Embed',
    disabled: 'Выключена',
    test: 'Отправить тест',
    testPickChannel: 'Куда отправить тестовое сообщение?',
    testSent: 'Тестовое сообщение отправлено',
    testNeedChannel: 'Выберите канал',
  },
};

/* Редактор сообщений модуля «Уровни» — табы. */
export const LEVELS_MSG = {
  sectionTitle: 'Сообщения модуля',
  sectionSubtitle: 'Настройте ответы для каждой встроенной команды',
  testButton: 'Тест текущего таба',
  testSent: 'Тестовое сообщение отправлено',
  testNeedChannel: 'Сначала выберите канал объявлений',
  tabs: {
    levelUp: {
      title: 'Повышение уровня',
      hint: 'Отправляется в канал объявлений при достижении нового уровня',
    },
    rank: { title: 'Карточка (/rank)', hint: 'Ответ на команду /rank — карточка участника' },
    leaderboard: { title: 'Топ (/leaderboard)', hint: 'Ответ на команду /leaderboard' },
    daily: { title: 'Ежедневная награда (/daily)', hint: 'Ответ на команду /daily' },
  },
};

/* Редактор сообщений модуля «Дни рождения» — табы. */
export const BIRTHDAYS_MSG = {
  sectionTitle: 'Сообщения модуля',
  sectionSubtitle: 'Поздравление и ответы на команды',
  testButton: 'Тест текущего таба',
  testSent: 'Тестовое сообщение отправлено',
  testNeedChannel: 'Сначала выберите канал объявлений',
  tabs: {
    announce: {
      title: 'Поздравление',
      hint: 'Отправляется в канал объявлений в день рождения участника',
    },
    cmdSet: {
      title: 'Установка ДР (/birthday_set)',
      hint: 'Ответ на команду /birthday_set',
    },
    cmdToggle: {
      title: 'Включение/выключение (/birthday_toggle)',
      hint: 'Ответ на команду /birthday_toggle',
    },
    cmdList: {
      title: 'Ближайшие ДР (/birthdays)',
      hint: 'Ответ на команду /birthdays — список ближайших',
    },
  },
};

export default CMD_EDITOR;