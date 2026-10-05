import { Op } from 'sequelize';
import { UserPlan, GymDailyStats, GymPlanRevenue, AnalyticsCache, Gym, User, WalletTransaction, Plan } from "../models/index.js";

export const getGymById = async (gymId, ownerId = null) => {
  if (ownerId) {
    return await Gym.findOne({ where: { id: gymId, ownerId } });
  }
  return await Gym.findByPk(gymId);
};

export const getActiveMembersCount = async (gymId) => {
  return await UserPlan.count({
    where: {
      gymId,
      isExpired: false
    }
  });
};

export const getAllUsersWithLocation = async () => {
  return await User.findAll({
    where: {
      role: 'User',
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null }
    },
    attributes: ['id', 'name', 'email', 'latitude', 'longitude', 'profile_picture']
  });
};

export const getAnalyticsCache = async (gymId, type) => {
  return await AnalyticsCache.findOne({
    where: { gymId, type }
  });
};

export const updateAnalyticsCache = async (gymId, type, data) => {
  const [cache, created] = await AnalyticsCache.findOrCreate({
    where: { gymId, type },
    defaults: { data, updatedAt: new Date() }
  });
  
  if (!created) {
    cache.data = data;
    cache.updatedAt = new Date();
    await cache.save();
  }
  return cache;
};

export const getAllPlanRevenues = async (gymId) => {
  return await GymPlanRevenue.findAll({
    where: { gymId },
    include: [{ model: Plan, as: 'plan', attributes: ['name', 'planType'] }]
  });
};

export const getCompletedDebitTransactions = async () => {
  return await WalletTransaction.findAll({
    where: {
      status: 'Completed',
      type: 'Debit'
    }
  });
};

export const getActiveUserPlans = async (gymId) => {
  return await UserPlan.findAll({
    where: {
      gymId,
      isExpired: false
    },
    include: [{ model: Plan, as: 'plan', attributes: ['name', 'planType'] }]
  });
};

export const getExpiringSoonCount = async (gymId, currentDate, sevenDaysFromNow) => {
  return await UserPlan.count({
    where: {
      gymId,
      isExpired: false,
      maxExpiryDate: { [Op.lte]: sevenDaysFromNow, [Op.gte]: currentDate }
    }
  });
};

export const getNewUserPlans = async (gymId, minPurchaseDate = null) => {
  const query = { gymId };
  if (minPurchaseDate) {
    query.purchaseDate = { [Op.gte]: minPurchaseDate };
  }
  return await UserPlan.findAll({ where: query });
};

export const getUserPlansList = async (gymId, type, sevenDaysFromNow = null) => {
  const query = { gymId };
  if (type === 'expired') {
    query.isExpired = true;
  } else if (type === 'expiring') {
    query.isExpired = false;
    if (sevenDaysFromNow) {
      query.maxExpiryDate = {
        [Op.gte]: new Date(),
        [Op.lte]: sevenDaysFromNow
      };
    }
  } else {
    // Default to active
    query.isExpired = false;
  }

  return await UserPlan.findAll({
    where: query,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'photo', 'gender']
      },
      {
        model: Plan,
        as: 'plan',
        attributes: ['id', 'name', 'planType', 'duration']
      }
    ],
    order: [['purchaseDate', 'DESC']]
  });
};

export const getUserPlanById = async (planId) => {
  return await UserPlan.findByPk(planId, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'photo', 'gender']
      },
      {
        model: Plan,
        as: 'plan',
        attributes: ['id', 'name', 'planType', 'duration']
      }
    ]
  });
};

export const getGymDailyStats = async (gymId) => {
  return await GymDailyStats.findAll({
    where: { gymId },
    attributes: ['register']
  });
};
