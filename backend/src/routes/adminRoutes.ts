import { Router } from 'express';
import { authenticateJWT, requireCEO } from '../middleware/authMiddleware';
import {
  listManagementData,
  createManagedUser,
  deleteManagedUser,
  createRole,
  deleteRole
} from '../controllers/adminController';

const router = Router();

router.use(authenticateJWT, requireCEO);
router.get('/', listManagementData);
router.post('/users', createManagedUser);
router.delete('/users/:userId', deleteManagedUser);
router.post('/roles', createRole);
router.delete('/roles/:role', deleteRole);

export default router;