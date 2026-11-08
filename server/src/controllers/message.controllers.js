import pool from '../db/pool.js';

const MAX_MESSAGE_LENGTH = 2000;

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
    res.status(400).json({ error: 'You cannot message yourself' });
    return null;
  }
  return other_id;
};

const userExists = async (user_id) => {
  const result = await pool.query('SELECT 1 FROM users WHERE user_id = $1', [user_id]);
  return result.rows.length > 0;
};

// ── GET /api/messages ──────────────────────────────────────
// Inbox: one row per conversation partner with the latest message
// and how many of their messages I have not read yet.
export const listConversations = async (req, res, next) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `WITH my_messages AS (
         SELECT dm.*,
                CASE WHEN dm.sender_id = $1 THEN dm.recipient_id
                     ELSE dm.sender_id END AS partner_id
         FROM direct_messages dm
         WHERE dm.sender_id = $1 OR dm.recipient_id = $1
       ),
       latest AS (
         SELECT DISTINCT ON (partner_id)
                partner_id, message_id, sender_id, content, sent_at
         FROM my_messages
         ORDER BY partner_id, sent_at DESC, message_id DESC
       ),
       unread AS (
         SELECT sender_id AS partner_id, COUNT(*)::int AS unread_count
         FROM direct_messages
         WHERE recipient_id = $1 AND read_at IS NULL
         GROUP BY sender_id
       )
       SELECT u.user_id, u.username, up.full_name, up.avatar_url,
              l.message_id AS last_message_id,
              l.sender_id  AS last_sender_id,
              l.content    AS last_message,
              l.sent_at    AS last_sent_at,
              COALESCE(un.unread_count, 0) AS unread_count
       FROM latest l
       JOIN users u ON u.user_id = l.partner_id
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       LEFT JOIN unread un ON un.partner_id = l.partner_id
       ORDER BY l.sent_at DESC, l.message_id DESC`,
      [user_id]
    );
    return res.status(200).json({ conversations: result.rows });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/messages/unread-count ─────────────────────────
// Total unread messages, for a badge in the UI.
export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM direct_messages
       WHERE recipient_id = $1 AND read_at IS NULL`,
      [req.user.user_id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/messages/:userId?limit=&before= ───────────────
// Messages between me and :userId, newest first.
// Paginate with ?before=<message_id> using next_before from the previous page.
export const getConversation = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  let before = null;
  if (req.query.before !== undefined) {
    before = Number(req.query.before);
    if (!Number.isInteger(before) || before <= 0) {
      return res.status(400).json({ error: 'before must be a message id' });
    }
  }

  try {
    if (!(await userExists(other_id))) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      `SELECT message_id, sender_id, recipient_id, content, sent_at, read_at
       FROM direct_messages
       WHERE ((sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1))
         AND ($3::int IS NULL OR message_id < $3::int)
       ORDER BY message_id DESC
       LIMIT $4`,
      [user_id, other_id, before, limit]
    );

    const messages = result.rows;
    const next_before = messages.length === limit
      ? messages[messages.length - 1].message_id
      : null;

    return res.status(200).json({ user_id: other_id, messages, next_before });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/messages/:userId ─────────────────────────────
// Send a message. Only accepted friends can message each other.
// Body: { "content": "..." }
export const sendMessage = async (req, res, next) => {
  const sender_id = req.user.user_id;
  const recipient_id = parseOtherUserId(req, res);
  if (recipient_id === null) return;

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    if (!(await userExists(recipient_id))) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert only if the pair are accepted friends (single statement, no race)
    const result = await pool.query(
      `INSERT INTO direct_messages (sender_id, recipient_id, content)
       SELECT $1, $2, $3
       WHERE EXISTS (
         SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND LEAST(f.requester_id, f.addressee_id)    = LEAST($1::int, $2::int)
           AND GREATEST(f.requester_id, f.addressee_id) = GREATEST($1::int, $2::int)
       )
       RETURNING message_id, sender_id, recipient_id, content, sent_at, read_at`,
      [sender_id, recipient_id, content]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You can only message your friends' });
    }

    return res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/messages/:userId/read ───────────────────────
// Mark every unread message :userId sent me as read (read receipt).
export const markConversationRead = async (req, res, next) => {
  const user_id = req.user.user_id;
  const other_id = parseOtherUserId(req, res);
  if (other_id === null) return;

  try {
    const result = await pool.query(
      `UPDATE direct_messages
       SET read_at = NOW()
       WHERE sender_id = $1
         AND recipient_id = $2
         AND read_at IS NULL`,
      [other_id, user_id]
    );
    return res.status(200).json({ marked_read: result.rowCount });
  } catch (err) {
    next(err);
  }
};
