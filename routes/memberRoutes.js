import express from 'express';
import {
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  deleteMember
} from '../controllers/memberController.js';
import { isAuthenticated, isGymOwner } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * =========================================================================
 * GYM MEMBER CRUD API ROUTES (/api/v1/members)
 * =========================================================================
 * 
 * POST   /api/v1/members         - Add a new gym member
 * GET    /api/v1/members         - Get list of members with search, filters, pagination
 * GET    /api/v1/members/:id     - Get single member details
 * PUT    /api/v1/members/:id     - Update member details, fitness stats, or plan
 * DELETE /api/v1/members/:id     - Deactivate / remove member from gym
 */

router.post('/', isAuthenticated, isGymOwner, createMember);
router.get('/', isAuthenticated, isGymOwner, getMembers);
router.get('/:id', isAuthenticated, isGymOwner, getMemberById);
router.put('/:id', isAuthenticated, isGymOwner, updateMember);
router.delete('/:id', isAuthenticated, isGymOwner, deleteMember);

export default router;
