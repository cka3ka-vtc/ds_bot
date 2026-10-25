/* ============================================================
   Фабрика команд /vtc, /steam, /hmp, /tmp.

   Все четыре имеют одинаковую структуру:
   - один обязательный параметр url
   - проверка валидности URL
   - запись в профиль через profiles.setField
   - ephemeral-ответ

   Разница только в поле профиля и тексте.
   ============================================================ */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setField, isValidUrl } from '../../services/profiles.js';
import { checkCommandChannel } from '../../services/channel-guard.js';

/**
 * Создаёт объект команды для одного поля профиля.
 *
 * @param {object} opts
 * @param {string} opts.name        - имя slash-команды (vtc, steam, hmp, tmp)
 * @param {string} opts.field       - ключ в profile (vtc, steam, haulmp, truckersmp)
 * @param {string} opts.label       - человекочитаемое название (VTC, Steam…)
 * @param {string} opts.description - описание команды
 * @returns {{ data: SlashCommandBuilder, execute: Function }}
 */
export function makeFieldCommand({ name, field, label, description }) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addStringOption(o =>
        o.setName('url')
          .setDescription(`Ссылка на ${label} (https://…)`)
          .setRequired(true)
          .setMaxLength(500)
      ),

    async execute(interaction) {
      /* 1. Проверяем, что команда вызвана в правильном канале */
      const guard = await checkCommandChannel(interaction, 'profiles');
      if (!guard.ok) {
        return interaction.reply({
          content: guard.message,
          flags: MessageFlags.Ephemeral
        });
      }

      /* 2. Достаём url и валидируем */
      const url = interaction.options.getString('url');
      if (!isValidUrl(url)) {
        return interaction.reply({
          content: '❌ Ссылка должна начинаться с `http://` или `https://`.',
          flags: MessageFlags.Ephemeral
        });
      }

      /* 3. Пишем в профиль */
      await setField(interaction.guildId, interaction.user.id, field, url);

      /* 4. Отвечаем ephemeral */
      return interaction.reply({
        content: `✅ ${label} сохранён.`,
        flags: MessageFlags.Ephemeral
      });
    }
  };
}