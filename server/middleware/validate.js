module.exports = function validate(schema, source = 'body') {
  return function (req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const message = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', errors, message });
    }
    req[source] = result.data;
    next();
  };
};
