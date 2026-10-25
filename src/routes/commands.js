/* ============================================================
   Управление slash-командами на уровне гильдии.

   GET  /guilds/:id/commands        — список команд с настройками
   PUT  /guilds/:id/commands/:name  — обновить настройки одной

   Клиент (public/js/sections/commands.js) читает через GET,
   сохраняет через PUT (по одному запросу на команду).
   ============================================================ */

import express from 'express';
import { z } from 'zod';
import { getConfig, setCommandConfig } from '../discord/command-config.js';

const router = express.Router();

/* ============================================================
   Реестр команд — синхронизирован с discord/commands/index.js
   ============================================================ */

const AVAILABLE_COMMANDS = [
  { name: 'hb',      description: 'Управление днём рождения' },
  { name: 'profile', description: 'Показать профиль' },
  { name: 'vtc',     description: 'Установить VTC в профиле' },
  { name: 'steam',   description: 'Установить Steam в профиле' },
  { name: 'hmp',     description: 'Установить HaulMP в профиле' },
  { name: 'tmp',     description: 'Установить TruckersMP в профиле' },
  { name: 'company', description: 'Дата вступления в компанию' }
];

/* ============================================================
   Чтение
   ============================================================ */

router.get('/guilds/:id/commands', (req, res) => {
  const cfg = getConfig(req.params.id);

  res.json(AVAILABLE_COMMANDS.map(c => ({
    ...c,
    config: cfg.items[c.name] || {
      enabled: true,
      cooldownSec: 0,
      allowedRoleIds: []
    }
  })));
});

/* ============================================================
   Обновление
   ============================================================ */

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  cooldownSec: z.number().int().min(0).max(3600).optional(),
  allowedRoleIds: z.array(z.string()).optional()
});

router.put('/guilds/:id/commands/:name', (req, res, next) => {
  try {
    const body = UpdateSchema.parse(req.body);
    const updated = setCommandConfig(req.params.id, req.params.name, body);
    res.json({ ok: true, config: updated });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

export default router;