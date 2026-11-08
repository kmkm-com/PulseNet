import { Router } from 'express';
import {
  listFriends,
  listSuggestions,
  listRequests,
  getFriendshipStatus,
  sendRequest,
  respondToRequest,
  removeFriendship,
} from '../controllers/friend.controllers.js';
import auth from '../middleware/auth.js';

const router = Router();

// All friend routes require authentication
router.use(auth);

router.get('/',                   listFriends);
router.get('/suggestions',        listSuggestions);
router.get('/requests',           listRequests);
router.post('/requests/:userId',  sendRequest);
router.patch('/requests/:userId', respondToRequest);
router.get('/status/:userId',     getFriendshipStatus);
router.delete('/:userId',         removeFriendship);

export default router;
