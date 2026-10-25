/* ============================================================
   Логи гильдии.

   GET  /guilds/:id/logs        — все записи + группировка
   POST /guilds/:id/logs/clear  — очистить
   ============================================================ */

import express from 'express';
import { readSection } from '../storage/index.js';
import { clearLogs, groupLogs, logInfo } from '../services/guild-logger.js';

const router = express.Router();

router.get('/guilds/:id/logs', (req, res) => {
  const data = readSection(req.params.id, 'logs') || { items: [] };

  res.json({
    items: data.items || [],
    groups: groupLogs(data.items || [])
  });
});

router.post('/guilds/:id/logs/clear', (req, res) => {
  clearLogs(req.params.id);
  logInfo(req.params.id, 'logs_clear', 'Логи очищены');
  res.json({ ok: true });
});

export default router;