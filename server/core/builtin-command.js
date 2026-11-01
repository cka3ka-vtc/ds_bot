// server/core/builtin-command.js
import { MessageFlags } from 'discord.js';

export const DEAD_INTERACTION_CODES = new Set([10062, 40060]);

export function isDeadInteraction(err) {
  const code = err?.code;
  if (DEAD_INTERACTION_CODES.has(code)) return true;
  return /already been acknowledged|unknown interaction/i.test(err?.message || '');
}

export const BUILTIN_DEFAULTS = {
  enabled: true,
  description: '',
  cooldownSeconds: 0,
  channelsMode: 'all',
  channels: [],
  requireRoles: [],
  excludeRoles: [],
  ephemeral: true,
};

export async function handleBuiltinCommand(interaction, opts, options) {
  const { db, logger, logScope, useCooldowns, fetchModuleConfig, dispatch } = options;

  const startedAt = Date.now();
  const guildId = opts.guildId || interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '⚠ Команда доступна только на сервере',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }

  const botId = opts.botId || interaction.client.user.id;
  const userId = interaction.user?.id || null;
  const cmd = interaction.commandName;

  if (interaction.replied || interaction.deferred) {
    logger.warn({
      event: 'interaction_already_ack',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
      replied: interaction.replied,
      deferred: interaction.deferred,
    }, `${logScope}.handleCommand: interaction already acknowledged — skipping`);
    return;
  }

  /* ─── Настройки встроенной команды ─── */
  let cmdSettings = { ...BUILTIN_DEFAULTS };
  try {
    const row = db.getBuiltinSettings?.(botId, guildId, cmd);
    if (row) cmdSettings = { ...cmdSettings, ...row };
  } catch (err) {
    logger.warn({
      err,
      event: 'builtin_settings_read_failed',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
    }, `${logScope}.handleCommand: read builtin settings failed`);
  }

  if (cmdSettings.enabled === false) {
    return interaction.reply({
      content: '⚠ Команда отключена на этом сервере',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }

  const ephemeral = cmdSettings.ephemeral !== false;

  try {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  } catch (err) {
    if (isDeadInteraction(err)) {
      logger.warn({
        event: 'defer_failed_dead',
        log_scope: logScope,
        bot_id: botId,
        guild_id: guildId,
        user_id: userId,
        cmd,
        err_code: err?.code || null,
        err_msg: err?.message || null,
        duration_ms: Date.now() - startedAt,
      }, `${logScope}.handleCommand: deferReply failed — interaction dead`);
      return;
    }
    logger.error({
      err,
      event: 'defer_failed',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
    }, `${logScope}.handleCommand: deferReply unexpected error`);
    return;
  }

  if (cmdSettings.cooldownSeconds > 0) {
    const k = `${guildId}:${userId}:use_${cmd}`;
    const now = Date.now();
    const last = useCooldowns.get(k) || 0;
    const need = cmdSettings.cooldownSeconds * 1000;
    if (now - last < need) {
      const rem = Math.ceil((need - (now - last)) / 1000);
      return interaction.editReply({
        content: `⏳ Подождите **${rem} сек.** перед повторным использованием`,
      }).catch(() => {});
    }
    useCooldowns.set(k, now);
  }

  if (cmdSettings.channelsMode === 'whitelist'
      && cmdSettings.channels.length
      && !cmdSettings.channels.includes(interaction.channelId)) {
    return interaction.editReply({ content: '⚠ Команда недоступна в этом канале' }).catch(() => {});
  }
  if (cmdSettings.channelsMode === 'blacklist'
      && cmdSettings.channels.includes(interaction.channelId)) {
    return interaction.editReply({ content: '⚠ Команда недоступна в этом канале' }).catch(() => {});
  }

  const memberRoles = new Set(interaction.member?.roles?.cache?.keys?.() ?? []);
  if (cmdSettings.requireRoles.length
      && !cmdSettings.requireRoles.some((r) => memberRoles.has(r))) {
    return interaction.editReply({ content: '⚠ У вас нет нужной роли для этой команды' }).catch(() => {});
  }
  if (cmdSettings.excludeRoles.length
      && cmdSettings.excludeRoles.some((r) => memberRoles.has(r))) {
    return interaction.editReply({ content: '⚠ Вам запрещено вызывать эту команду' }).catch(() => {});
  }

  let cfgResult = { enabled: false, config: {} };
  try {
    cfgResult = await fetchModuleConfig(botId, guildId);
  } catch (err) {
    logger.error({
      err,
      event: 'module_config_failed',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
    }, `${logScope}.handleCommand: getConfig failed`);
  }

  logger.info({
    event: 'builtin_command_received',
    log_scope: logScope,
    bot_id: botId,
    guild_id: guildId,
    user_id: userId,
    cmd,
    enabled: cfgResult.enabled,
    ephemeral,
    duration_ms: Date.now() - startedAt,
  }, `${logScope}.handleCommand: received`);

  if (!cfgResult.enabled) {
    logger.warn({
      event: 'module_disabled_but_command',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
      hint: 'Если ожидаемо (только что отключили) — игнорируйте.',
    }, `${logScope}.handleCommand: disabled in DB but proceeding`);
  }

  const ctx = {
    botId,
    guildId,
    config: cfgResult.config || {},
    interaction,
  };

  try {
    await dispatch(ctx);

    logger.debug({
      event: 'builtin_command_done',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
      duration_ms: Date.now() - startedAt,
    }, `${logScope}.handleCommand: done`);
  } catch (err) {
    if (isDeadInteraction(err)) {
      logger.warn({
        event: 'command_failed_dead',
        log_scope: logScope,
        bot_id: botId,
        guild_id: guildId,
        user_id: userId,
        cmd,
        err_code: err?.code || null,
        err_msg: err?.message || null,
        duration_ms: Date.now() - startedAt,
      }, `${logScope}.handleCommand: command failed — interaction dead`);
      return;
    }
    logger.error({
      err,
      event: 'command_failed',
      log_scope: logScope,
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
      cmd,
      duration_ms: Date.now() - startedAt,
    }, `${logScope}.handleCommand: command failed`);
    try {
      await interaction.editReply({
        content: '❌ Произошла ошибка при выполнении команды. Попробуйте позже.',
      });
    } catch (e) {
      logger.warn({
        err: e,
        event: 'fallback_edit_failed',
        log_scope: logScope,
        bot_id: botId,
        guild_id: guildId,
        user_id: userId,
        cmd,
      }, `${logScope}.handleCommand: fallback editReply failed`);
    }
  }
}