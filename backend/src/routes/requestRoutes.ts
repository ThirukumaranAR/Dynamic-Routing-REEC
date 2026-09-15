import { Router } from 'express';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  approveRequest,
  rejectRequest,
  raiseQuery,
  respondToQuery,
  escalateRequest,
  reassignRequest
} from '../controllers/requestController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getAllRequests);
router.get('/:id', getRequestById);
router.post('/', createRequest);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);
router.post('/:id/query', raiseQuery);
router.post('/:id/respond', respondToQuery);
router.post('/:id/escalate', escalateRequest);
router.post('/:id/reassign', reassignRequest);

export default router;
