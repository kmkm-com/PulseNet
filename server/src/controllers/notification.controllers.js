import pool from '../db/pool.js';
import { parsePaging } from '../utils/params.js';

// Notifications are created by database triggers (see db/schema.sql),
// so this controller only reads, marks read, and deletes them.
// :id is validated by router.param in notification.routes.js (req.idParam).

// ── GET /api/notifications?unread=true&limit=&offset= ──────
// My notifications, newest first, with who did it and a post preview.
export const listNotifications = async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const { limit, offset } = parsePaging(req.query, { defaultLimit: 20, maxLimit: 100 });

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
    [req.user.user_id, unreadOnly, limit, offset]
  );
  return res.status(200).json({ notifications: result.rows, limit, offset });
};

// ── GET /api/notifications/unread-count ────────────────────
export const getUnreadCount = async (req, res) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [req.user.user_id]
  );
  return res.status(200).json(result.rows[0]);
};

// ── PATCH /api/notifications/read-all ──────────────────────
export const markAllRead = async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [req.user.user_id]
  );
  return res.status(200).json({ marked_read: result.rowCount });
};

// ── PATCH /api/notifications/:id/read ──────────────────────
export const markOneRead = async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE notification_id = $1 AND recipient_id = $2
     RETURNING notification_id, is_read`,
    [req.idParam, req.user.user_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  return res.status(200).json({ notification: result.rows[0] });
};

// ── DELETE /api/notifications/:id ──────────────────────────
export const deleteNotification = async (req, res) => {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE notification_id = $1 AND recipient_id = $2
     RETURNING notification_id`,
    [req.idParam, req.user.user_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  return res.status(200).json({ message: 'Notification deleted' });
};
