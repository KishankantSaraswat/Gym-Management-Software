import { WalletTransaction, User, Gym, UserPlan, SettlementRequest } from "../models/index.js";

export const findGymWithOwner = async (query) => {
  return await Gym.findOne({
    where: query,
    include: [{ model: User, as: 'owner' }]
  });
};

export const findGymByIdWithOwner = async (gymId, transaction) => {
  return await Gym.findByPk(gymId, {
    include: [{ model: User, as: 'owner' }],
    transaction
  });
};

export const createWalletTransaction = async (data, transaction) => {
  return await WalletTransaction.create(data, { transaction });
};

export const decrementUserWalletBalance = async (userId, amount, transaction) => {
  return await User.decrement('walletBalance', { 
    by: amount, 
    where: { id: userId }, 
    transaction 
  });
};

export const findTransactions = async (query) => {
  return await WalletTransaction.findAll({
    where: query,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
  });
};

export const findUserPlanByIdWithDetails = async (userPlanId, transaction) => {
  return await UserPlan.findByPk(userPlanId, {
    include: [{ model: User, as: 'user' }, { model: Gym, as: 'gym' }],
    transaction
  });
};

export const expireUserPlan = async (userPlan, transaction) => {
  return await userPlan.update({ isExpired: true }, { transaction });
};

export const createSettlementRequest = async (data) => {
  return await SettlementRequest.create(data);
};

export const findAllSettlementRequests = async () => {
  return await SettlementRequest.findAll({
    include: [
      { model: Gym, as: 'gym', attributes: ['name'] },
      { model: User, as: 'owner', attributes: ['name', 'email'] }
    ],
    order: [['createdAt', 'DESC']]
  });
};

export const findSettlementRequestsByOwner = async (ownerId) => {
  return await SettlementRequest.findAll({
    where: { ownerId },
    include: [{ model: Gym, as: 'gym', attributes: ['name'] }],
    order: [['createdAt', 'DESC']]
  });
};

export const findSettlementRequestById = async (id) => {
  return await SettlementRequest.findByPk(id, {
    include: [{ model: Gym, as: 'gym' }, { model: User, as: 'owner' }]
  });
};

export const findUserById = async (id, transaction) => {
  return await User.findByPk(id, { transaction });
};

export const saveUser = async (user, transaction) => {
  return await user.save({ transaction });
};

export const saveSettlementRequest = async (request, transaction) => {
  return await request.save({ transaction });
};
