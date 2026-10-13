import {Router} from 'express';
import {register} from '../controllers/auth.controllers.js';
const router = Router();
router.post('/register',register);
//POST /api/health/register will be wired here
export default router;