// server/api/app.js
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { authRouter } from './routes/auth.js';
import { botsRouter } from './routes/bots.js';
import { guildsRouter } from './routes/guilds.js';
import { modulesRouter } from './routes/modules.js';
import { moderationRouter } from './routes/moderation.js';
import { commandsRouter } from './routes/commands.js';
import { membersRouter } from './routes/members.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';
import { publicRouter } from './routes/public.js';

export function createApp({ db, botManager, registry, logger }) {
  const app = express();
  app.locals = { db, botManager, registry, logger };

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Public (без авторизации)
  app.use('/api/public', publicRouter());
  app.get('/api/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

  // Auth
  app.use('/auth', authRouter());

  // Authorized API
  app.use('/api/bots', botsRouter());
  app.use('/api/guilds', guildsRouter());
  app.use('/api/modules', modulesRouter());
  app.use('/api/moderation', moderationRouter());
  app.use('/api/commands', commandsRouter());
  app.use('/api/members', membersRouter());
  app.use('/api/guild-settings', settingsRouter());
  app.use('/api/stats', statsRouter());

  app.use(express.static(path.resolve('public')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((err, req, res, _next) => {
    logger.error({ err }, 'request error');
    res.status(500).json({ error: 'internal_error' });
  });
  return app;
}