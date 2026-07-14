module.exports = function validateQuery(schema) {
  return function (req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', errors });
    }
    req.query = result.data;
    next();
  };
};
