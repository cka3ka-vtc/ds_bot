/* ============================================================
   Миграции схемы JSON-файлов.

   Каждая секция имеет свою версию схемы. При чтении старая
   версия автоматически прогоняется через цепочку миграций.
   После этого файл перезаписывается с актуальной версией.

   CURRENT_VERSION = 10.
   При добавлении новых полей — увеличьте версию и допишите
   блок if (fromVersion === N).
   ============================================================ */

export const CURRENT_VERSION = 10;

/**
 * Применяет миграции к секции.
 * @param {string} section - имя секции (rules, birthdays и т. д.)
 * @param {object} raw - содержимое файла как есть
 * @returns {{ data: object, __needsWrite: boolean }}
 */
export function migrate(section, raw) {
  /* Совсем старый формат: { version, data } отсутствует → v0 */
  if (!raw || typeof raw !== 'object' || !('version' in raw) || !('data' in raw)) {
    return {
      data: migratePayload(section, 0, raw),
      __needsWrite: true
    };
  }

  let data = raw.data;
  let version = raw.version;
  let changed = false;

  /* Битый version — считаем v0 */
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 0) {
    version = 0;
    data = migratePayload(section, 0, raw);
    changed = true;
  }

  /* Новее, чем мы знаем — не трогаем (на случай откатов) */
  if (version > CURRENT_VERSION) {
    console.warn(`[migrate] ${section}: version ${version} > CURRENT_VERSION ${CURRENT_VERSION}, skip`);
    return { data, __needsWrite: false };
  }

  /* Прогоняем все шаги по цепочке */
  while (version < CURRENT_VERSION) {
    data = migratePayload(section, version, data);
    version++;
    changed = true;
  }

  return { data, __needsWrite: changed };
}

/* ---------- Дефолты ---------- */

function defaultBirthdays() {
  return {
    settings: {
      time: '09:00',
      roleId: '',
      channelId: '',
      enabled: false,
      lastRunDate: null,
      roleRemoveNextDay: true,
      autoDeleteMessage: false,
      requiredRoleIds: [],
      _pending: []
    },
    users: [],
    template: {
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: 'С днём рождения, {user}!',
      subtitle: '',
      thumbnail: '',
      blocks: [{
        id: 'bd-def-s',
        type: 'text',
        content: 'Поздравляем! 🎂 Тебе исполняется **{age}**!'
      }]
    },
    templateNoYear: {
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: 'С днём рождения, {user}!',
      subtitle: '',
      thumbnail: '',
      blocks: [{
        id: 'bd-def-n',
        type: 'text',
        content: 'Поздравляем с днём рождения! 🎉 Всего наилучшего в новом году жизни!'
      }]
    }
  };
}

function defaultProfiles() {
  return {
    settings: {
      channelId: '',
      requiredRoleIds: [],
      template: null
    }
  };
}

function defaultProfile() {
  return {
    vtc: '',
    steam: '',
    haulmp: '',
    truckersmp: '',
    companySince: null
  };
}

/* ---------- Цепочка миграций ---------- */

/**
 * Возвращает данные, преобразованные из версии fromVersion
 * в fromVersion+1.
 * @param {string} section
 * @param {number} fromVersion
 * @param {object} data
 * @returns {object}
 */
