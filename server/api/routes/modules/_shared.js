// server/api/routes/modules/_shared.js
// Общие помощники для подроутов /api/modules.

/**
 * Пишет запись в аудит. botId/guildId берутся из тела или query — так
 * работает и для CRUD (query/body), и для test (body), и для debug (query).
 */
export function audit(req, action, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, meta,
    ip: req.ip,
  });
}

/**
 * Проверяет, что канал принадлежит гильдии бота.
 * Используется в валидации config перед сохранением.
 */
export function channelBelongs(guild, channelId) {
  if (!guild || !channelId) return false;
  return !!guild.channels.cache.get(channelId);
}