import { Router } from 'express';
import { asyncHandler, authenticateJWT, requireCEO, requireChairman } from '../middleware/authMiddleware';
import {
  listManagementData,
  listRoles,
  createManagedUser,
  deleteManagedUser,
  createRole,
  deleteRole,
  listWorkflows,
  saveWorkflow,
  publishWorkflowVersion,
  updateManagedUser,
  listCeoAccounts,
  createCeoAccount,
  updateCeoAccount,
  setCeoAccountActive,
  getAuditHistory,
  getGeneralWorkflow,
  activateGeneralWorkflow,
  validateGeneralWorkflow,
  listWorkflowConfigs,
  getWorkflowConfigById,
  saveWorkflowDraft,
  resetWorkflowDefault,
  validateWorkflowConfigEndpoint,
  activateWorkflowConfig,
  customizeRequestWorkflow,
  validateCustomRequestWorkflow,
  migrateRequestWorkflow
} from '../controllers/adminController';

const router = Router();

router.use(authenticateJWT);
router.get('/', requireCEO, asyncHandler(listManagementData));
router.get('/roles', requireCEO, asyncHandler(listRoles));
router.post('/users', requireCEO, asyncHandler(createManagedUser));
router.put('/users/:userId', requireCEO, asyncHandler(updateManagedUser));
router.delete('/users/:userId', requireCEO, asyncHandler(deleteManagedUser));
router.post('/roles', requireCEO, asyncHandler(createRole));
router.delete('/roles/:role', requireCEO, asyncHandler(deleteRole));
router.get('/workflows', requireCEO, asyncHandler(listWorkflows));
router.put('/workflows/:workflowId', requireCEO, asyncHandler(saveWorkflow));
router.post('/workflow-versions', requireCEO, asyncHandler(publishWorkflowVersion));

// Independent 5 Workflow Configurations Endpoints
router.get('/workflow-configs', requireCEO, asyncHandler(listWorkflowConfigs));
router.get('/workflow-configs/:workflowId', requireCEO, asyncHandler(getWorkflowConfigById));
router.post('/workflow-configs/:workflowId/draft', requireCEO, asyncHandler(saveWorkflowDraft));
router.post('/workflow-configs/:workflowId/reset-default', requireCEO, asyncHandler(resetWorkflowDefault));
router.post('/workflow-configs/:workflowId/validate', requireCEO, asyncHandler(validateWorkflowConfigEndpoint));
router.post('/workflow-configs/:workflowId/activate', requireCEO, asyncHandler(activateWorkflowConfig));

// General workflow backward-compatible endpoints
router.get('/general-workflow', requireCEO, asyncHandler(getGeneralWorkflow));
router.post('/general-workflow/activate', requireCEO, asyncHandler(activateGeneralWorkflow));
router.post('/general-workflow/validate', requireCEO, asyncHandler(validateGeneralWorkflow));
router.put('/requests/:requestId/custom-workflow', requireCEO, asyncHandler(customizeRequestWorkflow));
router.post('/requests/:requestId/validate-workflow', requireCEO, asyncHandler(validateCustomRequestWorkflow));
router.post('/requests/:requestId/migrate', requireCEO, asyncHandler(migrateRequestWorkflow));
router.get('/audit', requireCEO, asyncHandler(getAuditHistory));
router.get('/ceos', requireChairman, asyncHandler(listCeoAccounts));
router.post('/ceos', requireChairman, asyncHandler(createCeoAccount));
router.put('/ceos/:userId', requireChairman, asyncHandler(updateCeoAccount));
router.patch('/ceos/:userId/active', requireChairman, asyncHandler(setCeoAccountActive));
router.delete('/ceos/:userId', requireChairman, (req, res, next) => {
  req.body.active = false;
  next();
}, asyncHandler(setCeoAccountActive));

export default router;