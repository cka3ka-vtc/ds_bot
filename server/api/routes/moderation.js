// server/api/routes/moderation.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody, validateQuery } from '../validate.js';
import {
  modActionsQuery, modActionCreateBody, moderationTestBody,
} from '../../validators/schemas.js';
import { modActionToDto } from '../dto/index.js';
import { configCache } from '../../core/config-cache.js';
import { mergeModerationConfig, FILTER_KEYS } from '../../../shared/moderation-config.js';
import { runModerationFilters } from '../../modules/moderation/test.js';

const SINCE_MAP = {
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
};

function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

export function moderationRouter() {
  const router = Router();
  router.use(requireAuth);

  /* ═════════════════ Журнал / список ═════════════════ */

  router.get('/actions',
    validateQuery(modActionsQuery),
    requireBotAccess,
    (req, res) => {
      const q = req.validatedQuery;
      const db = req.app.locals.db;

      const since = q.since === 'all'
        ? 0
        : Math.floor(Date.now() / 1000) - (SINCE_MAP[q.since] || 0);

      const offset = (q.page - 1) * q.limit;

      const { rows, total } = db.getModActions(req.bot.id, req.query.guildId, {
        kind: q.kind,
        status: q.status === 'all' ? undefined : q.status,
        moderatorId: q.moderatorId,
        userId: q.userId,
        since,
        search: q.search,
        limit: q.limit,
        offset,
      });

      const since7d = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const counts = db.getModActionStats(req.bot.id, req.query.guildId, { since7d });

      res.json({
        items: rows.map(modActionToDto),
        total,
        page: q.page,
        limit: q.limit,
        pages: Math.max(1, Math.ceil(total / q.limit)),
        counts,
      });
    },
  );

  /* ═════════════════ Создание (ручное) ═════════════════ */

  router.post('/actions',
    validateBody(modActionCreateBody),
    requireBotAccess,
    async (req, res) => {
      const { botId, guildId, userId, kind, reason, durationMinutes } = req.body;

      const inst = req.app.locals.botManager.get(botId);
      if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

      const guild = inst.client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      /* ── Discord action ── */
      try {
        if (kind === 'mute') {
          const member = guild.members.cache.get(userId)
            || await guild.members.fetch(userId).catch(() => null);
          if (!member) return res.status(404).json({ error: 'member_not_found' });
          const ms = (durationMinutes || 60) * 60_000;
          await member.timeout(ms, reason || 'Ручной мут');
        } else if (kind === 'ban') {
          await guild.members.ban(userId, {
            reason: reason || 'Ручной бан',
            deleteMessageSeconds: 0,
          });
        }
        // warn — только запись
      } catch (err) {
        req.app.locals.logger.warn({ err, botId, guildId, userId, kind }, 'moderation: discord action failed');
        return res.status(500).json({ error: 'discord_action_failed', details: err.message });
      }

      /* ── DB record ── */
      const expiresAt = (kind === 'mute' || kind === 'ban') && durationMinutes
        ? Math.floor(Date.now() / 1000) + durationMinutes * 60
        : null;

      const id = req.app.locals.db.addModAction(botId, guildId, {
        userId, kind,
        reason: reason || '',
        moderatorId: req.user.id,
        expiresAt,
      });

      audit(req, 'moderation.action.create', id, { kind, userId });
      res.json({ id });
    },
  );

  /* ═════════════════ Снятие ═════════════════ */

  router.delete('/actions/:id',
    requireBotAccess,
    async (req, res) => {
      const { botId, guildId } = req.query;
      const db = req.app.locals.db;

      const row = db.getModAction(botId, guildId, req.params.id);
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.removed_at) return res.status(400).json({ error: 'already_removed' });
      if (row.kind === 'kick') return res.status(400).json({ error: 'cannot_revert_kick' });

      /* ── Discord action ── */
      const inst = req.app.locals.botManager.get(botId);
      const guild = inst?.client?.guilds?.cache?.get(guildId);
      const reasonText = `Снято: ${req.user.username}`;

      if (guild) {
        try {
          if (row.kind === 'ban') {
            await guild.bans.remove(row.user_id, reasonText);
          } else if (row.kind === 'mute') {
            const member = guild.members.cache.get(row.user_id)
              || await guild.members.fetch(row.user_id).catch(() => null);
            if (member?.isCommunicationDisabled?.()) {
              await member.timeout(null, reasonText);
            }
          }
        } catch (err) {
          req.app.locals.logger.warn(
            { err, botId, guildId, id: req.params.id },
            'moderation: discord remove failed (continuing with DB update)',
          );
        }
      }

      /* ── DB soft delete ── */
      db.markModActionRemoved(botId, guildId, req.params.id, String(req.user.id));

      try {
        db.addLog(botId, guildId, {
          level: 'info',
          module: 'moderation',
          userId: row.user_id,
          message: `Наказание снято вручную (${row.kind})`,
          meta: {
            userId: row.user_id,
            actionId: row.id,
            kind: row.kind,
            removedBy: String(req.user.id),
            removedByName: req.user.username,
          },
        });
      } catch {}

      audit(req, 'moderation.action.removed', req.params.id, {
        kind: row.kind, userId: row.user_id,
      });

      res.json({ ok: true });
    },
  );

  /* ═════════════════ Конфиг автомодерации (без изменений) ═════════════════ */

  router.get('/config', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const stored = req.app.locals.db.getModuleConfig(botId, guildId, 'moderation');
    res.json({
      enabled: !!stored.enabled,
      config: mergeModerationConfig(stored.config),
    });
  });

  router.put('/config', requireBotAccess, (req, res) => {
    const { botId, guildId, enabled, config } = req.body || {};
    if (!botId || !guildId) return res.status(400).json({ error: 'botId_guildId_required' });

    const normalized = mergeModerationConfig(config);
    req.app.locals.db.setModuleConfig(botId, guildId, 'moderation', normalized);
    if (typeof enabled === 'boolean') {
      req.app.locals.db.setModuleEnabled(botId, guildId, 'moderation', enabled);
    }
    configCache.invalidateModule(botId, guildId, 'moderation');
    configCache.invalidateEnabled(botId, guildId);

    audit(req, 'moderation.config.update', null, {
      enabled,
      filtersCount: Object.values(normalized.filters).filter((f) => f.enabled).length,
    });

    res.json({ ok: true, enabled: !!enabled, config: normalized });
  });

  router.post('/test',
    validateBody(moderationTestBody),
    requireBotAccess,
    async (req, res) => {
      const { botId, guildId, text } = req.body;
      const stored = req.app.locals.db.getModuleConfig(botId, guildId, 'moderation');
      const cfg = mergeModerationConfig(stored.config);
      try {
        const hits = await runModerationFilters(cfg, text);
        res.json({ hits });
      } catch (err) {
        req.app.locals.logger.warn({ err }, 'moderation test failed');
        res.status(500).json({ error: 'test_failed' });
      }
    },
  );

  return router;
}