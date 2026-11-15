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

// all groups require auth
router.use(auth);

router.post('/', createGroup);
router.get('/', listGroups);

// Individual group ops
router.get('/:id', getGroupById);
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

// group membership operations
router.post('/:id/join', joinGroup);
router.delete('/:id/leave', leaveGroup);
router.get('/:id/members', listGroupMembers);
router.patch('/:id/members/:userId', updateMemberRole);
router.delete('/:id/members/:userId', removeMember);

// Group feed and posting
router.get('/:id/posts', getGroupPosts);
router.post('/:id/posts', (req, res, next) => {
  req.body.group_id = parseInt(req.params.id, 10);
  return createPost(req, res, next);
});

export default router;
