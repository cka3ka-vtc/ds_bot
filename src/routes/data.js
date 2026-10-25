/* ============================================================
   Универсальный CRUD по секциям.

   GET  /guilds/:id/data/:section  — прочитать
   PUT  /guilds/:id/data/:section  — сохранить

   На PUT:
   - валидирует по Zod-схеме соответствующей секции
   - пересчитывает nextRunAt для объявлений
   - сохраняет _pending для ДР, если фича включена
   - сбрасывает кэши и уведомляет SSE-клиентов
   ============================================================ */

import express from 'express';
import { readSection, writeSection, invalidateCache } from '../storage/index.js';
import { notifySectionUpdate } from '../services/sse-hub.js';
import { invalidateAutodeleteRules, invalidateCommandChannels } from '../discord/autodelete.js';
import { computeNextRun } from '../services/announcements.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  RulesSchema,
  MessagesSchema,
  AnnouncementsSchema,
  DelayedSchema,
  AutodeleteSchema,
  BirthdaysSchema,
  ProfilesSchema,
  SettingsSchema,
  SectionSchema
} from '../validation/schemas.js';

const router = express.Router();

/* Запись данных — не чаще 30 раз в минуту */
const writeLimiter = rateLimit({ windowMs: 60_000, max: 30 });

/* ============================================================
   GET
   ============================================================ */

router.get('/guilds/:id/data/:section', (req, res) => {
  res.json(readSection(req.params.id, req.params.section));
});

/* ============================================================
   PUT
   ============================================================ */

router.put('/guilds/:id/data/:section', writeLimiter, (req, res, next) => {
  try {
    const section = SectionSchema.parse(req.params.section);

    /* Очередь автоудаления — read-only через API */
    if (section === 'autodelete-queue') {
      throw Object.assign(
        new Error('Секция доступна только для чтения'),
        { status: 403 }
      );
    }

    let data = req.body;

    /* ---------- Валидация по схеме ---------- */
    if (section === 'rules')              data = RulesSchema.parse(data);
    else if (section === 'messages')      data = MessagesSchema.parse(data);
    else if (section === 'announcements') data = AnnouncementsSchema.parse(data);
    else if (section === 'delayed')       data = DelayedSchema.parse(data);
    else if (section === 'autodelete')    data = AutodeleteSchema.parse(data);
    else if (section === 'birthdays')     data = BirthdaysSchema.parse(data);
    else if (section === 'profiles')      data = ProfilesSchema.parse(data);
    else if (section === 'settings')      data = SettingsSchema.parse(data);

    /* ---------- Пост-обработка объявлений ---------- */
    if (section === 'announcements' && data.items) {
      for (const ann of data.items) {
        if (ann.enabled && ann.schedule.type !== 'manual') {
          if (!ann.nextRunAt || ann.nextRunAt < Date.now()) {
            ann.nextRunAt = computeNextRun(ann, Date.now());
          }
        } else {
          ann.nextRunAt = null;
        }
      }
    }

    /* ---------- Пост-обработка дней рождения ---------- */
    if (section === 'birthdays') {
      const existing = readSection(req.params.id, 'birthdays');
      const existingPending = existing?.settings?._pending || [];

      /* Отключаем pending того типа, который выключен в настройках */
      const keepRoles = data.settings.roleRemoveNextDay !== false;
      const keepMsgs = !!data.settings.autoDeleteMessage;

      data.settings._pending = existingPending.filter(p => {
        if (p.type === 'role-remove' && !keepRoles) return false;
        if (p.type === 'message-delete' && !keepMsgs) return false;
        return true;
      });

      /* lastRunDate не перезаписываем — иначе бот поздравит дважды */
      data.settings.lastRunDate = existing?.settings?.lastRunDate || null;
    }

    /* ---------- Запись и инвалидация ---------- */
    writeSection(req.params.id, section, data);

    if (section === 'autodelete') {
      invalidateAutodeleteRules(req.params.id);
    }
    if (section === 'birthdays' || section === 'profiles') {
      invalidateCommandChannels(req.params.id);
    }
    invalidateCache(req.params.id, section);

    notifySectionUpdate(req.params.id, section);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;