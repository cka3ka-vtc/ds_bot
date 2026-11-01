// shared/strings/moderation-settings.js
export const moderationSettings = {
  pageTitle: 'Автомодерация',
  pageSubtitle: 'Фильтры, наказания и уведомления — настраиваются под каждый фильтр',
  backToModules: 'К модулям',

  /* ─── Фильтры ─── */
  filtersTitle: 'Фильтры',
  filtersSubtitle: 'У каждого фильтра — свой канал логов, шаблоны и наказания',
  filtersActiveBadge: (on, total) => `${on} из ${total} активны`,

  /* ─── Вкладки внутри фильтра ─── */
  tabParams: 'Параметры',
  tabPunish: 'Наказания',
  tabScope: 'Условия',
  tabLog: 'Лог',
  tabDm: 'ЛС',

  /* ─── Параметры ─── */
  paramsSectionTitle: 'Настройки фильтра',
  notificationsSectionTitle: 'Уведомления',
  logChannelLabel: 'Канал логов',
  logChannelHint: 'Логи всегда дублируются в БД.',
  logChannelPlaceholder: 'Выберите канал...',
  channelStatusEmpty: 'Канал не выбран',
  channelStatusOk: 'Права в порядке',
  channelStatusNotFound: 'Канал не найден',
  dmToggleLabel: 'Отправлять ЛС нарушителю',
  dmToggleHint: 'Приватное сообщение с причиной и наказанием',

  /* ─── Антирейд ─── */
  raid: {
    detectionTitle: 'Обнаружение волны',
    detectionHint: 'Сколько входов за какой промежуток считать рейдом',
    joinsLabel: 'Входов',
    windowLabel: 'За секунд',

    ageTitle: 'Подозрительные аккаунты',
    ageToggle: 'Проверять возраст аккаунта',
    ageToggleHint: 'Отдельно реагировать на одиночные аккаунты младше указанного возраста',
    minAgeLabel: 'Мин. возраст',
    ageActionLabel: 'Действие для одиночного аккаунта',
    ageActionAlert: 'Только алерт',
    ageActionKick: 'Кик',
    ageActionBan: 'Бан',
    ageBanDurationLabel: 'Длительность бана',
    ageBanForever: 'Навсегда',

    waveTitle: 'Действие при волне',
    waveHint: 'Что делать, если порог сработал',
    waveActionLabel: 'Действие',
    waveActionAlert: 'Только алерт',
    waveActionSlowmode: 'Slowmode',
    waveActionLockdown: 'Lockdown (запрет писать)',
    waveActionKickAll: 'Кикнуть всех вошедших',
    waveActionBanAll: 'Забанить всех вошедших',
    waveBanDurationLabel: 'Длительность бана',
    slowmodeSecLabel: 'Задержка slowmode',
    lockdownDurationLabel: 'Длительность lockdown',

    raidModeTitle: 'Raid mode',
    raidModeHint: 'После срабатывания волны блокировать все новые входы автоматически',
    raidModeToggle: 'Включить raid mode',
    raidModeActionLabel: 'Что делать с новыми',
    raidModeActionKick: 'Кик',
    raidModeActionBan: 'Бан',
    raidModeDurationLabel: 'Длительность raid mode',
    raidModeBanDurationLabel: 'Длительность бана',

    cooldownTitle: 'Cooldown',
    cooldownHint: 'После срабатывания не реагировать повторно в течение N минут',
    cooldownMinLabel: 'Не повторять',
  },

  /* ─── Карта нарушений ─── */
  escalationTitle: 'Карта нарушений',
  escalationSubtitle: 'Счётчик нарушений свой для каждого фильтра — нарушения по другим правилам не учитываются',
  escalationToggle: 'Учитывать повторные нарушения',
  escalationToggleHint: 'Выключить — будет применяться только действие ниже',
  escalationAddLevel: 'Добавить уровень',
  escalationRemoveLabel: 'Удалить',
  escalationInfo: 'Уровни выше применяются ко всем нарушениям этого фильтра после последнего указанного уровня. При выключенной карте — используется действие ниже.',

  /* ─── Обнуление счётчика ─── */
  resetToggleLabel: 'Обнуление счётчика нарушений',
  resetToggleHintOn: (days) => `Нарушения этого фильтра обнулятся через ${days} дн. тишины`,
  resetToggleHintOff: 'Нарушения этого фильтра накапливаются бессрочно',
  resetDaysLabel: 'Через',
  resetDaysSuffix: 'дн.',

  /* ─── Действие по умолчанию ─── */
  actionSection: 'Действие по умолчанию',
  actionFallbackLabel: 'Применяется, если карта нарушений выключена',
  actionDurationLabel: 'Длительность',

  /* ─── Условия ─── */
  scopeSection: 'Где работает',
  scopeAll: 'Везде',
  scopeWhitelist: 'Только в этих',
  scopeBlacklist: 'Кроме этих',
  scopeChannelsEmpty: 'Каналы не выбраны',
  scopeChannelsAdd: 'Добавить канал...',
  scopeRolesTitle: 'Исключённые роли',
  scopeRolesEmpty: 'Роли не выбраны',
  scopeRolesAdd: 'Добавить роль...',

  /* ─── Вкладка Лог ─── */
  logEditorTitle: 'Шаблон сообщения в лог',
  logEditorHint: 'Отправляется в канал, указанный на вкладке «Параметры»',
  logChannelNotSet: 'Канал логов не выбран. Отчёты будут только в БД.',

  /* ─── Вкладка ЛС ─── */
  dmEditorTitle: 'Шаблон личного сообщения',
  dmEditorHint: 'Отправляется нарушителю при срабатывании',
  dmDisabledTitle: 'ЛС отключены',
  dmDisabledHint: 'Включите тумблер «Отправлять ЛС нарушителю» на вкладке «Параметры»',

  /* ─── Словарь мата ─── */
  dictTitle: 'Словарь мата',
  dictSubtitle: 'Регулярки + ваши слова',
  dictImport: 'Импорт .txt',
  dictExport: 'Экспорт',
  dictCustom: 'Свои слова (через запятую)',
  dictExceptions: 'Исключения (не считать матом)',
  dictCustomPlaceholder: 'слово1, слово2, ...',
  dictExceptionsPlaceholder: 'слово1, слово2, ...',
  dictLeet: 'Leet-замена',
  dictLeetHint: '0→о, 3→з, @→а',
  dictObfuscation: 'Обфускация',
  dictObfuscationHint: '«х.у.й», «х-у-й»',
  dictHomoglyphs: 'Гомоглифы',
  dictHomoglyphsHint: 'латиница ↔ кириллица',
  dictSubstring: 'Мат в составе',
  dictSubstringHint: 'искать как подстроку',

  /* ─── Тест ─── */
  testTitle: 'Проверка правил',
  testSubtitle: 'Прогнать текст через все включённые фильтры',
  testInputLabel: 'Тестовое сообщение',
  testRun: 'Проверить',
  testHint: 'Ничего не отправится в Discord — только предпросмотр.',
  testNoHit: 'Ни один фильтр не сработал — сообщение прошло бы нормально',

  /* ─── Общее ─── */
  save: 'Сохранить',
  saving: 'Сохранение...',
  cancel: 'Отмена',
  saved: 'Настройки сохранены',
};

export default moderationSettings;