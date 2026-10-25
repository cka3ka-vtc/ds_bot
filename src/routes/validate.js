/* ============================================================
   Пробная валидация JSON без сохранения.

   Используется при импорте: клиент отправляет файл сюда,
   получает список ошибок (если есть) и показывает toast.

   POST /validate/:section  body = данные файла
   → { ok: true, errors: [] }
   → { ok: false, errors: [{ path, message }] }
   ============================================================ */

import express from 'express';
import {
  RulesSchema,
  MessagesSchema,
  AnnouncementsSchema,
  DelayedSchema,
  AutodeleteSchema,
  BirthdaysSchema,
  ProfilesSchema,
  SectionSchema
} from '../validation/schemas.js';

const router = express.Router();

/* Карта схем для валидации */
const SCHEMAS = {
  rules: RulesSchema,
  messages: MessagesSchema,
  announcements: AnnouncementsSchema,
  delayed: DelayedSchema,
  autodelete: AutodeleteSchema,
  birthdays: BirthdaysSchema,
  profiles: ProfilesSchema
};

router.post('/validate/:section', (req, res) => {
  try {
    const section = SectionSchema.parse(req.params.section);
    const schema = SCHEMAS[section];

    if (!schema) return res.json({ ok: true, errors: [] });

    const result = schema.safeParse(req.body);
    if (result.success) return res.json({ ok: true, errors: [] });

    res.json({
      ok: false,
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  } catch (e) {
    res.json({ ok: false, errors: [{ path: '', message: e.message }] });
  }
});

export default router;