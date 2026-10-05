import { Gym, AdminPlan, GymSubscription } from "../models/index.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { createRazorpayInstance } from "../config/razorpay.config.js";
import crypto from "crypto";
import { sequelize } from '../database/db.js';

// Lazy initialization of Razorpay instance
let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    razorpayInstance = createRazorpayInstance();
  }
  return razorpayInstance;
};

// Get the plan assigned to the gym by admin
export const getAssignedPlan = catchAsyncErrors(async (req, res, next) => {
  const gym = await Gym.findOne({ where: { ownerId: req.user.id }, include: [{ model: AdminPlan, as: 'assignedPlan' }] });

  if (!gym) {
    return next(new ErrorHandler("Gym not found", 404));
  }

  if (!gym.assignedPlan) {
    return next(new ErrorHandler("No plan assigned by admin yet", 400));
  }

  res.status(200).json({
    success: true,
    plan: gym.assignedPlan,
    subscriptionStatus: gym.subscriptionStatus,
    subscriptionExpiry: gym.subscriptionExpiry
  });
});

// Create Razorpay order for the assigned plan
export const createSubscriptionOrder = catchAsyncErrors(async (req, res, next) => {
  const gym = await Gym.findOne({ where: { ownerId: req.user.id }, include: [{ model: AdminPlan, as: 'assignedPlan' }] });

  if (!gym || !gym.assignedPlan) {
    return next(new ErrorHandler("Assigned plan not found", 404));
  }

  const amount = gym.assignedPlan.price * 100; // in paise
  const receiptId = `sub_${gym.id.toString().substring(0, 6)}_${Date.now().toString().substring(6)}`;

  const options = {
    amount,
    currency: "INR",
    receipt: receiptId,
    notes: {
      gymId: gym.id.toString(),
      planId: gym.assignedPlan.id.toString(),
      type: "GYM_SUBSCRIPTION"
    }
  };

  const order = await getRazorpay().orders.create(options);

  res.status(200).json({
    success: true,
    order,
    key: process.env.RAZORPAY_KEY_ID
  });
});

// Verify payment and activate subscription
export const verifySubscriptionPayment = catchAsyncErrors(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return next(new ErrorHandler("Payment verification failed", 400));
  }

  await sequelize.transaction(async (t) => {
    try {
      const gym = await Gym.findOne({ where: { ownerId: req.user.id }, transaction: t });
      if (!gym) throw new Error("Gym not found");

      const plan = await AdminPlan.findByPk(gym.assignedPlanId, { transaction: t });
      if (!plan) throw new Error("Assigned plan not found");

      // Calculate expiry date
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.duration);

      // Create subscription record
      const subscription = await GymSubscription.create({
        gymId: gym.id,
        adminPlanId: plan.id,
        startDate,
        endDate,
        status: 'active',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amountPaid: plan.price
      }, { transaction: t });

      // Update gym status
      gym.subscriptionStatus = 'active';
      gym.subscriptionExpiry = endDate;
      await gym.save({ transaction: t });

      res.status(200).json({
        success: true,
        message: "Subscription activated successfully",
        subscription: subscription,
        expiryDate: endDate
      });
    } catch (error) {
      console.error("Subscription activation error:", error);
      return next(new ErrorHandler("Failed to activate subscription", 500));
    }
  });
});

// Check subscription status (utility or separate endpoint)
export const checkSubscriptionStatus = catchAsyncErrors(async (req, res, next) => {
    const gym = await Gym.findOne({ where: { ownerId: req.user.id } });
    
    if (!gym) return next(new ErrorHandler("Gym not found", 404));

    const today = new Date();
    if (gym.subscriptionExpiry && gym.subscriptionExpiry < today) {
        gym.subscriptionStatus = 'expired';
        await gym.save();
    }

    res.status(200).json({
        success: true,
        status: gym.subscriptionStatus,
        expiry: gym.subscriptionExpiry
    });
});
