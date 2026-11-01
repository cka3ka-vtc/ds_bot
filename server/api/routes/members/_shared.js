// server/api/routes/members/_shared.js
// Общие помощники для подроутов /api/members.

/**
 * Пишет запись в аудит. botId/guildId берутся из query или body.
 */
export function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

/**
 * Инвалидирует member-кэш в модуле «Уровни», если он запущен.
 * Нужно после внешней правки через /api/members PUT — иначе /rank
 * в течение 30 сек будет показывать старые данные (кэш в
 * server/modules/levels/xp.js).
 */
export function invalidateLevelsMemberCache(req, botId, guildId, userId) {
  try {
    const levels = req.app.locals.registry?.get?.('levels');
    levels?._invalidateMemberCache?.(botId, guildId, userId);
  } catch {}
}