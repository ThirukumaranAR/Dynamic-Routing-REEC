import { Router } from 'express';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  routeRequest,
  approveRequest,
  rejectRequest,
  raiseQuery,
  respondToQuery,
  escalateRequest,
  reassignRequest,
  setRequestFlag
} from '../controllers/requestController';
import { asyncHandler, authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', asyncHandler(getAllRequests));
router.get('/:id', asyncHandler(getRequestById));
router.post('/', asyncHandler(createRequest));
router.post('/:id/route', asyncHandler(routeRequest));
router.post('/:id/approve', asyncHandler(approveRequest));
router.post('/:id/reject', asyncHandler(rejectRequest));
router.post('/:id/query', asyncHandler(raiseQuery));
router.post('/:id/respond', asyncHandler(respondToQuery));
router.post('/:id/escalate', asyncHandler(escalateRequest));
router.post('/:id/reassign', asyncHandler(reassignRequest));
router.post('/:id/flag', asyncHandler(setRequestFlag));
router.delete('/:id/flag', asyncHandler(setRequestFlag));

export default router;
