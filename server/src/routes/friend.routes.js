import { Router } from 'express';
import {
  listFriends,
  listSuggestions,
  listRequests,
  sendRequest,
  respondToRequest,
  removeFriendship,
} from '../controllers/friend.controllers.js';
import auth from '../middleware/auth.js';
import { userIdParam } from '../utils/params.js';

const router = Router();

// All friend routes require authentication
router.use(auth);
router.param('userId', userIdParam({ selfMessage: 'You cannot target yourself' }));

router.get('/',                   listFriends);
router.get('/suggestions',        listSuggestions);
router.get('/requests',           listRequests);
router.post('/requests/:userId',  sendRequest);
router.patch('/requests/:userId', respondToRequest);
router.delete('/:userId',         removeFriendship);

export default router;
