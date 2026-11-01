// server/api/routes/members/update.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateBody } from '../../validate.js';
import { memberUpdateBody } from '../../../validators/schemas.js';
import { xpForLevel } from '../../../core/formulas.js';
import { audit, invalidateLevelsMemberCache } from './_shared.js';

export function createUpdateRouter() {
  const router = Router();

  router.put('/:userId', validateBody(memberUpdateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, level, warnings, nickname, roles } = req.body;
    const userId = req.params.userId;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const me = guild.members.me;

    if (level !== undefined || warnings !== undefined) {
      try {
        const current = db.getMemberData(botId, guildId, userId) || { xp: 0, level: 0 };
        let newXp = current.xp | 0;
        let newLevel = current.level | 0;

        if (level !== undefined && level !== current.level) {
          const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
          const levelsConfig = levelsCfg?.config || {};
          const formula = levelsConfig.formula === 'linear' ? 'linear' : 'classic';
          newXp = xpForLevel(level, formula, levelsConfig);
          newLevel = level;
        }

        db.upsertMemberData(botId, guildId, userId, {
          level: newLevel,
          xp: newXp,
          warnings: warnings !== undefined ? warnings : current.warnings,
        });

        invalidateLevelsMemberCache(req, botId, guildId, userId);
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'member data update failed');
        return res.status(500).json({ error: 'db_failed' });
      }
    }

    const member = guild.members.cache.get(userId)
      || await guild.members.fetch(userId).catch(() => null);

    if (!member && (nickname !== undefined || roles !== undefined)) {
      return res.json({
        ok: true,
        warning: 'member_not_found',
        message: 'Участник не найден на сервере — никнейм и роли не изменены',
      });
    }

    if (nickname !== undefined && member) {
      if (!me?.permissions?.has('ManageNicknames')) {
        return res.status(403).json({
          error: 'no_permission',
          details: 'У бота нет права «Управление никнеймами»',
        });
      }
      try {
        const next = String(nickname || '').trim() || null;
        await member.setNickname(next, 'Изменение из панели');
        audit(req, 'member.nickname', userId, { next });
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'setNickname failed');
        return res.status(400).json({ error: 'nickname_failed', details: err.message });
      }
    }

    if (Array.isArray(roles) && member) {
      if (!me?.permissions?.has('ManageRoles')) {
        return res.status(403).json({
          error: 'no_permission',
          details: 'У бота нет права «Управление ролями»',
        });
      }
      const botHighest = me.roles.highest.position;

      const current = new Set(
        member.roles.cache
          .filter((r) => r.id !== guild.id && !r.managed && r.position < botHighest)
          .map((r) => r.id),
      );

      const target = new Set(
        roles.filter((id) => {
          const r = guild.roles.cache.get(id);
          return r && !r.managed && r.position < botHighest;
        }),
      );

      const toAdd = [...target].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !target.has(id));

      try {
        if (toAdd.length) await member.roles.add(toAdd, 'Изменение из панели');
        if (toRemove.length) await member.roles.remove(toRemove, 'Изменение из панели');
        if (toAdd.length || toRemove.length) {
          audit(req, 'member.roles', userId, { added: toAdd, removed: toRemove });
        }
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'roles update failed');
        return res.status(400).json({ error: 'roles_failed', details: err.message });
      }
    }

    return res.json({ ok: true });
  });

  return router;
}