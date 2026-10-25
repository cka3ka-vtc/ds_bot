/* ============================================================
   Конфиг slash-команд (настройки на уровне гильдии).

   Хранит:
   - enabled        — включена ли команда (скрывается из Discord при false)
   - cooldownSec    — задержка между вызовами
   - allowedRoleIds — роли, которым разрешено вызывать
   - descriptionOverride — кастомное описание (для UI)

   Хранится в data/<guildId>/command-config.json.
   Для глобальных настроек используется псевдо-guildId '__global__'.
   ============================================================ */

import { readSection, writeSection } from '../storage/index.js';
import { notifySectionUpdate } from '../services/sse-hub.js';

const SECTION = 'command-config';

/* Кэш cooldown'ов в памяти: `${guildId}:${commandName}:${userId}` → timestamp */
const cooldowns = new Map();

/* ============================================================
   Чтение / запись
   ============================================================ */

function defaults() {
  return { items: {} };
}

/**
 * Возвращает весь конфиг команд гильдии.
 * @param {string} guildId
 * @returns {{ items: object }}
 */
export function getConfig(guildId) {
  return readSection(guildId, SECTION) || defaults();
}

/**
 * Возвращает настройки одной команды.
 * @param {string} guildId
 * @param {string} commandName
 * @returns {{ enabled: boolean, cooldownSec: number, allowedRoleIds: string[], descriptionOverride: string|null }}
 */
export function getCommandConfig(guildId, commandName) {
  const cfg = getConfig(guildId);
  return cfg.items[commandName] || {
    enabled: true,
    cooldownSec: 0,
    allowedRoleIds: [],
    descriptionOverride: null
  };
}

/**
 * Обновляет настройки команды (мержит с текущими).
 * @param {string} guildId
 * @param {string} commandName
 * @param {object} patch
 * @returns {object} обновлённый конфиг
 */
export function setCommandConfig(guildId, commandName, patch) {
  const cfg = getConfig(guildId);
  const current = cfg.items[commandName] || {};
  cfg.items[commandName] = { ...current, ...patch };

  writeSection(guildId, SECTION, cfg);
  notifySectionUpdate(guildId, SECTION);

  return cfg.items[commandName];
}

/* ============================================================
   Проверки при вызове
   ============================================================ */

/**
 * Включена ли команда на этом сервере.
 * @param {string} guildId
 * @param {string} commandName
 * @returns {boolean}
 */
export function isEnabled(guildId, commandName) {
  return getCommandConfig(guildId, commandName).enabled !== false;
}

/**
 * Проверяет cooldown. При успехе — обновляет timestamp.
 * @param {string} guildId
 * @param {string} commandName
 * @param {string} userId
 * @returns {{ ok: true } | { ok: false, remainingSec: number }}
 */
export function checkCooldown(guildId, commandName, userId) {
  const cfg = getCommandConfig(guildId, commandName);
  const cooldownSec = cfg.cooldownSec || 0;
  if (cooldownSec <= 0) return { ok: true };

  const key = `${guildId}:${commandName}:${userId}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  const remaining = cooldownSec * 1000 - (now - last);

  if (remaining > 0) {
    return { ok: false, remainingSec: Math.ceil(remaining / 1000) };
  }

  cooldowns.set(key, now);
  return { ok: true };
}

/**
 * Проверяет права по ролям.
 * @param {string} guildId
 * @param {string} commandName
 * @param {import('discord.js').GuildMember|null} member
 * @returns {{ ok: true } | { ok: false, reason: 'no_role'|'no_member' }}
 */
export function checkPermissions(guildId, commandName, member) {
  const cfg = getCommandConfig(guildId, commandName);
  const allowed = cfg.allowedRoleIds || [];
  if (!allowed.length) return { ok: true };

  if (!member) return { ok: false, reason: 'no_member' };

  const has = allowed.some(rid => member.roles.cache.has(rid));
  return has ? { ok: true } : { ok: false, reason: 'no_role' };
}

/* ============================================================
   Периодическая очистка cooldown-кэша
   ============================================================ */

/* Раз в 10 минут удаляем старые записи, чтобы Map не разрастался */
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of cooldowns) {
    if (now - ts > 3600_000) cooldowns.delete(key);
  }
}, 10 * 60_000).unref();