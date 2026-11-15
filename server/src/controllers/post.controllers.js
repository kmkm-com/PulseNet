import pool from '../db/pool.js';
import { pairMatch } from '../db/sql.js';
import { findPosts, getMembership, canModerate, withUrl } from '../db/queries.js';
import { parsePaging, toPositiveInt } from '../utils/params.js';
import { uploadFileToStorage } from '../utils/storage.js';

// :id is checked once in post.routes.js and stored as req.idParam.
// Express 5 passes errors from these async handlers to errorhandler.js,
// so they don't need their own try/catch.

// A non-group post p the viewer ($1) may see: public, their own, or
// friends_only when they are friends with the author
const CAN_SEE = `(
  p.privacy_level = 'public'
  OR p.author_id = $1
  OR (p.privacy_level = 'friends_only' AND EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted' AND ${pairMatch('$1::int', 'p.author_id')}
  ))
)`;

// A group post p the viewer ($1) may see: the group is public or they are an active member
const CAN_SEE_GROUP_POST = `EXISTS (
  SELECT 1 FROM groups g
  WHERE g.group_id = p.group_id
    AND (g.visibility = 'public' OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = g.group_id AND gm.user_id = $1 AND gm.status = 'active'
    ))
)`;

// Comments with the author's name and avatar (alias c)
const COMMENT_SELECT = `
  SELECT c.comment_id, c.post_id, c.author_id, u.username, up.full_name, up.avatar_url,
         c.content, c.created_at
  FROM comments c
  JOIN users u ON u.user_id = c.author_id
  LEFT JOIN user_profiles up ON up.user_id = c.author_id`;

// ── Posts ──────────────────────────────────────────────────

// POST /api/posts   (also POST /api/groups/:id/posts, which sets group_id)
// Inserts the post and its media in one transaction.
export const createPost = async (req, res) => {
  const { content, privacy_level = 'public', group_id = null, media = [] } = req.body;
  const author_id = req.user.user_id;

  if (!content?.trim() && media.length === 0) {
    return res.status(400).json({ error: 'Post must have text content or media' });
  }
  if (group_id) {
    const me = await getMembership(group_id, author_id);
    if (me?.status !== 'active') {
      return res.status(403).json({ error: 'You must be an active member of the group to post' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO posts (author_id, group_id, content, privacy_level)
       VALUES ($1, $2, $3, $4)
       RETURNING post_id, author_id, group_id, content, privacy_level, created_at, updated_at`,
      [author_id, group_id, content?.trim() || null, privacy_level]
    );
    const post = rows[0];

    const savedMedia = [];
    for (const m of media) {
      const result = await client.query(
        `INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING media_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes`,
        [post.post_id, m.storage_bucket || 'post-media', m.storage_path, m.media_type, m.mime_type, m.file_size_bytes]
      );
      savedMedia.push(withUrl(result.rows[0]));
    }
    await client.query('COMMIT');

    return res.status(201).json({
      post: {
        ...post,
        username: req.user.username,
        like_count: 0,
        comment_count: 0,
        has_liked: false,
        has_saved: false,
        media: savedMedia,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // errorhandler.js sends the response
  } finally {
    client.release();
  }
};

// GET /api/posts/feed?author_id=&limit=&offset=
// Non-group posts the viewer may see, newest first
export const getFeed = async (req, res) => {
  const paging = parsePaging(req.query, { defaultLimit: 20, maxLimit: 100 });
  const authorId = toPositiveInt(req.query.author_id);

  const params = [req.user.user_id];
  let where = `p.group_id IS NULL AND ${CAN_SEE}`;
  if (authorId) {
    params.push(authorId);
    where += ' AND p.author_id = $2';
  }

  const posts = await findPosts(where, params, paging);
  return res.status(200).json({ posts, ...paging });
};

// GET /api/posts/:id
export const getPostById = async (req, res) => {
  const [post] = await findPosts(
    `p.post_id = $2 AND ((p.group_id IS NULL AND ${CAN_SEE}) OR ${CAN_SEE_GROUP_POST})`,
    [req.user.user_id, req.idParam],
    { limit: 1 }
  );
  if (!post) {
    return res.status(404).json({ error: 'Post not found or access denied' });
  }
  return res.status(200).json({ post });
};

// PATCH /api/posts/:id   Body: { content?, privacy_level? }  (author only)
export const updatePost = async (req, res) => {
  const { content, privacy_level } = req.body;
  const { rows } = await pool.query(
    `UPDATE posts
     SET content = COALESCE($1, content),
         privacy_level = COALESCE($2, privacy_level),
         updated_at = NOW()
     WHERE post_id = $3 AND author_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [content ?? null, privacy_level ?? null, req.idParam, req.user.user_id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Post not found, or you are not its author' });
  }
  return res.status(200).json({ message: 'Post updated successfully', post: rows[0] });
};

// DELETE /api/posts/:id   Soft delete: the author, or a group admin/moderator for group posts
export const deletePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { rows } = await pool.query(
    'SELECT author_id, group_id FROM posts WHERE post_id = $1 AND deleted_at IS NULL',
    [req.idParam]
  );
  const post = rows[0];
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const isAuthor = post.author_id === user_id;
  const isGroupModerator = post.group_id && canModerate(await getMembership(post.group_id, user_id));
  if (!isAuthor && !isGroupModerator) {
    return res.status(403).json({ error: 'Unauthorized to delete this post' });
  }

  await pool.query('UPDATE posts SET deleted_at = NOW() WHERE post_id = $1', [req.idParam]);
  return res.status(200).json({ message: 'Post deleted successfully' });
};

// POST /api/posts/media/upload   (multipart form, field "file")
// Uploads to Supabase Storage. The client then sends the returned
// `media` object with createPost.
export const uploadMedia = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No media file provided' });
  }
  const isVideo = file.mimetype.startsWith('video/');
  if (!isVideo && !file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'Only image and video uploads are allowed' });
  }

  const ext = file.originalname.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const random = Math.random().toString(36).slice(2, 8);
  const path = `posts/${req.user.user_id}/${Date.now()}-${random}.${ext}`;
  const uploaded = await uploadFileToStorage('post-media', path, file.buffer, file.mimetype);

  return res.status(201).json({
    media: {
      storage_bucket: 'post-media',
      storage_path: path,
      media_type: isVideo ? 'video' : 'image',
      mime_type: file.mimetype,
      file_size_bytes: file.size,
      url: uploaded.publicUrl,
    },
  });
};

