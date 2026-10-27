// server/api/validate.js
/**
 * Middleware валидации запроса через zod.
 * - тело запроса кладётся в req.body (распарсенный)
 * - query кладётся в req.validatedQuery (req.query в Express 4 мемоизирован)
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_failed',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query || {});
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_failed',
        details: result.error.flatten(),
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}