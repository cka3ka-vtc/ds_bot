/* ============================================================
   Данные о гильдиях и инфраструктура.

   GET  /bot-info                          — тег и аватар бота
   GET  /guilds                            — список серверов
   GET  /guilds/:id                        — детали одного
   GET  /guilds/:id/channels               — каналы + права бота
   GET  /guilds/:id/roles                  — роли + manageable
   GET  /guilds/:id/members                — участники
   POST /guilds/:id/refresh-cache          — сброс кэшей
   GET  /guilds/:id/events                 — SSE
   GET  /guilds/:id/backups/:section       — список бэкапов
   POST /guilds/:id/backups/:section/restore — восстановить
   ============================================================ */

import express from 'express';
import { getClient } from '../discord/client.js';
import { getChannels, getRoles, getMembers, invalidateGuild } from '../services/discord-cache.js';
import { invalidateAutodeleteRules, invalidateCommandChannels } from '../discord/autodelete.js';
import { addSSEClient, removeSSEClient, notifySectionUpdate } from '../services/sse-hub.js';
import { readSection, guildDir, invalidateCache } from '../storage/index.js';
import { listBackups, restoreBackup } from '../storage/backups.js';
import { GuildIdSchema } from '../validation/schemas.js';

const router = express.Router();

/* ============================================================
   Информация о боте
   ============================================================ */

router.get('/bot-info', (req, res) => {
  const client = getClient();
  if (!client.user) return res.status(503).json({ error: 'Bot not ready' });

  res.json({
    id: client.user.id,
    username: client.user.username,
    tag: client.user.tag,
    avatar: client.user.displayAvatarURL({ size: 128, extension: 'png' })
  });
});

/* ============================================================
   Список гильдий
   ============================================================ */

router.get('/guilds', (req, res) => {
  const client = getClient();
  res.json(client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ size: 128 }),
    memberCount: g.memberCount,
    createdAt: g.createdAt.toISOString(),
    status: computeStatus(g.id)
  })));
});

/* ============================================================
   Детали одной гильдии
   ============================================================ */

router.get('/guilds/:id', async (req, res, next) => {
  try {
    GuildIdSchema.parse(req.params.id);
    const client = getClient();

    let guild = client.guilds.cache.get(req.params.id);
    if (!guild) guild = await client.guilds.fetch(req.params.id);

    /* Online считаем по-разному: через presence, потом через fetch */
    let onlineCount = 0;
    try {
      onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;
    } catch {}

    if (onlineCount === 0) {
      try {
        const members = await guild.members.fetch({ withPresences: true });
        onlineCount = members.filter(m =>
          m.presence?.status && m.presence.status !== 'offline'
        ).size;
      } catch {}
    }

    if (onlineCount === 0 && typeof guild.approximatePresenceCount === 'number') {
      onlineCount = guild.approximatePresenceCount;
    }

    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      onlineCount,
      createdAt: guild.createdAt.toISOString(),
      status: computeStatus(guild.id)
    });
  } catch (e) {
    next(e);
  }
});

/* ============================================================
   Каналы / роли / участники
   ============================================================ */

router.get('/guilds/:id/channels', async (req, res, next) => {
  try { res.json(await getChannels(req.params.id)); }
  catch (e) { next(e); }
});

router.get('/guilds/:id/roles', async (req, res, next) => {
  try { res.json(await getRoles(req.params.id)); }
  catch (e) { next(e); }
});

router.get('/guilds/:id/members', async (req, res, next) => {
  try { res.json(await getMembers(req.params.id)); }
  catch (e) { next(e); }
});

/* ============================================================
   Инвалидация кэшей
   ============================================================ */

router.post('/guilds/:id/refresh-cache', (req, res) => {
  invalidateGuild(req.params.id);
  invalidateAutodeleteRules(req.params.id);
  invalidateCommandChannels(req.params.id);
  invalidateCache(req.params.id);
  res.json({ ok: true });
});

/* ============================================================
   SSE (Server-Sent Events)
   ============================================================ */

router.get('/guilds/:id/events', (req, res) => {
  const guildId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const added = addSSEClient(guildId, res);
  if (!added.ok) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: added.reason })}\n\n`);
    return res.end();
  }

  res.write(': connected\n\n');
  req.on('close', () => removeSSEClient(guildId, res));
});

/* ============================================================
   Бэкапы
   ============================================================ */

router.get('/guilds/:id/backups/:section', (req, res) => {
  try {
    res.json(listBackups(req.params.id, req.params.section, guildDir(req.params.id)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/guilds/:id/backups/:section/restore', (req, res) => {
  try {
    restoreBackup(
      req.params.id,
      req.params.section,
      guildDir(req.params.id),
      req.body.filename
    );

    /* После восстановления — сбросить кэши */
    if (req.params.section === 'autodelete') {
      invalidateAutodeleteRules(req.params.id);
    }
    if (req.params.section === 'birthdays' || req.params.section === 'profiles') {
      invalidateCommandChannels(req.params.id);
    }
    invalidateCache(req.params.id, req.params.section);
    notifySectionUpdate(req.params.id, req.params.section);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   Вычисление статуса гильдии (active/off)
   ============================================================ */

function computeStatus(guildId) {
  const s = readSection(guildId, 'settings');
  if (!s || s.botEnabled === false) return 'off';

  const a = (readSection(guildId, 'announcements')?.items || []).some(x => x.enabled);
  const d = (readSection(guildId, 'delayed')?.items || []).some(x => x.publishAt && !x.lastSentAt);
  const au = (readSection(guildId, 'autodelete')?.items || []).some(x => x.enabled);
  const b = !!readSection(guildId, 'birthdays')?.settings?.enabled;

  return (a || d || au || b) ? 'active' : 'off';
}

export default router;