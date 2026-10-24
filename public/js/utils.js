export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const escapeAttr = escapeHtml;

export function formatNumber(n) {
  return typeof n === 'number' ? n.toLocaleString('ru-RU') : n;
}

export function pluralize(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function formatMembers(n) {
  return `${formatNumber(n)} ${pluralize(n, ['участник', 'участника', 'участников'])}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

/* ============================================================
   Дискорд-форматы UNIX-времени (регистр важен):
     t → 17:45 · T → 17:45:00
     d → 23.10.2026 · D → 23 октября 2026 г.
     f → дата+время (дефолт) · F → +день недели · R → relative
   ============================================================ */
export function formatDateByCode(date, code) {
  let c = code || 'f';
  if (c === 'r') c = 'R';

  try {
    switch (c) {
      case 'R': return formatRelative(date);
      case 't':
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
      case 'T':
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      case 'd':
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      case 'D':
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'f':
        return date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      case 'F':
        return date.toLocaleString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      default:
        return date.toLocaleString('ru-RU');
    }
  } catch { return date.toLocaleString('ru-RU'); }
}

function formatRelative(date) {
  const diff = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs <= 1) return 'несколько секунд назад';
  if (abs < 60) {
    const s = abs;
    const w = pluralize(s, ['секунду', 'секунды', 'секунд']);
    return diff > 0 ? `через ${s} ${w}` : `${s} ${w} назад`;
  }
  if (abs < 3600) {
    const m = Math.round(abs / 60);
    const w = pluralize(m, ['минуту', 'минуты', 'минут']);
    return diff > 0 ? `через ${m} ${w}` : `${m} ${w} назад`;
  }
  if (abs < 86400) {
    const h = Math.round(abs / 3600);
    const w = pluralize(h, ['час', 'часа', 'часов']);
    return diff > 0 ? `через ${h} ${w}` : `${h} ${w} назад`;
  }
  const d = Math.round(abs / 86400);
  const w = pluralize(d, ['день', 'дня', 'дней']);
  return diff > 0 ? `через ${d} ${w}` : `${d} ${w} назад`;
}

/* ============================================================
   Длительность с точностью до месяцев/дней/часов/минут.
   Пример: «2 года 3 месяца 15 дней 8 часов 42 минуты»
   ============================================================ */
export function formatDuration(fromIso, toDate = new Date()) {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (isNaN(from.getTime())) return null;
  if (from > toDate) return 'Ещё не вступил';

  let y = toDate.getFullYear() - from.getFullYear();
  let m = toDate.getMonth() - from.getMonth();
  let d = toDate.getDate() - from.getDate();
  let h = toDate.getHours() - from.getHours();
  let mi = toDate.getMinutes() - from.getMinutes();

  if (mi < 0) { mi += 60; h--; }
  if (h < 0) { h += 24; d--; }
  if (d < 0) {
    const prevMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 0);
    d += prevMonth.getDate();
    m--;
  }
  if (m < 0) { m += 12; y--; }
  if (y < 0) return 'Ещё не вступил';

  const parts = [];
  if (y > 0) parts.push(`${y} ${pluralize(y, ['год', 'года', 'лет'])}`);
  if (m > 0) parts.push(`${m} ${pluralize(m, ['месяц', 'месяца', 'месяцев'])}`);
  if (d > 0) parts.push(`${d} ${pluralize(d, ['день', 'дня', 'дней'])}`);
  if (h > 0) parts.push(`${h} ${pluralize(h, ['час', 'часа', 'часов'])}`);
  if (mi > 0) parts.push(`${mi} ${pluralize(mi, ['минуту', 'минуты', 'минут'])}`);

  return parts.length ? parts.join(' ') : 'Меньше минуты';
}

export function getChannelIconName(type) {
  return { 0: 'text', 2: 'voice', 5: 'announcement', 13: 'stage', 15: 'forum' }[type] || 'text';
}