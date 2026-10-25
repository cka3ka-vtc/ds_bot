/* ============================================================
   Регистрация slash-команд в Discord.

   Стратегия «belt and suspenders»:
   1. Глобальные команды — для будущих серверов (propagation до 1 ч).
   2. Гильдейские команды для каждого текущего сервера (мгновенно).

   ВАЖНО: список команд берётся из реестра ./commands/index.js.
   Не импортируйте команды напрямую — там уже учтены фабрики
   (vtc/steam/hmp/tmp генерируются из profile-fields.js).

   Отключённые команды в конфиге (__global__.items[name].enabled=false)
   не регистрируются.
   ============================================================ */

import { REST, Routes } from 'discord.js';
import commands from './commands/index.js';
import { getConfig } from './command-config.js';

/**
 * Регистрирует все включённые команды.
 * @param {import('discord.js').Client} client
 * @param {string} token
 */
export async function registerCommands(client, token) {
  const rest = new REST({ version: '10' }).setToken(token);

  const applicationId = client.application?.id || client.user?.id;
  if (!applicationId) {
    console.error('[register-commands] ❌ не удалось определить applicationId');
    return;
  }

  /* Фильтруем по глобальным настройкам */
  const globalConfig = getConfig('__global__');
  const enabled = commands.filter(c => {
    const overrides = globalConfig.items?.[c.data.name];
    return !overrides || overrides.enabled !== false;
  });

  const body = enabled.map(c => c.data.toJSON());
  console.log(`[register-commands] Регистрируем ${body.length}/${commands.length} команд для ${applicationId}`);

  /* ---------- Глобальные ---------- */
  try {
    await rest.put(Routes.applicationCommands(applicationId), { body });
    console.log(`[register-commands] ✅ Global: ${body.length} команд (propagation ~1 час)`);
  } catch (e) {
    console.error(`[register-commands] ❌ Global FAILED: ${e.message}`);
  }

  /* ---------- Гильдейские ---------- */
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(applicationId, guild.id),
        { body }
      );
      console.log(`[register-commands] ✅ Guild "${guild.name}": ${body.length} команд`);
    } catch (e) {
      console.error(`[register-commands] ❌ Guild "${guild.name}" FAILED: ${e.message}`);

      if (e.code === 50001 || /missing access/i.test(e.message)) {
        console.error('      → Проверьте scope "applications.commands":');
        console.error('        Discord Developer Portal → OAuth2 → URL Generator → Scopes: bot + applications.commands');
      }
    }
  }

  console.log('[register-commands] Готово. Если команды не появились — Ctrl+R в Discord.');
}