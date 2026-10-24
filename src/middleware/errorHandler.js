import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  console.error(`[${req.method} ${req.path}]`, err.message);
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Внутренняя ошибка' });
}