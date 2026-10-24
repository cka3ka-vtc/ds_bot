const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.details = data.details;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  botInfo: () => request('/bot-info'),
  guilds: () => request('/guilds'),
  guild: (id) => request(`/guilds/${id}`),
  channels: (id) => request(`/guilds/${id}/channels`),
  roles: (id) => request(`/guilds/${id}/roles`),
  members: (id) => request(`/guilds/${id}/members`),
  refreshCache: (id) => request(`/guilds/${id}/refresh-cache`, { method: 'POST' }),

  getData: (id, section) => request(`/guilds/${id}/data/${section}`),
  setData: (id, section, data) => request(`/guilds/${id}/data/${section}`, { method: 'PUT', body: JSON.stringify(data) }),

  sendRules: (id, clear) => request(`/guilds/${id}/rules/send`, { method: 'POST', body: JSON.stringify({ clearChannel: clear }) }),
  sendMessage: (id, messageId, clear) => request(`/guilds/${id}/messages/send`, { method: 'POST', body: JSON.stringify({ messageId, clearChannel: clear }) }),
  sendAutopost: (id, announcementId, clear) => request(`/guilds/${id}/announcements/send`, { method: 'POST', body: JSON.stringify({ announcementId, clearChannel: clear }) }),
  sendDelayed: (id, itemId, clear) => request(`/guilds/${id}/delayed/send`, { method: 'POST', body: JSON.stringify({ itemId, clearChannel: clear }) }),

  deleteDiscordMessage: (guildId, section, itemId) =>
    request(`/guilds/${guildId}/${section}/${itemId}/delete-discord`, { method: 'POST' }),

  logs: (id) => request(`/guilds/${id}/logs`),
  clearLogs: (gid) => request(`/guilds/${gid}/logs/clear`, { method: 'POST' }),

  backups: (gid, section) => request(`/guilds/${gid}/backups/${section}`),
  restoreBackup: (gid, section, filename) => request(`/guilds/${gid}/backups/${section}/restore`, { method: 'POST', body: JSON.stringify({ filename }) })
};