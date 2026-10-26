import express from "express";
import {
  registerGym,
  addUpdateGymMedia,
  getGymDetails,
  updateGym,
  getAllGyms,
  getGymsByOwner,
  createGymAnnouncement,
  getUserAnnouncementsByGym,
  deleteGymAnnouncement,
  toggleGymStatus,
  addUpdateVerificationDocuments,
} from "../controllers/1_gymReg.js";

import {
  createPlan,
  getGymPlans,
  updatePlan,
  getPlanNameById,
} from "../controllers/3_planMang.js";

import {
  purchasePlan,
  verifyPlanPayment,
  getWalletTransactions,
  getUserPlans,
  getPurchasedPlans,
  getPlanUsage,
  approveCashPayment,
  rejectCashPayment,
  getPendingCashRequests
} from "../controllers/4_userPlanController.js";

import {
  qrCheckIn,
  qrCheckOut,
  getGymRegisterByDate,
  getActiveUsers,
  cleanExpiredUsers,
  getYearlyGymHeatmap,
  streak,
  getActiveCapacity,
} from "../controllers/4_userGymEntry.js";

import {
  addRating,
  getGymRatings,
  updateRating,
  deleteRating,
} from "../controllers/5_ratingController.js";

import {
  getGymDashboardStats,
  getRevenueAnalytics,
  getMemberAnalytics,
  getActiveMemberDetails,
  getSingleMemberDetails
} from "../controllers/6_dashboardController.js";

import { isAuthenticated, isGymOwner, isSubscriptionActive } from "../middlewares/authMiddleware.js";
import { body, validationResult } from "express-validator";
import ErrorHandler from "../middlewares/errorMiddlewares.js";

const router = express.Router();

