import pool from '../db/pool.js';

// ── helpers ────────────────────────────────────────────────
const PRIVACY_FILTER = `
  p.deleted_at IS NULL
  AND (
    p.privacy_level = 'public'
    OR p.author_id = $1
    OR (
      p.privacy_level = 'friends_only'
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = $1 AND f.addressee_id = p.author_id)
            OR (f.addressee_id = $1 AND f.requester_id = p.author_id)
          )
      )
    )
  )
`;

// ── POST /api/posts ────────────────────────────────────────
export const createPost = async (req, res) => {
  const { content, privacy_level = 'public', media = [] } = req.body;
  const author_id = req.user.user_id;

  if (!content && media.length === 0) {
    return res.status(400).json({ error: 'Post must have text content or media' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const postResult = await client.query(
      `INSERT INTO posts (author_id, content, privacy_level)
       VALUES ($1, $2, $3)
       RETURNING post_id, author_id, content, privacy_level, created_at`,
      [author_id, content || '', privacy_level]
    );
    const post = postResult.rows[0];

    const insertedMedia = [];
    for (const m of media) {
      const mediaResult = await client.query(
        `INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING media_id, storage_path, media_type`,
        [post.post_id, m.storage_bucket, m.storage_path, m.media_type, m.mime_type, m.file_size_bytes]
      );
      insertedMedia.push(mediaResult.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ post: { ...post, media: insertedMedia } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ── GET /api/posts/feed ────────────────────────────────────
export const getFeed = async (req, res) => {
  const user_id = req.user.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT p.post_id, p.author_id, u.username,
              p.content, p.privacy_level, p.created_at,
              COUNT(DISTINCT pl.user_id)   AS like_count,
              COUNT(DISTINCT c.comment_id)  AS comment_count,
              EXISTS (
                SELECT 1 FROM post_likes my_l
                WHERE my_l.post_id = p.post_id AND my_l.user_id = $1
              ) AS has_liked
       FROM posts p
       JOIN users u ON u.user_id = p.author_id
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       LEFT JOIN comments  c  ON c.post_id  = p.post_id
       WHERE ${PRIVACY_FILTER}
       GROUP BY p.post_id, u.username
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
    return res.status(200).json({ posts: result.rows, limit, offset });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/posts/:id ─────────────────────────────────────
export const getPostById = async (req, res) => {
  const user_id = req.user.user_id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.post_id, p.author_id, u.username,
              p.content, p.privacy_level, p.created_at
       FROM posts p
       JOIN users u ON u.user_id = p.author_id
       WHERE p.post_id = $2
         AND ${PRIVACY_FILTER}`,
      [user_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or access denied' });
    }

    const post = result.rows[0];

    const mediaResult = await pool.query(
      `SELECT media_id, storage_bucket, storage_path, media_type, mime_type
       FROM post_media WHERE post_id = $1`,
      [post.post_id]
    );

    return res.status(200).json({ post: { ...post, media: mediaResult.rows } });
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PATCH /api/posts/:id ───────────────────────────────────
export const updatePost = async (req, res) => {
  const author_id = req.user.user_id;
  const { id } = req.params;
  const { content, privacy_level } = req.body;

  if (!content && !privacy_level) {
    return res.status(400).json({ error: 'Provide content or privacy_level to update' });
  }

  try {
    const result = await pool.query(
      `UPDATE posts
       SET content       = COALESCE($1, content),
           privacy_level = COALESCE($2, privacy_level),
           updated_at    = NOW()
       WHERE post_id = $3
         AND author_id = $4
         AND deleted_at IS NULL
       RETURNING post_id, content, privacy_level, updated_at`,
      [content || null, privacy_level || null, id, author_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or not your post' });
    }

    return res.status(200).json({ post: result.rows[0] });
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── DELETE /api/posts/:id ──────────────────────────────────
export const deletePost = async (req, res) => {
  const author_id = req.user.user_id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE posts
       SET deleted_at = NOW()
       WHERE post_id = $1
         AND author_id = $2
         AND deleted_at IS NULL
       RETURNING post_id`,
      [id, author_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or not your post' });
    }

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/posts/:id/like ───────────────────────────────
export const likePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    const postCheck = await pool.query(
      `SELECT post_id FROM posts p WHERE p.post_id = $2 AND ${PRIVACY_FILTER}`,
      [user_id, post_id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or access denied' });
    }

    await pool.query(
      `INSERT INTO post_likes (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, post_id) DO NOTHING`,
      [user_id, post_id]
    );

    return res.status(200).json({ message: 'Post liked', post_id: Number(post_id), liked: true });
  } catch (err) {
    console.error('likePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── DELETE /api/posts/:id/like ─────────────────────────────
export const unlikePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    await pool.query(
      `DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2`,
      [user_id, post_id]
    );
    return res.status(200).json({ message: 'Post unliked', post_id: Number(post_id), liked: false });
  } catch (err) {
    console.error('unlikePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/posts/:id/comments ────────────────────────────
export const getComments = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    const postCheck = await pool.query(
      `SELECT post_id FROM posts p WHERE p.post_id = $2 AND ${PRIVACY_FILTER}`,
      [user_id, post_id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or access denied' });
    }

    const result = await pool.query(
      `SELECT c.comment_id, c.post_id, c.author_id, u.username,
              p_profile.avatar_url, c.content, c.created_at
       FROM comments c
       JOIN users u ON u.user_id = c.author_id
       LEFT JOIN user_profiles p_profile ON p_profile.user_id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [post_id]
    );

    return res.status(200).json({ comments: result.rows });
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/posts/:id/comments ───────────────────────────
export const addComment = async (req, res) => {
  const author_id = req.user.user_id;
  const { id: post_id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const postCheck = await pool.query(
      `SELECT post_id FROM posts p WHERE p.post_id = $2 AND ${PRIVACY_FILTER}`,
      [author_id, post_id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or access denied' });
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING comment_id, post_id, author_id, content, created_at`,
      [post_id, author_id, content.trim()]
    );

    const newComment = {
      ...result.rows[0],
      username: req.user.username,
      avatar_url: req.user.avatar_url || null,
    };

    return res.status(201).json({ comment: newComment });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── DELETE /api/posts/:id/comments/:commentId ──────────────
export const deleteComment = async (req, res) => {
  const user_id = req.user.user_id;
  const { commentId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM comments c
       USING posts p
       WHERE c.comment_id = $1
         AND c.post_id = p.post_id
         AND (c.author_id = $2 OR p.author_id = $2)
       RETURNING c.comment_id`,
      [commentId, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    return res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

