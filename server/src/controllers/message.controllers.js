import pool from '../db/pool.js';
import { USER_COLUMNS, JOIN_PROFILE, pairMatch } from '../db/sql.js';
import { parsePaging, toPositiveInt } from '../utils/params.js';

// :userId is validated by router.param in message.routes.js (req.otherId).
// Express 5 forwards errors thrown in async handlers to errorhandler.js.

const MAX_MESSAGE_LENGTH = 2000;

const userExists = async (user_id) => {
  const result = await pool.query('SELECT 1 FROM users WHERE user_id = $1', [user_id]);
  return result.rows.length > 0;
};

// ── GET /api/messages ──────────────────────────────────────
// Inbox: one row per conversation partner with the latest message
// and how many of their messages I have not read yet.
export const listConversations = async (req, res) => {
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
     SELECT ${USER_COLUMNS},
            l.message_id AS last_message_id,
            l.sender_id  AS last_sender_id,
            l.content    AS last_message,
            l.sent_at    AS last_sent_at,
            COALESCE(un.unread_count, 0) AS unread_count
     FROM latest l
     JOIN users u ON u.user_id = l.partner_id
     ${JOIN_PROFILE}
     LEFT JOIN unread un ON un.partner_id = l.partner_id
     ORDER BY l.sent_at DESC, l.message_id DESC`,
    [req.user.user_id]
  );
  return res.status(200).json({ conversations: result.rows });
};

// ── GET /api/messages/unread-count ─────────────────────────
// Total unread messages, for a badge in the UI.
export const getUnreadCount = async (req, res) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM direct_messages
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [req.user.user_id]
  );
  return res.status(200).json(result.rows[0]);
};

// ── GET /api/messages/:userId?limit=&before= ───────────────
// Messages between me and :userId, newest first.
// Paginate with ?before=<message_id> using next_before from the previous page.
export const getConversation = async (req, res) => {
  const other_id = req.otherId;
  const { limit } = parsePaging(req.query, { defaultLimit: 50, maxLimit: 100 });
  let before = null;
  if (req.query.before !== undefined) {
    before = toPositiveInt(req.query.before);
    if (before === null) {
      return res.status(400).json({ error: 'before must be a message id' });
    }
  }

  const result = await pool.query(
    `SELECT message_id, sender_id, recipient_id, content, sent_at, read_at
     FROM direct_messages
     WHERE ((sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1))
       AND ($3::int IS NULL OR message_id < $3::int)
     ORDER BY message_id DESC
     LIMIT $4`,
    [req.user.user_id, other_id, before, limit]
  );
  const messages = result.rows;

  // Only an empty first page needs to tell "no messages yet" from "no such user"
  if (messages.length === 0 && before === null && !(await userExists(other_id))) {
    return res.status(404).json({ error: 'User not found' });
  }

  const next_before = messages.length === limit ? messages[messages.length - 1].message_id : null;
  return res.status(200).json({ user_id: other_id, messages, next_before });
};

// ── POST /api/messages/:userId ─────────────────────────────
// Send a message. Only accepted friends can message each other.
// Body: { "content": "..." }
export const sendMessage = async (req, res) => {
  const recipient_id = req.otherId;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
  }

  // Insert only if the pair are accepted friends (single statement, no race)
  const result = await pool.query(
    `INSERT INTO direct_messages (sender_id, recipient_id, content)
     SELECT $1, $2, $3
     WHERE EXISTS (
       SELECT 1 FROM friendships f
       WHERE f.status = 'accepted' AND ${pairMatch('$1::int', '$2::int')}
     )
     RETURNING message_id, sender_id, recipient_id, content, sent_at, read_at`,
    [req.user.user_id, recipient_id, content]
  );

  if (result.rows.length === 0) {
    return (await userExists(recipient_id))
      ? res.status(403).json({ error: 'You can only message your friends' })
      : res.status(404).json({ error: 'User not found' });
  }
  return res.status(201).json({ message: result.rows[0] });
};

// ── PATCH /api/messages/:userId/read ───────────────────────
// Mark every unread message :userId sent me as read (read receipt).
export const markConversationRead = async (req, res) => {
  const result = await pool.query(
    `UPDATE direct_messages
     SET read_at = NOW()
     WHERE sender_id = $1
       AND recipient_id = $2
       AND read_at IS NULL`,
    [req.otherId, req.user.user_id]
  );
  return res.status(200).json({ marked_read: result.rowCount });
};
