import { readSection, writeSection } from '../storage/index.js';
import { logInfo, logError } from './logger.js';
import { notifySectionUpdate } from '../services/events.js';

const PREFIX = '!hb';
const MESSAGE_AUTO_DELETE_MS = 60 * 1000;   // 1 минута — удаление команды
const REPLY_AUTO_DELETE_MS = 60 * 1000;     // 1 минута — удаление ответа

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export function initBirthdayCommands(client) {
  client.prependListener('messageCreate', handleBirthdayCommand);

  client.on('messageDelete', async (message) => {
    try {
      if (!message.guild) return;
      if (!message.content || !message.content.toLowerCase().startsWith(PREFIX)) return;
      const ageMs = Date.now() - message.createdTimestamp;
      if (ageMs < MESSAGE_AUTO_DELETE_MS - 5000) {
        console.warn(`[birthday-commands] ⚠️ COMMAND DELETED EXTERNALLY: "${message.content}" (age=${ageMs}ms, наш таймер=${MESSAGE_AUTO_DELETE_MS}ms)`);
      }
    } catch {}
  });

  console.log('[birthday-commands] ✓ messageCreate handler REGISTERED (priority: first)');
}

async function handleBirthdayCommand(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.system) return;
    if (!message.content || !message.content.length) return;
    if (!message.content.toLowerCase().startsWith(PREFIX)) return;

    console.log(`[birthday-commands] ▶ command: "${message.content}" | #${message.channel.name} (${message.channel.id}) | user=${message.author.id} | msgId=${message.id}`);

    const guildId = message.guild.id;
    const data = readSection(guildId, 'birthdays');
    if (!data) {
      await sendReply(message, '⚠️ Раздел «Дни рождения» не настроен администратором.');
      scheduleMessageDelete(message);
      return;
    }
    if (!data.settings?.channelId) {
      await sendReply(message, '⚠️ Канал поздравлений не настроен.');
      scheduleMessageDelete(message);
      return;
    }
    if (message.channel.id !== data.settings.channelId) return;

    const requiredRoles = data.settings.requiredRoleIds || [];
    if (requiredRoles.length > 0) {
      let member = message.member;
      if (!member) member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        await sendReply(message, '❌ Не удалось проверить ваши роли.');
        scheduleMessageDelete(message);
        return;
      }
      const hasAny = requiredRoles.some(rid => member.roles.cache.has(rid));
      if (!hasAny) {
        await sendReply(message, '❌ У вас нет необходимой роли для использования этой команды.');
        scheduleMessageDelete(message);
        return;
      }
    }

    const rawArgs = message.content.slice(PREFIX.length).trim();
    const lower = rawArgs.toLowerCase();

    /* ============================================================
       Справка (без аргументов)
       ============================================================ */
    if (!rawArgs) {
      await sendReply(message,
        '**Команды:**\n' +
        '`!hb ДД.ММ` — установить дату (`!hb 30.03`)\n' +
        '`!hb ДД.ММ.ГГ` — с двузначным годом (`!hb 30.3.95`)\n' +
        '`!hb ДД.ММ.ГГГГ` — с полным годом (`!hb 03.03.1995`)\n' +
        '`!hb инфо` — посмотреть свой день рождения\n' +
        '`!hb включить` — получать поздравления\n' +
        '`!hb выключить` — не получать поздравления'
      );
      scheduleMessageDelete(message);
      return;
    }

    /* ============================================================
       !hb инфо — информация о своём дне рождения
       ============================================================ */
    if (lower === 'инфо' || lower === 'info') {
      await handleInfoCommand(message, data, guildId);
      scheduleMessageDelete(message);
      return;
    }

    /* ============================================================
       Включить / выключить
       ============================================================ */
    if (lower === 'включить' || lower === 'выключить') {
      const users = Array.isArray(data.users) ? data.users : [];
      const idx = users.findIndex(u => u.userId === message.author.id);

      if (idx < 0) {
        await sendReply(message, '📅 Сначала укажите дату дня рождения:\n`!hb ДД.ММ` (например, `!hb 30.03`)');
        scheduleMessageDelete(message);
        return;
      }
      if (lower === 'включить' && data.settings.enabled === false) {
        await sendReply(message, '⚠️ Автопоздравления отключены администратором на всём сервере.');
        scheduleMessageDelete(message);
        return;
      }

      const wantEnabled = lower === 'включить';
      if (users[idx].enabled === wantEnabled) {
        await sendReply(message,
          wantEnabled ? 'ℹ️ Поздравления уже включены для вас.' : 'ℹ️ Поздравления уже отключены для вас.');
        scheduleMessageDelete(message);
        return;
      }

      let cleanupMessage = '';
      if (!wantEnabled) {
        const cleanup = await cleanupCongrats(message, data, guildId, {
          skipIfToday: false,
          trigger: 'disable'
        });
        if (cleanup.removedMessage || cleanup.removedRole) {
          const parts = [];
          if (cleanup.removedRole) parts.push('роль снята');
          if (cleanup.removedMessage) parts.push('сообщение удалено');
          cleanupMessage = `\n♻️ Поздравление отменено (${parts.join(', ')}).`;
        }
      }

      users[idx].enabled = wantEnabled;
      data.users = users;

      try {
        writeSection(guildId, 'birthdays', data);
        notifySectionUpdate(guildId, 'birthdays');
      } catch (e) {
        logError(guildId, 'birthday_command_save', e.message, { userId: message.author.id }, e.stack);
        await sendReply(message, '❌ Не удалось сохранить. Обратитесь к администрации.');
        scheduleMessageDelete(message);
        return;
      }

      logInfo(guildId,
        wantEnabled ? 'birthday_user_enable' : 'birthday_user_disable',
        wantEnabled ? 'Пользователь включил поздравления' : 'Пользователь отключил поздравления',
        { userId: message.author.id, source: 'command' }
      );

      await sendReply(message,
        (wantEnabled
          ? '✅ Вы будете получать поздравления с днём рождения.'
          : '🛑 Вы больше не будете получать поздравления.') + cleanupMessage);
      scheduleMessageDelete(message);
      return;
    }

    /* ============================================================
       Установка / смена даты
       ============================================================ */
    const parsed = parseBirthdayDate(rawArgs);
    if (!parsed) {
      await sendReply(message,
        '❌ Неверный формат даты.\n' +
        'Используйте `!hb ДД.ММ`, `!hb ДД.ММ.ГГ` или `!hb ДД.ММ.ГГГГ`.\n' +
        'Примеры: `!hb 30.03`, `!hb 30.3.95`, `!hb 03.03.1995`.');
      scheduleMessageDelete(message);
      return;
    }

    const users = Array.isArray(data.users) ? data.users : [];
    const existingIdx = users.findIndex(u => u.userId === message.author.id);
    const wasExisting = existingIdx >= 0;

    const entry = {
      userId: message.author.id,
      day: parsed.day,
      month: parsed.month,
      year: parsed.year,
      enabled: wasExisting ? (users[existingIdx].enabled !== false) : true
    };

    if (wasExisting) users[existingIdx] = entry;
    else users.push(entry);
    data.users = users;

    let cleanupMessage = '';
    if (wasExisting) {
      const cleanup = await cleanupCongrats(message, data, guildId, {
        skipIfToday: true,
        trigger: 'change_date'
      });
      if (cleanup.removedMessage || cleanup.removedRole) {
        const parts = [];
        if (cleanup.removedRole) parts.push('роль снята');
        if (cleanup.removedMessage) parts.push('сообщение удалено');
        cleanupMessage = `\n♻️ Прошлое поздравление отменено (${parts.join(', ')}).`;
      }
    }

    try {
      writeSection(guildId, 'birthdays', data);
      notifySectionUpdate(guildId, 'birthdays');
      console.log(`[birthday-commands] ✓ saved: user=${message.author.id} ${parsed.day}.${parsed.month}${parsed.year ? '.' + parsed.year : ''} (${wasExisting ? 'updated' : 'new'})${cleanupMessage ? ' + cleanup' : ''}`);
    } catch (e) {
      console.error('[birthday-commands] ✗ writeSection FAILED:', e.message);
      logError(guildId, 'birthday_command_save', e.message, { userId: message.author.id, parsed }, e.stack);
      await sendReply(message, '❌ Не удалось сохранить дату. Обратитесь к администрации.');
      scheduleMessageDelete(message);
      return;
    }

    logInfo(guildId, 'birthday_command_add',
      wasExisting ? 'Дата дня рождения обновлена через команду' : 'День рождения установлен через команду',
      { userId: message.author.id, day: parsed.day, month: parsed.month, year: parsed.year, updated: wasExisting }
    );

    const dateStr = `${parsed.day} ${MONTHS[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;
    await sendReply(message,
      (wasExisting
        ? `🔄 Дата обновлена: **${dateStr}**`
        : `✅ День рождения сохранён: **${dateStr}**`) + cleanupMessage
    );
    scheduleMessageDelete(message);
  } catch (e) {
    console.error('[birthday-commands] ✗ unhandled error:', e);
    try {
      await sendReply(message, '❌ Внутренняя ошибка. Попробуйте позже.');
      scheduleMessageDelete(message);
    } catch {}
  }
}

/* ============================================================
   !hb инфо — информация о своём дне рождения
   ============================================================ */
async function handleInfoCommand(message, data, guildId) {
  const users = Array.isArray(data.users) ? data.users : [];
  const entry = users.find(u => u.userId === message.author.id);

  if (!entry) {
    await sendReply(message,
      '📅 У вас ещё не указана дата дня рождения.\n' +
      'Установите её командой `!hb ДД.ММ` (например, `!hb 30.03`).'
    );
    return;
  }

  const now = new Date();
  const days = daysUntilBirthday(entry.day, entry.month, now);
  const isToday = days === 0;
  const isTomorrow = days === 1;

  /* Дата: с годом, если он указан */
  const dateStr = `${entry.day} ${MONTHS[entry.month - 1]}${entry.year ? ` ${entry.year} г.` : ''}`;

  /* Возраст, если год указан */
  let ageLine = '';
  if (entry.year) {
    const age = now.getFullYear() - entry.year;
    /* Если ДР ещё не наступил в этом году — возраст на сегодня на 1 меньше */
    const hadBirthdayThisYear =
      (now.getMonth() + 1 > entry.month) ||
      (now.getMonth() + 1 === entry.month && now.getDate() >= entry.day);
    const currentAge = hadBirthdayThisYear ? age : age - 1;
    if (currentAge >= 0) {
      ageLine = `\n🎂 Возраст: **${currentAge}** ${pluralYears(currentAge)}`;
    }
  }

  /* Статус */
  const personalEnabled = entry.enabled !== false;
  let statusLine;
  if (!data.settings.enabled) {
    statusLine = '🔕 Автопоздравления отключены администратором на сервере';
  } else if (!personalEnabled) {
    statusLine = '🔕 Ваши поздравления отключены (`!hb включить` чтобы включить)';
  } else {
    statusLine = '🔔 Поздравления включены';
  }

  /* Когда наступит */
  let whenLine;
  if (isToday) whenLine = '🎉 **Сегодня ваш день рождения!**';
  else if (isTomorrow) whenLine = '⏰ **Завтра ваш день рождения**';
  else whenLine = `⏳ До дня рождения: **${days}** ${pluralDays(days)}`;

  const text =
    `📅 **Ваш день рождения:** ${dateStr}\n` +
    `${whenLine}` +
    ageLine + '\n' +
    `${statusLine}`;

  await sendReply(message, text);

  logInfo(guildId, 'birthday_command_info',
    'Пользователь запросил информацию о своём дне рождения',
    { userId: message.author.id, day: entry.day, month: entry.month, year: entry.year, daysLeft: days }
  );
}

/* ============================================================
   Утилиты: дни до ДР, склонения
   ============================================================ */
function daysUntilBirthday(day, month, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86400000);
}

function pluralDays(n) {
  const a = Math.abs(n) % 100;
  const l = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (l === 1) return 'день';
  if (l > 1 && l < 5) return 'дня';
  return 'дней';
}

function pluralYears(n) {
  const a = Math.abs(n) % 100;
  const l = a % 10;
  if (a > 10 && a < 20) return 'лет';
  if (l > 1 && l < 5) return 'года';
  if (l === 1) return 'год';
  return 'лет';
}

/* ============================================================
   Откат поздравления при смене даты / выключении
   ============================================================ */
async function cleanupCongrats(message, data, guildId, { skipIfToday = true, trigger = 'change_date' } = {}) {
  const result = { removedMessage: false, removedRole: false };

  const now = new Date();
  const entry = (data.users || []).find(u => u.userId === message.author.id);
  if (!entry) return result;

  if (skipIfToday) {
    const isToday = entry.day === now.getDate() && entry.month === (now.getMonth() + 1);
    if (isToday) return result;
  }

  const pending = data.settings._pending || [];
  const mine = pending.filter(p => p.userId === message.author.id);
  if (!mine.length) return result;

  const remaining = pending.filter(p => p.userId !== message.author.id);

  for (const p of mine) {
    try {
      if (p.type === 'message-delete') {
        const channel = await message.guild.channels.fetch(p.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(p.messageId).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
            result.removedMessage = true;
          }
        }
      } else if (p.type === 'role-remove') {
        const member = await message.guild.members.fetch(p.userId).catch(() => null);
        const role = await message.guild.roles.fetch(p.roleId).catch(() => null);
        if (member && role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch(() => {});
          result.removedRole = true;
        }
      }
    } catch (e) {
      console.error('[birthday-commands] cleanup error:', e.message);
    }
  }

  data.settings._pending = remaining;

  if (result.removedMessage || result.removedRole) {
    logInfo(guildId, 'birthday_congrats_cleanup',
      trigger === 'disable'
        ? 'Откат поздравления и роли при отключении пользователем'
        : 'Откат поздравления и роли при смене даты дня рождения',
      {
        userId: message.author.id,
        trigger,
        removedMessage: result.removedMessage,
        removedRole: result.removedRole,
        day: entry.day,
        month: entry.month,
        year: entry.year
      }
    );
  }

  return result;
}

/* ============================================================
   Отправка ответа (reply без ping → channel.send → DM)
   ============================================================ */
async function sendReply(message, text) {
  let sent = null;
  try {
    sent = await message.reply({ content: text, allowedMentions: { repliedUser: false } });
  } catch (e) {
    console.warn(`[birthday-commands] reply failed (${e.message}), fallback to channel.send`);
  }
  if (!sent) {
    try { sent = await message.channel.send({ content: text }); }
    catch (e) { console.error('[birthday-commands] ✗ channel.send FAILED:', e.message); }
  }
  if (sent) {
    console.log(`[birthday-commands] ✓ reply sent: ${sent.id}`);
    setTimeout(() => sent.delete().catch(() => {}), REPLY_AUTO_DELETE_MS);
    return;
  }
  try { await message.author.send(text); console.log('[birthday-commands] ✓ fallback DM'); }
  catch (dmErr) { console.error('[birthday-commands] ✗ fallback DM FAILED:', dmErr.message); }
}

/* ============================================================
   Удаление команды через 1 минуту
   ============================================================ */
function scheduleMessageDelete(message, delayMs = MESSAGE_AUTO_DELETE_MS) {
  setTimeout(() => {
    message.delete()
      .then(() => console.log(`[birthday-commands] command auto-deleted after ${delayMs / 1000}s: ${message.id}`))
      .catch((e) => console.warn('[birthday-commands] command delete failed:', e.message));
  }, delayMs);
}

/* ============================================================
   Парсинг даты
   ============================================================ */
function parseBirthdayDate(input) {
  const match = input.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = null;

  if (match[3]) {
    if (match[3].length === 2) {
      const y = parseInt(match[3], 10);
      year = y <= 68 ? 2000 + y : 1900 + y;
    } else {
      year = parseInt(match[3], 10);
    }
    if (year < 1900 || year > 2100) return null;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1) return null;
  if (day > daysInMonth(month, year)) return null;

  return { day, month, year };
}

function daysInMonth(month, year) {
  if (month === 2) return year ? (isLeap(year) ? 29 : 28) : 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}