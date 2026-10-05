import express from 'express';
import { isAuthenticated, isGymOwner } from "../middlewares/authMiddleware.js";
import { 
  getAssignedPlan, 
  createSubscriptionOrder, 
  verifySubscriptionPayment,
  checkSubscriptionStatus
} from '../controllers/gymSubscriptionController.js';

const router = express.Router();

router.get('/assigned-plan', isAuthenticated, isGymOwner, getAssignedPlan);
router.post('/create-order', isAuthenticated, isGymOwner, createSubscriptionOrder);
router.post('/verify-payment', isAuthenticated, isGymOwner, verifySubscriptionPayment);
router.get('/check-status', isAuthenticated, isGymOwner, checkSubscriptionStatus);

export default router;
