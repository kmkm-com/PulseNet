import { Router } from 'express';
import {
  listConversations,
  getUnreadCount,
  getConversation,
  sendMessage,
  markConversationRead,
} from '../controllers/message.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All message routes require authentication
router.use(auth);

router.get('/',                listConversations);
router.get('/unread-count',    getUnreadCount);
router.get('/:userId',         getConversation);
router.post('/:userId',        sendMessage);
router.patch('/:userId/read',  markConversationRead);

export default router;
