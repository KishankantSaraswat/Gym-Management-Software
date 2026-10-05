import { sequelize } from '../database/db.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import * as walletRepository from '../repositories/walletRepository.js';

export const getGymWalletBalanceService = async (gymId, user) => {
  let query = {};
  if (user.role === "Admin") {
    query = { id: gymId };
  } else {
    query = { id: gymId, ownerId: user.id };
  }

  const gym = await walletRepository.findGymWithOwner(query);
  if (!gym) throw new ErrorHandler("Gym not found", 404);

  return {
    gymId: gym.id,
    balance: gym.owner ? gym.owner.walletBalance : 0,
    gymName: gym.name
  };
};

export const payMoneyToGymService = async (data) => {
  const { gymId, amount, adminTransferTxnId, adminNotes } = data;

  return await sequelize.transaction(async (t) => {
    const gym = await walletRepository.findGymByIdWithOwner(gymId, t);
    if (!gym) {
      throw new ErrorHandler("Gym not found", 404);
    }

    const transaction = await walletRepository.createWalletTransaction({
      userId: gym.owner.id,
      amount: amount,
      type: "Debit",
      status: "Completed",
      reason: "admin payment to gym",
      adminTransferTxnId,
      adminNotes,
      metadata: {
        gymId: gym.id
      }
    }, t);

    await walletRepository.decrementUserWalletBalance(gym.owner.id, amount, t);

    return transaction;
  });
};

export const getPaymentHistoryService = async (gymId, user) => {
  let query = {};
  
  if (user.role === "Admin") {
    query["metadata.gymId"] = gymId;
    query.reason = "admin payment to gym";
  } else {
    const gym = await walletRepository.findGymWithOwner({ id: gymId, ownerId: user.id });
    if (!gym) throw new ErrorHandler("Unauthorized to access this gym's data", 403);
    query["metadata.gymId"] = gymId;
    query.reason = "admin payment to gym";
  }

  return await walletRepository.findTransactions(query);
};

export const payRefundToUserService = async (data) => {
  const { userPlanId, amount, adminTransferTxnId, adminNotes, gymShare } = data;

  return await sequelize.transaction(async (t) => {
    const userPlan = await walletRepository.findUserPlanByIdWithDetails(userPlanId, t);

    if (!userPlan) {
      throw new ErrorHandler("User plan not found", 404);
    }

    const userTransaction = await walletRepository.createWalletTransaction({
      userId: userPlan.userId,
      amount: amount,
      type: "Credit",
      status: "Completed",
      reason: "refund to user",
      adminTransferTxnId,
      adminNotes,
      metadata: {
        planId: userPlan.planId,
        gymId: userPlan.gymId,
        userPlanId: userPlan.id
      }
    }, t);

    const gymBear = amount * gymShare;

    const gymTransaction = await walletRepository.createWalletTransaction({
      userId: userPlan.gym.ownerId,
      amount: gymBear,
      type: "Debit",
      status: "Completed",
      reason: "refund to user",
      adminTransferTxnId,
      adminNotes,
      metadata: {
        planId: userPlan.planId,
        gymId: userPlan.gymId,
        userPlanId: userPlan.id,
        relatedTransaction: userTransaction.id
      }
    }, t);

    await walletRepository.expireUserPlan(userPlan, t);
    await walletRepository.decrementUserWalletBalance(userPlan.gym.ownerId, gymBear, t);

    return {
      userTransaction,
      gymTransaction
    };
  });
};

export const requestSettlementService = async (data, ownerId) => {
  const { gymId, amount, bankDetails } = data;

  const gym = await walletRepository.findGymWithOwner({ id: gymId, ownerId });
  if (!gym) {
    throw new ErrorHandler("Gym not found or unauthorized", 404);
  }

  if (gym.owner.walletBalance < amount) {
    throw new ErrorHandler("Insufficient balance", 400);
  }

  return await walletRepository.createSettlementRequest({
    gymId,
    ownerId,
    amount,
    bankDetails,
    status: 'Pending'
  });
};

export const getAllSettlementRequestsService = async () => {
  return await walletRepository.findAllSettlementRequests();
};

export const getMySettlementRequestsService = async (ownerId) => {
  return await walletRepository.findSettlementRequestsByOwner(ownerId);
};

export const updateSettlementStatusService = async (id, data) => {
  const { status, adminNotes, transactionId } = data;

  const request = await walletRepository.findSettlementRequestById(id);
  if (!request) {
    throw new ErrorHandler("Settlement request not found", 404);
  }

  if (request.status !== 'Pending') {
    throw new ErrorHandler("Request already processed", 400);
  }

  return await sequelize.transaction(async (t) => {
    if (status === 'Approved') {
      const user = await walletRepository.findUserById(request.ownerId, t);
      if (user.walletBalance < request.amount) {
        throw new ErrorHandler("Insufficient balance in user's wallet now", 400);
      }

      user.walletBalance -= request.amount;
      await walletRepository.saveUser(user, t);

      await walletRepository.createWalletTransaction({
        userId: request.ownerId,
        amount: request.amount,
        type: "Debit",
        status: "Completed",
        reason: "admin payment to gym",
        adminTransferTxnId: transactionId,
        adminNotes: adminNotes,
        metadata: {
          gymId: request.gym.id
        }
      }, t);
    }

    request.status = status;
    request.adminNotes = adminNotes;
    request.transactionId = transactionId;
    request.processedAt = Date.now();
    await walletRepository.saveSettlementRequest(request, t);

    return request;
  });
};
