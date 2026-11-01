// shared/birthdays-config.js
// Единый источник дефолтов и нормализации конфига модуля «Дни рождения».

function defaultMessageConfig() {
  return {
    displayMode: 'embed-color',
    accentColor: '#ec4899',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: [],
  };
}

export function defaultBirthdaysConfig() {
  return {
    announceChannelId: '',
    birthdayRoleId: '',
    sendTime: '09:00',
    deleteOldAnnouncements: true,
    // Исключённые роли — если у участника есть любая, не поздравляем.
    excludedRoles: [],
    // Разрешённые роли — если список непустой, поздравляем только тех,
    // у кого есть хотя бы одна из этих ролей. Excluded побеждает required.
    requiredRoles: [],
    messages: {
      announce:  defaultMessageConfig(),
      cmdSet:    defaultMessageConfig(),
      cmdToggle: defaultMessageConfig(),
      cmdList:   defaultMessageConfig(),
    },
  };
}

export function mergeBirthdaysConfig(raw) {
  const cfg = defaultBirthdaysConfig();
  if (!raw || typeof raw !== 'object') return cfg;

  if (raw.announceChannelId) cfg.announceChannelId = String(raw.announceChannelId);
  if (raw.birthdayRoleId)    cfg.birthdayRoleId    = String(raw.birthdayRoleId);

  if (typeof raw.sendTime === 'string' && /^\d{2}:\d{2}$/.test(raw.sendTime)) {
    cfg.sendTime = raw.sendTime;
  }

  if (raw.deleteOldAnnouncements !== undefined) {
    cfg.deleteOldAnnouncements = !!raw.deleteOldAnnouncements;
  }

  if (Array.isArray(raw.excludedRoles)) {
    cfg.excludedRoles = raw.excludedRoles.filter((x) => typeof x === 'string');
  }
  if (Array.isArray(raw.requiredRoles)) {
    cfg.requiredRoles = raw.requiredRoles.filter((x) => typeof x === 'string');
  }

  if (raw.messages && typeof raw.messages === 'object') {
    for (const k of ['announce', 'cmdSet', 'cmdToggle', 'cmdList']) {
      if (raw.messages[k] && typeof raw.messages[k] === 'object') {
        cfg.messages[k] = { ...cfg.messages[k], ...raw.messages[k] };
      }
    }
  }

  return cfg;
}