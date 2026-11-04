// server/api/routes/modules/levels-leaderboard.js
//
// GET /api/modules/levels/leaderboard
// GET /api/modules/levels/member/:userId
// POST /api/modules/levels/inactivity/run
//
// (URL через alias: /api/levels/* тоже работает до удаления alias)

import { Router } from 'express';
import { xpForLevel, progressOf } from '../../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../../shared/titles.js';
import { audit } from '../../_audit.js';

export function createLevelsLeaderboardRouter() {
  const router = Router();

  router.get('/leaderboard', (req, res) => {
    const { botId, guildId } = req.query;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const db = req.app.locals.db;
    const rows = db.getLeaderboard(botId, guildId, limit, offset);
    const total = db.countLeaderboard(botId, guildId);
    res.json({
      items: rows.map((r, i) => ({
        userId: r.user_id, xp: r.xp, level: r.level, rank: offset + i + 1,
      })),
      total, limit, offset,
    });
  });

  router.get('/member/:userId', (req, res) => {
    const { botId, guildId } = req.query;
    const { userId } = req.params;
    const db = req.app.locals.db;

    const data = db.getMemberData(botId, guildId, userId) || { xp: 0, level: 0 };
    const rank = db.getUserRank(botId, guildId, userId);
    const cfg = db.getModuleConfig(botId, guildId, 'levels');
    const config = cfg?.config || {};
    const formula = config.formula === 'linear' ? 'linear' : 'classic';
    const titles = config.titles || DEFAULT_TITLES;

    const progress = progressOf(data.xp, data.level, formula, config);
    res.json({
      userId,
      xp: data.xp, level: data.level,
      title: getTitleForLevel(data.level, titles),
      rank,
      progress: {
        current: progress.current,
        total: progress.total,
        percent: progress.percent,
        toNext: progress.toNext,
      },
      nextLevelXp: xpForLevel(data.level + 1, formula, config),
    });
  });

  router.post('/inactivity/run', async (req, res) => {
    const registry = req.app.locals.registry;
    const levelsMod = registry?.get?.('levels');
    if (!levelsMod?._inactivityTick) return res.status(503).json({ error: 'module_not_loaded' });

    try {
      await levelsMod._inactivityTick();
      audit(req, 'levels.inactivity.run', null);
      res.json({ ok: true });
    } catch (err) {
      req.app.locals.logger.warn({ err }, 'inactivity manual run failed');
      res.status(500).json({ error: 'failed' });
    }
  });

  return router;
}