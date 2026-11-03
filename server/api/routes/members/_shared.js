// server/api/routes/members/_shared.js
//
// Ре-экспорт единого audit-хелпера + member-специфичные утилиты.

import { audit } from '../../_audit.js';

export { audit };

/**
 * Инвалидирует member-кэш в модуле «Уровни», если он открыт.
 */
export function invalidateLevelsMemberCache(req, botId, guildId, userId) {
  try {
    const levels = req.app.locals.registry?.get?.('levels');
    levels?._invalidateMemberCache?.(botId, guildId, userId);
  } catch {}
}