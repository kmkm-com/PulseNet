// Queries shared by the post and group controllers.
import pool from './pool.js';
import { publicUrl } from '../utils/storage.js';

// ── Groups ─────────────────────────────────────────────────

// The user's row in group_members ({ role, status }), or null if they never joined
export async function getMembership(groupId, userId) {
  const result = await pool.query(
    'SELECT role, status FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows[0] || null;
}

// Active admins and moderators can moderate a group
export const canModerate = (m) => m?.status === 'active' && ['admin', 'moderator'].includes(m.role);

// ── Posts ──────────────────────────────────────────────────

// Fetches posts with the author's name, like/comment counts, and whether the
// viewer liked or saved each one. Deleted posts are always left out.
//   where:  extra SQL condition on posts p
//   params: query values; params[0] must be the viewer's user_id ($1)
export async function findPosts(where, params, { limit = 20, offset = 0, orderBy = 'p.created_at DESC' } = {}) {
  const n = params.length;
  const result = await pool.query(
    `SELECT p.post_id, p.author_id, p.group_id, u.username, up.full_name, up.avatar_url,
            p.content, p.privacy_level, p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.post_id)::int AS like_count,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id)::int AS comment_count,
            EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.post_id AND l.user_id = $1) AS has_liked,
            EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.post_id AND s.user_id = $1) AS has_saved
     FROM posts p
     JOIN users u ON u.user_id = p.author_id
     LEFT JOIN user_profiles up ON up.user_id = p.author_id
     WHERE p.deleted_at IS NULL AND ${where}
     ORDER BY ${orderBy}
     LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, limit, offset]
  );
  return attachMedia(result.rows);
}

// Adds a public URL to a post_media row
export const withUrl = (m) => ({ ...m, url: publicUrl(m.storage_bucket, m.storage_path) });

// Adds a `media` array to each post, using one query for all of them
async function attachMedia(posts) {
  if (posts.length === 0) return posts;
  const result = await pool.query(
    `SELECT media_id, post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes
     FROM post_media
     WHERE post_id = ANY($1::int[])
     ORDER BY media_id`,
    [posts.map((p) => p.post_id)]
  );
  return posts.map((p) => ({
    ...p,
    media: result.rows.filter((m) => m.post_id === p.post_id).map(withUrl),
  }));
}
