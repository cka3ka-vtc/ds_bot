import { readSection, writeSection } from '../storage/index.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from './builder.js';
import { logInfo, logError } from './logger.js';
import { notifySectionUpdate } from '../services/events.js';

const DEFAULT_SINGLE = {
  displayMode: 'embed-color', accentColor: '#5865F2',
  title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
  blocks: [{ id: 'bd-def-s', type: 'text', content: 'Поздравляем! 🎂 Тебе исполнилось **{age}**!' }]
};
const DEFAULT_NOYEAR = {
  displayMode: 'embed-color', accentColor: '#5865F2',
  title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
  blocks: [{ id: 'bd-def-n', type: 'text', content: 'Поздравляем с днём рождения! 🎉 Всего наилучшего в новом году жизни!' }]
};

function getTodayYmd(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextDayStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0).getTime();
}

function getAge(user, now = new Date()) {
  if (!user.year) return null;
  return now.getFullYear() - user.year;
}

function sanitizeTemplate(t) {
  if (!t || typeof t !== 'object') return null;
  if (t.title || t.subtitle || (Array.isArray(t.blocks) && t.blocks.length > 0)) return t;
  return null;
}

function pickTemplate(data, user) {
  if (user.year) return sanitizeTemplate(data.template) || DEFAULT_SINGLE;
  return sanitizeTemplate(data.templateNoYear) || DEFAULT_NOYEAR;
}

export async function processBirthdays(client) {
  const now = new Date();
  const nowTs = now.getTime();
  const today = getTodayYmd(now);
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  for (const guild of client.guilds.cache.values()) {
    try {
      const data = readSection(guild.id, 'birthdays');
      if (!data) continue;

      let changed = false;
      changed = (await processPending(guild, data, nowTs)) || changed;

      if (data.settings?.enabled && data.settings?.channelId && data.settings.lastRunDate !== today) {
        const targetTime = data.settings.time || '09:00';
        if (nowHHMM >= targetTime) {
          let todayUsers = (data.users || []).filter(u =>
            u.day === now.getDate() &&
            u.month === (now.getMonth() + 1) &&
            u.enabled !== false
          );

          todayUsers = await filterByRequiredRoles(guild, todayUsers, data.settings.requiredRoleIds || []);

          if (todayUsers.length) {
            const pending = [];
            for (const user of todayUsers) {
              try {
                const result = await sendMessage(guild, data, user, now);
                logInfo(guild.id, 'birthday_send', `Поздравление отправлено пользователю ${user.userId}`, {
                  userId: user.userId, age: getAge(user, now)
                });
                if (result.messageId) {
                  pending.push({
                    type: 'message-delete',
                    userId: user.userId,
                    channelId: data.settings.channelId,
                    messageId: result.messageId,
                    at: getNextDayStart(now)
                  });
                }
                if (result.addedRoleId) {
                  pending.push({
                    type: 'role-remove',
                    userId: user.userId,
                    roleId: result.addedRoleId,
                    at: getNextDayStart(now)
                  });
                }
              } catch (e) {
                logError(guild.id, 'birthday_send', e.message, { userId: user.userId }, e.stack);
              }
            }
            data.settings._pending = [...(data.settings._pending || []), ...pending];
          }

          data.settings.lastRunDate = today;
          changed = true;
        }
      }

      if (changed) {
        writeSection(guild.id, 'birthdays', data);
        notifySectionUpdate(guild.id, 'birthdays');
      }
    } catch (e) {
      console.error(`[birthday] guild ${guild.id}:`, e.message);
    }
  }
}

async function filterByRequiredRoles(guild, users, requiredRoleIds) {
  if (!requiredRoleIds?.length) return users;
  const result = [];
  for (const u of users) {
    const member = await guild.members.fetch(u.userId).catch(() => null);
    if (!member) continue;
    const hasAny = requiredRoleIds.some(rid => member.roles.cache.has(rid));
    if (hasAny) result.push(u);
  }
  return result;
}

async function processPending(guild, data, nowTs) {
  const pending = data.settings._pending || [];
  if (!pending.length) return false;

  const remaining = [];
  let changed = false;

  for (const p of pending) {
    if (p.at > nowTs) { remaining.push(p); continue; }
    changed = true;

    try {
      if (p.type === 'role-remove') {
        if (data.settings.roleRemoveNextDay === false) continue;
        const member = await guild.members.fetch(p.userId).catch(() => null);
        const role = await guild.roles.fetch(p.roleId).catch(() => null);
        if (member && role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch(() => {});
          logInfo(guild.id, 'birthday_role_remove', 'Роль именинника снята', {
            userId: p.userId, roleId: p.roleId
          });
        }
      } else if (p.type === 'message-delete') {
        if (!data.settings.autoDeleteMessage) continue;
        const channel = await guild.channels.fetch(p.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(p.messageId).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
            logInfo(guild.id, 'birthday_msg_delete', 'Сообщение-поздравление удалено', {
              channelId: p.channelId, messageId: p.messageId
            });
          }
        }
      }
    } catch (e) {
      logError(guild.id, `birthday_${p.type}`, e.message, p, e.stack);
    }
  }

  if (changed) data.settings._pending = remaining;
  return changed;
}

async function sendMessage(guild, data, user, now) {
  const channel = await guild.channels.fetch(data.settings.channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('Канал недоступен');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has('SendMessages')) throw new Error('Нет права SendMessages');

  const member = await guild.members.fetch(user.userId).catch(() => null);
  if (!member) throw new Error('Участник не найден на сервере');

  const age = getAge(user, now);
  const template = pickTemplate(data, user);

  const components = buildComponentsFromConfig(template, {
    userId: user.userId,
    age,
    section: 'birthdays'
  });

  const msg = await channel.send({ flags: FLAG_COMPONENTS_V2, components });

  let addedRoleId = null;
  if (data.settings.roleId) {
    try {
      const role = await guild.roles.fetch(data.settings.roleId).catch(() => null);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
        addedRoleId = role.id;
      }
    } catch (e) {
      logError(guild.id, 'birthday_role', e.message,
        { userId: user.userId, roleId: data.settings.roleId }, e.stack);
    }
  }

  return { messageId: msg.id, addedRoleId };
}