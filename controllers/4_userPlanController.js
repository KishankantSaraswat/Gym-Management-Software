import paymentService from '../services/paymentService.js';
import * as planService from '../services/planService.js';
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";

export const purchasePlan = catchAsyncErrors(async (req, res, next) => {
  try {
    const { planId, paymentMode } = req.body;
    const userId = req.user.id;
    
    const result = await paymentService.purchasePlan(userId, planId, paymentMode);
    
    res.status(200).json({ success: true, ...result, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('not verified')) {
      return next(new ErrorHandler(error.message, error.message.includes('not found') ? 404 : 403));
    }
    return next(new ErrorHandler("Failed to initiate plan purchase: " + error.message, 500));
  }
});

export const verifyPlanPayment = catchAsyncErrors(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await paymentService.verifyPlanPayment(userId, req.body);
    
    res.status(200).json({
      success: true,
      message: "Plan purchased successfully",
      userPlan: result.userPlan,
      paymentDetails: {
        totalAmount: result.amount
      }
    });
  } catch (error) {
    if (error.message === "Payment verification failed - Invalid signature" || error.message === "Invalid gymId format") {
      return next(new ErrorHandler(error.message, 400));
    }
    if (error.message.includes('not found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(new ErrorHandler("Plan purchase processing failed: " + error.message, 500));
  }
});

export const processRefund = catchAsyncErrors(async (req, res, next) => {
  try {
    const { userPlanId, reason } = req.body;
    const refundAmount = await paymentService.processRefund(userPlanId, reason);
    
    res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      refundAmount
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(new ErrorHandler("Refund processing failed: " + error.message, 500));
  }
});

export const getUserPlans = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user.id;
  const plans = await planService.getUserPlans(userId);
  res.status(200).json({ success: true, plans });
});

export const getPurchasedPlans = catchAsyncErrors(async (req, res, next) => {
  const ownerId = req.user.id;
  try {
    const plans = await planService.getPurchasedPlans(ownerId);
    res.status(200).json({ success: true, plans });
  } catch (error) {
    if (error.message.includes('Gym not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return next(new ErrorHandler(error.message, 500));
  }
});

export const getPlanUsage = catchAsyncErrors(async (req, res, next) => {
  const { planId } = req.params;
  const userId = req.user.id;
  
  try {
    const usage = await planService.getPlanUsage(planId, userId);
    res.status(200).json({ success: true, ...usage });
  } catch (error) {
    if (error.message === 'Plan not found') {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(new ErrorHandler(error.message, 500));
  }
});

export const approveCashPayment = catchAsyncErrors(async (req, res, next) => {
  try {
    const { walletTransactionId } = req.body;
    const gymOwnerId = req.user.id;
    
    const userPlan = await paymentService.approveCashPayment(walletTransactionId, gymOwnerId);
    
    res.status(200).json({
      success: true,
      message: "Cash payment approved successfully",
      userPlan
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    if (error.message.includes('authorized')) {
      return next(new ErrorHandler(error.message, 403));
    }
    return next(new ErrorHandler("Failed to approve cash payment: " + error.message, 500));
  }
});

export const rejectCashPayment = catchAsyncErrors(async (req, res, next) => {
  try {
    const { walletTransactionId, reason } = req.body;
    const gymOwnerId = req.user.id;
    
    await paymentService.rejectCashPayment(walletTransactionId, reason, gymOwnerId);
    
    res.status(200).json({
      success: true,
      message: "Cash payment rejected successfully"
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    if (error.message.includes('authorized')) {
      return next(new ErrorHandler(error.message, 403));
    }
    return next(new ErrorHandler("Failed to reject cash payment: " + error.message, 500));
  }
});

export const getPendingCashRequests = catchAsyncErrors(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorHandler("Authentication failed. User not found in request.", 401));
  }

  const gymOwnerId = req.user.id;
  try {
    const pendingRequests = await paymentService.getPendingCashRequests(gymOwnerId);
    res.status(200).json({
      success: true,
      count: pendingRequests.length,
      data: pendingRequests
    });
  } catch (error) {
    if (error.message.includes('Gym not found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(new ErrorHandler(error.message, 500));
  }
});

export const getWalletTransactions = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const transactions = await paymentService.getWalletTransactions(userId);
    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    if (error.message.includes('Invalid user ID')) {
      return next(new ErrorHandler(error.message, 400));
    }
    if (error.message.includes('No wallet transactions found')) {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(new ErrorHandler(error.message, 500));
  }
});