// Validation middleware
const validateGymRegistration = [
  body('name').notEmpty().withMessage('Gym name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('openTime').notEmpty().withMessage('Opening time is required'),
  body('closeTime').notEmpty().withMessage('Closing time is required'),
  body('contactEmail').isEmail().withMessage('Invalid email format'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('pincode').optional().isLength({ min: 6, max: 6 }).withMessage('Pincode must be 6 digits'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join(', ');
      return next(new ErrorHandler(`Validation error: ${errorMessages}`, 400));
    }
    next();
  }
];

const validatePlanCreation = [
  body('name').notEmpty().withMessage('Plan name is required'),
  body('validity').isInt({ min: 1 }).withMessage('Validity must be at least 1 day'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('discountPercent').isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0-100'),
  body('duration')
    .isFloat({ gt: 0 }) // Allows numbers > 0, including decimals like 1.5
    .withMessage('Workout duration must be a number greater than 0'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join(', ');
      return next(new ErrorHandler(`Validation error: ${errorMessages}`, 400));
    }
    next();
  }
];

//:id-->gymID, planID,..

// Gym Registration & Management Routes
router.post("/gym/register", isAuthenticated, isGymOwner, validateGymRegistration, registerGym);
router.get('/me', isAuthenticated, (req, res) => { //also profileRoute in auth..
  res.status(200).json({
    success: true,
    userId: req.user.id,
  });
});
router.get("/gyms", getAllGyms);

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// Place /gym/pending-requests BEFORE /gym/:id to avoid route collision
router.get("/gym/pending-requests", isAuthenticated, isGymOwner, isSubscriptionActive, getPendingCashRequests);
router.get("/gym/owner/me", isAuthenticated, getGymsByOwner);
router.get("/gym/owner/:ownerId", isAuthenticated, isGymOwner, getGymsByOwner);

// Generic parameterized routes come AFTER specific routes
router.get("/gym/:id", getGymDetails);
router.put("/gym/:id", isAuthenticated, isGymOwner, isSubscriptionActive, updateGym); //will handel updateEquipment also
router.post("/gym/:gymId/media", isAuthenticated, isGymOwner, isSubscriptionActive, addUpdateGymMedia); //also updateGymMedia

// Gym Management
router.put("/gyms/status", isAuthenticated, isGymOwner, isSubscriptionActive, toggleGymStatus);
router.put("/gyms/verification",
  isAuthenticated,
  isGymOwner,
  addUpdateVerificationDocuments
);

// Announcement Management
router.post("/gyms/announcements",
  isAuthenticated,
  isGymOwner,
  isSubscriptionActive,
  createGymAnnouncement
);

router.get("/announcements/gym", isAuthenticated, isSubscriptionActive, getUserAnnouncementsByGym);
router.delete("/announcements/gym/:announcementId",
  isAuthenticated,
  isGymOwner,
  isSubscriptionActive,
  deleteGymAnnouncement
);

// Plans Management Routes (gymId not require also, as gymOwner can create only 1 gym)
router.post("/:gymId/plans", isAuthenticated, isGymOwner, isSubscriptionActive, validatePlanCreation, createPlan); //plans/:gymId (not extendable && feels gym belong to a plan)
router.get("/plans/gym/:gymId", getGymPlans);  //as plans of user also: route should be clear
router.put("/plans/:planId", isAuthenticated, isGymOwner, isSubscriptionActive, updatePlan);
router.get("/name/:id", getPlanNameById); // Route to get plan name by ID


router.post("/plans/purchase", isAuthenticated, purchasePlan); //validatePayment, purchasePlan
router.post("/plans/verifyPlanPayment", isAuthenticated, verifyPlanPayment); //no isAuth required..

// Cash Payment Flow Routes
router.post("/plans/approve-cash", isAuthenticated, isGymOwner, isSubscriptionActive, approveCashPayment);
router.post("/plans/reject-cash", isAuthenticated, isGymOwner, isSubscriptionActive, rejectCashPayment);

router.get("/plans/user", isAuthenticated, getUserPlans);
router.get("/userPlans/gym", isAuthenticated, isSubscriptionActive, getPurchasedPlans);
router.get("/api/transactions", isAuthenticated, isSubscriptionActive, getWalletTransactions);
router.get("/plans/usage/:planId", isAuthenticated, getPlanUsage); //userPlanId (as multiple_samePlan buy allowed)


// Ratings & Reviews Routes
router.post("/ratings", isAuthenticated, addRating);
router.get("/ratings/gym/:gymId", getGymRatings);
router.put("/ratings/:id", isAuthenticated, updateRating);
router.delete("/ratings/:id", isAuthenticated, deleteRating);


// User Gym Entry Routes
router.post("/gym/check-in", isAuthenticated, qrCheckIn); // 1. QR Check-In (User)
router.post("/gym/check-out", isAuthenticated, qrCheckOut); // 2. QR Check-Out (User)
router.get("/userStreak", isAuthenticated, streak); // 3. Streak Calculation (User)
// 4. Daily Earnings Auto-Update (No Route Needed)
// Cron controller hits 3x/day, internally updates GymOwner WalletBalance
router.get("/user/yearly-data", isAuthenticated, getYearlyGymHeatmap); // 5. User Dashboard: Get Yearly Gym Data
////add condition: gymBelongs to gymOwner..
router.get("/gym/:gymId/today-register", isAuthenticated, isGymOwner, isSubscriptionActive, getGymRegisterByDate); // 6. Gym Dashboard: Get Today’s Check-in Register
router.get("/gym/:gymId/active-users", isAuthenticated, isGymOwner, isSubscriptionActive, getActiveUsers); // 7. Gym Dashboard: Get Active + Expired Users (un-checked-out)
router.put("/gym/:gymId/clean-expired-users", isAuthenticated, isGymOwner, isSubscriptionActive, cleanExpiredUsers); // 8. Gym Dashboard: Clean Expired Users (checkOutTimeCalc < now)
router.get("/gym/:gymId/active-capacity", getActiveCapacity); // 9. Get Active Capacity for Current Time Slot (Public)


// Gym Dashboard Routes
router.get("/dashboard/stats/:gymId", isAuthenticated, isGymOwner, isSubscriptionActive, getGymDashboardStats);
router.get("/dashboard/revenue/:gymId", isAuthenticated, isGymOwner, isSubscriptionActive, getRevenueAnalytics);
router.get("/dashboard/members/:gymId", isAuthenticated, isGymOwner, isSubscriptionActive, getMemberAnalytics);
router.get("/dashboard/members/list/:gymId", isAuthenticated, isGymOwner, isSubscriptionActive, getActiveMemberDetails);
router.get("/dashboard/member/details/:planId", isAuthenticated, isGymOwner, isSubscriptionActive, getSingleMemberDetails);

export default router;






