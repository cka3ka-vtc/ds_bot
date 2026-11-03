// public/assets/js/views/overview/lists.js
import { escapeHtml, fmtNum } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { renderLogEntry } from '../../components/logEntry.js';

/* ═══════════════ Top commands ═══════════════ */

export function renderTopCommands(commands) {
  if (!commands || !commands.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-terminal"></i>
      <strong>${UI.overview.topCommands.emptyTitle}</strong>
      <span>${UI.overview.topCommands.emptyHint}</span>
    </div>`;
  }
  return `<div class="top-list">
    ${commands.map((c, i) => {
      const rankClass = ['gold', 'silver', 'bronze'][i] || '';
      return `<div class="top-item">
        <span class="top-rank ${rankClass}">${i + 1}</span>
        <span class="top-cmd">/${escapeHtml(c.cmd || UI.overview.topCommands.unknown)}</span>
        <span class="top-count">${fmtNum(c.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ═══════════════ Top channels ═══════════════ */

export function renderTopChannels(channels, filter = 'text') {
  if (!channels || !channels.length) {
    const isEmptyText = filter !== 'voice';
    return `<div class="empty-state" style="padding:28px 16px;">
      <i class="fa-solid ${filter === 'voice' ? 'microphone' : 'hashtag'}"></i>
      <strong>${isEmptyText ? UI.overview.topChannels.emptyTextTitle : UI.overview.topChannels.emptyVoiceTitle}</strong>
      <span>${isEmptyText ? UI.overview.topChannels.emptyTextHint : UI.overview.topChannels.emptyVoiceHint}</span>
    </div>`;
  }
  const icon = filter === 'voice' ? 'fa-volume-high' : 'fa-hashtag';
  return `<div class="top-list">
    ${channels.map((ch, i) => {
      const rankClass = ['gold', 'silver', 'bronze'][i] || '';
      return `<div class="top-item">
        <span class="top-rank ${rankClass}">${i + 1}</span>
        <span class="top-cmd channel">
          <i class="fa-solid ${icon}"></i>
          ${escapeHtml(ch.name || UI.overview.topChannels.unknown)}
        </span>
        <span class="top-count">${fmtNum(ch.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ═══════════════ Recent events ═══════════════ */

export function classifyEvent(e) {
  if (!e) return 'other';
  if (e.source === 'mod') return 'moderation';
  if (e.source === 'log') {
    if (e.type === 'levels') return 'levels';
    if (e.type === 'birthdays') return 'birthdays';
    if (e.type === 'moderation') return 'moderation';
    if (e.type === 'greetings') return 'members';
    return 'other';
  }
  if (e.source === 'event') {
    if (e.type === 'command') return 'commands';
    if (e.type === 'member_join' || e.type === 'member_leave') return 'members';
  }
  return 'other';
}

export function filterEvents(events, filter) {
  if (!events || !events.length) return [];
  if (!filter || filter === 'all') return events;
  return events.filter((e) => classifyEvent(e) === filter);
}

export function renderRecentEventsBody(events, opts = {}) {
  const emptyTitle = opts.emptyTitle || 'Пока нет событий';
  const emptyHint = opts.emptyHint
    || 'Здесь появятся команды, повышения уровня, вход/выход участников и действия модерации';

  if (!events || !events.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-clock-rotate-left"></i>
      <strong>${escapeHtml(emptyTitle)}</strong>
      <span>${escapeHtml(emptyHint)}</span>
    </div>`;
  }

  const entries = events
    .map((e) => eventToLogEntry(e))
    .filter(Boolean);

  if (!entries.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-clock-rotate-left"></i>
      <strong>${escapeHtml(emptyTitle)}</strong>
      <span>${escapeHtml(emptyHint)}</span>
    </div>`;
  }

  return `<div class="log-list">${entries.map(renderLogEntry).join('')}</div>`;
}

/* ═══════════════ Хелперы ═══════════════ */

/**
 * Убирает username/displayName из начала строки, чтобы не было дублирования
 * с шапкой лога.
 */
function stripUserPrefix(text, displayName, username) {
  if (!text) return '';
  let s = String(text);
  const prefixes = [displayName, username].filter(Boolean);
  for (const name of prefixes) {
    if (s.startsWith(name + ' ')) return s.slice(name.length + 1);
    if (s.startsWith('@' + name + ' ')) return s.slice(name.length + 2);
  }
  return s;
}

/**
 * Извлекает номер уровня ТОЛЬКО из фраз со словом «уровень/level».
 * Никогда не возвращает первое попавшееся число — оно может быть из ника,
 * ID или другого контекста.
 *
 *   "maks6929 достиг 5 уровня"    → "5"    (число ПЕРЕД «уров»)
 *   "достиг уровня 5"             → "5"    (число ПОСЛЕ «уров»)
 *   "уровень 12"                  → "12"
 *   "level 42"                    → "42"
 *   "maks6929 достиг 6929 уровня" → "6929" (это и правда уровень, если так)
 *   "maks6929 что-то сделал"      → null   (нет контекста «уров»)
 */
function extractLevelFromText(text) {
  if (!text) return null;
  const s = String(text);

  // «5 уровня», «5 уровень», «5 lvl», «5 level»
  let m = s.match(/(\d+)\s*(?:уров(?:ень|ня|не|ней|нем)?|lvl|level)\b/i);
  if (m) return m[1];

  // «уровень 5», «уровня 5», «lvl 5», «level 5», «уровень №5»
  m = s.match(/(?:уров(?:ень|ня|не|ней|нем)?|lvl|level)\s*[:№#]?\s*(\d+)/i);
  if (m) return m[1];

  return null;
}

/**
 * Преобразует сырое событие из БД в аргументы для renderLogEntry.
 * Для всех источников (mod / log / event) достаёт userId, username,
 * displayName, avatarUrl — из JOIN-полей или meta.
 */
function eventToLogEntry(e) {
  if (!e) return null;

  /* ── mod_actions ── */
  if (e.source === 'mod') {
    const tone = ['warn', 'mute', 'ban', 'auto'].includes(e.type) ? e.type : 'auto';
    const labels = {
      warn: 'Предупреждение',
      mute: 'Мут',
      ban:  'Бан',
      auto: 'Автодействие',
    };
    const actionPhrases = {
      warn: 'Получил предупреждение',
      mute: 'Получил мут',
      ban:  'Получил бан',
      auto: 'Применено автоматически',
    };

    const phrase = actionPhrases[tone] || `Наказание: ${tone}`;
    const reason = (e.message || '').trim();

    return {
      tone,
      label: labels[tone],
      userId: e.user_id || null,
      username: e.user_username || null,
      displayName: e.user_display_name || null,
      avatarUrl: e.user_avatar_url || null,
      text: reason ? `${phrase} по фильтру «${escapeHtml(reason)}»` : phrase,
      timestamp: e.created_at,
    };
  }

  /* ── logs (модульные) ── */
  if (e.source === 'log') {
    const module = e.type;
    const meta = e.meta || {};

    const username    = e.user_username    || meta.username    || null;
    const displayName = e.user_display_name || meta.displayName || null;
    const avatarUrl   = e.user_avatar_url   || meta.avatarUrl   || null;
    const userId      = e.user_id || meta.userId || null;

    // Старые логи приветствий — пропускаем (дублируют events.member_join/leave)
    if (module === 'greetings') return null;

    if (module === 'moderation') {
      const reason = meta.reason || '';
      const text = reason
        ? `Сообщение удалено по фильтру «${escapeHtml(reason)}»`
        : 'Сообщение удалено';
      return {
        tone: 'auto',
        label: 'Модерация',
        userId, username, displayName, avatarUrl,
        text,
        timestamp: e.created_at,
      };
    }

    if (module === 'levels') {
      // ФИКС: показываем источник XP (message / voice / command / daily)
      // и корректный текст. Раньше был возможен fallback «Достигает нового уровня»
      // без числа — из-за того, что meta.level не всегда был доступен.
      const metaLvl = meta.level != null ? String(meta.level) : null;
      const lvl = metaLvl || extractLevelFromText(e.message);
      const src = meta.source || null;

      // Человекочитаемые ярлыки для источников XP
      const sourceLabel = {
        message: 'за сообщение',
        voice:   'за голосовую активность',
        command: 'за команду',
        daily:   'за /daily',
      }[src] || '';

      // Ключевая часть: формируем текст из реальных данных.
      // Если lvl есть — «Достигает N уровня за <source>».
      // Если lvl нет (старая запись) — показываем реальный текст из лога.
      let text;
      if (lvl) {
        text = sourceLabel
          ? `Достигает ${escapeHtml(lvl)} уровня ${escapeHtml(sourceLabel)}`
          : `Достигает ${escapeHtml(lvl)} уровня`;
      } else {
        // fallback для старых записей: показываем что реально в логе
        const raw = String(e.message || '').trim();
        text = raw ? escapeHtml(raw) : 'Повышение уровня';
      }

      return {
        tone: 'level',
        label: 'Уровень',
        userId, username, displayName, avatarUrl,
        text,
        timestamp: e.created_at,
      };
    }

    if (module === 'birthdays') {
      // ФИКС: показываем РЕАЛЬНЫЙ текст лога, а не хардкод.
      // Раньше любой лог с module='birthdays' рендерился как
      // «Празднует сегодня день рождения» — даже cleanup-логи и
      // force-снятие роли. Пользователь видел 3 «праздника» на дашборде,
      // хотя реальное поздравление могло быть только одно (или ноль).
      const rawMsg = String(e.message || '').trim();
      let tone = 'birthday';
      let label = 'День рождения';
      let text = escapeHtml(rawMsg || 'Событие дня рождения');

      if (/^Снято зависших/i.test(rawMsg)) {
        // cleanup (теперь debug-уровень, но на случай старых записей — показываем корректно)
        tone = 'info';
        label = 'Очистка ролей';
        text = escapeHtml(rawMsg);
      } else if (/снята.*день не сегодня/i.test(rawMsg)) {
        // force-removed role: важный warn
        tone = 'warn';
        label = 'Роль снята';
        text = escapeHtml(rawMsg);
      } else if (/^Поздравление/i.test(rawMsg)) {
        // успешное поздравление
        tone = 'birthday';
        label = 'Поздравление';
        text = escapeHtml(rawMsg);
      }

      return {
        tone,
        label,
        userId, username, displayName, avatarUrl,
        text,
        timestamp: e.created_at,
      };
    }

    // Прочие модульные логи
    const cleaned = stripUserPrefix(e.message, displayName, username);
    return {
      tone: 'info',
      label: 'Событие',
      userId, username, displayName, avatarUrl,
      text: escapeHtml(cleaned || ''),
      timestamp: e.created_at,
    };
  }

  /* ── events ── */
  if (e.source === 'event') {
    const meta = e.meta || {};

    const username    = e.user_username    || meta.username    || null;
    const displayName = e.user_display_name || meta.displayName || null;
    const avatarUrl   = e.user_avatar_url   || meta.avatarUrl   || null;
    const userId      = e.user_id || meta.userId || null;

    if (e.type === 'command') {
      const cmd = meta.command ? `/${meta.command}` : '/?';
      const channelId = meta.channelId;
      const channelName = meta.channelName;

      let channelPart = '';
      if (channelName) {
        channelPart = ` в канале <code>#${escapeHtml(channelName)}</code>`;
      } else if (channelId) {
        channelPart = ` в канале <code>&lt;#${escapeHtml(String(channelId))}&gt;</code>`;
      }

      return {
        tone: 'command',
        label: 'Команда',
        userId, username, displayName, avatarUrl,
        text: `Использовал команду <code>${escapeHtml(cmd)}</code>${channelPart}`,
        timestamp: e.created_at,
      };
    }

    if (e.type === 'member_join') {
      return {
        tone: 'join',
        label: 'Вход',
        userId, username, displayName, avatarUrl,
        text: 'Присоединился к серверу',
        timestamp: e.created_at,
      };
    }

    if (e.type === 'member_leave') {
      return {
        tone: 'leave',
        label: 'Выход',
        userId, username, displayName, avatarUrl,
        text: 'Покинул сервер',
        timestamp: e.created_at,
      };
    }
  }

  return {
    tone: 'info',
    label: 'Событие',
    text: escapeHtml(e.message || '—'),
    timestamp: e.created_at,
  };
}

/* ═══════════════ Upcoming birthdays ═══════════════ */

function formatDaysLeft(n) {
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n >= 2 && n <= 4) return `через ${n} дня`;
  return `через ${n} дней`;
}

function birthdayWhenClass(n) {
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return '';
}

function fullBirthday(ddmm, year) {
  return year ? `${ddmm}.${year}` : ddmm;
}

function ageFromYear(year) {
  if (!year) return null;
  const age = new Date().getFullYear() - Number(year);
  return age >= 0 && age < 200 ? age : null;
}

function initialsOf(name) {
  return String(name || '?').trim()
    .split(/\s+/).map((w) => w[0]).filter(Boolean)
    .join('').slice(0, 2).toUpperCase() || '?';
}

export function renderUpcomingBirthdays(list, moduleEnabled) {
  if (!moduleEnabled) {
    return `<div class="empty-state" style="padding:36px 24px;">
      <i class="fa-solid fa-cake-candles"></i>
      <strong>Модуль «Дни рождения» отключён</strong>
      <span>Для отображения панели необходимо включить модуль</span>
      <a href="#modules?sub=birthdays" class="btn btn-ghost btn-sm">Открыть модуль</a>
    </div>`;
  }

  if (!list || !list.length) {
    return `<div class="empty-state" style="padding:36px 24px;">
      <i class="fa-solid fa-cake-candles"></i>
      <strong>Пока никто не указал день рождения</strong>
      <span>Участники могут установить дату командой /birthday_set</span>
    </div>`;
  }

  return `<div class="birthday-list">
    ${list.map((b) => {
      const name = b.displayName || b.username || 'Участник';
      const initial = initialsOf(name);
      const age = ageFromYear(b.birthdayYear);
      const dateText = fullBirthday(b.birthday, b.birthdayYear) + (age != null ? ` · ${age} лет` : '');
      const whenClass = birthdayWhenClass(b.daysLeft);
      const isOff = b.birthdayPublic === false;

      const avatarInner = b.avatarUrl
        ? `<img src="${escapeHtml(b.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : escapeHtml(initial);

      const offBadge = isOff
        ? `<span class="birthday-off-badge" title="Поздравления отключены">
             <i class="fa-solid fa-bell-slash"></i>
           </span>`
        : '';

      return `<div class="birthday-item ${isOff ? 'is-off' : ''}">
        <div class="birthday-avatar">${avatarInner}</div>
        <div class="birthday-info">
          <div class="birthday-name">
            <span class="birthday-name-text">${escapeHtml(name)}</span>${offBadge}
          </div>
          <div class="birthday-date">${escapeHtml(dateText)}</div>
        </div>
        <span class="birthday-when ${whenClass}">${formatDaysLeft(b.daysLeft)}</span>
      </div>`;
    }).join('')}
  </div>`;
}