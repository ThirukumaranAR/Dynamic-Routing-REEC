import { Router } from 'express';
import { getDashboardStats, getFlowCategories, getSOPs } from '../controllers/analyticsController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard', getDashboardStats);
router.get('/categories', getFlowCategories);
router.get('/sops', getSOPs);

export default router;
