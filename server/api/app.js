// server/api/app.js
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { authRouter } from './routes/auth.js';
import { botsRouter } from './routes/bots.js';
import { guildsRouter } from './routes/guilds.js';
import { guildsDebugRouter } from './routes/guilds-debug.js';
import { modulesRouter } from './routes/modules.js';
import { moderationRouter } from './routes/moderation.js';
import { commandsRouter } from './routes/commands.js';
import { membersRouter } from './routes/members.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';
import { statsMembersRouter } from './routes/stats-members.js';
import { publicRouter } from './routes/public.js';
import { levelsRouter } from './routes/levels.js';
import { previewRouter } from './routes/preview.js';
import { originCheck } from './middleware/origin-check.js';
import { generalApiLimiter, authLimiter, addBotLimiter } from './middleware/rate-limit.js';

export function createApp({ db, botManager, registry, logger }) {
  const app = express();
  app.locals = { db, botManager, registry, logger };

  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'https://cdn.discordapp.com', 'https://media.discordapp.net', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', generalApiLimiter);
  app.use('/shared', express.static(path.resolve('shared')));

  app.use('/api/public', publicRouter());

  app.get('/api/health', (req, res) => {
    const checks = { db: false, bots: { total: 0, online: 0 } };
    try { req.app.locals.db.raw.prepare('SELECT 1').get(); checks.db = true; } catch {}

    const allBots = req.app.locals.botManager.all();
    checks.bots.total = allBots.length;
    checks.bots.online = allBots.filter((b) => b.client?.isReady()).length;

    const ok = checks.db;
    res.status(ok ? 200 : 503).json({
      ok,
      uptime: process.uptime(),
      checks,
      version: process.env.npm_package_version || '2.1.0',
    });
  });

  app.use('/auth', authLimiter, authRouter());
  app.use(originCheck());

  app.use('/api/guilds/debug', guildsDebugRouter());

  app.use('/api/bots', addBotLimiter, botsRouter());
  app.use('/api/guilds', guildsRouter());
  app.use('/api/modules', modulesRouter());
  app.use('/api/moderation', moderationRouter());
  app.use('/api/commands', commandsRouter());
  app.use('/api/members', membersRouter());
  app.use('/api/guild-settings', settingsRouter());

  app.use('/api/preview', previewRouter());

  app.use('/api/stats/members', statsMembersRouter());
  app.use('/api/stats', statsRouter());

  app.use('/api/levels', levelsRouter());

  app.use(express.static(path.resolve('public')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((err, req, res, _next) => {
    logger.error({ err, reqId: req.id }, 'request error');
    res.status(500).json({ error: 'internal_error', requestId: req.id });
  });

  return app;
}