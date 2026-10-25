/* ============================================================
   Проверка «команда вызывается только в своём канале».

   Каждый раздел (birthdays, profiles) имеет свой настроенный
   канал. Slash-команды вне этого канала получают ephemeral-ответ
   с указанием, куда идти.

   Возвращает объект — вызывающий код сам решает, как реагировать.
   ============================================================ */

import { readSection } from '../storage/index.js';

/* Карта: раздел → путь к channelId в JSON */
const SECTION_KEYS = {
  birthdays: ['birthdays', 'settings', 'channelId'],
  profiles:  ['profiles',  'settings', 'channelId']
};

/**
 * Проверяет, что interaction пришёл в правильном канале.
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {'birthdays'|'profiles'} section
 * @returns {Promise<{ ok: boolean, message?: string, channelId?: string }>}
 */
export async function checkCommandChannel(interaction, section) {
  const guildId = interaction.guildId;

  if (!guildId) {
    return { ok: false, message: '❌ Команда доступна только на сервере.' };
  }

  const [dataKey, settingsKey, channelKey] = SECTION_KEYS[section] || [];
  if (!dataKey) return { ok: true };

  const channelId = readSection(guildId, dataKey)?.[settingsKey]?.[channelKey];

  if (!channelId) {
    return {
      ok: false,
      message: `⚠️ Канал для раздела «${section}» не настроен. Обратитесь к администратору панели.`
    };
  }

  if (interaction.channelId !== channelId) {
    return {
      ok: false,
      message: `❌ Эта команда работает только в канале <#${channelId}>.`
    };
  }

  return { ok: true, channelId };
}