import express from 'express';
import { getMyGyms, getGymBranches, createBranch } from '../controllers/tenantController.js';
import { isAuthenticated, requirePermissions, tenantContext } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/my-gyms', isAuthenticated, getMyGyms);
router.get('/branches', isAuthenticated, tenantContext, getGymBranches);
router.get('/:gymId/branches', isAuthenticated, tenantContext, getGymBranches);
router.post('/branches', isAuthenticated, tenantContext, requirePermissions('BRANCH_MANAGE'), createBranch);
router.post('/:gymId/branches', isAuthenticated, tenantContext, requirePermissions('BRANCH_MANAGE'), createBranch);

export default router;

