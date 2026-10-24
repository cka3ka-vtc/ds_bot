import { readSection, writeSection } from '../storage/index.js';
import { notifySectionUpdate } from '../services/events.js';
import crypto from 'crypto';

const MAX_LOGS = 500;

export function log(guildId, level, type, message, context = {}, stack = null) {
  try {
    const data = readSection(guildId, 'logs') || { items: [] };
    if (!data.items) data.items = [];
    data.items.unshift({
      id: 'log_' + crypto.randomBytes(6).toString('hex'),
      level,
      type,
      message: String(message).slice(0, 2000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      context,
      timestamp: new Date().toISOString()
    });
    if (data.items.length > MAX_LOGS) data.items.length = MAX_LOGS;
    writeSection(guildId, 'logs', data);
    notifySectionUpdate(guildId, 'logs');
  } catch (e) {
    console.error('logger.log failed:', e.message);
  }
}

export const logInfo  = (guildId, type, message, context = {}) => log(guildId, 'info',  type, message, context);
export const logWarn  = (guildId, type, message, context = {}) => log(guildId, 'warn',  type, message, context);
export const logError = (guildId, type, message, context = {}, stack = null) => log(guildId, 'error', type, message, context, stack);

export function clearLogs(guildId) {
  writeSection(guildId, 'logs', { items: [] });
  notifySectionUpdate(guildId, 'logs');
}

export function groupLogs(items) {
  const groups = {};
  for (const l of items) {
    if (!groups[l.type]) groups[l.type] = [];
    groups[l.type].push(l);
  }
  return Object.entries(groups)
    .map(([type, logs]) => ({
      type,
      count: logs.length,
      errorCount: logs.filter(l => l.level === 'error').length,
      warnCount: logs.filter(l => l.level === 'warn').length,
      lastAt: logs[0]?.timestamp,
      logs
    }))
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}