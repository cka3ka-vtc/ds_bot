// server/validators/schemas.js
import { z } from 'zod';

/* -------- Query-схемы -------- */
export const botGuildQuery = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
});

export const botQuery = z.object({
  botId: z.string().min(1),
});

export const botGuildOptionalQuery = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1).optional(),
});

export const commandsCheckQuery = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  name: z.string().min(1),
  excludeId: z.string().optional(),
});

export const modActionsQuery = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  kind: z.enum(['warn', 'mute', 'ban', 'auto']).optional(),
});

/* -------- Body-схемы -------- */
export const addBotBody = z.object({
  token: z.string().min(20, 'Токен слишком короткий'),
});

export const commandCreateBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  name: z.string().min(2).max(32),
  description: z.string().max(100).optional().default(''),
  response: z.string().max(2000).optional().default(''),
});

export const commandUpdateBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  name: z.string().min(2).max(32).optional(),
  description: z.string().max(100).optional(),
  response: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
});

export const commandToggleBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  enabled: z.boolean(),
});

export const memberUpdateBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  level: z.number().int().min(0).optional(),
  warnings: z.number().int().min(0).optional(),
});

export const modActionCreateBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  userId: z.string().min(1),
  kind: z.enum(['warn', 'mute', 'ban', 'auto']),
  reason: z.string().max(500).optional().default(''),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 365).nullable().optional(),
});

export const moduleToggleBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  enabled: z.boolean(),
});

export const moduleConfigBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  config: z.record(z.any()),
});

export const guildSettingsBody = z.object({
  botId: z.string().min(1),
  guildId: z.string().min(1),
  language: z.enum(['ru', 'en']).optional().default('ru'),
  welcomeChannel: z.string().nullable().optional(),
  logChannel: z.string().nullable().optional(),
  excludedRoles: z.array(z.string()).optional().default([]),
});