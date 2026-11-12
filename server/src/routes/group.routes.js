import { Router } from 'express';
import {
  createGroup,
  listGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listGroupMembers,
  updateMemberRole,
  removeMember,
  getGroupPosts,
} from '../controllers/group.controllers.js';
import { createPost } from '../controllers/post.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All group routes require authentication
router.use(auth);

// Group list & creation
router.post('/', createGroup);
router.get('/', listGroups);

// Individual group operations
router.get('/:id', getGroupById);
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

// Membership operations
router.post('/:id/join', joinGroup);
router.delete('/:id/leave', leaveGroup);
router.get('/:id/members', listGroupMembers);
router.patch('/:id/members/:userId', updateMemberRole);
router.delete('/:id/members/:userId', removeMember);

// Group feed & posting
router.get('/:id/posts', getGroupPosts);
router.post('/:id/posts', (req, res, next) => {
  req.body.group_id = parseInt(req.params.id, 10);
  return createPost(req, res, next);
});

export default router;
