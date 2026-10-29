// server/api/routes/settings.js
// Раздел настроек находится в разработке.
// Пока возвращаем безопасные значения по умолчанию, чтобы не ломать другие модули.

import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { guildSettingsToDto } from '../dto/index.js';

export function settingsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const row = req.app.locals.db.getGuildSettings(botId, guildId);
    res.json({
      ...guildSettingsToDto(row),
      stub: true,
      message: 'Раздел находится в разработке',
    });
  });

  router.put('/', requireBotAccess, (req, res) => {
    res.json({
      ok: true,
      stub: true,
      message: 'Раздел находится в разработке — изменения не сохранены',
    });
  });

  return router;
}