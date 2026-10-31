// server/core/logger.js
import pino from 'pino';
import { config } from '../config.js';

/**
 * Базовый логгер. Все записи содержат base-поля:
 *   service  — 'botpanel' (для агрегации логов из нескольких сервисов)
 *   env      — development | production
 *   version  — версия из package.json
 *   pid      — PID процесса (автоматически от pino)
 *   hostname — имя хоста (автоматически от pino)
 *
 * Формат записи (production, JSON):
 *   { level, time, pid, hostname, service, env, version, msg, ...context }
 *
 * В dev — pino-pretty с цветами.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: 'botpanel',
    env: config.NODE_ENV,
    version: process.env.npm_package_version || '2.1.0',
  },
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});