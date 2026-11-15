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
import { idParam, userIdParam } from '../utils/params.js';

const router = Router();

// all groups require auth
router.use(auth);
// :id is stored as req.idParam and :userId as req.otherId (both must be positive numbers)
router.param('id', idParam('group'));
router.param('userId', userIdParam());

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
router.post('/:id/posts', (req, res) => {
  req.body.group_id = req.idParam;
  return createPost(req, res);
});

export default router;
