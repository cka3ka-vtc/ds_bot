/* ============================================================
   Slash-команда /company — дата вступления в компанию.
   ============================================================ */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setField, parseCompanyDate } from '../../services/profiles.js';
import { checkCommandChannel } from '../../services/channel-guard.js';

export default {
  data: new SlashCommandBuilder()
    .setName('company')
    .setDescription('Дата вступления в компанию')
    .addStringOption(o =>
      o.setName('date')
        .setDescription('ДД.ММ.ГГГГ или ГГГГ-ММ-ДД')
        .setRequired(true)
        .setMaxLength(20)
    ),

  async execute(interaction) {
    const guard = await checkCommandChannel(interaction, 'profiles');
    if (!guard.ok) {
      return interaction.reply({ content: guard.message, flags: MessageFlags.Ephemeral });
    }

    const raw = interaction.options.getString('date');
    const iso = parseCompanyDate(raw);

    if (!iso) {
      return interaction.reply({
        content: '❌ Некорректная дата. Используйте `ДД.ММ.ГГГГ` или `ГГГГ-ММ-ДД`.',
        flags: MessageFlags.Ephemeral
      });
    }

    await setField(interaction.guildId, interaction.user.id, 'companySince', iso);

    return interaction.reply({
      content: `✅ Дата вступления сохранена: **${raw}**.`,
      flags: MessageFlags.Ephemeral
    });
  }
};