// ── Likes and bookmarks ────────────────────────────────────
// The composite primary keys stop duplicates; ON CONFLICT makes repeats harmless.

// POST /api/posts/:id/like
export const likePost = async (req, res) => {
  await pool.query(
    'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.user_id, req.idParam]
  );
  return res.status(200).json({ message: 'Post liked', post_id: req.idParam, liked: true });
};

// DELETE /api/posts/:id/like
export const unlikePost = async (req, res) => {
  await pool.query('DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2', [req.user.user_id, req.idParam]);
  return res.status(200).json({ message: 'Post unliked', post_id: req.idParam, liked: false });
};

// POST /api/posts/:id/bookmark
export const savePost = async (req, res) => {
  await pool.query(
    'INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.user_id, req.idParam]
  );
  return res.status(200).json({ message: 'Post bookmarked', post_id: req.idParam, saved: true });
};

// DELETE /api/posts/:id/bookmark
export const unsavePost = async (req, res) => {
  await pool.query('DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2', [req.user.user_id, req.idParam]);
  return res.status(200).json({ message: 'Bookmark removed', post_id: req.idParam, saved: false });
};

// GET /api/posts/bookmarks/all  (and /api/posts/saved)
// My bookmarked posts, most recently saved first
export const getSavedPosts = async (req, res) => {
  const paging = parsePaging(req.query, { defaultLimit: 20, maxLimit: 100 });
  const posts = await findPosts(
    'EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.post_id AND s.user_id = $1)',
    [req.user.user_id],
    {
      ...paging,
      orderBy: '(SELECT s.saved_at FROM saved_posts s WHERE s.post_id = p.post_id AND s.user_id = $1) DESC',
    }
  );
  return res.status(200).json({ posts, ...paging });
};

// ── Comments ───────────────────────────────────────────────

// GET /api/posts/:id/comments   (oldest first)
export const getComments = async (req, res) => {
  const { rows } = await pool.query(`${COMMENT_SELECT} WHERE c.post_id = $1 ORDER BY c.created_at`, [req.idParam]);
  return res.status(200).json({ comments: rows });
};

// POST /api/posts/:id/comments   Body: { content }
export const addComment = async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  const post = await pool.query('SELECT 1 FROM posts WHERE post_id = $1 AND deleted_at IS NULL', [req.idParam]);
  if (post.rows.length === 0) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const inserted = await pool.query(
    'INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING comment_id',
    [req.idParam, req.user.user_id, content]
  );
  const { rows } = await pool.query(`${COMMENT_SELECT} WHERE c.comment_id = $1`, [inserted.rows[0].comment_id]);
  return res.status(201).json({ comment: rows[0] });
};

// DELETE /api/posts/:id/comments/:commentId   (comment author or post author)
export const deleteComment = async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM comments c
     USING posts p
     WHERE c.comment_id = $1
       AND c.post_id = p.post_id
       AND (c.author_id = $2 OR p.author_id = $2)
     RETURNING c.comment_id`,
    [req.params.commentId, req.user.user_id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Comment not found or unauthorized' });
  }
  return res.status(200).json({ message: 'Comment deleted successfully' });
};
