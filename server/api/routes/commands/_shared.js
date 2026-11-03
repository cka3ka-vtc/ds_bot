// server/api/routes/commands/_shared.js
//
// Общие helper'ы для роутов /api/commands.
// audit — ре-экспорт из единого api/_audit.js.

import { sanitizeCommandName } from '../../../core/commandSync.js';
import { isReservedCommandName } from '../../../../shared/builtin-commands.js';
import { audit } from '../../_audit.js';

export { audit };

export function ctx(req) {
  return {
    db: req.app.locals.db,
    botManager: req.app.locals.botManager,
    logger: req.app.locals.logger,
  };
}

/**
 * Валидация имени команды. Возвращает { ok, sanitized?, error?, message? }.
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