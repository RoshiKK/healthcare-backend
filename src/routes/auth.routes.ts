import { Router } from 'express';
import { loginUser, logoutUser, refreshAccessToken, registerUser } from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', registerUser); // Add this line
router.post('/login', loginUser);
router.post('/logout', authMiddleware, logoutUser);
router.post('/refresh-token', refreshAccessToken);

export default router;