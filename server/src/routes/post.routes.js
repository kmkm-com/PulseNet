import { Router } from 'express';
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deleteComment,
} from '../controllers/post.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All post routes require authentication
router.use(auth);

router.post('/',                          createPost);
router.get('/feed',                       getFeed);
router.get('/:id',                        getPostById);
router.patch('/:id',                      updatePost);
router.delete('/:id',                     deletePost);

// Likes & Comments
router.post('/:id/like',                  likePost);
router.delete('/:id/like',                unlikePost);
router.get('/:id/comments',               getComments);
router.post('/:id/comments',              addComment);
router.delete('/:id/comments/:commentId', deleteComment);

export default router;
