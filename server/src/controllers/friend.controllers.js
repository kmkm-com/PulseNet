import pool from '../db/pool.js';

// ── helpers ────────────────────────────────────────────────

// Parses :userId and rejects bad ids / self-targeting.
// Returns the numeric id, or null after sending a 400 response.
const parseOtherUserId = (req, res) => {
  const other_id = Number(req.params.userId);
  if (!Number.isInteger(other_id) || other_id <= 0) {
    res.status(400).json({ error: 'Invalid user id' });
    return null;
  }
  if (other_id === req.user.user_id) {
    res.status(400).json({ error: 'You cannot target yourself' });
    return null;
  }
  return other_id;
};

// Matches the single row for a user pair regardless of direction.
// Written with LEAST/GREATEST so it can use the uq_friendship_pair index.
const PAIR_MATCH = `
  LEAST(requester_id, addressee_id)    = LEAST($1::int, $2::int)
  AND GREATEST(requester_id, addressee_id) = GREATEST($1::int, $2::int)
`;

// Public user columns returned alongside friendship rows.
const USER_COLUMNS = `u.user_id, u.username, up.full_name, up.avatar_url`;

// ── GET /api/friends ───────────────────────────────────────
// Accepted friends of the logged-in user.
export const listFriends = async (req, res, next) => {
  const user_id = req.user.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS}, f.responded_at AS friends_since
       FROM friendships f
       JOIN users u
         ON u.user_id = CASE WHEN f.requester_id = $1
                             THEN f.addressee_id
                             ELSE f.requester_id END
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       WHERE f.status = 'accepted'
         AND $1 IN (f.requester_id, f.addressee_id)
       ORDER BY u.username
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
    return res.status(200).json({ friends: result.rows, limit, offset });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/friends/requests?direction=incoming|outgoing ──
// Pending requests sent to me (incoming, default) or by me (outgoing).
export const listRequests = async (req, res, next) => {
  const user_id = req.user.user_id;
  const direction = req.query.direction || 'incoming';

  if (!['incoming', 'outgoing'].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'incoming' or 'outgoing'" });
  }

  // incoming: I am the addressee, show the requester (and vice versa)
  const [mine, theirs] = direction === 'incoming'
    ? ['addressee_id', 'requester_id']
    : ['requester_id', 'addressee_id'];

  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS}, f.created_at AS requested_at
       FROM friendships f
       JOIN users u ON u.user_id = f.${theirs}
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       WHERE f.${mine} = $1
         AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [user_id]
    );
    return res.status(200).json({ direction, requests: result.rows });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/friends/status/:userId ────────────────────────
// Relationship between me and another user, for profile buttons.
// status: none | friends | request_sent | request_received | declined
export const getFriendshipStatus = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  try {
    const result = await pool.query(
      `SELECT requester_id, status FROM friendships WHERE ${PAIR_MATCH}`,
      [user_id, other_id]
    );

    let status = 'none';
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (row.status === 'accepted') status = 'friends';
      else if (row.status === 'declined') status = 'declined';
      else status = row.requester_id === user_id ? 'request_sent' : 'request_received';
    }

    return res.status(200).json({ user_id: other_id, status });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/friends/requests/:userId ─────────────────────
// Send a friend request. A previously declined request may be re-sent
// (by either side): the old row is replaced with a fresh pending one.
export const sendRequest = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const target = await client.query(
      'SELECT 1 FROM users WHERE user_id = $1',
      [other_id]
    );
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Lock the existing pair row (if any) so concurrent requests serialise
    const existing = await client.query(
      `SELECT requester_id, status FROM friendships WHERE ${PAIR_MATCH} FOR UPDATE`,
      [user_id, other_id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'accepted') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'You are already friends' });
      }
      if (row.status === 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: row.requester_id === user_id
            ? 'Friend request already sent'
            : 'This user already sent you a request; accept it instead',
        });
      }
      // declined: clear it so a new request can be made
      await client.query(`DELETE FROM friendships WHERE ${PAIR_MATCH}`, [user_id, other_id]);
    }

    const result = await client.query(
      `INSERT INTO friendships (requester_id, addressee_id)
       VALUES ($1, $2)
       RETURNING requester_id, addressee_id, status, created_at`,
      [user_id, other_id]
    );

    await client.query('COMMIT');
    return res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err); // 23505 from a racing insert becomes 409 in errorhandler
  } finally {
    client.release();
  }
};

// ── PATCH /api/friends/requests/:userId ────────────────────
// Accept or decline a pending request that :userId sent to me.
// Body: { "action": "accept" | "decline" }
export const respondToRequest = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  const { action } = req.body ?? {};
  const newStatus = { accept: 'accepted', decline: 'declined' }[action];
  if (!newStatus) {
    return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
  }

  try {
    // Only the addressee can respond, and only while pending
    const result = await pool.query(
      `UPDATE friendships
       SET status = $1, responded_at = NOW()
       WHERE requester_id = $2
         AND addressee_id = $3
         AND status = 'pending'
       RETURNING requester_id, addressee_id, status, created_at, responded_at`,
      [newStatus, other_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pending request from this user' });
    }

    return res.status(200).json({ friendship: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/friends/:userId ────────────────────────────
// Unfriend (accepted), cancel my own pending request, or clear a declined one.
// A pending request sent TO me must be declined via PATCH, not deleted.
export const removeFriendship = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  try {
    const result = await pool.query(
      `DELETE FROM friendships
       WHERE ${PAIR_MATCH}
         AND (status <> 'pending' OR requester_id = $1)
       RETURNING status`,
      [user_id, other_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No friendship or request to remove' });
    }

    const messages = {
      accepted: 'Friend removed',
      pending: 'Friend request cancelled',
      declined: 'Declined request cleared',
    };
    return res.status(200).json({ message: messages[result.rows[0].status] });
  } catch (err) {
    next(err);
  }
};
