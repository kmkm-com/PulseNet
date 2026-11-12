import pool from '../db/pool.js';
import { uploadFileToStorage, removeFileFromStorage } from '../utils/storage.js';

// Base privacy and visibility filter
// p: posts, $1: requesting user_id
const PRIVACY_FILTER = `
  p.deleted_at IS NULL
  AND p.group_id IS NULL
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

// Helper: attach media to posts
async function attachMediaToPosts(posts) {
  if (!posts || posts.length === 0) return posts;
  const postIds = posts.map((p) => p.post_id);
  const mediaRes = await pool.query(
    `SELECT media_id, post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes
     FROM post_media
     WHERE post_id = ANY($1::int[])
     ORDER BY media_id ASC`,
    [postIds]
  );

  const mediaByPost = {};
  for (const m of mediaRes.rows) {
    if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
    const publicUrl = `https://vsuqxguawnxtodcuajij.supabase.co/storage/v1/object/public/${m.storage_bucket}/${m.storage_path}`;
    mediaByPost[m.post_id].push({ ...m, url: publicUrl });
  }

  return posts.map((p) => ({
    ...p,
    media: mediaByPost[p.post_id] || [],
  }));
}

// POST /api/posts
export const createPost = async (req, res) => {
  const { content, privacy_level = 'public', group_id = null, media = [] } = req.body;
  const author_id = req.user.user_id;

  if ((!content || !content.trim()) && (!media || media.length === 0)) {
    return res.status(400).json({ error: 'Post must have text content or media' });
  }

  // If group_id is provided, verify active group membership
  if (group_id) {
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
      [group_id, author_id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be an active member of the group to post' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const postResult = await client.query(
      `INSERT INTO posts (author_id, group_id, content, privacy_level)
       VALUES ($1, $2, $3, $4)
       RETURNING post_id, author_id, group_id, content, privacy_level, created_at, updated_at`,
      [author_id, group_id, content ? content.trim() : null, privacy_level]
    );
    const post = postResult.rows[0];

    const insertedMedia = [];
    for (const m of media) {
      const mediaResult = await client.query(
        `INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING media_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes`,
        [post.post_id, m.storage_bucket || 'post-media', m.storage_path, m.media_type, m.mime_type, m.file_size_bytes]
      );
      const row = mediaResult.rows[0];
      const url = `https://vsuqxguawnxtodcuajij.supabase.co/storage/v1/object/public/${row.storage_bucket}/${row.storage_path}`;
      insertedMedia.push({ ...row, url });
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
        media: insertedMedia,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// GET /api/posts/feed
export const getFeed = async (req, res) => {
  const user_id = req.user.user_id;
  const author_id = req.query.author_id ? parseInt(req.query.author_id, 10) : null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    let whereClause = PRIVACY_FILTER;
    const params = [user_id];

    if (author_id) {
      params.push(author_id);
      whereClause += ` AND p.author_id = $${params.length}`;
    }

    params.push(limit, offset);
    const limitParam = `$${params.length - 1}`;
    const offsetParam = `$${params.length}`;

    const result = await pool.query(
      `SELECT p.post_id, p.author_id, p.group_id, u.username, prof.full_name, prof.avatar_url,
              p.content, p.privacy_level, p.created_at, p.updated_at,
              COUNT(DISTINCT pl.user_id)::int   AS like_count,
              COUNT(DISTINCT c.comment_id)::int AS comment_count,
              EXISTS (
                SELECT 1 FROM post_likes my_l
                WHERE my_l.post_id = p.post_id AND my_l.user_id = $1
              ) AS has_liked,
              EXISTS (
                SELECT 1 FROM saved_posts my_s
                WHERE my_s.post_id = p.post_id AND my_s.user_id = $1
              ) AS has_saved
       FROM posts p
       JOIN users u ON u.user_id = p.author_id
       LEFT JOIN user_profiles prof ON prof.user_id = p.author_id
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       LEFT JOIN comments  c  ON c.post_id  = p.post_id
       WHERE ${whereClause}
       GROUP BY p.post_id, u.username, prof.full_name, prof.avatar_url
       ORDER BY p.created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const postsWithMedia = await attachMediaToPosts(result.rows);
    return res.status(200).json({ posts: postsWithMedia, limit, offset });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/posts/:id
export const getPostById = async (req, res) => {
  const user_id = req.user.user_id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.post_id, p.author_id, p.group_id, u.username, prof.full_name, prof.avatar_url,
              p.content, p.privacy_level, p.created_at, p.updated_at,
              COUNT(DISTINCT pl.user_id)::int   AS like_count,
              COUNT(DISTINCT c.comment_id)::int AS comment_count,
              EXISTS (
                SELECT 1 FROM post_likes my_l
                WHERE my_l.post_id = p.post_id AND my_l.user_id = $1
              ) AS has_liked,
              EXISTS (
                SELECT 1 FROM saved_posts my_s
                WHERE my_s.post_id = p.post_id AND my_s.user_id = $1
              ) AS has_saved
       FROM posts p
       JOIN users u ON u.user_id = p.author_id
       LEFT JOIN user_profiles prof ON prof.user_id = p.author_id
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       LEFT JOIN comments  c  ON c.post_id  = p.post_id
       WHERE p.post_id = $2
         AND p.deleted_at IS NULL
         AND (
           p.group_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM groups g
             LEFT JOIN group_members gm ON gm.group_id = g.group_id AND gm.user_id = $1 AND gm.status = 'active'
             WHERE g.group_id = p.group_id AND (g.visibility = 'public' OR gm.user_id IS NOT NULL)
           )
           OR
           (p.group_id IS NULL AND (
             p.privacy_level = 'public'
             OR p.author_id = $1
             OR (
               p.privacy_level = 'friends_only'
               AND EXISTS (
                 SELECT 1 FROM friendships f
                 WHERE f.status = 'accepted'
                   AND ((f.requester_id = $1 AND f.addressee_id = p.author_id)
                     OR (f.addressee_id = $1 AND f.requester_id = p.author_id))
               )
             )
           ))
         )
       GROUP BY p.post_id, u.username, prof.full_name, prof.avatar_url`,
      [user_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or access denied' });
    }

    const postsWithMedia = await attachMediaToPosts(result.rows);
    return res.status(200).json({ post: postsWithMedia[0] });
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/posts/:id (Edit post)
export const updatePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id } = req.params;
  const { content, privacy_level } = req.body;

  try {
    const postCheck = await pool.query(
      `SELECT author_id FROM posts WHERE post_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (postCheck.rows[0].author_id !== user_id) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    const updateResult = await pool.query(
      `UPDATE posts
       SET content = COALESCE($1, content),
           privacy_level = COALESCE($2, privacy_level),
           updated_at = NOW()
       WHERE post_id = $3
       RETURNING *`,
      [content !== undefined ? content : null, privacy_level || null, id]
    );

    return res.status(200).json({ message: 'Post updated successfully', post: updateResult.rows[0] });
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/posts/:id (Soft-delete)
export const deletePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id } = req.params;

  try {
    const postCheck = await pool.query(
      `SELECT author_id, group_id FROM posts WHERE post_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postCheck.rows[0];
    let isAuthorized = post.author_id === user_id;

    // Group admin/moderator can also delete group posts
    if (!isAuthorized && post.group_id) {
      const memberRole = await pool.query(
        `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
        [post.group_id, user_id]
      );
      if (memberRole.rows.length > 0 && ['admin', 'moderator'].includes(memberRole.rows[0].role)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    await pool.query(
      `UPDATE posts SET deleted_at = NOW() WHERE post_id = $1`,
      [id]
    );

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/posts/media/upload
export const uploadMedia = async (req, res) => {
  const user_id = req.user.user_id;
  if (!req.file) {
    return res.status(400).json({ error: 'No media file provided' });
  }

  const file = req.file;
  const isVideo = file.mimetype.startsWith('video/');
  const isImage = file.mimetype.startsWith('image/');

  if (!isImage && !isVideo) {
    return res.status(400).json({ error: 'Only image and video uploads are allowed' });
  }

  const ext = file.originalname.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const storagePath = `posts/${user_id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  try {
    const uploadRes = await uploadFileToStorage(
      'post-media',
      storagePath,
      file.buffer,
      file.mimetype
    );

    return res.status(201).json({
      media: {
        storage_bucket: 'post-media',
        storage_path: storagePath,
        media_type: isVideo ? 'video' : 'image',
        mime_type: file.mimetype,
        file_size_bytes: file.size,
        url: uploadRes.publicUrl,
      },
    });
  } catch (err) {
    console.error('uploadMedia error:', err);
    return res.status(500).json({ error: 'Failed to upload media asset' });
  }
};

// POST /api/posts/:id/like
export const likePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
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

// DELETE /api/posts/:id/like
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

// POST /api/posts/:id/bookmark
export const savePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    await pool.query(
      `INSERT INTO saved_posts (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, post_id) DO NOTHING`,
      [user_id, post_id]
    );
    return res.status(200).json({ message: 'Post bookmarked', post_id: Number(post_id), saved: true });
  } catch (err) {
    console.error('savePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/posts/:id/bookmark
export const unsavePost = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    await pool.query(
      `DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2`,
      [user_id, post_id]
    );
    return res.status(200).json({ message: 'Bookmark removed', post_id: Number(post_id), saved: false });
  } catch (err) {
    console.error('unsavePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/users/me/bookmarks
export const getSavedPosts = async (req, res) => {
  const user_id = req.user.user_id;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const result = await pool.query(
      `SELECT p.post_id, p.author_id, p.group_id, u.username, prof.full_name, prof.avatar_url,
              p.content, p.privacy_level, p.created_at, p.updated_at,
              COUNT(DISTINCT pl.user_id)::int   AS like_count,
              COUNT(DISTINCT c.comment_id)::int AS comment_count,
              EXISTS (
                SELECT 1 FROM post_likes my_l
                WHERE my_l.post_id = p.post_id AND my_l.user_id = $1
              ) AS has_liked,
              TRUE AS has_saved,
              sp.saved_at
       FROM saved_posts sp
       JOIN posts p ON p.post_id = sp.post_id
       JOIN users u ON u.user_id = p.author_id
       LEFT JOIN user_profiles prof ON prof.user_id = p.author_id
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       LEFT JOIN comments  c  ON c.post_id  = p.post_id
       WHERE sp.user_id = $1
         AND p.deleted_at IS NULL
       GROUP BY p.post_id, u.username, prof.full_name, prof.avatar_url, sp.saved_at
       ORDER BY sp.saved_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );

    const postsWithMedia = await attachMediaToPosts(result.rows);
    return res.status(200).json({ posts: postsWithMedia, limit, offset });
  } catch (err) {
    console.error('getSavedPosts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/posts/:id/comments
export const getComments = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: post_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.comment_id, c.post_id, c.author_id, u.username,
              p_profile.full_name, p_profile.avatar_url, c.content, c.created_at
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

// POST /api/posts/:id/comments
export const addComment = async (req, res) => {
  const author_id = req.user.user_id;
  const { id: post_id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const postCheck = await pool.query(
      `SELECT post_id FROM posts WHERE post_id = $1 AND deleted_at IS NULL`,
      [post_id]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING comment_id`,
      [post_id, author_id, content.trim()]
    );

    const commentRes = await pool.query(
      `SELECT c.comment_id, c.post_id, c.author_id, u.username,
              p_profile.full_name, p_profile.avatar_url, c.content, c.created_at
       FROM comments c
       JOIN users u ON u.user_id = c.author_id
       LEFT JOIN user_profiles p_profile ON p_profile.user_id = c.author_id
       WHERE c.comment_id = $1`,
      [result.rows[0].comment_id]
    );

    return res.status(201).json({ comment: commentRes.rows[0] });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/posts/:id/comments/:commentId
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
