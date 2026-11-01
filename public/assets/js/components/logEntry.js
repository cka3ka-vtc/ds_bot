// public/assets/js/components/logEntry.js
// Единый компонент лога: используется в дашборде («Последние события»)
// и в разделе «Модерация» («Журнал действий»).
// Формат: [аватар] displayName @username · ID: xxx  [бейдж типа]  описание  [meta]  [время]  [actions]

import { escapeHtml, timeAgo, initials } from '../core/utils.js';

const TONES = {
  warn:     { icon: 'fa-triangle-exclamation', label: 'Предупреждение' },
  mute:     { icon: 'fa-microphone-slash',     label: 'Мут' },
  ban:      { icon: 'fa-ban',                  label: 'Бан' },
  kick:     { icon: 'fa-user-slash',           label: 'Кик' },
  auto:     { icon: 'fa-shield-halved',        label: 'Автодействие' },
  command:  { icon: 'fa-terminal',             label: 'Команда' },
  level:    { icon: 'fa-ranking-star',         label: 'Уровень' },
  greeting: { icon: 'fa-hand',                 label: 'Приветствие' },
  birthday: { icon: 'fa-cake-candles',         label: 'День рождения' },
  join:     { icon: 'fa-right-to-bracket',     label: 'Вход' },
  leave:    { icon: 'fa-right-from-bracket',   label: 'Выход' },
  info:     { icon: 'fa-circle-info',          label: 'Событие' },
};

/**
 * Рендер одной строки лога.
 *
 * @param {object} p
 * @param {string} [p.tone='info']   — ключ из TONES
 * @param {string} [p.label]         — override текста бейджа
 * @param {string} [p.icon]          — override иконки (без 'fa-solid ')
 * @param {string} [p.userId]        — Discord ID (всегда показывается)
 * @param {string} [p.username]      — @username (если известен)
 * @param {string} [p.displayName]   — отображаемое имя (если известно)
 * @param {string} [p.avatarUrl]     — URL аватара
 * @param {string} [p.text='']       — HTML описания (уже безопасный)
 * @param {string} [p.meta='']       — HTML мелкой строки под текстом
 * @param {number} [p.timestamp]     — unix seconds для timeAgo
 * @param {string} [p.actions='']    — HTML справа
 */
export function renderLogEntry({
  tone = 'info',
  label,
  icon,
  userId,
  username,
  displayName,
  avatarUrl,
  text = '',
  meta = '',
  timestamp,
  actions = '',
}) {
  const metaTone = TONES[tone] || TONES.info;
  const finalIcon = icon || metaTone.icon;
  const finalLabel = label || metaTone.label;

  const userBlock = renderUser({
    userId, username, displayName, avatarUrl,
  });

  const timeHtml = timestamp ? timeAgo(timestamp) : '';

  return `
    <div class="log-entry">
      <div class="log-icon log-icon--${escapeHtml(tone)}">
        <i class="fa-solid ${finalIcon}"></i>
      </div>
      <div class="log-body">
        <div class="log-head">
          <span class="log-badge log-badge--${escapeHtml(tone)}">${escapeHtml(finalLabel)}</span>
          ${userBlock}
        </div>
        <div class="log-text">${text}</div>
        ${meta ? `<div class="log-meta">${meta}</div>` : ''}
      </div>
      <div class="log-side">
        ${timeHtml ? `<span class="log-time">${escapeHtml(timeHtml)}</span>` : ''}
        ${actions}
      </div>
    </div>`;
}

/**
 * Блок пользователя: аватар + displayName + @username · ID: xxx
 * Компактно, без дублирования (displayName === username → показываем одно).
 */
function renderUser({ userId, username, displayName, avatarUrl }) {
  if (!userId && !username && !displayName) return '';

  // Основное имя
  const primaryName = displayName || username || null;
  // @handle — показываем, если username есть и отличается от основного имени
  const handle = username && username !== primaryName ? username : null;

  // Инициал для фолбэка аватара
  const initialsText = primaryName ? initials(primaryName) : (userId ? '?' : '');
  const avatarInner = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : (initialsText ? escapeHtml(initialsText) : '<i class="fa-solid fa-user"></i>');

  const parts = [];

  // Имя (жирное) — если есть
  if (primaryName) {
    parts.push(`<span class="log-user-name">${escapeHtml(primaryName)}</span>`);
  }
  // @username — если отличается
  if (handle) {
    parts.push(`<span class="log-user-handle">@${escapeHtml(handle)}</span>`);
  }
  // ID — всегда, если известен
  if (userId) {
    if (parts.length) {
      parts.push('<span class="log-sep">·</span>');
    }
    parts.push(`<span class="log-user-id">ID: ${escapeHtml(String(userId))}</span>`);
  }

  return `
    <span class="log-user">
      <span class="log-avatar">${avatarInner}</span>
      ${parts.join(' ')}
    </span>`;
}