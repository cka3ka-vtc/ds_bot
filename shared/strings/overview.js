// shared/strings/overview.js

export const overview = {
  refresh: 'Обновить',
  kpi: {
    totalMembers: 'Всего участников', newMembers: 'Новые', leftMembers: 'Покинули', activeUsers: 'Активные',
    hintTotalMembers: 'Общее число участников на сервере прямо сейчас.',
    hintNewMembers: 'Сколько присоединилось за последние 7 дней.',
    hintLeftMembers: 'Сколько покинуло сервер за последние 7 дней.',
    hintActiveUsers: 'Уникальные авторы сообщений, команд и голосовой активности за 7 дней.',
    openJoined: 'Открыть: Новые', openLeft: 'Открыть: Покинули',
    openActive: 'Открыть: Активные', goMembers: 'Перейти: Всего участников',
  },
  chart: {
    title: 'Активность', subtitle: 'за 14 дней',
    filterAll: 'Всё', filterMessages: 'Сообщения', filterCommands: 'Команды', filterVoice: 'Голос',
    emptyTitle: 'Пока нет данных',
    emptyHint: 'Активность появится, когда участники начнут писать сообщения и использовать команды',
    legendMessages: 'Сообщения', legendCommands: 'Команды', legendVoice: 'Голос',
  },
  topCommands: {
    title: 'Топ команд', subtitle: 'за 7 дней',
    hint: 'Суммарное количество использований каждой команды.',
    emptyTitle: 'Пока нет данных', emptyHint: 'Команды появятся здесь, когда ими начнут пользоваться',
    unknown: 'неизвестно',
  },
  topChannels: {
    title: 'Популярные каналы', subtitle: 'за 7 дней',
    hint: 'Количество уникальных пользователей, активных в канале.',
    filterText: 'Текстовые', filterVoice: 'Голосовые',
    emptyTextTitle: 'Пока нет данных', emptyTextHint: 'Статистика появится после активности в текстовых каналах',
    emptyVoiceTitle: 'Пока нет данных', emptyVoiceHint: 'Статистика появится после активности в голосовых каналах',
    unknown: 'unknown',
  },
  recentEvents: {
    title: 'Последние события', all: 'Все',
    emptyTitle: 'Пока нет событий', emptyHint: 'Здесь появятся действия модерации и логи',
  },
  tooltip: { messages: 'Сообщения', commands: 'Команды', voice: 'Голос' },
};

export const userModals = {
  joined: {
    title: 'Новые участники',
    subtitle: 'Присоединились к серверу за последние 7 дней',
    prefix: 'Присоединились',
    empty: 'За последние 7 дней никто не присоединился к серверу.',
  },
  left: {
    title: 'Покинули сервер',
    subtitle: 'Ушли за последние 7 дней',
    prefix: 'Покинули сервер',
    empty: 'За последние 7 дней никто не покинул сервер.',
  },
  active: {
    title: 'Активные пользователи',
    subtitle: 'Сообщения, команды и голосовая активность за 7 дней',
    prefix: 'Были активны',
    empty: 'За последние 7 дней активности не было.',
  },
  loading: 'Загрузка списка...',
  errorTitle: 'Ошибка загрузки',
  errorHint: 'Попробуйте ещё раз',
  close: 'Закрыть',
  userFallback: 'Пользователь',
  statMessages: 'Сообщений',
  statVoice: 'Заходов в голос',
  statCommands: 'Команд',
};