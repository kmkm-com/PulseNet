import { Router } from 'express';
import { register,login } from '../controllers/auth.controllers.js';
const router = Router();
router.post('/register', register);
router.post('/login', login);
//POST /api/health/register will be wired here
export default router;