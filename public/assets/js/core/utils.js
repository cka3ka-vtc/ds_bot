// public/assets/js/core/utils.js

/** Склонения русских существительных */
export function pluralize(n, one, few, many) {
  n = Math.abs(Number(n) || 0);
  const m = n % 10;
  const h = n % 100;
  if (m === 1 && h !== 11) return one;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

/** Готовые словари */
export const WORD = {
  server:  (n) => pluralize(n, 'сервер', 'сервера', 'серверов'),
  member:  (n) => pluralize(n, 'участник', 'участника', 'участников'),
  module:  (n) => pluralize(n, 'модуль', 'модуля', 'модулей'),
  command: (n) => pluralize(n, 'команда', 'команды', 'команд'),
  record:  (n) => pluralize(n, 'запись', 'записи', 'записей'),
  role:    (n) => pluralize(n, 'роль', 'роли', 'ролей'),
  bot:     (n) => pluralize(n, 'бот', 'бота', 'ботов'),
};

/** С числом: "5 серверов" */
export function plur(n, one, few, many) {
  return `${n} ${pluralize(n, one, few, many)}`;
}

/** Разделитель тысяч: 1248 → "1 248" */
export function fmtNum(n) {
  n = Number(n) || 0;
  return n.toLocaleString('ru-RU');
}

/** Unix секунды → "25.10.2026" */
export function fmtDate(unixSec) {
  if (!unixSec) return '—';
  const d = new Date(unixSec * 1000);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

/** HTML escape */
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

/** "5 мин назад" */
export function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - (unixSec || 0);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

/** "1 ч 20 мин" / "3 д 4 ч" */
export function fmtUptime(seconds) {
  seconds = Math.round(seconds || 0);
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч ${Math.floor((seconds % 3600) / 60)} мин`;
  return `${Math.floor(seconds / 86400)} д ${Math.floor((seconds % 86400) / 3600)} ч`;
}