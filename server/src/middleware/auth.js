import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

/**
 * Authentication Middleware
 * Verifies JWT token and ensures account is active (not suspended/disabled)
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check account_status in database
    const userCheck = await pool.query(
      `SELECT account_status FROM users WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({ error: 'User does not exist' });
    }

    const { account_status } = userCheck.rows[0];
    if (account_status !== 'active') {
      return res.status(403).json({ error: `Account is ${account_status}. Please contact support.` });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default auth;
