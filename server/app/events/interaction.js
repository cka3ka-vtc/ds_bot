// server/app/events/interaction.js
import { EmbedBuilder } from 'discord.js';
import { BUILTIN_NAMES } from '../../../shared/builtin-commands.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { saveProfileThrottled, snapshotOf } from './helpers.js';

const CMD_COOLDOWNS = new Map();
const CMD_COOLDOWN_CLEANUP_INTERVAL = 10 * 60_000;
setInterval(() => {
  const cutoff = Date.now() - 24 * 3600_000;
  for (const [k, ts] of CMD_COOLDOWNS) {
    if (ts < cutoff) CMD_COOLDOWNS.delete(k);
  }
}, CMD_COOLDOWN_CLEANUP_INTERVAL).unref?.();

function checkCooldown(key, seconds) {
  if (!seconds) return 0;
  const now = Date.now();
  const last = CMD_COOLDOWNS.get(key) || 0;
  const elapsed = now - last;
  const need = seconds * 1000;
  if (elapsed < need) return Math.ceil((need - elapsed) / 1000);
  CMD_COOLDOWNS.set(key, now);
  return 0;
}

function resolveCommandTokens(text, tokens) {
  if (!text) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, key) => {
    return tokens[key] != null ? String(tokens[key]) : match;
  });
}

async function buildCustomCommandTokens(interaction) {
  const now = Math.floor(Date.now() / 1000);
  return {
    user: `<@${interaction.user.id}>`,
    mention: `<@${interaction.user.id}>`,
    username: interaction.user.username,
    displayName: interaction.member?.displayName || interaction.user.username,
    guild: interaction.guild.name,
    channel: `<#${interaction.channelId}>`,
    channelName: interaction.channel?.name || '',
    memberCount: interaction.guild.memberCount || 0,
    command: interaction.commandName,
    timestamp: `<t:${now}:R>`,
    date: `<t:${now}:D>`,
    time: `<t:${now}:t>`,
    dateFull: `<t:${now}:F>`,
  };
}

export async function onInteraction({ db, registry, logger, payload }) {
  const { botId, guildId, interaction } = payload;
  if (!guildId) return;
  if (!interaction?.isChatInputCommand?.()) return;
  if (interaction.user?.bot) return;

  // ── Диагностика на входе ──
  // Если здесь payload.botId ≠ interaction.client.user.id — это баг в instance.js,
  // но полезно видеть сразу. Если interaction.guildId ≠ payload.guildId — тоже.
  logger.info({
    event: 'interaction',
    cmd: interaction.commandName,
    payloadBotId: botId,
    clientBotId: interaction.client.user.id,
    payloadGuildId: guildId,
    interactionGuildId: interaction.guildId,
    applicationId: interaction.applicationId || null,
    userId: interaction.user?.id,
    isBuiltin: BUILTIN_NAMES.has(interaction.commandName),
  }, 'interaction: dispatch');

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

  /* ─── 1. Builtin ─── */
  if (BUILTIN_NAMES.has(interaction.commandName)) {
    const levelsMod = registry.get('levels');
    if (!levelsMod?.handleCommand) {
      logger.error({ cmd: interaction.commandName }, 'interaction: levels module has no handleCommand');
      try {
        await interaction.reply({
          content: '⚠ Команда временно недоступна',
          ephemeral: true,
        });
      } catch {}
      return;
    }
    try {
      // botId/guildId передаём явно — НЕ полагаемся на interaction.client.user.id.
      await levelsMod.handleCommand(interaction, { botId, guildId });
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

  /* ─── 2. Custom ─── */
  const customs = db.getCustomCommands(botId, guildId);
  const cmd = customs.find(
    (c) => c.enabled && c.name.toLowerCase() === interaction.commandName,
  );
  if (!cmd) return;

  const replyEphemeral = (msg) =>
    interaction.reply({ content: msg, ephemeral: true }).catch(() => {});

  const channelId = interaction.channelId;
  if (cmd.channelsMode === 'whitelist' && cmd.channels.length && !cmd.channels.includes(channelId)) {
    return replyEphemeral('⚠ Команда недоступна в этом канале');
  }
  if (cmd.channelsMode === 'blacklist' && cmd.channels.includes(channelId)) {
    return replyEphemeral('⚠ Команда недоступна в этом канале');
  }

  const memberRoles = new Set(interaction.member?.roles?.cache?.keys?.() ?? []);
  if (cmd.requireRoles.length && !cmd.requireRoles.some((r) => memberRoles.has(r))) {
    return replyEphemeral('⚠ У вас нет нужной роли для этой команды');
  }
  if (cmd.excludeRoles.length && cmd.excludeRoles.some((r) => memberRoles.has(r))) {
    return replyEphemeral('⚠ Вам запрещено вызывать эту команду');
  }

  const cdKey = `${guildId}:${interaction.user.id}:${cmd.name}`;
  const cdRemaining = checkCooldown(cdKey, cmd.cooldownSeconds);
  if (cdRemaining > 0) {
    return replyEphemeral(`⏳ Подождите ${cdRemaining} сек. перед следующим использованием`);
  }

  const tokens = await buildCustomCommandTokens(interaction);
  if (/\{count\}/.test(cmd.response || '')) {
    try { tokens.count = await getNonBotMemberCount(interaction.guild); }
    catch { tokens.count = tokens.memberCount; }
  }
  const resolvedResponse = resolveCommandTokens(cmd.response, tokens) || '✅ Команда выполнена';

  try {
    if (interaction.deferred || interaction.replied) return;

    if (cmd.responseMode === 'embed') {
      const embed = new EmbedBuilder()
        .setColor(cmd.responseEmbedColor || '#5865F2')
        .setDescription(resolvedResponse);
      await interaction.reply({
        embeds: [embed],
        ephemeral: cmd.ephemeral,
        allowedMentions: { parse: ['users'] },
      });
    } else {
      await interaction.reply({
        content: resolvedResponse,
        ephemeral: cmd.ephemeral,
        allowedMentions: { parse: ['users'] },
      });
    }

    try { db.incrementCommandUsage(botId, guildId, cmd.id); } catch {}
  } catch (err) {
    logger.warn({ err, command: interaction.commandName }, 'custom command reply failed');
  }
}