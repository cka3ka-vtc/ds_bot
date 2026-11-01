// server/api/routes/modules/levels-debug.js
import { Router } from 'express';

/**
 * GET /api/modules/levels/debug?botId=...&guildId=...
 *
 * Диагностика модуля «Уровни»: enabled, ключи config, daily-синхронизация,
 * зарегистрированные slash-команды в Discord, список ботов и т.п.
 * Нужен для ручной проверки при проблемах с /rank /leaderboard /daily.
 */
export function createLevelsDebugRouter() {
  const router = Router();

  router.get('/debug', async (req, res) => {
    try {
      const { botId, guildId } = req.query;
      const db = req.app.locals.db;
      const botManager = req.app.locals.botManager;

      const cfg = db.getModuleConfig(botId, guildId, 'levels');
      const dbPath = `data/guilds/${guildId}/${botId}.sqlite`;

      const botsKnowingGuild = [];
      for (const inst of botManager.all()) {
        if (!inst?.client?.isReady()) {
          botsKnowingGuild.push({ botId: inst.id, ready: false, inGuild: null, applicationId: null });
          continue;
        }
        const hasGuild = !!inst.client.guilds.cache.get(guildId);
        botsKnowingGuild.push({
          botId: inst.id,
          tag: inst.client.user?.tag || null,
          ready: true,
          inGuild: hasGuild,
          applicationId: inst.client.application?.id || null,
        });
      }

      let registeredCommands = null;
      let registeredCommandsError = null;
      const inst = botManager.get(botId);
      if (inst?.client?.isReady()) {
        const guild = inst.client.guilds.cache.get(guildId);
        if (guild) {
          try {
            const cmds = await guild.commands.fetch();
            registeredCommands = [...cmds.values()].map((c) => c.name);
          } catch (err) {
            registeredCommandsError = err.message;
          }
        } else {
          registeredCommandsError = 'guild_not_in_cache';
        }
      } else {
        registeredCommandsError = 'bot_not_ready';
      }

      const states = db.getModuleStates(botId, guildId);
      const modules = states.map((s) => ({ key: s.module_key, enabled: !!s.enabled }));

      const diagnosis = [];
      if (!cfg.enabled) {
        diagnosis.push('⚠ В БД модуль levels ВЫКЛЮЧЕН для этой пары (botId, guildId).');
      } else {
        diagnosis.push('✅ В БД модуль levels ВКЛЮЧЁН для этой пары (botId, guildId).');
      }

      const dailyBuiltin = db.getBuiltinSettings(botId, guildId, 'daily');
      const dailyEnabledInConfig = cfg.config?.dailyEnabled !== false;

      res.json({
        botId, guildId, dbPath,
        levelConfig: {
          enabled: cfg.enabled,
          configKeys: Object.keys(cfg.config || {}),
          dailyEnabled: dailyEnabledInConfig,
        },
        dailyBuiltin,
        modules, bots: botsKnowingGuild,
        registeredCommands, registeredCommandsError, diagnosis,
      });
    } catch (err) {
      req.app.locals.logger.error({ err }, 'levels/debug failed');
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  return router;
}