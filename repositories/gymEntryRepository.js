import { Op } from 'sequelize';
import { UserGymLog, UserPlan, Plan, Gym, GymDailyStats, WalletTransaction, User } from "../models/index.js";

export const findActiveUserPlan = async (userPlanId, userId, checkInTime) => {
  return await UserPlan.findOne({
    where: {
      id: userPlanId,
      userId,
      isExpired: false,
      maxExpiryDate: { [Op.gte]: checkInTime }
    }
  });
};

export const findActiveCheckIn = async (gymId, date, userId) => {
  return await GymDailyStats.findOne({
    where: {
      gymId,
      date,
      register: {
        [Op.contains]: [{ userId: userId, checkOutTimeReal: null }]
      }
    }
  });
};

export const findUserGymLog = async (userId) => {
  return await UserGymLog.findOne({
    where: { userId },
    order: [['startingDate', 'DESC']]
  });
};

export const createUserGymLog = async (userId, startingDate, dateArray) => {
  return await UserGymLog.create({
    userId,
    startingDate,
    dateArray,
  });
};

export const findUserById = async (userId, attributes) => {
  return await User.findByPk(userId, { attributes });
};

export const findOrCreateGymDailyStats = async (gymId, date) => {
  return await GymDailyStats.findOrCreate({
    where: { gymId, date },
    defaults: {
      totalUsersToday: 0,
      activeUsers: 0,
      register: []
    }
  });
};

export const findGymDailyStats = async (gymId, date) => {
  return await GymDailyStats.findOne({
    where: { gymId, date }
  });
};

export const findGymDailyStatsByDateRange = async (gymId, startDate, endDate) => {
  return await GymDailyStats.findOne({
    where: {
      gymId,
      date: {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      }
    }
  });
};

export const findGymDailyStatsDescending = async (gymId, date) => {
  return await GymDailyStats.findOne({
    where: { gymId, date },
    order: [['createdAt', 'DESC']]
  });
};

export const findGymById = async (gymId) => {
  return await Gym.findByPk(gymId);
};

export const findAllGyms = async () => {
  return await Gym.findAll();
};

export const findOrCreateWalletTransaction = async (userId, gymId, transactionDate, yesterday, tomorrow) => {
  return await WalletTransaction.findOrCreate({
    where: {
      userId,
      reason: "gymDailyEarning",
      transactionDate: {
        [Op.gte]: yesterday,
        [Op.lt]: tomorrow
      },
      gymId,
    },
    defaults: {
      type: "Credit",
      status: "Pending",
      transactionDate: transactionDate,
      reason: "gymDailyEarning",
      gymId,
      amount: 0
    }
  });
};

export const incrementUserWalletBalance = async (userId, amount) => {
  return await User.increment('walletBalance', { by: amount, where: { id: userId } });
};
