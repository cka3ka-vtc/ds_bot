// server/index.js
import 'dotenv/config';
import { config } from './config.js';
import { logger } from './core/logger.js';
import { initDb } from './core/db.js';
import { eventBus } from './core/eventBus.js';
import { BotManager } from './bots/manager.js';
import { ModuleRegistry } from './modules/registry.js';
import { createApp } from './api/app.js';
import { encrypt } from './core/crypto.js';
import { syncAllGuildCommands, syncGuildCommands } from './core/commandSync.js';

async function main() {
  /* ── 1. Инициализация ─────────────────────────────── */
  const db = initDb(config.DATABASE_PATH);
  const botManager = new BotManager({ db, logger, eventBus });
  const registry = new ModuleRegistry({ db, logger, eventBus, botManager });

  /* ── 2. Восстановление ботов и серверов ──────────── */
  await botManager.restoreAll();
  await ensureMainBot({ db, botManager });
  await syncGuildsOnStartup({ db, botManager, logger });

  /* ── 3. Загрузка модулей ─────────────────────────── */
  await registry.load();

  /* ── 4. Регистрация slash-команд ─────────────────── */
  await syncAllGuildCommands({ db, botManager, logger });

  /* ── 5. Dispatch событий в модули ────────────────── */
  const forwarded = [
    'guildMemberAdd',
    'guildMemberRemove',
    'messageCreate',
    'interactionCreate',
    'voiceStateUpdate',
  ];
  for (const event of forwarded) {
    eventBus.on(event, (payload) => {
      registry.dispatch({ ...payload, event });
    });
  }

  /* ── 6. Запись событий для статистики ────────────── */
  eventBus.on('messageCreate', ({ botId, guildId, message }) => {
    if (!guildId || message.author.bot) return;
    try {
      db.addEvent({ botId, guildId, userId: message.author.id, type: 'message' });
    } catch (err) {
      logger.warn({ err }, 'addEvent message failed');
    }
  });

  eventBus.on('guildMemberAdd', ({ botId, guildId, member }) => {
    if (!guildId || member.user.bot) return;
    try {
      db.addEvent({ botId, guildId, userId: member.id, type: 'member_join' });
    } catch {}
  });

  eventBus.on('guildMemberRemove', ({ botId, guildId, member }) => {
    if (!guildId || member.user.bot) return;
    try {
      db.addEvent({ botId, guildId, userId: member.id, type: 'member_leave' });
    } catch {}
  });

  /* ⚡ НОВОЕ: голосовая активность ─────────────────────
   * Записываем событие `voice_join` только при переходе
   * «не в голосе → в голосе». Переключение между
   * каналами и выход не считаются новым входом.
   */
  eventBus.on('voiceStateUpdate', ({ botId, guildId, oldState, newState }) => {
    if (!guildId) return;

    const member = newState.member || oldState.member;
    if (!member || !member.user || member.user.bot) return;

    const wasInVoice = !!oldState.channelId;
    const isInVoice  = !!newState.channelId;

    // Только реальный вход: не было канала → появился канал
    if (!wasInVoice && isInVoice) {
      try {
        db.addEvent({
          botId,
          guildId,
          userId: member.id,
          type: 'voice_join',
          meta: { channelId: newState.channelId },
        });
        logger.debug(
          {
            botId,
            guildId,
            userId: member.id,
            channelId: newState.channelId,
          },
          'voice_join recorded',
        );
      } catch (err) {
        logger.warn({ err }, 'addEvent voice failed');
      }
    }
  });

  /* ── 7. Слэш-команды: статистика + ответ ──────────── */
  eventBus.on('interactionCreate', async ({ botId, guildId, interaction }) => {
    if (!guildId) return;
    if (!interaction.isChatInputCommand?.()) return;

    // Записываем использование команды
    try {
      db.addEvent({
        botId,
        guildId,
        userId: interaction.user.id,
        type: 'command',
        meta: { command: interaction.commandName },
      });
    } catch (err) {
      logger.warn({ err }, 'addEvent command failed');
    }

    // Проверяем кастомную команду и отвечаем
    const customs = db.getCustomCommands(botId, guildId);
    const custom = customs.find(
      (c) => c.enabled && c.name.toLowerCase() === interaction.commandName,
    );

    if (custom) {
      try {
        if (interaction.deferred || interaction.replied) return;
        await interaction.reply({
          content: custom.response || '✅ Команда выполнена',
          allowedMentions: { parse: [] },
        });
        logger.info(
          {
            botId,
            guildId,
            command: interaction.commandName,
            userId: interaction.user.id,
          },
          'custom command replied',
        );
      } catch (err) {
        logger.warn(
          { err, command: interaction.commandName },
          'custom command reply failed',
        );
      }
    }
  });

  /* ── 8. Жизненный цикл серверов ──────────────────── */
  eventBus.on('guildCreate', async ({ client, guild }) => {
    db.upsertGuild({
      id: guild.id,
      bot_id: client.user.id,
      name: guild.name,
      icon: guild.icon,
      owner_id: guild.ownerId,
      member_count: guild.memberCount,
      discord_created_at: guild.createdTimestamp
        ? Math.floor(guild.createdTimestamp / 1000)
        : null,
      online_count: guild.approximatePresenceCount ?? null,
    });
    logger.info({ botId: client.user.id, guildId: guild.id }, 'guild added');

    try {
      await syncGuildCommands({ db, botManager, logger }, client.user.id, guild.id);
    } catch {}
  });

  eventBus.on('guildDelete', ({ client, guild }) => {
    db.deleteGuild(client.user.id, guild.id);
    logger.info({ botId: client.user.id, guildId: guild.id }, 'guild removed');
  });

  /* ── 9. HTTP-сервер ──────────────────────────────── */
  const app = createApp({ db, botManager, registry, logger });
  const server = app.listen(config.PORT, () => {
    logger.info(`🌐 API на http://localhost:${config.PORT}`);
  });

  /* ── 10. Graceful shutdown ───────────────────────── */
  const stop = async () => {
    logger.info('shutting down...');
    server.close();
    await botManager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

/* ============================================================
   ХЕЛПЕРЫ
   ============================================================ */

async function ensureMainBot({ db, botManager }) {
  const existing = db.getMainBot();
  if (existing) {
    if (!botManager.get(existing.id)) {
      logger.warn({ botId: existing.id }, 'main bot not running — check token');
    }
    return;
  }

  logger.info('first start — creating main bot from .env');
  const { BotInstance } = await import('./bots/instance.js');
  const instance = new BotInstance({
    token: config.DISCORD_MAIN_BOT_TOKEN,
    isMain: true,
    logger,
    eventBus,
  });
  await instance.start();

  db.createBot({
    id: instance.id,
    owner_id: null,
    name: instance.name,
    avatar_url: instance.avatarUrl,
    token_encrypted: encrypt(config.DISCORD_MAIN_BOT_TOKEN),
    is_main: 1,
  });

  botManager.bots.set(instance.id, instance);
}

async function syncGuildsOnStartup({ db, botManager, logger }) {
  for (const inst of botManager.all()) {
    if (!inst.client) continue;

    let count = 0;
    try {
      const guilds = await inst.client.guilds.fetch({
        withCounts: true,
        force: true,
        cache: true,
      });

      for (const [, guild] of guilds) {
        db.upsertGuild({
          id: guild.id,
          bot_id: inst.id,
          name: guild.name,
          icon: guild.icon,
          owner_id: guild.ownerId,
          member_count: guild.memberCount,
          discord_created_at: guild.createdTimestamp
            ? Math.floor(guild.createdTimestamp / 1000)
            : null,
          online_count: guild.approximatePresenceCount ?? null,
        });
        count++;
      }
    } catch (err) {
      logger.warn(
        { err, botId: inst.id },
        'failed to sync guilds with counts, using cache',
      );

      for (const [, guild] of inst.client.guilds.cache) {
        db.upsertGuild({
          id: guild.id,
          bot_id: inst.id,
          name: guild.name,
          icon: guild.icon,
          owner_id: guild.ownerId,
          member_count: guild.memberCount,
          discord_created_at: guild.createdTimestamp
            ? Math.floor(guild.createdTimestamp / 1000)
            : null,
          online_count: null,
        });
        count++;
      }
    }

    logger.info({ botId: inst.id, guilds: count }, 'guilds synced on startup');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});