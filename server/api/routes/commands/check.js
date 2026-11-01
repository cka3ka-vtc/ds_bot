// server/api/routes/commands/check.js
import { Router } from 'express';
import { validateCommandName } from './_shared.js';

/**
 * GET /api/commands/check?botId=...&guildId=...&name=...&excludeId=...
 *
 * Проверка имени команды перед сохранением (для подсказок в редакторе):
 *   - валидный ли формат (буквы/цифры/_-);
 *   - не зарезервировано ли имя под встроенную команду;
 *   - нет ли дубликата среди кастомных (с учётом excludeId при редактировании).
 *
 * Не проверяет минимальную длину — это делает UI (2 символа).
 */
export function createCheckRouter() {
  const router = Router();

  router.get('/check', (req, res) => {
    const { botId, guildId, name, excludeId } = req.query;

    const result = validateCommandName(
      req.app.locals.db,
      botId,
      guildId,
      name,
      { excludeId, minLength: 1, includeMessage: false },
    );

    if (!result.ok) {
      return res.json({ valid: false, error: result.error });
    }
    res.json({ valid: true, sanitized: result.sanitized });
  });

  return router;
}