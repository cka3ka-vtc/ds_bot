// server/api/auth-middleware.js
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { userApiLimiter } from './middleware/rate-limit.js';

const adminCache = new Map();
const ADMIN_TTL = 2 * 60_000;

async function checkMemberAdmin(inst, guildId, userId) {
  const key = `${inst.id}:${guildId}:${userId}`;
  const now = Date.now();
  const c = adminCache.get(key);
  if (c && now - c.ts < ADMIN_TTL) return c.value;

  if (!inst?.client?.isReady?.()) return false;
  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) { adminCache.set(key, { value: false, ts: now }); return false; }

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    }
    const value = !!(
      member?.permissions?.has?.('Administrator') ||
      member?.permissions?.has?.('ManageGuild')
    );
    adminCache.set(key, { value, ts: now });
    return value;
  } catch {
    adminCache.set(key, { value: false, ts: now });
    return false;
  }
}

export function invalidateAdminCache(botId, guildId, userId) {
  adminCache.delete(`${botId}:${guildId}:${userId}`);
}

/**
 * Проверка JWT-cookie. При успехе:
 *   - req.user = { id, username, ... };
 *   - пропускает через userApiLimiter (300 req/min per user_id),
 *     чтобы 1 IP = N админов не били лимит друг другу.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = req.app.locals.db.getUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Per-user rate limit — после того как req.user.id известен.
  return userApiLimiter(req, res, next);
}

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
  if (!guildId) return next();

  const guild = req.app.locals.db.getGuild(botId, guildId);
  if (!guild) return res.status(404).json({ error: 'guild_not_found' });

  (async () => {
    try {
      let hasAccess = req.app.locals.db.userHasGuildAccess(req.user.id, guildId);

      if (!hasAccess) {
        const inst = req.app.locals.botManager.get(botId);
        if (inst?.client?.isReady?.()) {
          const live = inst.client.guilds.cache.get(guildId);
          if (live && live.ownerId != null && String(live.ownerId) === String(req.user.id)) {
            hasAccess = true;
            try {
              req.app.locals.db.upsertGuild({
                id: guildId, bot_id: botId, name: guild.name, icon: guild.icon,
                owner_id: live.ownerId,
                member_count: live.memberCount ?? guild.member_count ?? null,
                discord_created_at: guild.discord_created_at ?? null,
                online_count: live.approximatePresenceCount ?? guild.online_count ?? null,
              });
            } catch {}
          } else {
            hasAccess = await checkMemberAdmin(inst, guildId, req.user.id);
          }
        }
      }

      if (!hasAccess) return res.status(403).json({ error: 'access_denied' });
      req.guild = guild;
      next();
    } catch (err) {
      req.app.locals.logger.error({ err, guildId }, 'requireBotAccess check failed');
      res.status(500).json({ error: 'internal_error' });
    }
  })();
}