/* ============================================================
   Комбайнер всех API-роутеров.

   Порядок монтирования важен:
   1. guildsRouter  — /bot-info, /guilds, /guilds/:id, SSE, backups
   2. dataRouter    — /guilds/:id/data/:section
   3. validateRouter — /validate/:section
   4. rules/messages/announcements/delayed — /guilds/:id/{section}/send
   5. membersReadRouter — /guilds/:id/birthdays/upcoming, /guilds/:id/profiles/:userId
   6. logsRouter    — /guilds/:id/logs
   7. commandsRouter — /guilds/:id/commands
   8. botsRouter    — /bots, /bots/:id, /bots/active, /bots/status, /bots/validate

   Внутри botsRouter специфичные пути (/bots/active) идут
   ДО параметризованных (/bots/:id) — иначе Express матчит
   /bots/active как бота с id='active'.
   ============================================================ */

import guildsRouter      from './guilds.js';
import dataRouter        from './data.js';
import validateRouter    from './validate.js';
import rulesRouter       from './rules.js';
import messagesRouter    from './messages.js';
import announcementsRouter from './announcements.js';
import delayedRouter     from './delayed.js';
import membersReadRouter from './members-read.js';
import logsRouter        from './logs.js';
import commandsRouter    from './commands.js';
import botsRouter        from './bots.js';

export default function registerRoutes(app) {
  app.use('/api', guildsRouter);
  app.use('/api', dataRouter);
  app.use('/api', validateRouter);
  app.use('/api', rulesRouter);
  app.use('/api', messagesRouter);
  app.use('/api', announcementsRouter);
  app.use('/api', delayedRouter);
  app.use('/api', membersReadRouter);
  app.use('/api', logsRouter);
  app.use('/api', commandsRouter);
  app.use('/api', botsRouter);

  /* Fallback для неизвестных /api/* путей */
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
}