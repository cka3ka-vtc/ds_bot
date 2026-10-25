/* ============================================================
   API-клиент для общения с сервером.

   Все запросы идут через request(), который:
   - добавляет Content-Type
   - парсит JSON
   - кидает Error с полем status
   ============================================================ */

const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return res.json();
}

export const api = {
  /* ---------- Бот ---------- */
  botInfo: () => request('/bot-info'),
  bots: () => request('/bots'),
  botStats: () => request('/bots/stats'),
  switchBot: (id) => request('/bots/active', { method: 'POST', body: JSON.stringify({ id }) }),
  addBot: (id, payload) => request(`/bots/${id}`, { method: 'POST', body: JSON.stringify(payload) }),
  removeBot: (id) => request(`/bots/${id}`, { method: 'DELETE' }),
  validateToken: (token) => request('/bots/validate', { method: 'POST', body: JSON.stringify({ token }) }),
  setActivity: (activity) => request('/bots/status', { method: 'POST', body: JSON.stringify(activity) }),

  /* ---------- Гильдии ---------- */
  guilds: () => request('/guilds'),
  guild: (id) => request(`/guilds/${id}`),
  channels: (id) => request(`/guilds/${id}/channels`),
  roles: (id) => request(`/guilds/${id}/roles`),
  members: (id) => request(`/guilds/${id}/members`),
  refreshCache: (id) => request(`/guilds/${id}/refresh-cache`, { method: 'POST' }),

  /* ---------- Команды ---------- */
  commands: (id) => request(`/guilds/${id}/commands`),
  updateCommand: (id, name, patch) =>
    request(`/guilds/${id}/commands/${name}`, { method: 'PUT', body: JSON.stringify(patch) }),

  /* ---------- Данные секций ---------- */
  getData: (id, section) => request(`/guilds/${id}/data/${section}`),
  setData: (id, section, data) =>
    request(`/guilds/${id}/data/${section}`, { method: 'PUT', body: JSON.stringify(data) }),

  validateData: (id, section, data) =>
    request(`/validate/${section}`, { method: 'POST', body: JSON.stringify(data) })
      .catch((e) => ({ ok: false, errors: [{ path: '', message: e.message }] })),

  /* ---------- Отправка в Discord ---------- */
  sendRules: (id, clear) =>
    request(`/guilds/${id}/rules/send`, { method: 'POST', body: JSON.stringify({ clearChannel: clear }) }),
  sendMessage: (id, messageId, clear) =>
    request(`/guilds/${id}/messages/send`, { method: 'POST', body: JSON.stringify({ messageId, clearChannel: clear }) }),
  sendAutopost: (id, announcementId, clear) =>
    request(`/guilds/${id}/announcements/send`, { method: 'POST', body: JSON.stringify({ announcementId, clearChannel: clear }) }),
  sendDelayed: (id, itemId, clear) =>
    request(`/guilds/${id}/delayed/send`, { method: 'POST', body: JSON.stringify({ itemId, clearChannel: clear }) }),

  deleteDiscordMessage: (guildId, section, itemId) =>
    request(`/guilds/${guildId}/${section}/${itemId}/delete-discord`, { method: 'POST' }),

  /* ---------- Логи ---------- */
  logs: (id) => request(`/guilds/${id}/logs`),
  clearLogs: (gid) => request(`/guilds/${gid}/logs/clear`, { method: 'POST' }),

  /* ---------- Бэкапы ---------- */
  backups: (gid, section) => request(`/guilds/${gid}/backups/${section}`),
  restoreBackup: (gid, section, filename) =>
    request(`/guilds/${gid}/backups/${section}/restore`, { method: 'POST', body: JSON.stringify({ filename }) })
};