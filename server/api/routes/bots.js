import { Router } from 'express';
import { requireAuth } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import { addBotBody } from '../../validators/schemas.js';
import { botToDto } from '../dto/index.js';

export function botsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;
    const rows = db.getBotsForUser(req.user.id);

    // Быстрая синхронизация имени/аватара с работающими инстансами
    const synced = rows.map((row) => {
      const inst = botManager.get(row.id);
      if (!inst) return row;
      const nextName = inst.name || row.name;
      const nextAvatar = inst.avatarUrl || row.avatar_url;
      if (row.name !== nextName || row.avatar_url !== nextAvatar) {
        try {
          db.updateBotProfile(row.id, { name: nextName, avatar_url: nextAvatar });
        } catch {}
        return { ...row, name: nextName, avatar_url: nextAvatar };
      }
      return row;
    });

    res.json(synced.map(botToDto));
  });

  router.post('/', validateBody(addBotBody), async (req, res, next) => {
    try {
      const bot = await req.app.locals.botManager.addUserBot({
        token: req.body.token, ownerId: req.user.id,
      });
      res.json(bot);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'add bot failed');
      res.status(400).json({ error: 'invalid_token', details: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await req.app.locals.botManager.removeUserBot(req.params.id, req.user.id);
      res.json({ ok: true });
    } catch (err) {
      const map = {
        bot_not_found: [404, 'bot_not_found'],
        cannot_remove_main: [400, 'cannot_remove_main'],
        forbidden: [403, 'forbidden'],
      };
      const [status, code] = map[err.message] || [500, 'unknown'];
      res.status(status).json({ error: code });
    }
  });

  return router;
}