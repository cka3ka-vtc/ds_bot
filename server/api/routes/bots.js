import { Router } from 'express';
import { requireAuth } from '../auth-middleware.js';

export function botsRouter() {
  const router = Router();
  router.use(requireAuth);

  /** Список ботов пользователя: главный + его собственные */
  router.get('/', (req, res) => {
    const rows = req.app.locals.db.getBotsForUser(req.user.id);
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      avatarUrl: r.avatar_url,
      isMain: !!r.is_main,
    })));
  });

  /** Добавить своего бота */
  router.post('/', async (req, res, next) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'token_required' });
      }
      const bot = await req.app.locals.botManager.addUserBot({
        token, ownerId: req.user.id,
      });
      res.json(bot);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'add bot failed');
      res.status(400).json({ error: 'invalid_token', details: err.message });
    }
  });

  /** Удалить своего бота */
  router.delete('/:id', async (req, res, next) => {
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
      res.status(code ? status : 500).json({ error: code });
    }
  });

  return router;
}