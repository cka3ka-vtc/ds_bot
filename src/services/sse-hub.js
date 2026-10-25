/* ============================================================
   SSE-хаб: держит открытые соединения с панелью.

   Используется для real-time обновлений в UI. Когда серверная
   часть меняет данные (отправила объявление, удалила сообщение),
   она вызывает notifySectionUpdate — и все подключённые вкладки
   панели перезагружают нужную секцию.

   Архитектура:
   - Map<guildId, Map<res, { lastPong }>>  — по одной Map на гильдию
   - каждое соединение пингуется раз в 25 с
   - «мёртвые» (нет активности >50 с) закрываются watchdog-таймером
   - жёсткий лимит 10 клиентов на гильдию
   ============================================================ */

const MAX_CLIENTS_PER_GUILD = 10;   // жёсткий лимит
const PING_INTERVAL_MS      = 25_000;
const DEAD_TIMEOUT_MS       = 50_000;

/* guildId → Map<res, { lastPong:number }> */
const clients = new Map();

/**
 * Регистрирует SSE-клиента.
 * @param {string} guildId
 * @param {import('express').Response} res
 * @returns {{ ok: boolean, reason?: string, cleanup?: Function }}
 */
export function addSSEClient(guildId, res) {
  if (!clients.has(guildId)) clients.set(guildId, new Map());
  const map = clients.get(guildId);

  if (map.size >= MAX_CLIENTS_PER_GUILD) {
    return { ok: false, reason: `Максимум ${MAX_CLIENTS_PER_GUILD} клиентов на гильдию` };
  }

  const entry = { lastPong: Date.now() };
  map.set(res, entry);

  /* Пинг раз в 25 с — держим соединение живым */
  const pingTimer = setInterval(() => {
    if (res.writableEnded) return;
    try { res.write(': ping\n\n'); } catch {}
  }, PING_INTERVAL_MS);

  /* Watchdog: если от клиента давно нет активности — рвём */
  const watchdog = setInterval(() => {
    if (Date.now() - entry.lastPong > DEAD_TIMEOUT_MS) cleanup();
  }, 10_000);

  /* Любая активность от клиента продлевает жизнь */
  const onActivity = () => { entry.lastPong = Date.now(); };

  const cleanup = () => {
    clearInterval(pingTimer);
    clearInterval(watchdog);
    map.delete(res);
    if (!map.size) clients.delete(guildId);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
  res.on('finish', cleanup);
  res.on('data', onActivity);
  res.on('drain', onActivity);

  return { ok: true, cleanup };
}

/**
 * Убирает клиента из хаба (вызывается при закрытии соединения).
 * @param {string} guildId
 * @param {import('express').Response} res
 */
export function removeSSEClient(guildId, res) {
  const map = clients.get(guildId);
  if (!map) return;
  map.delete(res);
  if (!map.size) clients.delete(guildId);
}

/**
 * Сообщает всем клиентам гильдии, что секция обновилась.
 * Клиент сам решает, перезагружать ли эту секцию.
 * @param {string} guildId
 * @param {string} section
 */
export function notifySectionUpdate(guildId, section) {
  broadcast(guildId, { type: 'section-update', section });
}

/**
 * Низкоуровневая отправка произвольного сообщения всем клиентам гильдии.
 * @param {string} guildId
 * @param {object} payload
 */
export function broadcast(guildId, payload) {
  const map = clients.get(guildId);
  if (!map?.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of map.keys()) {
    if (res.writableEnded) { map.delete(res); continue; }
    try { res.write(data); } catch {}
  }
}

/**
 * Сколько клиентов сейчас подключено к гильдии (для отладки).
 * @param {string} guildId
 * @returns {number}
 */
export function getConnectedCount(guildId) {
  return clients.get(guildId)?.size || 0;
}