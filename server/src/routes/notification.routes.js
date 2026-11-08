import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  deleteNotification,
} from '../controllers/notification.controllers.js';
import auth from '../middleware/auth.js';
import { idParam } from '../utils/params.js';

const router = Router();

// All notification routes require authentication
router.use(auth);
router.param('id', idParam('notification'));

router.get('/',               listNotifications);
router.get('/unread-count',   getUnreadCount);
router.patch('/read-all',     markAllRead);
router.patch('/:id/read',     markOneRead);
router.delete('/:id',         deleteNotification);

export default router;
