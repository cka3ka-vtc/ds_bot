/* ============================================================
   Slash-команда /profile — показать профиль.

   - без параметра: показать свой профиль
   - с параметром user: показать чужой профиль
   - если у целевого нет профиля — вежливый ответ
   - если настроен канал профилей и это не он — публикуем туда
   ============================================================ */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { buildProfilePayload } from '../../services/profiles.js';
import { checkCommandChannel } from '../../services/channel-guard.js';
import { readSection } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Показать профиль')
    .addUserOption(o =>
      o.setName('user').setDescription('Пользователь (по умолчанию вы)')
    ),

  async execute(interaction) {
    /* Проверка канала */
    const guard = await checkCommandChannel(interaction, 'profiles');
    if (!guard.ok) {
      return interaction.reply({ content: guard.message, flags: MessageFlags.Ephemeral });
    }

    /* Целевой пользователь */
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    /* Сборка Components v2 */
    const components = await buildProfilePayload(interaction.guildId, target, member);

    if (!components) {
      const isSelf = target.id === interaction.user.id;
      const msg = isSelf
        ? '📭 У вас ещё нет профиля.\nЗаполните: `/vtc`, `/steam`, `/hmp`, `/tmp`, `/company`.'
        : `📭 У <@${target.id}> нет профиля.`;

      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }

    /* Если настроен канал профилей и это не он — публикуем и туда */
    const targetChannelId = readSection(interaction.guildId, 'profiles')?.settings?.channelId;
    const channel = targetChannelId ? interaction.guild.channels.cache.get(targetChannelId) : null;

    if (channel && channel.id !== interaction.channelId) {
      try {
        await channel.send({
          components,
          flags: 32768,
          allowedMentions: { parse: [] }
        });
      } catch {}
    }

    /* Отвечаем ephemeral — не засоряем чат */
    return interaction.reply({
      components,
      flags: MessageFlags.Ephemeral | 32768,
      allowedMentions: { parse: [] }
    });
  }
};