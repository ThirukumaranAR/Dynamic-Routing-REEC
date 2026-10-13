import { Router } from 'express';
import { getDashboardStats, getFlowCategories, getSOPs } from '../controllers/analyticsController';
import { asyncHandler, authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard', asyncHandler(getDashboardStats));
router.get('/categories', asyncHandler(getFlowCategories));
router.get('/sops', asyncHandler(getSOPs));

export default router;
