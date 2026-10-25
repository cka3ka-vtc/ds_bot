/* ============================================================
   Только-чтение по участникам.

   GET /guilds/:id/birthdays/upcoming?days=N
     → ближайшие ДР на N дней (по умолчанию 30)
   GET /guilds/:id/profiles/:userId
     → запись профиля одного пользователя (или 404)

   Объединяет бывшие routes/birthdays.js и routes/profiles.js.
   ============================================================ */

import express from 'express';
import { readSection } from '../storage/index.js';

const router = express.Router();

/* ============================================================
   Ближайшие ДР
   ============================================================ */

router.get('/guilds/:id/birthdays/upcoming', (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
  const data = readSection(req.params.id, 'birthdays') || { users: [] };
  const now = new Date();
  const list = [];

  /* Проходим по каждому дню в диапазоне и ищем именинников */
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const day = d.getDate();
    const month = d.getMonth() + 1;

    for (const u of (data.users || [])) {
      if (u.day === day && u.month === month && u.enabled !== false) {
        list.push({ ...u, inDays: i });
      }
    }
  }

  res.json(list);
});

/* ============================================================
   Профиль одного пользователя
   ============================================================ */

router.get('/guilds/:id/profiles/:userId', (req, res) => {
  const data = readSection(req.params.id, 'birthdays') || { users: [] };
  const entry = (data.users || []).find(u => u.userId === req.params.userId);

  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

export default router;