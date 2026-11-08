import pool from '../db/pool.js';
import { USER_COLUMNS, JOIN_PROFILE, pairMatch } from '../db/sql.js';
import { parsePaging } from '../utils/params.js';

// :userId is validated by router.param in user.routes.js (req.otherId).

// My ($1) relationship to user u, from the friendships row for the pair (f)
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
const JOIN_PAIR = `LEFT JOIN friendships f ON ${pairMatch('$1::int', 'u.user_id')}`;

// ── GET /api/users?search=&limit= ──────────────────────────
// Find people by username or full name (case-insensitive substring).
export const searchUsers = async (req, res) => {
  const search = (req.query.search || '').trim();
  const { limit } = parsePaging(req.query, { defaultLimit: 20, maxLimit: 50 });
  if (!search) {
    return res.status(400).json({ error: 'search is required' });
  }

  // Escape LIKE wildcards so "%" or "_" in the input match literally
  const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const result = await pool.query(
    `SELECT ${USER_COLUMNS}, ${RELATIONSHIP}
     FROM users u
     ${JOIN_PROFILE}
     ${JOIN_PAIR}
     WHERE u.user_id <> $1
       AND (u.username ILIKE $2 OR up.full_name ILIKE $2)
     ORDER BY u.username
     LIMIT $3`,
    [req.user.user_id, pattern, limit]
  );
  return res.status(200).json({ users: result.rows });
};

// ── GET /api/users/:userId ─────────────────────────────────
// Public profile with activity stats, my relationship to them,
// and how many friends we share.
export const getUserProfile = async (req, res) => {
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
     ${JOIN_PROFILE}
     JOIN v_user_stats s ON s.user_id = u.user_id
     ${JOIN_PAIR}
     WHERE u.user_id = $2`,
    [req.user.user_id, req.otherId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(200).json({ user: result.rows[0] });
};
