import pool from '../db/pool.js';
import { findPosts, getMembership, canModerate } from '../db/queries.js';
import { parsePaging } from '../utils/params.js';

// :id is checked in group.routes.js and stored as req.idParam;
// :userId is stored as req.otherId.
// Express 5 passes errors from these async handlers to errorhandler.js,
// so they don't need their own try/catch.

const isActive = (m) => m?.status === 'active';
const isAdmin = (m) => isActive(m) && m.role === 'admin';

// Group details plus member count and the viewer's ($1) role and status (alias g)
const GROUP_SELECT = `
  SELECT g.group_id, g.name, g.description, g.visibility, g.creator_id, g.created_at,
         (SELECT username FROM users WHERE user_id = g.creator_id) AS creator_username,
         (SELECT COUNT(*) FROM group_members gm
           WHERE gm.group_id = g.group_id AND gm.status = 'active')::int AS member_count,
         me.role   AS user_role,
         me.status AS membership_status
  FROM groups g
  LEFT JOIN group_members me ON me.group_id = g.group_id AND me.user_id = $1`;

// True if the group has only one active admin left
async function isLastAdmin(groupId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS admins FROM group_members
     WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
    [groupId]
  );
  return rows[0].admins <= 1;
}

// Why the user may not see a group's members or posts, or null if they may:
// the group must exist, and private groups are for active members only
async function accessError(groupId, userId) {
  const { rows } = await pool.query('SELECT visibility FROM groups WHERE group_id = $1', [groupId]);
  if (rows.length === 0) {
    return { status: 404, error: 'Group not found' };
  }
  if (rows[0].visibility === 'private' && !isActive(await getMembership(groupId, userId))) {
    return { status: 403, error: 'Only active members can see this private group' };
  }
  return null;
}

// ── Groups ─────────────────────────────────────────────────

