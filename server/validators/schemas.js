// server/validators/schemas.js
import { z } from 'zod';

/* -------- Базовые примитивы -------- */
const discordId = z.string().regex(/^\d{5,32}$/, 'invalid_discord_id');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid_hex_color');

/* -------- Query-схемы -------- */
export const botGuildQuery = z.object({
  botId: discordId,
  guildId: discordId,
});

export const botQuery = z.object({
  botId: discordId,
});

export const botGuildOptionalQuery = z.object({
  botId: discordId,
  guildId: discordId.optional(),
});

export const commandsCheckQuery = z.object({
  botId: discordId,
  guildId: discordId,
  name: z.string().min(1).max(32),
  excludeId: z.string().optional(),
});

export const modActionsQuery = z.object({
  botId: discordId,
  guildId: discordId,
  kind: z.enum(['warn', 'mute', 'ban', 'auto']).optional(),
});

export const membersListQuery = z.object({
  botId: discordId,
  guildId: discordId,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(100).optional().default(''),
  roleId: discordId.optional(),
  status: z.enum(['all', 'active', 'left']).default('all'),
});

/* -------- Body-схемы -------- */
export const addBotBody = z.object({
  token: z.string().min(20, 'Токен слишком короткий').max(200),
});

/* ---------- Пользовательские команды ---------- */

const channelsModeEnum = z.enum(['all', 'whitelist', 'blacklist']);
const responseModeEnum = z.enum(['text', 'embed']);

const commandSettingsFields = {
  channelsMode: channelsModeEnum.optional(),
  channels: z.array(discordId).max(50).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  requireRoles: z.array(discordId).max(20).optional(),
  excludeRoles: z.array(discordId).max(20).optional(),
  ephemeral: z.boolean().optional(),
  responseMode: responseModeEnum.optional(),
  responseEmbedColor: hexColor.optional(),
};

export const commandCreateBody = z.object({
  botId: discordId,
  guildId: discordId,
  name: z.string().min(2).max(32),
  description: z.string().max(100).optional().default(''),
  response: z.string().max(2000).optional().default(''),
  channelsMode: channelsModeEnum.optional().default('all'),
  channels: z.array(discordId).max(50).optional().default([]),
  cooldownSeconds: z.number().int().min(0).max(86400).optional().default(0),
  requireRoles: z.array(discordId).max(20).optional().default([]),
  excludeRoles: z.array(discordId).max(20).optional().default([]),
  ephemeral: z.boolean().optional().default(false),
  responseMode: responseModeEnum.optional().default('text'),
  responseEmbedColor: hexColor.optional().default('#5865F2'),
  messageConfig: z.record(z.any()).optional(),
});

export const commandUpdateBody = z.object({
  botId: discordId,
  guildId: discordId,
  name: z.string().min(2).max(32).optional(),
  description: z.string().max(100).optional(),
  response: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  ...commandSettingsFields,
  messageConfig: z.record(z.any()).optional(),
});

export const commandToggleBody = z.object({
  botId: discordId,
  guildId: discordId,
  enabled: z.boolean(),
});

export const commandTestBody = z.object({
  botId: discordId,
  guildId: discordId,
  channelId: discordId,
});

/* ---------- Встроенные команды ---------- */

export const builtinCommandUpdateBody = z.object({
  botId: discordId,
  guildId: discordId,
  enabled: z.boolean().optional(),
  description: z.string().max(100).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  channelsMode: channelsModeEnum.optional(),
  channels: z.array(discordId).max(50).optional(),
  requireRoles: z.array(discordId).max(20).optional(),
  excludeRoles: z.array(discordId).max(20).optional(),
  ephemeral: z.boolean().optional(),
});

/* ---------- Участники ---------- */
export const memberUpdateBody = z.object({
  botId: discordId,
  guildId: discordId,
  level: z.number().int().min(0).max(1000).optional(),
  warnings: z.number().int().min(0).max(1000).optional(),
  nickname: z.string().max(32).nullable().optional(),
  roles: z.array(discordId).max(500).optional(),
});

/* ---------- Модерация ---------- */
export const modActionCreateBody = z.object({
  botId: discordId,
  guildId: discordId,
  userId: discordId,
  kind: z.enum(['warn', 'mute', 'ban', 'auto']),
  reason: z.string().max(500).optional().default(''),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 365).nullable().optional(),
});

/* ---------- Модули ---------- */
export const moduleToggleBody = z.object({
  botId: discordId,
  guildId: discordId,
  enabled: z.boolean(),
});

const blockType = z.enum([
  'text', 'sections', 'separator', 'image', 'images',
  'file', 'buttons', 'footer',
]);

const messageBlockSchema = z.object({
  id: z.string().min(1).max(64),
  type: blockType,
  content: z.string().max(4000).optional(),
  title: z.string().max(200).optional(),
  listStyle: z.enum(['numeric', 'dot']).optional(),
  items: z.array(z.string().max(500)).max(50).optional(),
  url: z.string().max(2000).optional(),
  urls: z.array(z.string().max(2000)).max(10).optional(),
  spacing: z.union([z.literal(1), z.literal(2)]).optional(),
  divider: z.boolean().optional(),
  buttons: z.array(z.object({
    id: z.string().min(1).max(64),
    label: z.string().max(80).optional(),
    url: z.string().max(500).optional(),
    style: z.enum(['primary', 'secondary', 'success', 'danger']).optional(),
    roleId: z.string().optional(),
    emoji: z.string().max(100).optional(),
  })).max(5).optional(),
}).passthrough();

const messageConfigSchema = z.object({
  displayMode: z.enum(['flat', 'embed', 'embed-color']).optional(),
  accentColor: hexColor.optional(),
  title: z.string().max(4000).optional(),
  subtitle: z.string().max(4000).optional(),
  thumbnail: z.string().max(2000).optional(),
  blocks: z.array(messageBlockSchema).max(40).optional(),
}).passthrough();

export const moduleConfigBody = z.object({
  botId: discordId,
  guildId: discordId,
  config: z.record(z.any()),
});

export const greetingsTestBody = z.object({
  botId: discordId,
  guildId: discordId,
  which: z.enum(['join', 'leave']),
  channelId: discordId.optional(),
  messageConfig: messageConfigSchema,
});

/**
 * Тест levels.
 * `which` — какой таб тестируется:
 *   - levelUp → отправится Components V2 (как реальный анонс)
 *   - rank/leaderboard/daily → отправится embed (как реальные команды)
 */
export const levelsTestBody = z.object({
  botId: discordId,
  guildId: discordId,
  channelId: discordId,
  messageConfig: messageConfigSchema,
  which: z.enum(['levelUp', 'rank', 'leaderboard', 'daily']).optional().default('daily'),
});

/**
 * Тест birthdays.
 * `which` — какой таб тестируется:
 *   - announce (анонс в канал) → Components V2 (как реальное поздравление)
 *   - cmdSet / cmdToggle / cmdList → embed (как реальные команды)
 */
export const birthdaysTestBody = z.object({
  botId: discordId,
  guildId: discordId,
  channelId: discordId,
  messageConfig: messageConfigSchema,
  which: z.enum(['announce', 'cmdSet', 'cmdToggle', 'cmdList']).optional().default('announce'),
});

/* -------- Публичные хелперы -------- */
export const guildSettingsBody = z.object({
  botId: discordId,
  guildId: discordId,
});

export { messageConfigSchema, messageBlockSchema, discordId, hexColor };