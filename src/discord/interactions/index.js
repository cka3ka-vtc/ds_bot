/* ============================================================
   Регистратор всех обработчиков interactionCreate.

   Здесь вешается один listener на клиент. Внутри —
   маршрутизация по типу интеракции:
   - isButton()          → role-buttons.js + пагинация /hb list
   - isChatInputCommand() → commands.js

   Так избегаем дублирования: клиент слушает одно событие,
   а логика разложена по файлам.
   ============================================================ */

import { handleCommand } from './commands.js';
import { handleRoleButton } from './role-buttons.js';

/**
 * Вешает обработчики на клиент. Вызывается один раз при старте.
 * @param {import('discord.js').Client} client
 */
export function registerInteractionHandlers(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      /* ---------- Кнопки ---------- */
      if (interaction.isButton()) {
        /* Пагинация /hb list */
        if (interaction.customId.startsWith('hblist:')) {
          return handleHbListButton(interaction);
        }
        /* Кнопки выдачи ролей */
        if (interaction.customId.startsWith('role_')) {
          return handleRoleButton(interaction);
        }
        return;
      }

      /* ---------- Slash-команды ---------- */
      if (interaction.isChatInputCommand()) {
        return handleCommand(interaction);
      }
    } catch (e) {
      console.error('[interactions] unhandled error:', e);
    }
  });

  console.log('[interactions] ✅ handlers registered');
}

/**
 * Обработчик кнопок пагинации /hb list.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleHbListButton(interaction) {
  const [, arg] = interaction.customId.split(':');

  if (arg === 'noop') return;

  if (arg === 'close') {
    try {
      await interaction.update({
        content: '📭 Список закрыт.',
        components: [],
        flags: 64
      });
    } catch {}
    return;
  }

  const page = parseInt(arg, 10);
  if (!Number.isFinite(page) || page < 0) return;

  try {
    const { handleList } = await import('../commands/hb.js');
    await handleList(interaction, interaction.guildId, page, 'update');
  } catch (e) {
    console.error('[hblist] button failed:', e);
    try {
      await interaction.followUp({ content: '❌ Не удалось обновить список.', flags: 64 });
    } catch {}
  }
}