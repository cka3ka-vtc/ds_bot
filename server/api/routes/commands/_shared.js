// server/api/routes/commands/_shared.js
// Общие помощники для подроутов /api/commands.

import { sanitizeCommandName } from '../../../core/commandSync.js';
import { isReservedCommandName } from '../../../../shared/builtin-commands.js';

/**
 * Контекст для syncGuildCommands: репозиторий БД, менеджер ботов, логгер.
 */
export function ctx(req) {
  return {
    db: req.app.locals.db,
    botManager: req.app.locals.botManager,
    logger: req.app.locals.logger,
  };
}

/**
 * Пишет запись в аудит. botId/guildId берутся из query или body.
 */
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
 * Единая проверка имени команды для check / create / update.
 *
 * Возвращает:
 *   { ok: true,  sanitized }                       — имя прошло проверки;
 *   { ok: false, error, message }                  — при ошибке.
 *
 * Коды ошибок:
 *   'invalid_name'   — пустое имя после sanitize / короче minLength;
 *   'reserved_name'  — имя занято встроенной командой;
 *   'duplicate_name' — есть другая команда с таким именем.
 *
 * @param {object} db             — репозиторий req.app.locals.db
 * @param {string} botId
 * @param {string} guildId
 * @param {string} rawName
 * @param {object} [opts]
 * @param {string} [opts.excludeId]   — id, который игнорируем (при update)
 * @param {number} [opts.minLength=1] — минимальная длина (POST/PUT передают 2)
 * @param {boolean} [opts.includeMessage=false]
 *                                    — добавлять человекочитаемое message
 *                                      (для POST/PUT, где 400/409 идут в UI)
 */
export function validateCommandName(db, botId, guildId, rawName, opts = {}) {
  const { excludeId, minLength = 1, includeMessage = false } = opts;

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

  const existing = db
    .getCustomCommands(botId, guildId)
    .find((c) => c.name === sanitized && c.id !== excludeId);

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