import pool from '../db/pool.js';

/**
 * Helper: check group membership and role
 */
async function getMembership(groupId, userId) {
  const result = await pool.query(
    `SELECT role, status, joined_at
     FROM group_members
     WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  return result.rows[0] || null;
}

/**
 * POST /api/groups
 * Create group (creator becomes admin automatically via database trigger)
 */
export const createGroup = async (req, res) => {
  const creator_id = req.user.user_id;
  const { name, description, visibility = 'public' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  if (!['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'Visibility must be either public or private' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO groups (name, description, creator_id, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), description ? description.trim() : null, creator_id, visibility]
    );

    const group = result.rows[0];
    return res.status(201).json({
      message: 'Group created successfully',
      group: {
        ...group,
        member_count: 1,
        user_role: 'admin',
        membership_status: 'active',
      },
    });
  } catch (err) {
    console.error('createGroup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/groups
 * Discover accessible groups (public groups or private groups the user is a member of)
 */
export const listGroups = async (req, res) => {
  const user_id = req.user.user_id;
  const search = req.query.search?.trim();

  try {
    let query = `
      SELECT g.group_id, g.name, g.description, g.visibility, g.creator_id, g.created_at,
             COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.status = 'active')::int AS member_count,
             my_m.role   AS user_role,
             my_m.status AS membership_status
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.group_id
      LEFT JOIN group_members my_m ON my_m.group_id = g.group_id AND my_m.user_id = $1
      WHERE (g.visibility = 'public' OR my_m.user_id IS NOT NULL)
    `;
    const params = [user_id];

    if (search) {
      query += ` AND (g.name ILIKE $2 OR g.description ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY g.group_id, my_m.role, my_m.status
      ORDER BY member_count DESC, g.created_at DESC
      LIMIT 50;
    `;

    const result = await pool.query(query, params);
    return res.status(200).json({ groups: result.rows });
  } catch (err) {
    console.error('listGroups error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/groups/:id
 * Get single group details
 */
export const getGroupById = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      `SELECT g.group_id, g.name, g.description, g.visibility, g.creator_id, g.created_at,
              u.username AS creator_username,
              COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.status = 'active')::int AS member_count,
              my_m.role   AS user_role,
              my_m.status AS membership_status
       FROM groups g
       JOIN users u ON u.user_id = g.creator_id
       LEFT JOIN group_members gm ON gm.group_id = g.group_id
       LEFT JOIN group_members my_m ON my_m.group_id = g.group_id AND my_m.user_id = $1
       WHERE g.group_id = $2
       GROUP BY g.group_id, u.username, my_m.role, my_m.status`,
      [user_id, groupId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = result.rows[0];

    // Privacy rule: private group content is hidden if not an active member
    if (group.visibility === 'private' && group.membership_status !== 'active') {
      return res.status(200).json({
        group: {
          group_id: group.group_id,
          name: group.name,
          description: group.description,
          visibility: group.visibility,
          member_count: group.member_count,
          membership_status: group.membership_status,
          user_role: group.user_role,
          is_restricted: true,
        },
      });
    }

    return res.status(200).json({ group });
  } catch (err) {
    console.error('getGroupById error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/groups/:id
 * Update group name, description, visibility (admin only)
 */
export const updateGroup = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);
  const { name, description, visibility } = req.body;

  try {
    const membership = await getMembership(groupId, user_id);
    if (!membership || membership.role !== 'admin' || membership.status !== 'active') {
      return res.status(403).json({ error: 'Only group admins can update group settings' });
    }

    const result = await pool.query(
      `UPDATE groups
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           visibility = COALESCE($3, visibility),
           updated_at = NOW()
       WHERE group_id = $4
       RETURNING *`,
      [name ? name.trim() : null, description !== undefined ? description : null, visibility || null, groupId]
    );

    return res.status(200).json({ message: 'Group updated successfully', group: result.rows[0] });
  } catch (err) {
    console.error('updateGroup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/groups/:id
 * Delete group (creator or admin only)
 */
export const deleteGroup = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);

  try {
    const groupRes = await pool.query(`SELECT creator_id FROM groups WHERE group_id = $1`, [groupId]);
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const membership = await getMembership(groupId, user_id);
    if (groupRes.rows[0].creator_id !== user_id && (!membership || membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Unauthorized to delete this group' });
    }

    await pool.query(`DELETE FROM groups WHERE group_id = $1`, [groupId]);
    return res.status(200).json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('deleteGroup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/groups/:id/join
 * Join public group immediately or request to join private group
 */
export const joinGroup = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);

  try {
    const groupRes = await pool.query(`SELECT visibility FROM groups WHERE group_id = $1`, [groupId]);
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const visibility = groupRes.rows[0].visibility;
    const initialStatus = visibility === 'public' ? 'active' : 'pending';

    const result = await pool.query(
      `INSERT INTO group_members (group_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'member', $3, NOW())
       ON CONFLICT (group_id, user_id) DO UPDATE SET
         status = CASE WHEN group_members.status = 'pending' THEN EXCLUDED.status ELSE group_members.status END
       RETURNING *`,
      [groupId, user_id, initialStatus]
    );

    const message = initialStatus === 'active' ? 'Joined group successfully' : 'Membership request submitted';
    return res.status(200).json({ message, membership: result.rows[0] });
  } catch (err) {
    console.error('joinGroup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/groups/:id/leave
 * Leave group
 */
export const leaveGroup = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);

  try {
    const membership = await getMembership(groupId, user_id);
    if (!membership) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    // Check if user is the last active admin
    if (membership.role === 'admin') {
      const adminCountRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
        [groupId]
      );
      if (adminCountRes.rows[0].count <= 1) {
        return res.status(400).json({
          error: 'You are the only active admin. Promote another member to admin before leaving, or delete the group.',
        });
      }
    }

    await pool.query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, user_id]);
    return res.status(200).json({ message: 'Left group successfully' });
  } catch (err) {
    console.error('leaveGroup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/groups/:id/members
 * List members of a group
 */
export const listGroupMembers = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);

  try {
    const groupRes = await pool.query(`SELECT visibility FROM groups WHERE group_id = $1`, [groupId]);
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const membership = await getMembership(groupId, user_id);
    if (groupRes.rows[0].visibility === 'private' && (!membership || membership.status !== 'active')) {
      return res.status(403).json({ error: 'Must be an active member to view member list of private group' });
    }

    const result = await pool.query(
      `SELECT gm.group_id, gm.user_id, gm.role, gm.status, gm.joined_at,
              u.username, u.email, prof.full_name, prof.avatar_url
       FROM group_members gm
       JOIN users u ON u.user_id = gm.user_id
       LEFT JOIN user_profiles prof ON prof.user_id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY 
         CASE gm.role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
         gm.joined_at ASC`,
      [groupId]
    );

    return res.status(200).json({ members: result.rows });
  } catch (err) {
    console.error('listGroupMembers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/groups/:id/members/:userId
 * Update member role or status (Approve request, Promote/Demote)
 */
export const updateMemberRole = async (req, res) => {
  const currentUserId = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);
  const targetUserId = parseInt(req.params.userId, 10);
  const { role, status } = req.body;

  try {
    const callerMembership = await getMembership(groupId, currentUserId);
    if (!callerMembership || callerMembership.status !== 'active' || !['admin', 'moderator'].includes(callerMembership.role)) {
      return res.status(403).json({ error: 'Admin or Moderator privileges required' });
    }

    const targetMembership = await getMembership(groupId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member record not found' });
    }

    // Role changes require Admin
    if (role && role !== targetMembership.role) {
      if (callerMembership.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change member roles' });
      }

      // Check demoting last admin
      if (targetMembership.role === 'admin' && role !== 'admin') {
        const adminCountRes = await pool.query(
          `SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
          [groupId]
        );
        if (adminCountRes.rows[0].count <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last active admin of the group' });
        }
      }
    }

    const updateResult = await pool.query(
      `UPDATE group_members
       SET role = COALESCE($1, role),
           status = COALESCE($2, status)
       WHERE group_id = $3 AND user_id = $4
       RETURNING *`,
      [role || null, status || null, groupId, targetUserId]
    );

    return res.status(200).json({
      message: 'Member status updated successfully',
      member: updateResult.rows[0],
    });
  } catch (err) {
    console.error('updateMemberRole error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove a member from the group (Kick)
 */
export const removeMember = async (req, res) => {
  const currentUserId = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);
  const targetUserId = parseInt(req.params.userId, 10);

  try {
    const callerMembership = await getMembership(groupId, currentUserId);
    if (!callerMembership || callerMembership.status !== 'active' || !['admin', 'moderator'].includes(callerMembership.role)) {
      return res.status(403).json({ error: 'Admin or Moderator privileges required' });
    }

    const targetMembership = await getMembership(groupId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found in group' });
    }

    // Moderators cannot kick admins or moderators
    if (callerMembership.role === 'moderator' && ['admin', 'moderator'].includes(targetMembership.role)) {
      return res.status(403).json({ error: 'Moderators cannot remove admins or other moderators' });
    }

    // Cannot remove last admin
    if (targetMembership.role === 'admin') {
      const adminCountRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
        [groupId]
      );
      if (adminCountRes.rows[0].count <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last active admin of the group' });
      }
    }

    await pool.query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('removeMember error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/groups/:id/posts
 * Group feed
 */
export const getGroupPosts = async (req, res) => {
  const user_id = req.user.user_id;
  const groupId = parseInt(req.params.id, 10);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const groupRes = await pool.query(`SELECT visibility FROM groups WHERE group_id = $1`, [groupId]);
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const membership = await getMembership(groupId, user_id);
    if (groupRes.rows[0].visibility === 'private' && (!membership || membership.status !== 'active')) {
      return res.status(403).json({ error: 'Must be an active member to view posts in a private group' });
    }

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
       WHERE p.group_id = $2
         AND p.deleted_at IS NULL
       GROUP BY p.post_id, u.username, prof.full_name, prof.avatar_url
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [user_id, groupId, limit, offset]
    );

    // Fetch media attachments
    const posts = result.rows;
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.post_id);
      const mediaRes = await pool.query(
        `SELECT media_id, post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes
         FROM post_media
         WHERE post_id = ANY($1::int[])`,
        [postIds]
      );
      const mediaMap = {};
      for (const m of mediaRes.rows) {
        if (!mediaMap[m.post_id]) mediaMap[m.post_id] = [];
        const publicUrl = `https://vsuqxguawnxtodcuajij.supabase.co/storage/v1/object/public/${m.storage_bucket}/${m.storage_path}`;
        mediaMap[m.post_id].push({ ...m, url: publicUrl });
      }
      for (const p of posts) {
        p.media = mediaMap[p.post_id] || [];
      }
    }

    return res.status(200).json({ posts, limit, offset });
  } catch (err) {
    console.error('getGroupPosts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
