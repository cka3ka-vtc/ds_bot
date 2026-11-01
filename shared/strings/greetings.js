// shared/strings/greetings.js

export const greetings = {
  pageTitle: 'Приветствия', pageSubtitle: 'Настройки модуля',
  channelTitle: 'Канал', channelSubtitle: 'Куда отправлять сообщения модуля',
  channelLabel: 'Канал',
  eventsTitle: 'События', eventsSubtitle: 'На какие события реагировать',
  eventJoinTitle: 'При входе', eventJoinDesc: 'Сообщение при входе нового участника',
  eventLeaveTitle: 'При выходе', eventLeaveDesc: 'Сообщение, если участник покинул сервер',
  messagesTitle: 'Сообщения', messagesSubtitle: 'Настройка текста, блоков и оформления',
  tabJoin: 'Вступление', tabLeave: 'Выход',
  emptyTitle: 'Выберите хотя бы одно событие',
  emptyHint: 'Чтобы настроить сообщения, включите «При входе» и/или «При выходе» в блоке «События».',
  testJoin: 'Тест: приветствие', testLeave: 'Тест: прощание',
  needEvent: 'Включите хотя бы одно событие',
  needChannel: 'Выберите канал для модуля',
  saved: 'Настройки сохранены',
  testJoinSent: 'Тестовое приветствие отправлено',
  testLeaveSent: 'Тестовое прощание отправлено',
  channelPlaceholder: 'Канал не выбран',
  channelStatus: {
    empty: 'Канал не выбран',
    checking: (name) => `Проверка прав в #${name}...`,
    notFound: 'Канал не найден',
    ok: 'Бот может отправлять сообщения в выбранный канал',
    missing: (list) => `Бот не может отправлять сообщения: ${list}`,
    checkFailed: 'Не удалось проверить права',
  },
};