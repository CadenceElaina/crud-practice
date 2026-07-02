import {Router} from 'express';
import {getUsers, registerUser, loginUser} from '../controllers/userController';

const router = Router();

// Public routes - no auth needed
router.get('/users', getUsers) // maps path -> controller fn
router.post('/users', registerUser);
router.post('/login', loginUser);

export default router;