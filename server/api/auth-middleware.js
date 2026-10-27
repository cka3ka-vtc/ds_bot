import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** Пользователь должен быть авторизован (JWT в httpOnly cookie) */
export function requireAuth(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = req.app.locals.db.getUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

/**
 * Проверяет, что:
 *   1. botId существует и пользователь имеет к нему доступ
 *   2. guildId (если передан) существует для этого бота
 *   3. пользователь имеет админ-права в guild (проверено при OAuth)
 */
export function requireBotAccess(req, res, next) {
  const botId = req.query.botId || req.body.botId;
  if (!botId) return res.status(400).json({ error: 'botId_required' });

  const bot = req.app.locals.db.getBot(botId);
  if (!bot) return res.status(404).json({ error: 'bot_not_found' });

  if (!bot.is_main && bot.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'access_denied' });
  }
  req.bot = bot;

  const guildId = req.query.guildId || req.body.guildId;
  if (guildId) {
    const guild = req.app.locals.db.getGuild(botId, guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });
    if (!req.app.locals.db.userHasGuildAccess(req.user.id, guildId)) {
      return res.status(403).json({ error: 'access_denied' });
    }
    req.guild = guild;
  }
  next();
}