// POST /api/groups   Body: { name, description?, visibility? }
// A database trigger makes the creator the group's admin.
export const createGroup = async (req, res) => {
  const { name, description, visibility = 'public' } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  if (!['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'Visibility must be either public or private' });
  }

  const { rows } = await pool.query(
    `INSERT INTO groups (name, description, creator_id, visibility)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name.trim(), description?.trim() || null, req.user.user_id, visibility]
  );
  return res.status(201).json({
    message: 'Group created successfully',
    group: { ...rows[0], member_count: 1, user_role: 'admin', membership_status: 'active' },
  });
};

// GET /api/groups?search=
// Public groups plus the private groups I belong to, biggest first
export const listGroups = async (req, res) => {
  const params = [req.user.user_id];
  let where = "(g.visibility = 'public' OR me.user_id IS NOT NULL)";
  const search = req.query.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    where += ' AND (g.name ILIKE $2 OR g.description ILIKE $2)';
  }

  const { rows } = await pool.query(
    `${GROUP_SELECT} WHERE ${where} ORDER BY member_count DESC, g.created_at DESC LIMIT 50`,
    params
  );
  return res.status(200).json({ groups: rows });
};

// GET /api/groups/:id
// Non-members of a private group only get the basics, with is_restricted: true
export const getGroupById = async (req, res) => {
  const { rows } = await pool.query(`${GROUP_SELECT} WHERE g.group_id = $2`, [req.user.user_id, req.idParam]);
  const group = rows[0];
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (group.visibility === 'private' && group.membership_status !== 'active') {
    const { group_id, name, description, visibility, member_count, membership_status, user_role } = group;
    return res.status(200).json({
      group: { group_id, name, description, visibility, member_count, membership_status, user_role, is_restricted: true },
    });
  }
  return res.status(200).json({ group });
};

// PATCH /api/groups/:id   Body: { name?, description?, visibility? }  (admins only)
export const updateGroup = async (req, res) => {
  if (!isAdmin(await getMembership(req.idParam, req.user.user_id))) {
    return res.status(403).json({ error: 'Only group admins can update group settings' });
  }

  const { name, description, visibility } = req.body;
  const { rows } = await pool.query(
    `UPDATE groups
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         visibility = COALESCE($3, visibility),
         updated_at = NOW()
     WHERE group_id = $4
     RETURNING *`,
    [name?.trim() || null, description ?? null, visibility || null, req.idParam]
  );
  return res.status(200).json({ message: 'Group updated successfully', group: rows[0] });
};

// DELETE /api/groups/:id   (creator or admin)
export const deleteGroup = async (req, res) => {
  const user_id = req.user.user_id;
  const { rows } = await pool.query('SELECT creator_id FROM groups WHERE group_id = $1', [req.idParam]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (rows[0].creator_id !== user_id && !isAdmin(await getMembership(req.idParam, user_id))) {
    return res.status(403).json({ error: 'Unauthorized to delete this group' });
  }

  await pool.query('DELETE FROM groups WHERE group_id = $1', [req.idParam]);
  return res.status(200).json({ message: 'Group deleted successfully' });
};

// ── Membership ─────────────────────────────────────────────

// POST /api/groups/:id/join
// Public group: join straight away. Private group: request to join (pending).
export const joinGroup = async (req, res) => {
  const { rows } = await pool.query('SELECT visibility FROM groups WHERE group_id = $1', [req.idParam]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const status = rows[0].visibility === 'public' ? 'active' : 'pending';

  // Re-joining: a pending request may become active; an existing member is left unchanged
  const result = await pool.query(
    `INSERT INTO group_members (group_id, user_id, role, status)
     VALUES ($1, $2, 'member', $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET
       status = CASE WHEN group_members.status = 'pending' THEN EXCLUDED.status ELSE group_members.status END
     RETURNING *`,
    [req.idParam, req.user.user_id, status]
  );
  const message = status === 'active' ? 'Joined group successfully' : 'Membership request submitted';
  return res.status(200).json({ message, membership: result.rows[0] });
};

// DELETE /api/groups/:id/leave   (the last admin cannot leave)
export const leaveGroup = async (req, res) => {
  const me = await getMembership(req.idParam, req.user.user_id);
  if (!me) {
    return res.status(400).json({ error: 'You are not a member of this group' });
  }
  if (isAdmin(me) && (await isLastAdmin(req.idParam))) {
    return res.status(400).json({
      error: 'You are the only active admin. Promote another member to admin before leaving, or delete the group.',
    });
  }

  await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [req.idParam, req.user.user_id]);
  return res.status(200).json({ message: 'Left group successfully' });
};

// GET /api/groups/:id/members   (admins first, then moderators, then members)
export const listGroupMembers = async (req, res) => {
  const denied = await accessError(req.idParam, req.user.user_id);
  if (denied) {
    return res.status(denied.status).json({ error: denied.error });
  }

  const { rows } = await pool.query(
    `SELECT gm.group_id, gm.user_id, gm.role, gm.status, gm.joined_at,
            u.username, up.full_name, up.avatar_url
     FROM group_members gm
     JOIN users u ON u.user_id = gm.user_id
     LEFT JOIN user_profiles up ON up.user_id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY CASE gm.role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, gm.joined_at`,
    [req.idParam]
  );
  return res.status(200).json({ members: rows });
};

// PATCH /api/groups/:id/members/:userId   Body: { role?, status? }
// Admins and moderators can approve requests (status); only admins can change roles.
export const updateMemberRole = async (req, res) => {
  const { role, status } = req.body;
  const me = await getMembership(req.idParam, req.user.user_id);
  if (!canModerate(me)) {
    return res.status(403).json({ error: 'Admin or Moderator privileges required' });
  }
  const target = await getMembership(req.idParam, req.otherId);
  if (!target) {
    return res.status(404).json({ error: 'Member record not found' });
  }

  if (role && role !== target.role) {
    if (me.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change member roles' });
    }
    if (target.role === 'admin' && (await isLastAdmin(req.idParam))) {
      return res.status(400).json({ error: 'Cannot demote the last active admin of the group' });
    }
  }

  const { rows } = await pool.query(
    `UPDATE group_members
     SET role = COALESCE($1, role), status = COALESCE($2, status)
     WHERE group_id = $3 AND user_id = $4
     RETURNING *`,
    [role || null, status || null, req.idParam, req.otherId]
  );
  return res.status(200).json({ message: 'Member status updated successfully', member: rows[0] });
};

// DELETE /api/groups/:id/members/:userId
// Admins and moderators can remove members; moderators cannot remove admins or moderators.
export const removeMember = async (req, res) => {
  const me = await getMembership(req.idParam, req.user.user_id);
  if (!canModerate(me)) {
    return res.status(403).json({ error: 'Admin or Moderator privileges required' });
  }
  const target = await getMembership(req.idParam, req.otherId);
  if (!target) {
    return res.status(404).json({ error: 'Member not found in group' });
  }
  if (me.role === 'moderator' && ['admin', 'moderator'].includes(target.role)) {
    return res.status(403).json({ error: 'Moderators cannot remove admins or other moderators' });
  }
  if (target.role === 'admin' && (await isLastAdmin(req.idParam))) {
    return res.status(400).json({ error: 'Cannot remove the last active admin of the group' });
  }

  await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [req.idParam, req.otherId]);
  return res.status(200).json({ message: 'Member removed successfully' });
};

// ── Group feed ─────────────────────────────────────────────

// GET /api/groups/:id/posts?limit=&offset=
export const getGroupPosts = async (req, res) => {
  const denied = await accessError(req.idParam, req.user.user_id);
  if (denied) {
    return res.status(denied.status).json({ error: denied.error });
  }

  const paging = parsePaging(req.query, { defaultLimit: 20, maxLimit: 100 });
  const posts = await findPosts('p.group_id = $2', [req.user.user_id, req.idParam], paging);
  return res.status(200).json({ posts, ...paging });
};
