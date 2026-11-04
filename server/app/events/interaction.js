// server/app/events/interaction.js
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { BUILTIN_NAMES, getBuiltinCommand } from '../../../shared/builtin-commands.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../core/v2-to-embed.js';
import { v2ConfigToMarkdown } from '../../core/v2-to-markdown.js';
import { saveProfileThrottled, snapshotOf } from './helpers.js';
import { getCachedCommands } from './helper-cache.js';
import {
  defaultRoleSuccessAddResponse,
  defaultRoleSuccessRemoveResponse,
  defaultRoleErrorResponse,
} from '../../../shared/role-button-responses.js';

const ROLE_BUTTON_RE = /^role_[a-z0-9]+_(\d+)_([a-z0-9_]+)$/i;

async function replyWithRoleResponse(interaction, cfgMsg, ctx) {
  const { roleName, roleMention, roleState, roleAction, fallbackText, edited } = ctx;

  const tokens = {
    user: `<@${interaction.user.id}>`,
    mention: `<@${interaction.user.id}>`,
    username: interaction.user.username,
    displayName: interaction.member?.displayName || interaction.user.username,
    avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
    guild: interaction.guild?.name || '',
    guildIconUrl: interaction.guild?.iconURL?.({ size: 128 }) || '',
    roleName, roleMention, roleState, roleAction,
    section: 'role-button-response',
  };

  if (cfgMsg && typeof cfgMsg === 'object') {
    try {
      const embed = v2ConfigToEmbed(cfgMsg, tokens);
      if (embedHasContent(embed)) {
        if (edited) {
          await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }
    } catch {}
  }

  if (edited) {
    await interaction.editReply({ content: fallbackText }).catch(() => {});
  } else {
    await interaction.reply({ content: fallbackText, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function handleRoleButton({ db, interaction, logger }) {
  const customId = interaction.customId || '';
  const match = customId.match(ROLE_BUTTON_RE);
  if (!match) return false;

  const roleId = match[1];
  const buttonId = match[2];
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({
      content: '⚠️ Кнопки-роли работают только на сервере',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return true;
  }

  const botId = interaction.client.user.id;
  let cfg = null;
  try { cfg = db.getRoleButtonConfig(botId, guild.id, buttonId); } catch {}

  const successAddCfg = cfg?.successAddResponse || defaultRoleSuccessAddResponse();
  const successRemoveCfg = cfg?.successRemoveResponse || defaultRoleSuccessRemoveResponse();
  const errorCfg = cfg?.errorResponse || defaultRoleErrorResponse();

  const role = guild.roles.cache.get(roleId)
    || await guild.roles.fetch(roleId).catch(() => null);

  if (!role) {
    await replyWithRoleResponse(interaction, errorCfg, {
      roleName: '—', roleMention: '—',
      roleState: '—', roleAction: '—',
      fallbackText: '❌ Роль не найдена — возможно, она была удалена',
      edited: false,
    });
    return true;
  }

  const me = guild.members.me;
  if (!me?.permissions?.has('ManageRoles')) {
    await replyWithRoleResponse(interaction, errorCfg, {
      roleName: role.name, roleMention: `<@&${role.id}>`,
      roleState: '—', roleAction: '—',
      fallbackText: '❌ У бота нет права «Управление ролями»',
      edited: false,
    });
    return true;
  }

  if (role.position >= me.roles.highest.position) {
    await replyWithRoleResponse(interaction, errorCfg, {
      roleName: role.name, roleMention: `<@&${role.id}>`,
      roleState: '—', roleAction: '—',
      fallbackText: '❌ Роль выше роли бота — выдать нельзя',
      edited: false,
    });
    return true;
  }

  const member = interaction.member;
  const hasRole = member.roles.cache.has(roleId);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    logger.warn({ err, buttonId }, 'role-button: deferReply failed');
    return true;
  }

  try {
    if (hasRole) {
      await member.roles.remove(roleId, 'Role-button из панели');
    } else {
      await member.roles.add(roleId, 'Role-button из панели');
    }
  } catch (err) {
    logger.warn(
      { err, guildId: guild.id, userId: interaction.user.id, roleId, buttonId },
      'role-button: toggle failed',
    );
    await replyWithRoleResponse(interaction, errorCfg, {
      roleName: role.name, roleMention: `<@&${role.id}>`,
      roleState: hasRole ? 'не снята' : 'не выдана',
      roleAction: hasRole ? 'попробовать снять' : 'попробовать выдать',
      fallbackText: '❌ Не удалось изменить роль',
      edited: true,
    });
    return true;
  }

  const chosenCfg = hasRole ? successRemoveCfg : successAddCfg;
  await replyWithRoleResponse(interaction, chosenCfg, {
    roleName: role.name, roleMention: `<@&${role.id}>`,
    roleState: hasRole ? 'снята' : 'выдана',
    roleAction: hasRole ? 'снята с тебя' : 'выдана тебе',
    fallbackText: hasRole
      ? `✅ Роль **${role.name}** снята`
      : `✅ Роль **${role.name}** выдана`,
    edited: true,
  });
  return true;
}

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

function moduleForBuiltin(name) {
  const meta = getBuiltinCommand(name);
  return meta?.moduleKey || null;
}

export async function onInteraction({ db, registry, logger, payload }) {
  const { botId, guildId, interaction } = payload;
  if (!guildId) return;

  if (interaction.isButton?.()) {
    const handled = await handleRoleButton({ db, interaction, logger });
    if (handled) return;
    return;
  }

  if (!interaction.isChatInputCommand?.()) return;
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

  if (BUILTIN_NAMES.has(interaction.commandName)) {
    const moduleKey = moduleForBuiltin(interaction.commandName);
    const mod = moduleKey ? registry.get(moduleKey) : null;

    if (!mod || typeof mod.handleCommand !== 'function') {
      logger.error(
        { cmd: interaction.commandName, moduleKey, hasModule: !!mod },
        'interaction: module unavailable',
      );
      await safeReply(interaction, '⚠️ Команда временно недоступна');
      return;
    }

    if (interaction.replied || interaction.deferred) {
      logger.warn({ cmd: interaction.commandName }, 'interaction: builtin already acknowledged — skipping');
      return;
    }

    try {
      await mod.handleCommand(interaction, { botId, guildId });
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, `${moduleKey}.handleCommand failed`);
      await safeReply(interaction, '❌ Ошибка');
    }

    setImmediate(() => {
      try {
        const snap = snapshotOf(interaction.member || interaction.user);
        db.addEvent({
          botId, guildId, userId: interaction.user.id, type: 'command',
          meta: {
            command: interaction.commandName,
            channelId: interaction.channelId,
            channelName: interaction.channel?.name || null,
            ...snap,
          },
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

  const snap = snapshotOf(interaction.member || interaction.user);
  try {
    db.addEvent({
      botId, guildId, userId: interaction.user.id, type: 'command',
      meta: {
        command: interaction.commandName,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || null,
        ...snap,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'addEvent command failed');
  }
  saveProfileThrottled(db, logger, { botId, guildId, userId: interaction.user.id, ...snap });

  const customs = getCachedCommands(db, botId, guildId);
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
    return replyEphemeral('⚠️ Команда недоступна в этом канале');
  }
  if (cmd.channelsMode === 'blacklist' && cmd.channels.includes(channelId)) {
    return replyEphemeral('⚠️ Команда недоступна в этом канале');
  }

  const memberRoles = new Set(interaction.member?.roles?.cache?.keys?.() ?? []);
  if (cmd.requireRoles.length && !cmd.requireRoles.some((r) => memberRoles.has(r))) {
    return replyEphemeral('⚠️ У вас нет нужной роли для этой команды');
  }
  if (cmd.excludeRoles.length && cmd.excludeRoles.some((r) => memberRoles.has(r))) {
    return replyEphemeral('⚠️ Вам запрещено использовать эту команду');
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
  const mode = cfgObj?.displayMode || 'context';

  try {
    if (interaction.deferred || interaction.replied) return;

    if (hasBlocks) {
      // 'context' — content markdown
      if (mode === 'context') {
        const markdown = v2ConfigToMarkdown(cfgObj, tokens);
        if (markdown.trim()) {
          try {
            await interaction.reply({
              content: markdown,
              ...(replyFlags ? { flags: replyFlags } : {}),
              allowedMentions: { parse: ['users'] },
            });
            try { db.incrementCommandUsage(botId, guildId, cmd.id); } catch {}
            return;
          } catch (err) {
            logger.warn({ err, cmd: cmd.name }, 'custom command: context reply failed, fallback to embed');
          }
        }
      }

      // V2 (flat / embed / embed-color)
      let components = null;
      try {
        components = buildComponentsFromConfig(cfgObj, tokens);
      } catch (err) {
        logger.warn({ err, cmd: cmd.name }, 'custom command: buildComponents failed');
      }

      if (components?.length) {
        try {
          await interaction.reply({
            flags: replyFlags ? (FLAG_COMPONENTS_V2 | replyFlags) : FLAG_COMPONENTS_V2,
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

    const resolvedResponse = resolveCommandTokens(cmd.response, tokens) || '⚙ Команда выполнилась';

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