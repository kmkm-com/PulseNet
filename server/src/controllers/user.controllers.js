import pool from '../db/pool.js';

// My relationship to user u, computed from the single friendships row
// for the pair (joined as f). $1 must be the logged-in user's id.
const RELATIONSHIP = `
  CASE
    WHEN u.user_id = $1          THEN 'self'
    WHEN f.status IS NULL        THEN 'none'
    WHEN f.status = 'accepted'   THEN 'friends'
    WHEN f.status = 'declined'   THEN 'declined'
    WHEN f.requester_id = $1     THEN 'request_sent'
    ELSE 'request_received'
  END AS relationship
`;

const JOIN_PAIR = `
  LEFT JOIN friendships f
    ON LEAST(f.requester_id, f.addressee_id)    = LEAST($1::int, u.user_id)
   AND GREATEST(f.requester_id, f.addressee_id) = GREATEST($1::int, u.user_id)
`;

// ── GET /api/users?search=&limit= ──────────────────────────
// Find people by username or full name (case-insensitive substring).
export const searchUsers = async (req, res, next) => {
  const user_id = req.user.user_id;
  const search = (req.query.search || '').trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  if (search.length < 1) {
    return res.status(400).json({ error: 'search is required' });
  }

  // Escape LIKE wildcards so "%" or "_" in the input match literally
  const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.username, up.full_name, up.avatar_url, ${RELATIONSHIP}
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       ${JOIN_PAIR}
       WHERE u.user_id <> $1
         AND (u.username ILIKE $2 OR up.full_name ILIKE $2)
       ORDER BY u.username
       LIMIT $3`,
      [user_id, pattern, limit]
    );
    return res.status(200).json({ users: result.rows });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/:userId ─────────────────────────────────
// Public profile with activity stats, my relationship to them,
// and how many friends we share.
export const getUserProfile = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = Number(req.params.userId);
  if (!Number.isInteger(other_id) || other_id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.created_at AS joined_at,
              up.full_name, up.bio, up.location, up.avatar_url,
              s.friend_count, s.post_count, s.likes_received, s.group_count,
              ${RELATIONSHIP},
              (SELECT COUNT(*)::int
                 FROM v_friend_pairs a
                 JOIN v_friend_pairs b ON b.friend_id = a.friend_id
                WHERE a.user_id = $1 AND b.user_id = u.user_id
                  AND u.user_id <> $1) AS mutual_friends
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       JOIN v_user_stats s ON s.user_id = u.user_id
       ${JOIN_PAIR}
       WHERE u.user_id = $2`,
      [user_id, other_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
