// shared/strings/common.js
import { pluralize } from './_pluralize.js';

export const brand = {
  name: 'Ckaзka Dev',
  title: 'Панель управления Discord-ботом',
};

export const common = {
  save: 'Сохранить', saving: 'Сохранение...', sending: 'Отправка...', checking: 'Проверка...',
  loading: 'Загрузка...', cancel: 'Отмена', close: 'Закрыть', confirm: 'Подтвердить',
  delete: 'Удалить', edit: 'Редактировать', remove: 'Удалить', add: 'Добавить',
  select: 'Выбрать', manage: 'Управлять', test: 'Отправить тест', refresh: 'Обновить',
  updated: 'Обновлено', back: 'Назад', backToModules: '← К модулям',
  error: 'Ошибка', errorLoad: 'Не удалось загрузить', errorSave: 'Ошибка сохранения',
  errorGeneric: 'Что-то пошло не так', yes: 'Да', no: 'Нет',
  on: 'Включено', off: 'Отключено', enabled: 'Включено', disabled: 'Отключено',
  notSelected: 'Не выбран', notSet: 'Не указано', search: 'Поиск...', all: 'Все',
  empty: 'Пусто', noData: 'Пока нет данных', required: 'Заполните поле',
  copied: 'Скопировано', copy: 'Скопировать', dashboard: 'Дашборд',
  inDevelopment: 'В разработке', inDevelopmentLong: 'Раздел находится в разработке',
  inDevelopmentHint: 'Скоро здесь появятся настройки.',
  selectServer: 'Выберите сервер', selectServerHint: 'Сначала выберите сервер в сайдбаре',
  botOffline: 'Бот офлайн', botOfflineHint: 'Запустите бота или выберите другого',
  noAccess: 'Нет доступа', page: 'Стр.', of: 'из', prev: 'Назад', next: 'Вперёд',
};

export const words = {
  server:  (n) => pluralize(n, 'сервер', 'сервера', 'серверов'),
  member:  (n) => pluralize(n, 'участник', 'участника', 'участников'),
  module:  (n) => pluralize(n, 'модуль', 'модуля', 'модулей'),
  command: (n) => pluralize(n, 'команда', 'команды', 'команд'),
  record:  (n) => pluralize(n, 'запись', 'записи', 'записей'),
  role:    (n) => pluralize(n, 'роль', 'роли', 'ролей'),
  bot:     (n) => pluralize(n, 'бот', 'бота', 'ботов'),
  block:   (n) => pluralize(n, 'блок', 'блока', 'блоков'),
  event:   (n) => pluralize(n, 'событие', 'события', 'событий'),
};

export const actions = {
  addBot: 'Добавить своего бота', addBotOnServer: 'Добавить бота на сервер',
  contactUs: 'Связаться с нами', panelTour: 'Тур по панели', toggleTheme: 'Переключить тему',
  openMenu: 'Меню', logout: 'Выйти', activate: 'Активировать', active: 'Активен',
  backToPanel: 'На главную', login: 'Войти через Discord',
};

export const toast = {
  saved: 'Сохранено', savedSettings: 'Настройки сохранены', deleted: 'Удалено',
  created: 'Создано', updated: 'Обновлено', noChanges: 'Изменений нет',
  botAdded: 'Бот успешно добавлен на сервер!', botActivated: 'Бот активирован',
  botRemoved: 'Бот удалён', testSent: 'Тестовое сообщение отправлено',
  connectionError: 'Ошибка соединения',
  oauth: {
    invalid_state: 'Сессия OAuth истекла. Попробуйте снова.',
    token_exchange: 'Не удалось обменять код на токен.',
    access_denied: 'Вы отменили добавление бота.',
    no_main_bot: 'Главный бот ещё не запущен.',
    unknown: 'Неизвестная ошибка.',
  },
};

export const errors = {
  unauthorized: 'Сессия истекла. Войдите снова.', forbidden: 'Недостаточно прав',
  bot_offline: 'Бот офлайн — запустите его', guild_not_found: 'Сервер не найден',
  channel_not_found: 'Канал не найден', invalid_channel: 'Канал недоступен боту',
  no_permission: 'У бота нет нужных прав', nickname_failed: 'Не удалось изменить никнейм',
  roles_failed: 'Не удалось изменить роли',
  duplicate_name: 'Команда с таким именем уже существует',
  reserved_name: 'Это имя зарезервировано за встроенной командой',
  invalid_name: 'Некорректное имя: 2–32 символа (буквы, цифры, _ и -)',
  send_failed: 'Не удалось отправить сообщение', build_failed: 'Ошибка сборки сообщения',
  empty_message: 'Сообщение пустое', no_channel: 'Выберите канал',
  no_message: 'Настройте сообщение', validation_failed: 'Проверьте введённые данные',
  rate_limited: 'Слишком часто. Подождите.',
};