// server/api/routes/auth/me.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';

/**
 * Сессия без authLimiter — эти роуты вызываются на каждой загрузке страницы
 * (fetch /auth/me из auth.html и panel.html). Лимитер здесь приводил бы
 * к «выкидыванию» пользователя при F5.
 */
export function createSessionRouter() {
  const router = Router();

  router.get('/me', (req, res) => {
    const token = req.cookies?.auth;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    try {
      const payload = jwt.verify(token, config.JWT_SECRET);
      const user = req.app.locals.db.getUser(payload.sub);
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      res.json({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
      });
    } catch {
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('auth');
    res.json({ ok: true });
  });

  return router;
}