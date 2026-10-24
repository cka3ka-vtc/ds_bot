import { getClient } from './client.js';
import { readSection, writeSection } from '../storage/index.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from './builder.js';
import { logInfo, logError } from './logger.js';
import { notifySectionUpdate } from '../services/events.js';
import { processAutodeleteQueue, shutdownAutodelete } from './autodelete.js';
import { processBirthdays } from './birthday-scheduler.js';

let schedulerRunning = false;
let schedulerInterval = null;

export function computeNextRun(ann, from = Date.now()) {
  const s = ann.schedule;
  if (!s || s.type === 'manual') return null;
  if (s.type === 'interval') return from + (s.intervalMinutes || 30) * 60000;
  const [hh, mm] = (s.time || '00:00').split(':').map(Number);
  const base = new Date(from);
  if (s.type === 'daily') {
    const target = new Date(base);
    target.setHours(hh, mm, 0, 0);
    if (target <= base) target.setDate(target.getDate() + 1);
    return target.getTime();
  }
  if (s.type === 'weekly') {
    const target = new Date(base);
    const targetDay = s.dayOfWeek ?? 1;
    const currentDay = target.getDay() === 0 ? 7 : target.getDay();
    const diff = (targetDay - currentDay + 7) % 7;
    target.setDate(target.getDate() + diff);
    target.setHours(hh, mm, 0, 0);
    if (target <= base) target.setDate(target.getDate() + 7);
    return target.getTime();
  }
  if (s.type === 'monthly') {
    const dom = s.dayOfMonth ?? 1;
    const target = new Date(base.getFullYear(), base.getMonth(), dom, hh, mm, 0, 0);
    if (target <= base) target.setMonth(target.getMonth() + 1);
    return target.getTime();
  }
  return null;
}

export function recoverScheduler() {
  const client = getClient();
  for (const guild of client.guilds.cache.values()) recoverAutoposts(guild);
  console.log('🔁 Планировщик восстановлен');
}

function recoverAutoposts(guild) {
  const data = readSection(guild.id, 'announcements');
  if (!data?.items?.length) return;
  let changed = false;
  const now = Date.now();
  const grace = 5 * 60 * 1000;
  for (const ann of data.items) {
    if (!ann.enabled) { ann.nextRunAt = null; continue; }
    if (ann.schedule?.type === 'manual') { ann.nextRunAt = null; continue; }
    if (!ann.nextRunAt) { ann.nextRunAt = computeNextRun(ann, now); changed = true; continue; }
    if (ann.nextRunAt < now) {
      const missed = now - ann.nextRunAt;
      if (ann.schedule.type === 'interval') ann.nextRunAt = now;
      else if (missed <= grace) ann.nextRunAt = now;
      else ann.nextRunAt = computeNextRun(ann, now);
      changed = true;
    }
  }
  if (changed) writeSection(guild.id, 'announcements', data);
}

export function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(tick, 30000);
  setTimeout(tick, 5000);
  console.log('⏱️  Планировщик запущен');
}

export function stopScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
  shutdownAutodelete();
}

async function tick() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    const client = getClient();
    for (const guild of client.guilds.cache.values()) {
      await processGuild(guild);
    }
    await processAutodeleteQueue(client);
    await processBirthdays(client);
  } catch (e) {
    console.error('scheduler tick error:', e);
  } finally {
    schedulerRunning = false;
  }
}

async function processGuild(guild) {
  await processAutoposts(guild);
  await processDelayed(guild);
}

