import express from 'express';
import { isAuthenticated, isAdmin } from "../middlewares/authMiddleware.js";
import { 
  createAdminPlan, 
  getAllAdminPlans, 
  updateAdminPlan, 
  deleteAdminPlan 
} from '../controllers/adminPlanController.js';

const router = express.Router();

router.post('/create', isAuthenticated, isAdmin, createAdminPlan);
router.get('/all', isAuthenticated, isAdmin, getAllAdminPlans);
router.put('/update/:id', isAuthenticated, isAdmin, updateAdminPlan);
router.delete('/delete/:id', isAuthenticated, isAdmin, deleteAdminPlan);

export default router;
