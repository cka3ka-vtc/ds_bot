// server/app/events/interaction.js
import { BUILTIN_NAMES } from '../../../shared/builtin-commands.js';
import { saveProfileThrottled, snapshotOf } from './helpers.js';

export async function onInteraction({ db, registry, logger, payload }) {
  const { botId, guildId, interaction } = payload;
  if (!guildId) return;
  if (!interaction?.isChatInputCommand?.()) return;
  if (interaction.user?.bot) return;

  const snap = snapshotOf(interaction.member || interaction.user);

  try {
    db.addEvent({
      botId, guildId, userId: interaction.user.id, type: 'command',
      meta: { command: interaction.commandName, ...snap },
    });
  } catch (err) {
    logger.warn({ err }, 'addEvent command failed');
  }

  saveProfileThrottled(db, logger, { botId, guildId, userId: interaction.user.id, ...snap });

  // 1. Builtin
  if (BUILTIN_NAMES.has(interaction.commandName)) {
    const levelsMod = registry.get('levels');
    if (!levelsMod?.handleCommand) {
      try {
        await interaction.reply({
          content: '⚠ Команда временно недоступна',
          ephemeral: true,
        });
      } catch {}
      return;
    }
    try {
      await levelsMod.handleCommand(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, 'levels.handleCommand failed');
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Ошибка', ephemeral: true });
        }
      } catch {}
    }
    return;
  }

  // 2. Custom
  const customs = db.getCustomCommands(botId, guildId);
  const custom = customs.find(
    (c) => c.enabled && c.name.toLowerCase() === interaction.commandName,
  );
  if (custom) {
    try {
      if (interaction.deferred || interaction.replied) return;
      await interaction.reply({
        content: custom.response || '✅ Команда выполняется',
        allowedMentions: { parse: [] },
      });
    } catch (err) {
      logger.warn({ err, command: interaction.commandName }, 'custom command reply failed');
    }
  }
}