async function processAutoposts(guild) {
  const data = readSection(guild.id, 'announcements');
  if (!data?.items?.length) return;
  const now = Date.now();
  let changed = false;
  for (const ann of data.items) {
    if (ann._autoDeleteAt && ann._autoDeleteAt <= now && ann.lastMessageId) {
      try {
        const channel = await guild.channels.fetch(ann.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(ann.lastMessageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
        logInfo(guild.id, 'autopost_autodelete', `Анонс «${ann.name || 'Без названия'}» автоудалён`, { announcementId: ann.id });
      } catch (e) {
        logError(guild.id, 'autopost_autodelete', e.message, { announcementId: ann.id }, e.stack);
      }
      ann._autoDeleteAt = null;
      ann.lastMessageId = null;
      changed = true;
    }
  }
  for (const ann of data.items) {
    if (!ann.enabled) continue;
    if (!ann.nextRunAt || ann.nextRunAt > now) continue;
    try {
      await sendAutopost(guild, ann);
      ann.nextRunAt = computeNextRun(ann, Date.now());
      changed = true;
      logInfo(guild.id, 'autopost_send', `Автопост «${ann.name || 'Без названия'}» отправлен по расписанию`, {
        announcementId: ann.id, channelId: ann.channelId
      });
    } catch (e) {
      console.error(`Autopost "${ann.name}" failed:`, e.message);
      logError(guild.id, 'autopost_send', e.message, { announcementId: ann.id, name: ann.name }, e.stack);
      ann.nextRunAt = Date.now() + 5 * 60 * 1000;
      changed = true;
    }
  }
  if (changed) {
    writeSection(guild.id, 'announcements', data);
    notifySectionUpdate(guild.id, 'announcements');
  }
}

export async function sendAutopost(guild, ann) {
  if (!ann.channelId) throw new Error('Канал не выбран');
  const channel = await guild.channels.fetch(ann.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Канал недоступен');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has('SendMessages')) throw new Error('Нет права SendMessages');
  const eventUnix = computeEventUnix(ann.eventTime);
  const components = buildComponentsFromConfig(ann.config, { untilUnix: eventUnix, section: 'announcements' });
  const mention = buildMention(ann.mention);
  if (mention.content) {
    const textComp = { type: 10, content: mention.content };
    if (ann.config.displayMode === 'flat' || !components.length) components.unshift(textComp);
    else {
      const container = components[0];
      if (container?.type === 17 && Array.isArray(container.components)) container.components.unshift(textComp);
      else components.unshift(textComp);
    }
  }
  const msg = await channel.send({ allowedMentions: mention.allowedMentions, flags: FLAG_COMPONENTS_V2, components });
  ann.lastSentAt = new Date().toISOString();
  ann.lastMessageId = msg.id;
  ann.messageDeleted = false;
  ann._autoDeleteAt = ann.autoDelete?.enabled && ann.autoDelete.minutes > 0
    ? Date.now() + ann.autoDelete.minutes * 60000 : null;
  return { messageId: msg.id };
}

async function processDelayed(guild) {
  const data = readSection(guild.id, 'delayed');
  if (!data?.items?.length) return;
  const now = Date.now();
  let changed = false;
  for (const item of data.items) {
    if (item._autoDeleteAt && item._autoDeleteAt <= now && item.lastMessageId) {
      try {
        const channel = await guild.channels.fetch(item.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(item.lastMessageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
        logInfo(guild.id, 'delayed_autodelete', `Отложенный «${item.name || 'Без названия'}» автоудалён`, { itemId: item.id });
      } catch (e) {
        logError(guild.id, 'delayed_autodelete', e.message, { itemId: item.id }, e.stack);
      }
      item._autoDeleteAt = null;
      item.lastMessageId = null;
      changed = true;
    }
  }
  for (const item of data.items) {
    if (!item.publishAt) continue;
    if (item.lastSentAt) continue;
    if (new Date(item.publishAt).getTime() > now) continue;
    try {
      await sendDelayed(guild, item);
      changed = true;
      logInfo(guild.id, 'delayed_send', `Отложенный «${item.name || 'Без названия'}» отправлен по расписанию`, {
        itemId: item.id, channelId: item.channelId
      });
    } catch (e) {
      logError(guild.id, 'delayed_send', e.message, { itemId: item.id, name: item.name }, e.stack);
      item.lastSentAt = new Date().toISOString();
      item._failed = true;
      changed = true;
    }
  }
  if (changed) {
    writeSection(guild.id, 'delayed', data);
    notifySectionUpdate(guild.id, 'delayed');
  }
}

export async function sendDelayed(guild, item) {
  if (!item.channelId) throw new Error('Канал не выбран');
  const channel = await guild.channels.fetch(item.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Канал недоступен');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has('SendMessages')) throw new Error('Нет права SendMessages');
  const components = buildComponentsFromConfig(item.config, { section: 'delayed' });
  const mention = buildMention(item.mention);
  if (mention.content) {
    const textComp = { type: 10, content: mention.content };
    if (item.config.displayMode === 'flat' || !components.length) components.unshift(textComp);
    else {
      const container = components[0];
      if (container?.type === 17 && Array.isArray(container.components)) container.components.unshift(textComp);
      else components.unshift(textComp);
    }
  }
  const msg = await channel.send({ allowedMentions: mention.allowedMentions, flags: FLAG_COMPONENTS_V2, components });
  item.lastSentAt = new Date().toISOString();
  item.lastMessageId = msg.id;
  item.messageDeleted = false;
  item._autoDeleteAt = item.autoDelete?.enabled && item.autoDelete.minutes > 0
    ? Date.now() + item.autoDelete.minutes * 60000 : null;
  item._failed = false;
  return { messageId: msg.id };
}

export function computeEventUnix(eventTime) {
  if (!eventTime?.enabled) return null;
  const now = new Date();
  const [hh, mm] = (eventTime.time || '00:00').split(':').map(Number);
  let target;
  if (eventTime.type === 'daily') {
    target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
  } else if (eventTime.type === 'weekly') {
    target = new Date(now);
    const targetDay = eventTime.dayOfWeek ?? 1;
    const currentDay = target.getDay() === 0 ? 7 : target.getDay();
    const diff = (targetDay - currentDay + 7) % 7;
    target.setDate(target.getDate() + diff);
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
  } else if (eventTime.type === 'monthly') {
    const dom = eventTime.dayOfMonth ?? 1;
    target = new Date(now.getFullYear(), now.getMonth(), dom, hh, mm, 0, 0);
    if (target <= now) target.setMonth(target.getMonth() + 1);
  } else return null;
  return Math.floor(target.getTime() / 1000);
}

function buildMention(mention) {
  if (!mention || mention.type === 'none') return { content: '', allowedMentions: { parse: [] } };
  if (mention.type === 'everyone') return { content: '@everyone', allowedMentions: { parse: ['everyone'] } };
  if (mention.type === 'role' && mention.roleId) return { content: `<@&${mention.roleId}>`, allowedMentions: { roles: [mention.roleId] } };
  if (mention.type === 'user' && mention.userId) return { content: `<@${mention.userId}>`, allowedMentions: { users: [mention.userId] } };
  return { content: '', allowedMentions: { parse: [] } };
}