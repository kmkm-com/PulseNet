import { Router } from 'express';
import {
  listConversations,
  getUnreadCount,
  getConversation,
  sendMessage,
  markConversationRead,
} from '../controllers/message.controllers.js';
import auth from '../middleware/auth.js';
import { userIdParam } from '../utils/params.js';

const router = Router();

// All message routes require authentication
router.use(auth);
router.param('userId', userIdParam({ selfMessage: 'You cannot message yourself' }));

router.get('/',                listConversations);
router.get('/unread-count',    getUnreadCount);
router.get('/:userId',         getConversation);
router.post('/:userId',        sendMessage);
router.patch('/:userId/read',  markConversationRead);

export default router;
