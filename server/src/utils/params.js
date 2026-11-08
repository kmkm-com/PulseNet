// Shared request parsing for controllers and routers.

// Positive integer or null
export const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// router.param handler for :userId. Validates the id once per request and
// stores it as req.otherId, so handlers never parse it themselves.
// Use after router.use(auth) so req.user is set.
export const userIdParam = ({ selfMessage } = {}) => (req, res, next, value) => {
  const id = toPositiveInt(value);
  if (id === null) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (selfMessage && id === req.user.user_id) {
    return res.status(400).json({ error: selfMessage });
  }
  req.otherId = id;
  next();
};

// router.param handler for a numeric :id, stored as req.idParam
export const idParam = (label) => (req, res, next, value) => {
  const id = toPositiveInt(value);
  if (id === null) {
    return res.status(400).json({ error: `Invalid ${label} id` });
  }
  req.idParam = id;
  next();
};

// ?limit=&offset= with a per-endpoint default and cap; offset never negative
export const parsePaging = (query, { defaultLimit, maxLimit }) => ({
  limit: Math.min(toPositiveInt(query.limit) ?? defaultLimit, maxLimit),
  offset: Math.max(parseInt(query.offset) || 0, 0),
});
