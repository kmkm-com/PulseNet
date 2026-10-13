import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware (The Bouncer)
 * Verifies JWT token from 'Authorization: Bearer <token>' header
 * Attaches decoded payload { user_id, username } to req.user
 */
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // req.user.user_id is canonical identity
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default auth;
