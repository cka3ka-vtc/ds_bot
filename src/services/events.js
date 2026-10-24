/* ============================================================
   SSE-хаб для real-time обновлений панели.
   Один Map: guildId -> Set<res>. Каждое событие — broadcast
   всем подключённым клиентам этой гильдии.
   ============================================================ */
const clients = new Map();

export function addSSEClient(guildId, res) {
  if (!clients.has(guildId)) clients.set(guildId, new Set());
  clients.get(guildId).add(res);
  console.log(`[events] + client for guild ${guildId} (total: ${clients.get(guildId).size})`);
}

export function removeSSEClient(guildId, res) {
  const set = clients.get(guildId);
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(guildId);
  console.log(`[events] - client for guild ${guildId} (remaining: ${set.size})`);
}

export function notifySectionUpdate(guildId, section) {
  broadcast(guildId, { type: 'section-update', section });
}

export function broadcast(guildId, payload) {
  const set = clients.get(guildId);
  if (!set || !set.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch {}
  }
}

export function getConnectedCount(guildId) {
  return clients.get(guildId)?.size || 0;
}