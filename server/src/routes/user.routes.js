import { Router } from 'express';
import multer from 'multer';
import {
  searchUsers,
  getUserProfile,
  updateProfile,
  uploadAvatar,
  updateAccountStatus,
} from '../controllers/user.controllers.js';
import auth from '../middleware/auth.js';
import { userIdParam } from '../utils/params.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// All user routes require authentication
router.use(auth);

// Profile editing and avatar upload for current user
router.patch('/me', updateProfile);
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);

// Search users
router.get('/', searchUsers);

// Individual profile operations
router.param('userId', userIdParam());
router.get('/:userId', getUserProfile);
router.patch('/:userId/status', updateAccountStatus);

export default router;
