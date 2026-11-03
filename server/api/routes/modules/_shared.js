// server/api/routes/modules/_shared.js
//
// Общие helper'ы для /api/modules.
// audit — ре-экспорт из единого api/_audit.js.

import { audit } from '../../_audit.js';

export { audit };

/**
 * Проверяет, что канал принадлежит гильдии.
 */
export function channelBelongs(guild, channelId) {
  if (!guild || !channelId) return false;
  return !!guild.channels.cache.get(channelId);
}