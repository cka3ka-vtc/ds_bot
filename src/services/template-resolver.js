/* ============================================================
   Резолвер шаблонных токенов в текстах.

   Поддерживает:
     {time} / {time:CODE}     → <t:NOW:CODE>  (Discord timestamp)
     {until}                  → <t:UNIX:R>
     {role}                   → имя роли
     {user}                   → <@userId> или строка
     {age}                    → число
     {mention}                → <@userId>
     {userId}                 → Discord ID
     {displayName}            → отображаемое имя
     {username}               → логин
     {birthday}               → дата рождения
     {links}                  → markdown-ссылки
     {vtc} {steam} {haulmp} {truckersmp}  → URL
     {companySince}           → дата вступления
     {companyDuration}        → стаж

   Используется при сборке Components v2.
   ============================================================ */

/**
 * Подставляет значения вместо токенов.
 * @param {string} text
 * @param {object} [opts] - контекст с полями userId, age, roleName и т. д.
 * @returns {string}
 */
export function resolveTokens(text, opts = {}) {
  if (!text || typeof text !== 'string') return text;

  const now = Math.floor(Date.now() / 1000);

  /* ---- Время ---- */
  text = text.replace(/\{time(?::([RrFfDdTt]))?\}/g, (_, code) => {
    const c = code || 'f';
    const normalized = c === 'r' ? 'R' : c;
    return `<t:${now}:${normalized}>`;
  });

  text = opts.untilUnix
    ? text.replace(/\{until\}/g, `<t:${opts.untilUnix}:R>`)
    : text.replace(/\{until\}/g, '');

  /* ---- Роль ---- */
  if (opts.roleName !== undefined && opts.roleName !== null) {
    text = text.replace(/\{role\}/g, opts.roleName);
  }

  /* ---- Пользователь (birthdays) ---- */
  if (opts.userMention !== undefined && opts.userMention !== null) {
    text = text.replace(/\{user\}/g, opts.userMention);
  } else if (opts.userId !== undefined && opts.userId !== null) {
    text = text.replace(/\{user\}/g, `<@${opts.userId}>`);
  } else if (opts.userName !== undefined && opts.userName !== null) {
    text = text.replace(/\{user\}/g, opts.userName);
  }

  /* ---- Возраст ---- */
  if (opts.age !== undefined && opts.age !== null) {
    text = text.replace(/\{age\}/g, String(opts.age));
  }

  /* ---- Профиль ---- */
  if (opts.userId !== undefined && opts.userId !== null) {
    text = text.replace(/\{mention\}/g, `<@${opts.userId}>`);
    text = text.replace(/\{userId\}/g, String(opts.userId));
  }

  if (opts.displayName !== undefined && opts.displayName !== null) {
    text = text.replace(/\{displayName\}/g, String(opts.displayName));
  }
  if (opts.username !== undefined && opts.username !== null) {
    text = text.replace(/\{username\}/g, String(opts.username));
  }

  if (opts.birthday !== undefined && opts.birthday !== null) {
    text = text.replace(/\{birthday\}/g, String(opts.birthday));
  }
  if (opts.links !== undefined && opts.links !== null) {
    text = text.replace(/\{links\}/g, String(opts.links));
  }

  if (opts.profile) {
    const p = opts.profile;
    text = text.replace(/\{vtc\}/g, p.vtc || '');
    text = text.replace(/\{steam\}/g, p.steam || '');
    text = text.replace(/\{haulmp\}/g, p.haulmp || '');
    text = text.replace(/\{truckersmp\}/g, p.truckersmp || '');
    text = text.replace(/\{companySince\}/g, p.companySinceFormatted || 'не указано');
    text = text.replace(/\{companyDuration\}/g, p.companyDuration || '—');
  }

  return text;
}