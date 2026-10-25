/* ============================================================
   Сервис объявлений:
   - расчёт следующего запуска по расписанию
   - вычисление UNIX-таймстемпа события {until}
   - формирование строки упоминания (@everyone / роль / user)
   - отправка Components v2 в канал
   ============================================================ */

import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../discord/components-builder.js';

/**
 * Вычисляет timestamp следующего запуска объявления.
 *
 * Для 'interval'      → from + N минут
 * Для 'daily/weekly/monthly' → ближайшая дата с заданным временем
 *
 * @param {object} ann
 * @param {number} [from=Date.now()]
 * @returns {number|null} timestamp или null для manual
 */
export function computeNextRun(ann, from = Date.now()) {
  const s = ann.schedule;
  if (!s || s.type === 'manual') return null;
  if (s.type === 'interval') return from + (s.intervalMinutes || 30) * 60_000;

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
    target.setDate(target.getDate() + ((targetDay - currentDay + 7) % 7));
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

/**
 * Считает UNIX-timestamp следующего события для {until}.
 * @param {object} eventTime
 * @returns {number|null}
 */
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
    target.setDate(target.getDate() + ((targetDay - currentDay + 7) % 7));
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
  } else if (eventTime.type === 'monthly') {
    const dom = eventTime.dayOfMonth ?? 1;
    target = new Date(now.getFullYear(), now.getMonth(), dom, hh, mm, 0, 0);
    if (target <= now) target.setMonth(target.getMonth() + 1);
  } else return null;

  return Math.floor(target.getTime() / 1000);
}

/**
 * Формирует строку упоминания и allowedMentions.
 * @param {object} mention
 * @returns {{ content: string, allowedMentions: object }}
 */
export function buildMention(mention) {
  if (!mention || mention.type === 'none') {
    return { content: '', allowedMentions: { parse: [] } };
  }
  if (mention.type === 'everyone') {
    return { content: '@everyone', allowedMentions: { parse: ['everyone'] } };
  }
  if (mention.type === 'role' && mention.roleId) {
    return { content: `<@&${mention.roleId}>`, allowedMentions: { roles: [mention.roleId] } };
  }
  if (mention.type === 'user' && mention.userId) {
    return { content: `<@${mention.userId}>`, allowedMentions: { users: [mention.userId] } };
  }
  return { content: '', allowedMentions: { parse: [] } };
}

/**
 * Отправляет объявление в канал и мутирует `ann`
 * (lastSentAt, lastMessageId, _autoDeleteAt).
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} ann
 * @returns {Promise<{ messageId: string }>}
 * @throws Если канал недоступен или нет права SendMessages
 */
export async function sendAutopost(guild, ann) {
  if (!ann.channelId) throw new Error('Канал не выбран');

  const channel = await guild.channels.fetch(ann.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Канал недоступен');

  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has('SendMessages')) throw new Error('Нет права SendMessages');

  /* Собираем контент: компоненты + упоминание в начале */
  const eventUnix = computeEventUnix(ann.eventTime);
  const components = buildComponentsFromConfig(ann.config, {
    untilUnix: eventUnix,
    section: 'announcements'
  });

  const mention = buildMention(ann.mention);
  if (mention.content) {
    const textComp = { type: 10, content: mention.content };
    if (ann.config.displayMode === 'flat' || !components.length) {
      components.unshift(textComp);
    } else {
      const container = components[0];
      if (container?.type === 17 && Array.isArray(container.components)) {
        container.components.unshift(textComp);
      } else {
        components.unshift(textComp);
      }
    }
  }

  const msg = await channel.send({
    allowedMentions: mention.allowedMentions,
    flags: FLAG_COMPONENTS_V2,
    components
  });

  /* Мутируем объект — caller сам сохранит его через writeSection */
  ann.lastSentAt = new Date().toISOString();
  ann.lastMessageId = msg.id;
  ann.messageDeleted = false;
  ann._autoDeleteAt = (ann.autoDelete?.enabled && ann.autoDelete.minutes > 0)
    ? Date.now() + ann.autoDelete.minutes * 60_000
    : null;

  return { messageId: msg.id };
}