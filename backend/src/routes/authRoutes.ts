import { Router } from 'express';
import { login, logout, updateProfile, getMe } from '../controllers/authController';
import { asyncHandler, authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', asyncHandler(login as any));
router.post('/logout', logout);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, asyncHandler(updateProfile));

export default router;