function migratePayload(section, fromVersion, data) {
  /* v0 → v1: начальные дефолты */
  if (fromVersion === 0) {
    if (section === 'rules') {
      return data || {
        channelId: '',
        displayMode: 'embed-color',
        accentColor: '#5865F2',
        title: '',
        subtitle: '',
        thumbnail: '',
        blocks: []
      };
    }
    if (section === 'birthdays') return data || defaultBirthdays();
    if (section === 'profiles') return data || defaultProfiles();
    if (['messages', 'announcements', 'delayed', 'autodelete', 'autodelete-queue'].includes(section)) {
      return { items: data?.items || [] };
    }
    if (section === 'logs') return { items: data?.items || [] };
    if (section === 'settings') {
      return {
        botEnabled: true,
        modules: { announcements: true, autodelete: true, birthdays: true, profiles: true },
        prefix: '!',
        language: 'ru',
        logChannel: ''
      };
    }
    return data;
  }

  /* v1 → v2: объявления, ролевые кнопки */
  if (fromVersion === 1) {
    if (section === 'announcements' && data?.items) {
      for (const a of data.items) {
        if (a.enabled === undefined) a.enabled = true;
        if (!a.schedule) a.schedule = { type: 'manual' };
        if (!a.autoDelete) a.autoDelete = { enabled: false, minutes: 60 };
        if (!a.eventTime) a.eventTime = { enabled: false, type: 'daily', time: '18:00' };
        if (!a.mention) a.mention = { type: 'none' };
      }
    }
    if (section === 'rules' && data?.blocks) {
      for (const block of data.blocks) {
        if (block.type === 'role-buttons' && block.buttons) {
          for (const btn of block.buttons) {
            if (!btn.ephemeral?.positive) {
              const old = btn.ephemeral || {};
              btn.ephemeral = {
                positive: {
                  displayMode: old.displayMode || 'embed-color',
                  accentColor: old.accentColor || '#5865F2',
                  title: old.title || '',
                  subtitle: old.subtitle || '',
                  thumbnail: old.thumbnail || '',
                  blocks: old.blocks?.length
                    ? old.blocks
                    : [{ id: 'b1', type: 'text', content: old.content || '✅ Роль выдана!' }]
                },
                negative: {
                  displayMode: 'embed-color',
                  accentColor: '#5865F2',
                  title: '', subtitle: '', thumbnail: '',
                  blocks: [{ id: 'b2', type: 'text', content: '❌ Роль снята!' }]
                }
              };
            }
          }
        }
      }
    }
    return data;
  }

  /* v2 → v3: autodelete-queue */
  if (fromVersion === 2) {
    if (section === 'autodelete') return data || { items: [] };
    if (section === 'autodelete-queue') return data || { items: [] };
    return data;
  }

  /* v3 → v4: birthdays settings + шаблоны */
  if (fromVersion === 3) {
    if (section === 'birthdays') return data || defaultBirthdays();
    return data;
  }

  /* v4 → v5: multiple template */
  if (fromVersion === 4) {
    if (section === 'birthdays') {
      if (!data || typeof data !== 'object') return defaultBirthdays();
      if (!data.settings) data.settings = {};
      if (!Array.isArray(data.settings.requiredRoleIds)) data.settings.requiredRoleIds = [];
      if (!data.template) data.template = defaultBirthdays().template;
      if (!data.templateNoYear) data.templateNoYear = defaultBirthdays().templateNoYear;
      if (!data.templateMultiple) data.templateMultiple = defaultBirthdays().templateNoYear;
      return data;
    }
    return data;
  }

  /* v5 → v6: убираем multiMode */
  if (fromVersion === 5) {
    if (section === 'birthdays' && data && typeof data === 'object') {
      if (data.settings) delete data.settings.multiMode;
      delete data.templateMultiple;
      for (const key of ['template', 'templateNoYear']) {
        const t = data[key];
        if (!t) continue;
        if (typeof t.title === 'string') t.title = t.title.replace(/\{count\}/g, '');
        if (typeof t.subtitle === 'string') t.subtitle = t.subtitle.replace(/\{count\}/g, '');
        if (Array.isArray(t.blocks)) {
          for (const b of t.blocks) {
            if (typeof b.content === 'string') b.content = b.content.replace(/\{count\}/g, '');
          }
        }
      }
      return data;
    }
    return data;
  }

  /* v6 → v7: логи */
  if (fromVersion === 6) {
    if (section === 'logs') return data?.items ? data : { items: [] };
    return data;
  }

  /* v7 → v8: profile-объект у пользователей */
  if (fromVersion === 7) {
    if (section === 'birthdays' && data?.users) {
      for (const u of data.users) {
        if (!u.profile || typeof u.profile !== 'object') {
          u.profile = defaultProfile();
        } else {
          u.profile = {
            vtc: u.profile.vtc || '',
            steam: u.profile.steam || '',
            haulmp: u.profile.haulmp || '',
            truckersmp: u.profile.truckersmp || '',
            companySince: u.profile.companySince || null
          };
        }
      }
    }
    return data;
  }

  /* v8 → v9: profiles settings */
  if (fromVersion === 8) {
    if (section === 'profiles') return data || defaultProfiles();
    return data;
  }

  /* v9 → v10: template строки → MessageConfig */
  if (fromVersion === 9) {
    if (section === 'profiles' && data && typeof data === 'object') {
      if (!data.settings) data.settings = {};
      const tpl = data.settings.template;
      if (typeof tpl === 'string') {
        if (tpl.trim()) {
          data.settings.template = {
            displayMode: 'flat',
            accentColor: '#5865F2',
            title: '', subtitle: '', thumbnail: '',
            blocks: [{ id: 'prof-migrated', type: 'text', content: tpl }]
          };
        } else {
          data.settings.template = null;
        }
      }
    }
    return data;
  }

  return data;
}