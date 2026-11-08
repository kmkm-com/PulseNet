import { Router } from 'express';
import { searchUsers, getUserProfile } from '../controllers/user.controllers.js';
import auth from '../middleware/auth.js';
import { userIdParam } from '../utils/params.js';

const router = Router();

// All user routes require authentication
router.use(auth);
router.param('userId', userIdParam()); // viewing your own profile is allowed

router.get('/',         searchUsers);
router.get('/:userId',  getUserProfile);

export default router;
