import pool from '../db/pool.js';
import { uploadFileToStorage } from '../utils/storage.js';

/**
 * GET /api/users
 * Search users
 */
export const searchUsers = async (req, res) => {
  const currentUserId = req.user.user_id;
  const search = req.query.search?.trim();

  try {
    let query;
    let params;

    if (search) {
      query = `
        SELECT u.user_id, u.username, p.full_name, p.avatar_url,
          CASE
            WHEN u.user_id = $1 THEN 'self'
            WHEN f.status = 'accepted' THEN 'friends'
            WHEN f.status = 'pending' AND f.requester_id = $1 THEN 'request_sent'
            WHEN f.status = 'pending' AND f.addressee_id = $1 THEN 'request_received'
            ELSE 'none'
          END AS relationship
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.user_id
        LEFT JOIN friendships f ON (
          (f.requester_id = $1 AND f.addressee_id = u.user_id) OR
          (f.addressee_id = $1 AND f.requester_id = u.user_id)
        )
        WHERE u.account_status = 'active'
          AND (u.username ILIKE $2 OR p.full_name ILIKE $2)
        ORDER BY u.username ASC
        LIMIT 50;
      `;
      params = [currentUserId, `%${search}%`];
    } else {
      query = `
        SELECT u.user_id, u.username, p.full_name, p.avatar_url,
          CASE
            WHEN u.user_id = $1 THEN 'self'
            WHEN f.status = 'accepted' THEN 'friends'
            WHEN f.status = 'pending' AND f.requester_id = $1 THEN 'request_sent'
            WHEN f.status = 'pending' AND f.addressee_id = $1 THEN 'request_received'
            ELSE 'none'
          END AS relationship
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.user_id
        LEFT JOIN friendships f ON (
          (f.requester_id = $1 AND f.addressee_id = u.user_id) OR
          (f.addressee_id = $1 AND f.requester_id = u.user_id)
        )
        WHERE u.account_status = 'active' AND u.user_id <> $1
        ORDER BY u.created_at DESC
        LIMIT 20;
      `;
      params = [currentUserId];
    }

    const result = await pool.query(query, params);
    return res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error('searchUsers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/users/:userId
 * Get user profile with stats
 */
export const getUserProfile = async (req, res) => {
  const currentUserId = req.user.user_id;
  const targetUserId = parseInt(req.params.userId, 10);

  try {
    const userQuery = `
      SELECT u.user_id, u.username, u.email, u.account_status, u.created_at AS joined_at,
             p.full_name, p.bio, p.location, p.website_url, p.avatar_url, p.avatar_storage_path,
             COALESCE(s.friend_count, 0) AS friend_count,
             COALESCE(s.post_count, 0) AS post_count,
             COALESCE(s.likes_received, 0) AS likes_received,
             COALESCE(s.group_count, 0) AS group_count,
             CASE
               WHEN u.user_id = $1 THEN 'self'
               WHEN f.status = 'accepted' THEN 'friends'
               WHEN f.status = 'pending' AND f.requester_id = $1 THEN 'request_sent'
               WHEN f.status = 'pending' AND f.addressee_id = $1 THEN 'request_received'
               ELSE 'none'
             END AS relationship,
             COALESCE(mf.mutual_friends, 0) AS mutual_friends
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.user_id
      LEFT JOIN v_user_stats s ON s.user_id = u.user_id
      LEFT JOIN friendships f ON (
        (f.requester_id = $1 AND f.addressee_id = u.user_id) OR
        (f.addressee_id = $1 AND f.requester_id = u.user_id)
      )
      LEFT JOIN v_friend_suggestions mf ON (mf.user_id = $1 AND mf.suggested_user_id = u.user_id)
      WHERE u.user_id = $2;
    `;

    const result = await pool.query(userQuery, [currentUserId, targetUserId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('getUserProfile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/users/me
 * Update current user's profile
 */
export const updateProfile = async (req, res) => {
  const currentUserId = req.user.user_id;
  const { full_name, bio, location, website_url, avatar_url, avatar_storage_path } = req.body;

  try {
    const updateQuery = `
      INSERT INTO user_profiles (user_id, full_name, bio, location, website_url, avatar_url, avatar_storage_path, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = COALESCE($2, user_profiles.full_name),
        bio = COALESCE($3, user_profiles.bio),
        location = COALESCE($4, user_profiles.location),
        website_url = COALESCE($5, user_profiles.website_url),
        avatar_url = COALESCE($6, user_profiles.avatar_url),
        avatar_storage_path = COALESCE($7, user_profiles.avatar_storage_path),
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      currentUserId,
      full_name !== undefined ? full_name : null,
      bio !== undefined ? bio : null,
      location !== undefined ? location : null,
      website_url !== undefined ? website_url : null,
      avatar_url !== undefined ? avatar_url : null,
      avatar_storage_path !== undefined ? avatar_storage_path : null,
    ]);

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: result.rows[0],
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/users/me/avatar
 * Upload avatar image to Supabase Storage
 */
export const uploadAvatar = async (req, res) => {
  const currentUserId = req.user.user_id;

  if (!req.file) {
    return res.status(400).json({ error: 'No avatar file uploaded' });
  }

  const file = req.file;
  const ext = file.originalname.split('.').pop() || 'png';
  const storagePath = `avatars/${currentUserId}/${Date.now()}.${ext}`;

  try {
    const uploadResult = await uploadFileToStorage(
      'avatars',
      storagePath,
      file.buffer,
      file.mimetype
    );

    await pool.query(
      `UPDATE user_profiles
       SET avatar_url = $1, avatar_storage_path = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [uploadResult.publicUrl, storagePath, currentUserId]
    );

    return res.status(200).json({
      message: 'Avatar uploaded successfully',
      avatar_url: uploadResult.publicUrl,
      avatar_storage_path: storagePath,
    });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

/**
 * PATCH /api/users/:userId/status
 * Platform operator endpoint to suspend or disable accounts
 */
export const updateAccountStatus = async (req, res) => {
  const currentUserId = req.user.user_id;
  const targetUserId = parseInt(req.params.userId, 10);
  const { account_status } = req.body;

  if (!['active', 'suspended', 'disabled'].includes(account_status)) {
    return res.status(400).json({ error: 'Invalid account status' });
  }

  // Operator allowlist: either PLATFORM_OPERATOR_IDS env or user_id 1 by default
  const operatorIds = (process.env.PLATFORM_OPERATOR_IDS || '1')
    .split(',')
    .map((id) => parseInt(id.trim(), 10));

  if (!operatorIds.includes(currentUserId)) {
    return res.status(403).json({ error: 'Forbidden: Operator privileges required' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET account_status = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING user_id, username, email, account_status`,
      [account_status, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'Account status updated',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('updateAccountStatus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
