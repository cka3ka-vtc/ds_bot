// server/api/routes/commands/_shared.js
// Общие помощники для подроутов /api/commands.

import { sanitizeCommandName } from '../../../core/commandSync.js';
import { isReservedCommandName } from '../../../../shared/builtin-commands.js';

export function ctx(req) {
  return {
    db: req.app.locals.db,
    botManager: req.app.locals.botManager,
    logger: req.app.locals.logger,
  };
}

export function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.query.botId || req.body?.botId,
    guildId: req.query.guildId || req.body?.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

/**
 * Единая проверка имени команды.
 *
 * @param {object} db
 * @param {string} botId
 * @param {string} guildId
 * @param {string} rawName
 * @param {object} [opts]
 * @param {string} [opts.excludeId]
 * @param {number} [opts.minLength=1]
 * @param {boolean} [opts.includeMessage=false]
 * @param {Array} [opts.existingCommands] — предзагруженный список (избегает повторной
 *   выборки при вызове из контекста, где он уже есть, например из custom.js update).
 */
export function validateCommandName(db, botId, guildId, rawName, opts = {}) {
  const { excludeId, minLength = 1, includeMessage = false, existingCommands } = opts;

  const sanitized = sanitizeCommandName(rawName);
  if (!sanitized || sanitized.length < minLength) {
    return {
      ok: false,
      error: 'invalid_name',
      message: includeMessage
        ? `Имя: ${minLength}-32 символа, буквы/цифры/_-`
        : undefined,
    };
  }

  if (isReservedCommandName(sanitized)) {
    return {
      ok: false,
      error: 'reserved_name',
      message: includeMessage
        ? 'Это имя зарезервировано за встроенной командой'
        : undefined,
    };
  }

  const pool = Array.isArray(existingCommands)
    ? existingCommands
    : db.getCustomCommands(botId, guildId);
  const existing = pool.find((c) => c.name === sanitized && c.id !== excludeId);

  if (existing) {
    return {
      ok: false,
      error: 'duplicate_name',
      message: includeMessage
        ? 'Команда с таким именем уже существует'
        : undefined,
    };
  }

  return { ok: true, sanitized };
}