import {Router} from 'express';
import {getUsers, registerUser, loginUser} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
const router = Router();

// Public routes - no auth needed
router.get('/users', authenticateToken, getUsers) // maps path -> controller fn
router.post('/users', registerUser);
router.post('/login', loginUser);

export default router;