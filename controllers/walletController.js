import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import * as walletService from "../services/walletService.js";

/**
 * @description Get gym wallet balance
 * @route GET /api/wallet/gym-balance/:gymId?
 * @access Private (admin or gym owner)
 */
export const getGymWalletBalance = catchAsyncErrors(async (req, res, next) => {
  const { gymId } = req.params;
  
  const data = await walletService.getGymWalletBalanceService(gymId, req.user);
  
  res.status(200).json({
    success: true,
    data
  });
});

/**
 * @description Admin transfers money to gym
 * @route POST /api/wallet/pay-to-gym
 * @access Private (admin only)
 */
export const payMoneyToGym = catchAsyncErrors(async (req, res, next) => {
  const { gymId, amount, adminTransferTxnId, adminNotes } = req.body;

  if (!gymId || !amount || !adminTransferTxnId) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  const transaction = await walletService.payMoneyToGymService(req.body);

  res.status(200).json({
    success: true,
    data: transaction
  });
});

/**
 * @description Get payment history
 * @route GET /api/wallet/history
 * @access Private (admin only)
 */
export const getPaymentHistory = catchAsyncErrors(async (req, res, next) => {
  const { gymId } = req.params;

  if (!gymId) {
    return next(new ErrorHandler("Must provide gymId", 400));
  }

  const transactions = await walletService.getPaymentHistoryService(gymId, req.user);

  res.status(200).json({
    success: true,
    data: transactions,
  });
});

/**
 * @description Admin issues refund to user
 * @route POST /api/wallet/refund-user
 * @access Private (admin only)
 */
export const payRefundToUser = catchAsyncErrors(async (req, res, next) => {
  const { userPlanId, amount, adminTransferTxnId, adminNotes, gymShare } = req.body;

  if (!userPlanId || !amount || !adminTransferTxnId) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  const data = await walletService.payRefundToUserService(req.body);

  res.status(200).json({
    success: true,
    data
  });
});

/**
 * @description Request a settlement
 * @route POST /api/payment/request-settlement
 * @access Private (Gym Owner)
 */
export const requestSettlement = catchAsyncErrors(async (req, res, next) => {
  const { gymId, amount, bankDetails } = req.body;

  if (!gymId || !amount || !bankDetails) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  const settlementRequest = await walletService.requestSettlementService(req.body, req.user.id);

  res.status(201).json({
    success: true,
    data: settlementRequest
  });
});

/**
 * @description Get all settlement requests (Admin)
 * @route GET /api/payment/settlement-requests
 * @access Private (Admin)
 */
export const getAllSettlementRequests = catchAsyncErrors(async (req, res, next) => {
  const requests = await walletService.getAllSettlementRequestsService();

  res.status(200).json({
    success: true,
    data: requests
  });
});

/**
 * @description Get my settlement requests (Gym Owner)
 * @route GET /api/payment/my-settlement-requests
 * @access Private (Gym Owner)
 */
export const getMySettlementRequests = catchAsyncErrors(async (req, res, next) => {
  const requests = await walletService.getMySettlementRequestsService(req.user.id);

  res.status(200).json({
    success: true,
    data: requests
  });
});

/**
 * @description Update settlement status (Admin)
 * @route PUT /api/payment/settlement/:id/status
 * @access Private (Admin)
 */
export const updateSettlementStatus = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    return next(new ErrorHandler("Invalid status", 400));
  }

  const request = await walletService.updateSettlementStatusService(id, req.body);

  res.status(200).json({
    success: true,
    data: request
  });
});
