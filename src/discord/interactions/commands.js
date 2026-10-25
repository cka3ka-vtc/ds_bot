/* ============================================================
   Обработчик slash-команд.

   Проверки перед вызовом:
   1. Команда включена (command-config enabled)
   2. У пользователя есть разрешающая роль
   3. Не превышен cooldown

   Только после этого вызывается execute() команды.
   ============================================================ */

import commands from '../commands/index.js';
import { isEnabled, checkCooldown, checkPermissions } from '../command-config.js';

/* Map<commandName, commandObject> — для O(1) поиска */
const registry = new Map(commands.map(c => [c.data.name, c]));

/**
 * Обрабатывает interactionChatInputCommand.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function handleCommand(interaction) {
  const name = interaction.commandName;
  const cmd = registry.get(name);
  if (!cmd) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({ content: '❌ Только на сервере.', flags: 64 });
  }

  /* 1. Включена ли команда */
  if (!isEnabled(guildId, name)) {
    return interaction.reply({
      content: '❌ Команда отключена на этом сервере.',
      flags: 64
    });
  }

  /* 2. Роли */
  const perm = checkPermissions(guildId, name, interaction.member);
  if (!perm.ok) {
    const msg = perm.reason === 'no_role'
      ? '❌ У вас нет роли, необходимой для этой команды.'
      : '❌ Не удалось проверить права.';
    return interaction.reply({ content: msg, flags: 64 });
  }

  /* 3. Cooldown */
  const cd = checkCooldown(guildId, name, interaction.user.id);
  if (!cd.ok) {
    return interaction.reply({
      content: `⏱ Подождите ${cd.remainingSec} с перед следующим использованием.`,
      flags: 64
    });
  }

  /* 4. Выполнение */
  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(`[interaction] /${name}:`, e);

    const payload = { content: `❌ Ошибка: ${e.message}`, flags: 64 };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch {}
  }
}