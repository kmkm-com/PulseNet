import { Router } from 'express';
import multer from 'multer';
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getSavedPosts,
  getComments,
  addComment,
  deleteComment,
  uploadMedia,
} from '../controllers/post.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// All post routes require authentication
router.use(auth);

// Feed & Posts
router.post('/', createPost);
router.get('/feed', getFeed);
router.post('/media/upload', upload.single('file'), uploadMedia);

// Bookmarks
router.get('/bookmarks/all', getSavedPosts);
router.get('/saved', getSavedPosts);
router.post('/:id/bookmark', savePost);
router.delete('/:id/bookmark', unsavePost);

// Single post operations
router.get('/:id', getPostById);
router.patch('/:id', updatePost);
router.delete('/:id', deletePost);

// Likes & Comments
router.post('/:id/like', likePost);
router.delete('/:id/like', unlikePost);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

export default router;
