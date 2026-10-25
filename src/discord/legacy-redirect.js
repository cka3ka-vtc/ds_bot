/* ============================================================
   Redirect для legacy `!` команд.

   Пользователи привыкли к `!hb`, `!profile` и т. д.
   После перехода на slash эти команды больше не работают.

   Решение: перехватываем их и отвечаем сообщением
   «используйте /hb». Само сообщение пользователя и наш ответ
   автоматически удаляются через 30 секунд, чтобы не засорять чат.

   ВАЖНО: этот обработчик должен работать ДО autodelete,
   иначе autodelete удалит legacy-сообщение мгновенно и redirect
   не успеет отреагировать. Регистрируется через prependListener.
   ============================================================ */

/* Карта: legacy → slash */
const LEGACY_MAP = {
  '!hb':      '/hb',
  '!profile': '/profile',
  '!vtc':     '/vtc',
  '!steam':   '/steam',
  '!hmp':     '/hmp',
  '!tmp':     '/tmp',
  '!company': '/company'
};

/* Через сколько удалять сообщения */
const AUTO_DELETE_MS = 30 * 1000;

/**
 * Вешает обработчик на клиент. Вызывается один раз при старте.
 * @param {import('discord.js').Client} client
 */
 
 let initializedOn = null;
 
export function initLegacyRedirect(client) {
  if (initializedOn === client) return;
  initializedOn = client;

  client.prependListener('messageCreate', async (message) => {
    try {
      /* Только серверные текстовые сообщения от людей */
      if (!message.guild) return;
      if (message.author.bot || message.system) return;
      if (!message.content) return;

      const trimmed = message.content.trimStart().toLowerCase();
      const legacyKey = Object.keys(LEGACY_MAP).find(k =>
        trimmed === k || trimmed.startsWith(k + ' ')
      );
      if (!legacyKey) return;

      const slashName = LEGACY_MAP[legacyKey];

      /* Отвечаем reply — если не получится, fallback на channel.send */
      let reply;
      try {
        reply = await message.reply({
          content:
            `🔄 Команда \`${legacyKey}\` переехала в slash — используйте \`${slashName}\`.\n` +
            `Это сообщение и ответ удалятся через ${AUTO_DELETE_MS / 1000} секунд.`,
          allowedMentions: { repliedUser: false }
        });
      } catch {
        try {
          reply = await message.channel.send({
            content: `🔄 Используйте \`${slashName}\` вместо \`${legacyKey}\`.`
          });
        } catch {}
      }

      /* Автоудаление через 30 секунд */
      setTimeout(() => message.delete().catch(() => {}), AUTO_DELETE_MS);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), AUTO_DELETE_MS);
    } catch (e) {
      console.error('[legacy-redirect] error:', e.message);
    }
  });

  console.log('[legacy-redirect] ✅ включён');
}