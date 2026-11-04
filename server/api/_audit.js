// server/api/_audit.js
//
// Единый helper для записи аудита действий администраторов панели.
// Все write-эндпоинты (create/update/delete/toggle/test) вызывают его
// вместо локальных копий.
//
// Источник botId/guildId — body (приоритет) или query.
// Источник userId — req.user.id (гарантирован requireAuth выше по стеку).
// Источник ip — req.ip (Express с trust-proxy).
//
// Ошибки записи аудита НЕ должны валить бизнес-операцию — молча глотаем.

export function audit(req, action, target = null, meta = null) {
  const db = req.app?.locals?.db;
  if (!db) return;

  const userId = req.user?.id;
  if (!userId) return;

  const botId = req.body?.botId || req.query?.botId || null;
  const guildId = req.body?.guildId || req.query?.guildId || null;

  try {
    db.addAudit({ userId, botId, guildId, action, target, meta, ip: req.ip });
  } catch {
    // audit не критичен для успеха операции
  }
}