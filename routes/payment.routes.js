// routes/walletRoutes.js
import express from "express";
import {
  getGymWalletBalance,
  payMoneyToGym,
  getPaymentHistory,
  payRefundToUser,
  requestSettlement,
  getMySettlementRequests,
  getAllSettlementRequests,
  updateSettlementStatus
} from "../controllers/walletController.js";
import { isAuthenticated, isAdmin, isGymOwnerOrAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Gym wallet balance
router.get("/gym-balance/:gymId?",
  isAuthenticated,
  isGymOwnerOrAdmin,
  getGymWalletBalance
);

// Admin operations
router.post("/pay-to-gym",
  isAuthenticated,
  isAdmin,
  payMoneyToGym
);

router.get("/history/:gymId?",
  isAuthenticated,
  isGymOwnerOrAdmin,
  getPaymentHistory
);

router.post("/refund-user",
  isAuthenticated,
  isAdmin,
  payRefundToUser
);

// Settlement Requests
router.post("/request-settlement",
  isAuthenticated,
  isGymOwnerOrAdmin,
  requestSettlement
);

router.get("/my-settlement-requests",
  isAuthenticated,
  isGymOwnerOrAdmin,
  getMySettlementRequests
);

router.get("/settlement-requests",
  isAuthenticated,
  isAdmin,
  getAllSettlementRequests
);

router.put("/settlement/:id/status",
  isAuthenticated,
  isAdmin,
  updateSettlementStatus
);

export default router;



