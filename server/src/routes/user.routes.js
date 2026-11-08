import { Router } from 'express';
import { searchUsers, getUserProfile } from '../controllers/user.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All user routes require authentication
router.use(auth);

router.get('/',         searchUsers);
router.get('/:userId',  getUserProfile);

export default router;
