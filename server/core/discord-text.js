// server/core/discord-text.js

/**
 * Escape Discord markdown-символов (**жирный**, ||спойлер||, `код`, > цитата).
 *
 * Экспортируется отдельно, но по умолчанию НЕ применяется к тексту сообщения:
 * escape ломает Discord-синтаксис (custom emoji <:name:id>, mentions <@id>,
 * timestamps <t:…>, каналы <#id>) — всё, что заканчивается на `>`.
 *
 * Для логов модерации нужен ИСХОДНЫЙ текст с форматированием и эмодзи
 * (это доказательство нарушения), а не plain-text. Пинги всё равно
 * блокируются через allowedMentions в _sendLog / _sendDm.
 */
const MARKDOWN_SPECIALS = /([\\*_~`|>])/g;

export function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(MARKDOWN_SPECIALS, '\\$1');
}

/**
 * Обрезает строку до max символов по границе слова с ellipsis.
 * Если исходная строка короче — возвращает как есть.
 */
export function truncateText(text, max = 1900) {
  if (!text) return '';
  const s = String(text);
  if (s.length <= max) return s;

  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.8 ? lastSpace : max;
  return s.slice(0, cut) + '…';
}

/**
 * Форматирует content сообщения для логов / ЛС:
 *   - пустой content + вложения → «[+N вложен.]»
 *   - обычный content → truncate (БЕЗ escape, чтобы сохранить emoji/mentions/markdown)
 *     + «[+N вложен.]» при наличии вложений.
 *
 * @param {string} content        — message.content
 * @param {object} [attachments]  — message.attachments (Collection discord.js)
 * @param {number} [max=1900]     — лимит символов
 */
export function formatMessageForLog(content, attachments, max = 1900) {
  const text = String(content || '').trim();
  const count = attachments?.size || 0;
  const attSuffix = count > 0
    ? (text ? ' ' : '') + `[+${count} вложен.]`
    : '';

  if (!text && !count) return '';

  const formatted = text
    ? truncateText(text, Math.max(100, max - attSuffix.length))
    : '';

  return formatted + attSuffix;
}