// server/app/events/interaction.js
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { BUILTIN_NAMES, getBuiltinCommand } from '../../../shared/builtin-commands.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../core/v2-to-embed.js';
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
    avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
    guild: interaction.guild.name,
    guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
    channel: `<#${interaction.channelId}>`,
    channelName: interaction.channel?.name || '',
    memberCount: interaction.guild.memberCount || 0,
    command: interaction.commandName,
    timestamp: `<t:${now}:R>`,
    date: `<t:${now}:D>`,
    time: `<t:${now}:t>`,
    dateFull: `<t:${now}:F>`,
    section: 'cmd',
  };
}

async function safeReply(interaction, content, opts = {}) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral, ...opts });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, ...opts });
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral, ...opts });
    }
  } catch {}
}

/**
 * Какой модуль обслуживает builtin-команду.
 *   levels      → rank, leaderboard, daily
 *   birthdays   → birthday_set, birthday_toggle, birthdays
 */
function moduleForBuiltin(name) {
  const meta = getBuiltinCommand(name);
  return meta?.moduleKey || null;
}

export async function onInteraction({ db, registry, logger, payload }) {
  const { botId, guildId, interaction } = payload;
  if (!guildId) return;
  if (!interaction?.isChatInputCommand?.()) return;
  if (interaction.user?.bot) return;

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
    replied: interaction.replied,
    deferred: interaction.deferred,
  }, 'interaction: dispatch');

  /* ═══════════════ 1. Builtin ═══════════════ */
  if (BUILTIN_NAMES.has(interaction.commandName)) {
    const moduleKey = moduleForBuiltin(interaction.commandName);
    const mod = moduleKey ? registry.get(moduleKey) : null;

    if (!mod || typeof mod.handleCommand !== 'function') {
      logger.error(
        {
          cmd: interaction.commandName,
          moduleKey,
          hasModule: !!mod,
          moduleHasHandle: !!mod?.handleCommand,
        },
        'interaction: module unavailable — check module load errors at startup',
      );
      await safeReply(interaction, '⚠ Команда временно недоступна');
      return;
    }

    if (interaction.replied || interaction.deferred) {
      logger.warn(
        { cmd: interaction.commandName, replied: interaction.replied, deferred: interaction.deferred },
        'interaction: builtin already acknowledged — skipping',
      );
      return;
    }

    try {
      await mod.handleCommand(interaction, { botId, guildId });
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, `${moduleKey}.handleCommand failed`);
      await safeReply(interaction, '❌ Ошибка');
    }

    // Побочные эффекты — fire-and-forget.
    setImmediate(() => {
      try {
        const snap = snapshotOf(interaction.member || interaction.user);
        db.addEvent({
          botId, guildId, userId: interaction.user.id, type: 'command',
          meta: { command: interaction.commandName, ...snap },
        });
        saveProfileThrottled(db, logger, { botId, guildId, userId: interaction.user.id, ...snap });
      } catch (err) {
        logger.warn({ err }, 'addEvent (builtin) failed');
      }

      if (typeof mod.awardCommandXp === 'function') {
        mod.awardCommandXp(interaction, { botId, guildId }).catch((err) => {
          logger.warn({ err, cmd: interaction.commandName }, 'awardCommandXp failed');
        });
      }
    });
    return;
  }

  /* ═══════════════ 2. Custom ═══════════════ */
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

  const customs = db.getCustomCommands(botId, guildId);
  const cmd = customs.find(
    (c) => c.enabled && c.name.toLowerCase() === interaction.commandName,
  );
  if (!cmd) return;

  if (interaction.replied || interaction.deferred) {
    logger.warn({ cmd: interaction.commandName }, 'interaction: custom already acknowledged — skipping');
    return;
  }

  const replyEphemeral = (msg) => safeReply(interaction, msg);

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

  const cfgObj = cmd.messageConfig || {};
  const hasBlocks = cfgObj && typeof cfgObj === 'object' &&
    (cfgObj.title || cfgObj.subtitle || (Array.isArray(cfgObj.blocks) && cfgObj.blocks.length));

  if (/\{count\}/.test(JSON.stringify(hasBlocks ? cfgObj : (cmd.response || '')))) {
    try { tokens.count = await getNonBotMemberCount(interaction.guild); }
    catch { tokens.count = tokens.memberCount; }
  } else {
    tokens.count = tokens.memberCount;
  }

  const replyFlags = cmd.ephemeral ? MessageFlags.Ephemeral : undefined;

  try {
    if (interaction.deferred || interaction.replied) return;

    if (hasBlocks) {
      let components = null;
      try {
        components = buildComponentsFromConfig(cfgObj, tokens);
      } catch (err) {
        logger.warn({ err, cmd: cmd.name }, 'custom command: buildComponents failed');
      }

      if (components?.length) {
        try {
          await interaction.reply({
            flags: replyFlags
              ? (FLAG_COMPONENTS_V2 | replyFlags)
              : FLAG_COMPONENTS_V2,
            components,
            allowedMentions: { parse: ['users'] },
          });
          try { db.incrementCommandUsage(botId, guildId, cmd.id); } catch {}
          return;
        } catch (err) {
          logger.warn({ err, cmd: cmd.name }, 'custom command: V2 reply failed, fallback to embed');
        }
      }

      const embed = v2ConfigToEmbed(cfgObj, tokens);
      if (embedHasContent(embed)) {
        await interaction.reply({
          embeds: [embed],
          ...(replyFlags ? { flags: replyFlags } : {}),
          allowedMentions: { parse: ['users'] },
        });
        try { db.incrementCommandUsage(botId, guildId, cmd.id); } catch {}
        return;
      }
    }

    const resolvedResponse = resolveCommandTokens(cmd.response, tokens) || '✅ Команда выполнена';

    if (cmd.responseMode === 'embed') {
      const embed = new EmbedBuilder()
        .setColor(cmd.responseEmbedColor || '#5865F2')
        .setDescription(resolvedResponse);
      await interaction.reply({
        embeds: [embed],
        ...(replyFlags ? { flags: replyFlags } : {}),
        allowedMentions: { parse: ['users'] },
      });
    } else {
      await interaction.reply({
        content: resolvedResponse,
        ...(replyFlags ? { flags: replyFlags } : {}),
        allowedMentions: { parse: ['users'] },
      });
    }

    try { db.incrementCommandUsage(botId, guildId, cmd.id); } catch {}
  } catch (err) {
    logger.warn({ err, command: interaction.commandName }, 'custom command reply failed');
    await safeReply(interaction, '❌ Не удалось отправить ответ');
  }
}