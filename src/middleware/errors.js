/* ============================================================
   Глобальный обработчик ошибок Express.

   Различает:
   - ZodError       → 400 + список полей
   - err.status     → соответствующий код
   - всё остальное  → 500
   ============================================================ */

import { ZodError } from 'zod';

/**
 * Express error middleware (4 аргумента обязательны).
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
export function errorHandler(err, req, res, next) {
  console.error(`[${req.method} ${req.path}]`, err.message);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.publicMessage || err.message || 'Внутренняя ошибка'
  });
}