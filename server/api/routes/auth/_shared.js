// server/api/routes/auth/_shared.js
// Общие хелперы для OAuth-роутов.

/**
 * Флаг Administrator в Discord permissions bitfield (1 << 3).
 * Используется для фильтрации гильдий, где пользователь — админ.
 */
export const ADMIN_BIT = 0x8n;

/**
 * Возвращает true, если пользователь — владелец гильдии или имеет
 * permission Administrator в этой гильдии.
 *
 * @param {object} g — объект guild из /users/@me/guilds:
 *                     { id, name, owner: boolean, permissions: string }
 */
export function isAdminGuild(g) {
  if (!g || typeof g !== 'object') return false;
  if (g.owner === true) return true;
  if (typeof g.permissions !== 'string' || !g.permissions) return false;
  try {
    return (BigInt(g.permissions) & ADMIN_BIT) === ADMIN_BIT;
  } catch {
    return false;
  }
}

/**
 * Чистит OAuth-cookies. Вызывается во всех ветках callback-роутов
 * (и при успехе, и при ошибке), чтобы state не «залипал» в браузере.
 */
export function clearOauthCookies(res) {
  try { res.clearCookie('oauth_state'); } catch {}
  try { res.clearCookie('bot_oauth_state'); } catch {}
}