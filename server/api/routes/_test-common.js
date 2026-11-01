// server/api/routes/_test-common.js
// Общие помощники для test-роутов модулей и кастомных команд:
//   - разрешение канала и пользователя;
//   - отправка через Components V2 / embed / V2-с-fallback (с retry).

import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../core/v2-to-embed.js';
import { retryDiscord } from '../../core/retry.js';

export async function resolveTestChannel(inst, guildId, channelId) {
  if (!inst?.client?.isReady?.()) {
    const err = new Error('bot_offline');
    err.code = 'bot_offline';
    throw err;
  }

  const guild = inst.client.guilds.cache.get(guildId);
  if (!guild) {
    const err = new Error('invalid_channel');
    err.code = 'invalid_channel';
    throw err;
  }

  const channel = await inst.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || channel.guild.id !== guildId) {
    const err = new Error('invalid_channel');
    err.code = 'invalid_channel';
    throw err;
  }

  return { guild, channel };
}

export async function resolveTestUser(guild, user) {
  let displayName = user.username;
  let avatarUrl = '';
  try {
    const member = await guild.members.fetch(user.id);
    displayName = member.displayName || user.username;
    avatarUrl = member.user.displayAvatarURL?.({ size: 128 }) || '';
  } catch {
    if (user.avatar) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
  }
  return { displayName, avatarUrl };
}

export async function trySendV2(channel, cfgMsg, tokens, retryOpts = {}) {
  const components = buildComponentsFromConfig(cfgMsg, tokens);
  if (!components?.length) return null;

  return retryDiscord(
    () => channel.send({
      flags: FLAG_COMPONENTS_V2,
      components,
      allowedMentions: { parse: [] },
    }),
    {
      maxAttempts: 3,
      baseDelayMs: 800,
      maxDelayMs: 8000,
      label: 'test.sendV2',
      ...retryOpts,
    },
  );
}

export async function sendAsEmbed(channel, cfgMsg, tokens, retryOpts = {}) {
  const embed = v2ConfigToEmbed(cfgMsg, tokens);
  if (!embedHasContent(embed)) return null;

  return retryDiscord(
    () => channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    }),
    {
      maxAttempts: 3,
      baseDelayMs: 800,
      maxDelayMs: 8000,
      label: 'test.sendEmbed',
      ...retryOpts,
    },
  );
}

export async function sendV2OrEmbed(channel, cfgMsg, tokens, retryOpts = {}) {
  try {
    const v2msg = await trySendV2(channel, cfgMsg, tokens, retryOpts);
    if (v2msg) return { msg: v2msg, mode: 'v2' };
  } catch {
    // V2 отклонён — пробуем embed
  }

  const embedMsg = await sendAsEmbed(channel, cfgMsg, tokens, retryOpts);
  if (embedMsg) return { msg: embedMsg, mode: 'embed' };

  return null;
}