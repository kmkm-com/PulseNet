import pool from '../db/pool.js';

// Notifications are created by database triggers (see db/schema.sql),
// so this controller only reads, marks read, and deletes them.

// Parses :id. Returns the numeric id, or null after sending a 400 response.
const parseNotificationId = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid notification id' });
    return null;
  }
  return id;
};

// ── GET /api/notifications?unread=true&limit=&offset= ──────
// My notifications, newest first, with who did it and a post preview.
export const listNotifications = async (req, res, next) => {
  const user_id = req.user.user_id;
  const unreadOnly = req.query.unread === 'true';
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT n.notification_id, n.notification_type, n.is_read, n.created_at,
              n.actor_id, a.username AS actor_username, ap.avatar_url AS actor_avatar_url,
              n.related_post_id, LEFT(p.content, 100) AS post_preview,
              n.related_group_id
       FROM notifications n
       LEFT JOIN users a          ON a.user_id  = n.actor_id
       LEFT JOIN user_profiles ap ON ap.user_id = n.actor_id
       LEFT JOIN posts p          ON p.post_id  = n.related_post_id
                                 AND p.deleted_at IS NULL
       WHERE n.recipient_id = $1
         AND ($2::boolean = FALSE OR n.is_read = FALSE)
       ORDER BY n.created_at DESC, n.notification_id DESC
       LIMIT $3 OFFSET $4`,
      [user_id, unreadOnly, limit, offset]
    );
    return res.status(200).json({ notifications: result.rows, limit, offset });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/notifications/unread-count ────────────────────
export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [req.user.user_id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/notifications/read-all ──────────────────────
export const markAllRead = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [req.user.user_id]
    );
    return res.status(200).json({ marked_read: result.rowCount });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/notifications/:id/read ──────────────────────
export const markOneRead = async (req, res, next) => {
  const id = parseNotificationId(req, res);
  if (id === null) return;

  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE notification_id = $1 AND recipient_id = $2
       RETURNING notification_id, is_read`,
      [id, req.user.user_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ notification: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/notifications/:id ──────────────────────────
export const deleteNotification = async (req, res, next) => {
  const id = parseNotificationId(req, res);
  if (id === null) return;

  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE notification_id = $1 AND recipient_id = $2
       RETURNING notification_id`,
      [id, req.user.user_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};
