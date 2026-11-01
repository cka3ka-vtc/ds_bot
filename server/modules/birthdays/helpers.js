// server/modules/birthdays/helpers.js
// Чистые функции дат для модуля «Дни рождения».

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function todayDdMm(date = new Date()) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

export function parseBirthday(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2})[.,/](\d{1,2})(?:[.,/](\d{4}))?$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;

  const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > dim) return null;

  let year = null;
  if (m[3]) {
    year = parseInt(m[3], 10);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear - 5) return null;
  }

  return { ddmm: `${pad2(day)}.${pad2(month)}`, year };
}

export function daysUntilBirthday(ddmm) {
  const [d, m] = ddmm.split('.').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function humanDaysLeft(n) {
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  return `через ${n} дн.`;
}

export function ageOnNextBirthday(birthdayYear) {
  if (!birthdayYear) return null;
  const age = new Date().getFullYear() - Number(birthdayYear);
  return age >= 0 && age < 200 ? age : null;
}

export function fullDate(ddmm, year) {
  return year ? `${ddmm}.${year}` : ddmm;
}