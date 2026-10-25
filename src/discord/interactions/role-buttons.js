/* ============================================================
   Обработчик кнопок выдачи/снятия ролей.

   customId: role_<section>_<roleId>_<buttonId>

   При клике:
   - проверяет, есть ли у пользователя роль
   - выдаёт или снимает
   - отвечает ephemeral-сообщением по настройкам кнопки
     (или дефолтным текстом)

   Ответ может быть как простой строкой, так и Components v2,
   если в конфиге кнопки настроены `ephemeral.positive` / `negative`.
   ============================================================ */

import { readSection } from '../../storage/index.js';
import { buildComponentsFromConfig, FLAG_EPHEMERAL, FLAG_COMPONENTS_V2 } from '../components-builder.js';
import { logInfo, logError } from '../../services/guild-logger.js';

/**
 * Вешает обработчик на клиент.
 * @param {import('discord.js').Client} client
 */
export function registerRoleButtonHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('role_')) return;

    try {
      await handleRoleButton(interaction);
    } catch (e) {
      console.error('[role-button] error:', e);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Ошибка: ${e.message}`,
            flags: FLAG_EPHEMERAL
          });
        }
      } catch {}
    }
  });
}

/* ============================================================
   Главный обработчик
   ============================================================ */

/**
 * Обрабатывает клик по кнопке роли.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleRoleButton(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '⚠️ Только на сервере.',
      flags: FLAG_EPHEMERAL
    });
  }

  /* Парсим customId: role_<section>_<roleId>_<buttonId> */
  const parts = interaction.customId.split('_');
  let section = 'rules';
  let buttonId;

  if (parts.length >= 4) {
    section = parts[1];
    buttonId = parts[3];
  } else if (parts.length === 3) {
    buttonId = parts[2];
  } else {
    return interaction.reply({
      content: '⚠️ Некорректный ID кнопки.',
      flags: FLAG_EPHEMERAL
    });
  }

  /* Ищем конфиг кнопки в данных */
  const buttonConfig = findRoleButton(guildId, section, buttonId);
  if (!buttonConfig) {
    return interaction.reply({
      content: '⚠️ Кнопка роли не найдена. Возможно, сообщение устарело — попросите администратора обновить его.',
      flags: FLAG_EPHEMERAL
    });
  }

  const roleId = buttonConfig.roleId;
  if (!roleId) {
    return interaction.reply({
      content: '⚠️ Роль не настроена.',
      flags: FLAG_EPHEMERAL
    });
  }

  const member = interaction.member;
  if (!member || !member.roles) {
    return interaction.reply({
      content: '❌ Не удалось получить участника.',
      flags: FLAG_EPHEMERAL
    });
  }

  /* Toggle роли */
  let hasRole;
  try {
    hasRole = member.roles.cache.has(roleId);

    if (hasRole) await member.roles.remove(roleId);
    else await member.roles.add(roleId);

    logInfo(guildId, 'role_toggle',
      hasRole ? 'Роль снята с пользователя' : 'Роль выдана пользователю',
      { roleId, buttonId, userId: member.id, action: hasRole ? 'remove' : 'add' });
  } catch (e) {
    logError(guildId, 'role_toggle', e.message,
      { roleId, buttonId, userId: member.id }, e.stack);

    return interaction.reply({
      content: `❌ Не удалось изменить роль: ${e.message}`,
      flags: FLAG_EPHEMERAL
    });
  }

  /* Имя роли для ответа */
  let roleName = 'Роль';
  const cachedRole = interaction.guild.roles.cache.get(roleId);
  if (cachedRole) roleName = cachedRole.name;

  /* Вариант ответа: positive при выдаче, negative при снятии */
  const eph = buttonConfig.ephemeral || {};
  const variant = hasRole
    ? (eph.negative || eph)
    : (eph.positive || eph);

  /* Если variant содержит блоки — собираем Components v2 */
  if (variant?.blocks?.length > 0) {
    const components = buildComponentsFromConfig(variant, { roleName });
    return interaction.reply({
      flags: FLAG_EPHEMERAL | FLAG_COMPONENTS_V2,
      components
    });
  }

  /* Иначе — простой текст */
  const action = hasRole ? 'снята' : 'выдана';
  const content = (variant?.content || `✅ Роль **${roleName}** ${action}!`)
    .replace(/\{role\}/g, roleName);

  return interaction.reply({ content, flags: FLAG_EPHEMERAL });
}

/* ============================================================
   Поиск конфига кнопки
   ============================================================ */

/**
 * Ищет настройки кнопки по section + buttonId.
 * Ищет сначала в указанной секции, потом в остальных.
 *
 * @param {string} guildId
 * @param {string} primarySection
 * @param {string} buttonId
 * @returns {object|null}
 */
function findRoleButton(guildId, primarySection, buttonId) {
  const found = searchSection(guildId, primarySection, buttonId);
  if (found) return found;

  /* Резервный обход — вдруг кнопка из другого раздела */
  const sections = ['rules', 'messages', 'announcements', 'delayed'];
  for (const section of sections) {
    if (section === primarySection) continue;
    const result = searchSection(guildId, section, buttonId);
    if (result) return result;
  }
  return null;
}

/**
 * Ищет кнопку в конкретной секции.
 * @param {string} guildId
 * @param {string} section
 * @param {string} buttonId
 * @returns {object|null}
 */
function searchSection(guildId, section, buttonId) {
  const data = readSection(guildId, section);
  if (!data) return null;

  if (section === 'rules') {
    return findButtonInBlocks(data.blocks, buttonId);
  }

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const found = findButtonInBlocks(item.config?.blocks, buttonId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Ищет кнопку в массиве блоков.
 * @param {Array} blocks
 * @param {string} buttonId
 * @returns {object|null}
 */
function findButtonInBlocks(blocks, buttonId) {
  if (!Array.isArray(blocks)) return null;

  for (const block of blocks) {
    if (block.type === 'role-buttons' && Array.isArray(block.buttons)) {
      const found = block.buttons.find(b => b.id === buttonId);
      if (found) return found;
    }
  }
  return null;
}