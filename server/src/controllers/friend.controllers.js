import pool from '../db/pool.js';
import { USER_COLUMNS, JOIN_PROFILE, pairMatch } from '../db/sql.js';
import { parsePaging } from '../utils/params.js';

// :userId is validated by router.param in friend.routes.js (req.otherId).
// Express 5 forwards errors thrown in async handlers to errorhandler.js.

// The friendships row (alias f) between me ($1) and the other user ($2)
const PAIR = pairMatch('$1::int', '$2::int');

const REMOVED_MESSAGE = {
  accepted: 'Friend removed',
  pending: 'Friend request cancelled',
  declined: 'Declined request cleared',
};

// ── GET /api/friends ───────────────────────────────────────
// Accepted friends of the logged-in user.
export const listFriends = async (req, res) => {
  const { limit, offset } = parsePaging(req.query, { defaultLimit: 50, maxLimit: 100 });
  const result = await pool.query(
    `SELECT ${USER_COLUMNS}, fp.friends_since
     FROM v_friend_pairs fp
     JOIN users u ON u.user_id = fp.friend_id
     ${JOIN_PROFILE}
     WHERE fp.user_id = $1
     ORDER BY u.username
     LIMIT $2 OFFSET $3`,
    [req.user.user_id, limit, offset]
  );
  return res.status(200).json({ friends: result.rows, limit, offset });
};

// ── GET /api/friends/suggestions?limit= ────────────────────
// Friends of my friends I am not connected to, most mutual friends first.
export const listSuggestions = async (req, res) => {
  const { limit } = parsePaging(req.query, { defaultLimit: 10, maxLimit: 50 });
  const result = await pool.query(
    `SELECT ${USER_COLUMNS}, s.mutual_friends
     FROM v_friend_suggestions s
     JOIN users u ON u.user_id = s.suggested_user_id
     ${JOIN_PROFILE}
     WHERE s.user_id = $1
     ORDER BY s.mutual_friends DESC, u.username
     LIMIT $2`,
    [req.user.user_id, limit]
  );
  return res.status(200).json({ suggestions: result.rows });
};

// ── GET /api/friends/requests?direction=incoming|outgoing ──
// Pending requests sent to me (incoming, default) or by me (outgoing).
export const listRequests = async (req, res) => {
  const direction = req.query.direction || 'incoming';
  if (!['incoming', 'outgoing'].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'incoming' or 'outgoing'" });
  }

  // incoming: I am the addressee, show the requester (and vice versa)
  const [mine, theirs] = direction === 'incoming'
    ? ['addressee_id', 'requester_id']
    : ['requester_id', 'addressee_id'];

  const result = await pool.query(
    `SELECT ${USER_COLUMNS}, f.created_at AS requested_at
     FROM friendships f
     JOIN users u ON u.user_id = f.${theirs}
     ${JOIN_PROFILE}
     WHERE f.${mine} = $1
       AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [req.user.user_id]
  );
  return res.status(200).json({ direction, requests: result.rows });
};

// ── POST /api/friends/requests/:userId ─────────────────────
// Send a friend request. A previously declined request may be re-sent
// (by either side): the old row is replaced with a fresh pending one,
// so the INSERT trigger notifies the addressee again.
export const sendRequest = async (req, res) => {
  const user_id = req.user.user_id;
  const other_id = req.otherId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the existing pair row (if any) so concurrent requests serialise
    const existing = await client.query(
      `SELECT requester_id, status FROM friendships f WHERE ${PAIR} FOR UPDATE`,
      [user_id, other_id]
    );
    const row = existing.rows[0];

    let conflict = null;
    if (row?.status === 'accepted') conflict = 'You are already friends';
    if (row?.status === 'pending') {
      conflict = row.requester_id === user_id
        ? 'Friend request already sent'
        : 'This user already sent you a request; accept it instead';
    }
    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: conflict });
    }

    if (row) { // declined: clear it so a new request can be made
      await client.query(`DELETE FROM friendships f WHERE ${PAIR}`, [user_id, other_id]);
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
    if (err.code === '23503') { // addressee_id FK: no such user
      return res.status(404).json({ error: 'User not found' });
    }
    throw err; // 23505 from a racing insert becomes 409 in errorhandler
  } finally {
    client.release();
  }
};

// ── PATCH /api/friends/requests/:userId ────────────────────
// Accept or decline a pending request that :userId sent to me.
// Body: { "action": "accept" | "decline" }
export const respondToRequest = async (req, res) => {
  const newStatus = { accept: 'accepted', decline: 'declined' }[req.body?.action];
  if (!newStatus) {
    return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
  }

  // Only the addressee can respond, and only while pending
  const result = await pool.query(
    `UPDATE friendships
     SET status = $1, responded_at = NOW()
     WHERE requester_id = $2
       AND addressee_id = $3
       AND status = 'pending'
     RETURNING requester_id, addressee_id, status, created_at, responded_at`,
    [newStatus, req.otherId, req.user.user_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No pending request from this user' });
  }
  return res.status(200).json({ friendship: result.rows[0] });
};

// ── DELETE /api/friends/:userId ────────────────────────────
// Unfriend (accepted), cancel my own pending request, or clear a declined one.
// A pending request sent TO me must be declined via PATCH, not deleted.
export const removeFriendship = async (req, res) => {
  const result = await pool.query(
    `DELETE FROM friendships f
     WHERE ${PAIR}
       AND (f.status <> 'pending' OR f.requester_id = $1)
     RETURNING f.status`,
    [req.user.user_id, req.otherId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No friendship or request to remove' });
  }
  return res.status(200).json({ message: REMOVED_MESSAGE[result.rows[0].status] });
};
