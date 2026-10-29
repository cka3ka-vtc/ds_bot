// server/api/routes/modules.js
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';

export function modulesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireBotAccess);

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('shared/modules.manifest.json'), 'utf8'),
  );

  router.get('/', (req, res) => {
    const { botId, guildId } = req.query;
    const states = req.app.locals.db.getModuleStates(botId, guildId);
    const stateMap = Object.fromEntries(states.map(s => [s.module_key, !!s.enabled]));

    res.json(manifest.modules.map(m => ({
      key: m.key,
      name: m.name,
      description: m.description,
      icon: m.icon,
      color: m.color,
      category: m.category,
      version: m.version,
      enabled: stateMap[m.key] ?? m.defaultEnabled ?? false,
      configSchema: m.configSchema,
    })));
  });

  router.post('/:key/toggle', (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const { key } = req.params;
    if (!manifest.modules.find(m => m.key === key)) {
      return res.status(404).json({ error: 'unknown_module' });
    }
    req.app.locals.db.setModuleEnabled(botId, guildId, key, !!enabled);
    req.app.locals.logger.info({ botId, guildId, key, enabled }, 'module toggled');
    res.json({ ok: true });
  });

  router.get('/:key/config', (req, res) => {
    const { botId, guildId } = req.query;
    const { key } = req.params;
    res.json(req.app.locals.db.getModuleConfig(botId, guildId, key));
  });

  router.put('/:key/config', (req, res) => {
    const { botId, guildId, config } = req.body;
    const { key } = req.params;
    req.app.locals.db.setModuleConfig(botId, guildId, key, config || {});
    res.json({ ok: true });
  });

  /* ─── Тест сообщения модуля «Приветствия» ─── */
  router.post('/greetings/test', async (req, res) => {
    const { botId, guildId, which, messageConfig } = req.body || {};
    if (which !== 'join' && which !== 'leave') {
      return res.status(400).json({ error: 'invalid_which' });
    }

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const stored = db.getModuleConfig(botId, guildId, 'greetings');
    const channelId = req.body.channelId || stored?.config?.channelId;
    if (!channelId) return res.status(400).json({ error: 'no_channel' });

    const msgCfg = messageConfig || stored?.config?.messages?.[which];
    if (!msgCfg) return res.status(400).json({ error: 'no_message' });

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const channel = await inst.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      return res.status(400).json({ error: 'invalid_channel' });
    }

    const user = req.user;
    let displayName = user.username;
    let avatarUrl = '';
    try {
      const member = await channel.guild.members.fetch(user.id);
      displayName = member.displayName || user.username;
      avatarUrl = member.user.displayAvatarURL?.({ size: 128 }) || '';
    } catch {
      if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
      }
    }

    const nonBotCount = await getNonBotMemberCount(channel.guild);

    const tokens = {
      user: `<@${user.id}>`,
      mention: `<@${user.id}>`,
      username: user.username,
      displayName,
      avatarUrl,
      guild: channel.guild.name,
      count: nonBotCount,
      guildIconUrl: channel.guild.iconURL?.({ size: 128 }) || '',
      section: 'greetings',
    };

    let components;
    try {
      components = buildComponentsFromConfig(msgCfg, tokens);
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId }, 'greetings: test build failed');
      return res.status(500).json({ error: 'build_failed' });
    }
    if (!components?.length) return res.status(400).json({ error: 'empty_message' });

    try {
      const msg = await channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: { parse: [] },
      });
      req.app.locals.logger.info(
        { botId, guildId, channelId, which, userId: user.id, messageId: msg.id },
        'greetings: test message sent',
      );
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'greetings: test send failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}