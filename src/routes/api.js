import { getClient } from '../discord/client.js';
import { readSection, writeSection, guildDir } from '../storage/index.js';
import { listBackups, restoreBackup } from '../storage/backups.js';
import { getChannels, getRoles, getMembers, invalidateGuild } from '../services/cache.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../discord/builder.js';
import { sendAutopost, sendDelayed, computeNextRun } from '../discord/scheduler.js';
import { logInfo, logError, clearLogs, groupLogs } from '../discord/logger.js';
import { invalidateAutodeleteRules, invalidateCommandChannels } from '../discord/autodelete.js';
import { addSSEClient, removeSSEClient, notifySectionUpdate } from '../services/events.js';
import {
  RulesSchema, MessagesSchema, AnnouncementsSchema, DelayedSchema, AutodeleteSchema,
  BirthdaysSchema, ProfilesSchema, SettingsSchema,
  SendBodySchema, SendMessageSchema, SendAnnouncementSchema, SendDelayedSchema,
  GuildIdSchema, SectionSchema
} from '../validation/schemas.js';

export default function registerRoutes(app) {

  app.get('/api/guilds/:id/events', (req, res) => {
    const guildId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');
    addSSEClient(guildId, res);

    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch {}
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSSEClient(guildId, res);
    });
  });

  app.get('/api/bot-info', (req, res) => {
    const client = getClient();
    if (!client.user) return res.status(503).json({ error: 'Bot not ready' });
    res.json({
      id: client.user.id,
      username: client.user.username,
      tag: client.user.tag,
      avatar: client.user.displayAvatarURL({ size: 128, extension: 'png' })
    });
  });

  app.get('/api/guilds', (req, res) => {
    const client = getClient();
    const guilds = client.guilds.cache.map(g => ({
      id: g.id, name: g.name, icon: g.iconURL({ size: 128 }),
      memberCount: g.memberCount, createdAt: g.createdAt.toISOString(),
      status: computeStatus(g.id)
    }));
    res.json(guilds);
  });

  app.get('/api/guilds/:id', async (req, res, next) => {
    try {
      GuildIdSchema.parse(req.params.id);
      const client = getClient();
      let guild = client.guilds.cache.get(req.params.id);
      if (!guild) guild = await client.guilds.fetch(req.params.id);

      let onlineCount = 0;
      try {
        onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;
      } catch {}
      if (onlineCount === 0) {
        try {
          const members = await guild.members.fetch({ withPresences: true });
          onlineCount = members.filter(m => {
            const s = m.presence?.status;
            return s && s !== 'offline';
          }).size;
        } catch {}
      }
      if (onlineCount === 0 && typeof guild.approximatePresenceCount === 'number') {
        onlineCount = guild.approximatePresenceCount;
      }

      res.json({
        id: guild.id, name: guild.name, icon: guild.iconURL({ size: 256 }),
        memberCount: guild.memberCount, onlineCount,
        createdAt: guild.createdAt.toISOString(), status: computeStatus(guild.id)
      });
    } catch (e) { next(e); }
  });

  app.get('/api/guilds/:id/channels', async (req, res, next) => {
    try { res.json(await getChannels(req.params.id)); } catch (e) { next(e); }
  });
  app.get('/api/guilds/:id/roles', async (req, res, next) => {
    try { res.json(await getRoles(req.params.id)); } catch (e) { next(e); }
  });
  app.get('/api/guilds/:id/members', async (req, res, next) => {
    try { res.json(await getMembers(req.params.id)); } catch (e) { next(e); }
  });
  app.post('/api/guilds/:id/refresh-cache', (req, res) => {
    invalidateGuild(req.params.id);
    invalidateAutodeleteRules(req.params.id);
    invalidateCommandChannels(req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/guilds/:id/data/:section', (req, res, next) => {
    try { res.json(readSection(req.params.id, req.params.section)); } catch (e) { next(e); }
  });

  app.put('/api/guilds/:id/data/:section', (req, res, next) => {
    try {
      const section = SectionSchema.parse(req.params.section);
      if (section === 'autodelete-queue') {
        throw Object.assign(new Error('Секция доступна только для чтения'), { status: 403 });
      }

      let data = req.body;
      if (section === 'rules') data = RulesSchema.parse(data);
      else if (section === 'messages') data = MessagesSchema.parse(data);
      else if (section === 'announcements') data = AnnouncementsSchema.parse(data);
      else if (section === 'delayed') data = DelayedSchema.parse(data);
      else if (section === 'autodelete') data = AutodeleteSchema.parse(data);
      else if (section === 'birthdays') data = BirthdaysSchema.parse(data);
      else if (section === 'profiles') data = ProfilesSchema.parse(data);
      else if (section === 'settings') data = SettingsSchema.parse(data);

      if (section === 'announcements' && data.items) {
        for (const ann of data.items) {
          if (ann.enabled && ann.schedule.type !== 'manual') {
            if (!ann.nextRunAt || ann.nextRunAt < Date.now()) ann.nextRunAt = computeNextRun(ann, Date.now());
          } else {
            ann.nextRunAt = null;
          }
        }
      }

      if (section === 'birthdays') {
        const existing = readSection(req.params.id, 'birthdays');
        const existingPending = existing?.settings?._pending || [];
        const keepRoles = data.settings.roleRemoveNextDay !== false;
        const keepMsgs = !!data.settings.autoDeleteMessage;
        data.settings._pending = existingPending.filter(p => {
          if (p.type === 'role-remove' && !keepRoles) return false;
          if (p.type === 'message-delete' && !keepMsgs) return false;
          return true;
        });
        data.settings.lastRunDate = existing?.settings?.lastRunDate || null;
      }

      writeSection(req.params.id, section, data);
      if (section === 'autodelete') invalidateAutodeleteRules(req.params.id);
      if (section === 'birthdays' || section === 'profiles') invalidateCommandChannels(req.params.id);
      notifySectionUpdate(req.params.id, section);

      res.json({ ok: true, status: computeStatus(req.params.id) });
    } catch (e) { next(e); }
  });

  app.get('/api/guilds/:id/backups/:section', (req, res) => {
    try {
      const backups = listBackups(req.params.id, req.params.section, guildDir(req.params.id));
      res.json(backups);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/guilds/:id/backups/:section/restore', (req, res) => {
    try {
      restoreBackup(req.params.id, req.params.section, guildDir(req.params.id), req.body.filename);
      if (req.params.section === 'autodelete') invalidateAutodeleteRules(req.params.id);
      if (req.params.section === 'birthdays' || req.params.section === 'profiles') invalidateCommandChannels(req.params.id);
      notifySectionUpdate(req.params.id, req.params.section);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ================= Правила ================= */
  app.post('/api/guilds/:id/rules/send', async (req, res, next) => {
    try {
      const body = SendBodySchema.parse(req.body);
      const rules = readSection(req.params.id, 'rules');
      if (!rules?.channelId) throw Object.assign(new Error('Канал не выбран'), { status: 400 });

      const client = getClient();
      const guild = await client.guilds.fetch(req.params.id);
      const channel = await guild.channels.fetch(rules.channelId).catch(() => null);
      if (!channel?.isTextBased()) throw Object.assign(new Error('Канал недоступен'), { status: 400 });

      const perms = channel.permissionsFor(guild.members.me);
      if (!perms?.has('SendMessages')) throw Object.assign(new Error('Нет права SendMessages'), { status: 403 });

      let cleared = 0;
      if (body.clearChannel && perms.has('ManageMessages')) cleared = await clearChannel(channel);

      const components = buildComponentsFromConfig(rules, { section: 'rules' });
      const sent = await channel.send({ flags: FLAG_COMPONENTS_V2, components });

      rules.lastSentAt = new Date().toISOString();
      rules.lastMessageId = sent.id;
      writeSection(req.params.id, 'rules', rules);
      notifySectionUpdate(req.params.id, 'rules');

      logInfo(req.params.id, 'rules_send', 'Правила отправлены', {
        channelId: channel.id, messageId: sent.id, cleared
      });

      res.json({ ok: true, messageId: sent.id, cleared });
    } catch (e) { next(e); }
  });

  /* ================= Сообщения ================= */
  app.post('/api/guilds/:id/messages/send', async (req, res, next) => {
    try {
      const body = SendMessageSchema.parse(req.body);
      const data = readSection(req.params.id, 'messages');
      const message = data?.items?.find(m => m.id === body.messageId);
      if (!message) throw Object.assign(new Error('Сообщение не найдено'), { status: 404 });

      const client = getClient();
      const guild = await client.guilds.fetch(req.params.id);
      const channel = await guild.channels.fetch(message.channelId).catch(() => null);
      if (!channel?.isTextBased()) throw Object.assign(new Error('Канал недоступен'), { status: 400 });

      const perms = channel.permissionsFor(guild.members.me);
      if (!perms?.has('SendMessages')) throw Object.assign(new Error('Нет права SendMessages'), { status: 403 });

      let cleared = 0;
      if (body.clearChannel && perms.has('ManageMessages')) cleared = await clearChannel(channel);

      const components = buildComponentsFromConfig(message.config, { section: 'messages' });
      const sent = await channel.send({ flags: FLAG_COMPONENTS_V2, components });

      message.lastSentAt = new Date().toISOString();
      message.lastMessageId = sent.id;
      message.messageDeleted = false;
      writeSection(req.params.id, 'messages', data);
      notifySectionUpdate(req.params.id, 'messages');

      logInfo(req.params.id, 'message_send', `Сообщение «${message.name || 'Без названия'}» отправлено`, {
        messageId: message.id, channelId: channel.id, discordMessageId: sent.id, cleared
      });

      res.json({ ok: true, messageId: sent.id, cleared });
    } catch (e) { next(e); }
  });

  /* ================= Анонсы ================= */
  app.post('/api/guilds/:id/announcements/send', async (req, res, next) => {
    try {
      const body = SendAnnouncementSchema.parse(req.body);
      const data = readSection(req.params.id, 'announcements');
      const ann = data?.items?.find(a => a.id === body.announcementId);
      if (!ann) throw Object.assign(new Error('Автопост не найден'), { status: 404 });

      const client = getClient();
      const guild = await client.guilds.fetch(req.params.id);

      if (body.clearChannel) {
        const ch = await guild.channels.fetch(ann.channelId).catch(() => null);
        const perms = ch?.permissionsFor(guild.members.me);
        if (ch && perms?.has('ManageMessages')) await clearChannel(ch);
      }

      const result = await sendAutopost(guild, ann);
      ann.nextRunAt = ann.enabled ? computeNextRun(ann, Date.now()) : null;
      writeSection(req.params.id, 'announcements', data);
      notifySectionUpdate(req.params.id, 'announcements');

      logInfo(req.params.id, 'announcement_send', `Анонс «${ann.name || 'Без названия'}» отправлен`, {
        announcementId: ann.id, channelId: ann.channelId, discordMessageId: result.messageId
      });

      res.json({ ok: true, ...result, status: computeStatus(req.params.id) });
    } catch (e) { next(e); }
  });

  /* ================= Отложенные ================= */
  app.post('/api/guilds/:id/delayed/send', async (req, res, next) => {
    try {
      const body = SendDelayedSchema.parse(req.body);
      const data = readSection(req.params.id, 'delayed');
      const item = data?.items?.find(i => i.id === body.itemId);
      if (!item) throw Object.assign(new Error('Анонс не найден'), { status: 404 });

      const client = getClient();
      const guild = await client.guilds.fetch(req.params.id);

      if (body.clearChannel) {
        const ch = await guild.channels.fetch(item.channelId).catch(() => null);
        const perms = ch?.permissionsFor(guild.members.me);
        if (ch && perms?.has('ManageMessages')) await clearChannel(ch);
      }

      const result = await sendDelayed(guild, item);
      writeSection(req.params.id, 'delayed', data);
      notifySectionUpdate(req.params.id, 'delayed');

      logInfo(req.params.id, 'delayed_send', `Отложенный «${item.name || 'Без названия'}» отправлен`, {
        itemId: item.id, channelId: item.channelId, discordMessageId: result.messageId
      });

      res.json({ ok: true, ...result, status: computeStatus(req.params.id) });
    } catch (e) { next(e); }
  });

  /* ================= Удаление в Discord ================= */
  app.post('/api/guilds/:id/:section/:itemId/delete-discord', async (req, res, next) => {
    try {
      const { section, itemId } = req.params;
      if (!['messages', 'announcements', 'delayed'].includes(section)) {
        throw Object.assign(new Error('Неподдерживаемая секция'), { status: 400 });
      }

      const data = readSection(req.params.id, section);
      const item = data?.items?.find(i => i.id === itemId);
      if (!item) throw Object.assign(new Error('Элемент не найден'), { status: 404 });
      if (!item.lastMessageId) {
        throw Object.assign(new Error('Сообщение не отправлено в Discord'), { status: 400 });
      }

      const client = getClient();
      const guild = await client.guilds.fetch(req.params.id);
      const channel = await guild.channels.fetch(item.channelId).catch(() => null);
      if (!channel?.isTextBased()) throw Object.assign(new Error('Канал недоступен'), { status: 400 });

      let deleted = false;
      const msg = await channel.messages.fetch(item.lastMessageId).catch(() => null);
      if (msg) {
        try { await msg.delete(); deleted = true; }
        catch (e) {
          logError(req.params.id, 'delete_discord_message', e.message,
            { section, itemId, messageId: item.lastMessageId }, e.stack);
        }
      }

      item.lastMessageId = null;
      item.messageDeleted = true;
      writeSection(req.params.id, section, data);
      notifySectionUpdate(req.params.id, section);

      logInfo(req.params.id, 'discord_delete', `Сообщение удалено в Discord (${section})`, {
        section, itemId, deleted
      });

      res.json({ ok: true, deleted });
    } catch (e) { next(e); }
  });

  /* ================= Логи ================= */
  app.get('/api/guilds/:id/logs', (req, res) => {
    const data = readSection(req.params.id, 'logs') || { items: [] };
    res.json({ items: data.items || [], groups: groupLogs(data.items || []) });
  });
  app.post('/api/guilds/:id/logs/clear', (req, res) => {
    clearLogs(req.params.id);
    logInfo(req.params.id, 'logs_clear', 'Логи очищены');
    res.json({ ok: true });
  });

  async function clearChannel(channel) {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const msgs = await channel.messages.fetch({ limit: 100 });
      if (!msgs.size) break;
      if (msgs.size === 1) { try { await msgs.first().delete(); total++; } catch {} }
      else { try { total += (await channel.bulkDelete(msgs, true)).size; } catch {} }
      if (msgs.size < 100) break;
    }
    return total;
  }

  function computeStatus(guildId) {
    const s = readSection(guildId, 'settings');
    if (!s) return 'off';
    if (s.botEnabled === false) return 'off';
    const autoposts = readSection(guildId, 'announcements');
    const delayed = readSection(guildId, 'delayed');
    const autodelete = readSection(guildId, 'autodelete');
    const birthdays = readSection(guildId, 'birthdays');
    const hasActiveAutopost = (autoposts?.items || []).some(a => a.enabled);
    const hasScheduledAnnouncement = (delayed?.items || []).some(d => d.publishAt && !d.lastSentAt);
    const hasActiveAutodelete = (autodelete?.items || []).some(a => a.enabled);
    const hasActiveBirthdays = !!birthdays?.settings?.enabled;
    return (hasActiveAutopost || hasScheduledAnnouncement || hasActiveAutodelete || hasActiveBirthdays) ? 'active' : 'off';
  }
}