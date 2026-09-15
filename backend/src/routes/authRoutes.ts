import { Router } from 'express';
import { login, register, updateProfile, getMe, getDemoUsers } from '../controllers/authController';
import { authenticateJWT, requireCEO } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/register', authenticateJWT, requireCEO, register);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);
router.get('/demo-users', getDemoUsers);

export default router;
