/* ============================================================
   Slash-команда /hb — управление днём рождения.

   Subcommand'ы:
     /hb set      — установить дату (день, месяц, опционально год)
     /hb info     — показать свою дату
     /hb enable   — включить поздравления
     /hb disable  — отключить поздравления (с очисткой старого поздравления)
     /hb list     — список ДР сервера с пагинацией
   ============================================================ */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  setBirthday,
  getBirthday,
  setBirthdayEnabled,
  buildInfoText,
  cleanupCongrats,
  parseBirthdayDate,
  daysUntilBirthday,
  pluralDays
} from '../../services/birthdays.js';
import { checkCommandChannel } from '../../services/channel-guard.js';
import { readSection, writeSection } from '../../storage/index.js';

/* Размер страницы в /hb list */
const PAGE_SIZE = 8;

export default {
  data: new SlashCommandBuilder()
    .setName('hb')
    .setDescription('Управление днём рождения')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Установить дату рождения')
      .addIntegerOption(o =>
        o.setName('day').setDescription('День (1–31)').setRequired(true).setMinValue(1).setMaxValue(31)
      )
      .addIntegerOption(o =>
        o.setName('month').setDescription('Месяц (1–12)').setRequired(true).setMinValue(1).setMaxValue(12)
      )
      .addIntegerOption(o =>
        o.setName('year').setDescription('Год (необязательно)').setMinValue(1900).setMaxValue(2100)
      )
    )
    .addSubcommand(sub => sub.setName('info').setDescription('Показать мою дату рождения'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Включить поздравления'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Отключить поздравления'))
    .addSubcommand(sub => sub.setName('list').setDescription('Список дней рождения сервера')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    /* /hb list — не требует проверки канала, доступен везде */
    if (sub === 'list') {
      return handleList(interaction, guildId, 0);
    }

    /* Остальные subcommand'ы — только в настроенном канале */
    const guard = await checkCommandChannel(interaction, 'birthdays');
    if (!guard.ok) {
      return interaction.reply({ content: guard.message, flags: MessageFlags.Ephemeral });
    }

    const userId = interaction.user.id;

    /* ---------- /hb set ---------- */
    if (sub === 'set') {
      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year');

      /* Переиспользуем серверную валидацию */
      const parsed = parseBirthdayDate(`${day}.${month}${year ? '.' + year : ''}`);
      if (!parsed) {
        return interaction.reply({
          content: '❌ Некорректная дата.',
          flags: MessageFlags.Ephemeral
        });
      }

      const { wasExisting } = await setBirthday(guildId, userId, parsed);

      /* Если дата менялась — очищаем возможное старое поздравление */
      let cleanupNote = '';
      if (wasExisting) {
        const data = readSection(guildId, 'birthdays');
        const r = await cleanupCongrats(interaction.guild, data, userId, { skipIfToday: true });
        if (r.removedMessage || r.removedRole) {
          writeSection(guildId, 'birthdays', data);

          const bits = [];
          if (r.removedRole) bits.push('роль снята');
          if (r.removedMessage) bits.push('сообщение удалено');
          cleanupNote = ` ⚠️ Старое поздравление очищено (${bits.join(', ')}).`;
        }
      }

      /* Если настроен канал ДР и это не он — публикуем анонс туда */
      const targetChannelId = readSection(guildId, 'birthdays')?.settings?.channelId;
      const channel = targetChannelId ? interaction.guild.channels.cache.get(targetChannelId) : null;

      if (channel && channel.id !== interaction.channelId) {
        try {
          await channel.send(
            `🎂 <@${userId}> указал(а) дату рождения: ${day}.${month}${year ? '.' + year : ''}`
          );
        } catch {}
      }

      return interaction.reply({
        content:
          `✅ ${wasExisting ? 'Дата обновлена' : 'Дата сохранена'}: ` +
          `**${day}.${month}${year ? '.' + year : ''}**.${cleanupNote}`,
        flags: MessageFlags.Ephemeral
      });
    }

    /* ---------- /hb info ---------- */
    if (sub === 'info') {
      const entry = await getBirthday(guildId, userId);
      const text = buildInfoText(entry) ||
        '📭 У вас ещё не указана дата рождения.\n`/hb set день:30 месяц:03`';

      return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    }

    /* ---------- /hb enable / disable ---------- */
    if (sub === 'enable' || sub === 'disable') {
      const enabled = sub === 'enable';
      const r = await setBirthdayEnabled(guildId, userId, enabled);

      if (!r.ok) {
        const msg = r.reason === 'not_found'
          ? '📭 Сначала установите дату через `/hb set`.'
          : '⚠️ Не удалось изменить настройки.';
        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }

      /* При отключении — очищаем возможное поздравление */
      let cleanupNote = '';
      if (!enabled) {
        const data = readSection(guildId, 'birthdays');
        const cl = await cleanupCongrats(interaction.guild, data, userId, { skipIfToday: false });

        if (cl.removedMessage || cl.removedRole) {
          writeSection(guildId, 'birthdays', data);

          const bits = [];
          if (cl.removedRole) bits.push('роль снята');
          if (cl.removedMessage) bits.push('сообщение удалено');
          cleanupNote = ` (${bits.join(', ')})`;
        }
      }

      return interaction.reply({
        content: enabled
          ? '🔔 Поздравления включены.'
          : `🔕 Поздравления отключены${cleanupNote}.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

/* ============================================================
   /hb list — список ДР с пагинацией через Components v2
   Экспортируется отдельно — кнопки пагинации переиспользуют её
   ============================================================ */

/**
 * Собирает ответ /hb list для указанной страницы.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {string} guildId
 * @param {number} page - 0-indexed
 * @param {'reply'|'update'} [mode='reply'] - reply для нового, update для кнопки
 */
export async function handleList(interaction, guildId, page, mode = 'reply') {
  const data = readSection(guildId, 'birthdays') || { users: [] };
  const now = new Date();

  /* Сортируем по близости ДР */
  const sorted = (data.users || [])
    .filter(u => u.day && u.month && u.enabled !== false)
    .map(u => ({ ...u, _days: daysUntilBirthday(u.day, u.month, now) }))
    .sort((a, b) => a._days - b._days);

  /* Если никого — простой ответ */
  if (!sorted.length) {
    const payload = {
      content: '📭 На сервере пока нет ни одного дня рождения.',
      flags: MessageFlags.Ephemeral
    };
    return mode === 'update' ? interaction.update(payload) : interaction.reply(payload);
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  /* Строки списка */
  const lines = slice.map(u => {
    const date = `${String(u.day).padStart(2, '0')}.${String(u.month).padStart(2, '0')}`;
    const when = u._days === 0
      ? '**сегодня** 🎉'
      : u._days === 1
        ? 'завтра'
        : `через ${u._days} ${pluralDays(u._days)}`;
    return `• <@${u.userId}> — ${date} (${when})`;
  });

  const header = `# 🎂 Дни рождения\n` +
    `> Страница **${safePage + 1}** из **${totalPages}** · всего **${sorted.length}**`;

  const components = [
    {
      type: 17,
      components: [
        { type: 10, content: header },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: lines.join('\n') },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: '◀ Назад',
              custom_id: `hblist:${safePage - 1}`,
              disabled: safePage === 0
            },
            {
              type: 2,
              style: 2,
              label: `${safePage + 1} / ${totalPages}`,
              custom_id: 'hblist:noop',
              disabled: true
            },
            {
              type: 2,
              style: 2,
              label: 'Вперёд ▶',
              custom_id: `hblist:${safePage + 1}`,
              disabled: safePage >= totalPages - 1
            },
            {
              type: 2,
              style: 4,
              label: '✕',
              custom_id: 'hblist:close'
            }
          ]
        }
      ]
    }
  ];

  const payload = {
    components,
    flags: MessageFlags.Ephemeral | 32768,
    allowedMentions: { parse: [] }
  };

  return mode === 'update' ? interaction.update(payload) : interaction.reply(payload);
}