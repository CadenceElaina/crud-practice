import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {getUsers, registerUser, loginUser} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const makeAuthLimiter = (message: string) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
        skip: () => process.env.NODE_ENV === 'test',  // add this

    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
});

const loginLimiter    = makeAuthLimiter('Too many login attempts, please try again later');
const registerLimiter = makeAuthLimiter('Too many register attempts, please try again later');


const router = Router();

// Public routes - no auth needed
router.get('/users', authenticateToken, getUsers) // maps path -> controller fn
router.post('/users', registerLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);

export default router;