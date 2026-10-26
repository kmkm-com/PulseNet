import { Router } from 'express';
import { createPost, getFeed, getPostById, updatePost, deletePost } from '../controllers/post.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All post routes require authentication
router.use(auth);

router.post('/',       createPost);
router.get('/feed',    getFeed);
router.get('/:id',     getPostById);
router.patch('/:id',   updatePost);
router.delete('/:id',  deletePost);

export default router;
