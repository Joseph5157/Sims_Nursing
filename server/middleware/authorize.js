module.exports = function authorize(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
};
