import * as planRepository from "../repositories/planRepository.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";

export const createPlan = async (gymId, ownerId, planData) => {
  const gym = await planRepository.findVerifiedGymByOwner(gymId, ownerId);

  if (!gym) {
    throw new ErrorHandler("Gym not found, unauthorized, or not verified", 404);
  }

  if (gym.ownerId !== ownerId) {
    throw new ErrorHandler("Not authorized to create plans for this gym", 403);
  }

  let maxExpiryFactor = 1;
  const { validity } = planData;

  if (validity >= 1 && validity <= 2) {
    maxExpiryFactor = 7;
  } else if (validity > 2 && validity <= 8) {
    maxExpiryFactor = 4;
  } else if (validity > 8 && validity <= 16) {
    maxExpiryFactor = 6;
  } else if (validity > 16 && validity <= 31) {
    maxExpiryFactor = 6;
  }

  const newPlanData = {
    ...planData,
    gymId,
    isActive: true,
    maxExpiryFactor
  };

  return await planRepository.createPlan(newPlanData);
};

export const getGymPlans = async (gymId) => {
  return await planRepository.findActivePlansByGym(gymId);
};

export const getPlanNameById = async (planId) => {
  if (!planId) {
    throw new ErrorHandler("Plan ID is required", 400);
  }

  const plan = await planRepository.findPlanNameById(planId);

  if (!plan) {
    throw new ErrorHandler("Plan not found", 404);
  }

  return plan.name;
};

export const getGymPlansAdminView = async (gymId, user) => {
  if (user.role === 'Admin') {
    return await planRepository.findAllPlansByGym(gymId);
  }

  const gym = await planRepository.findGymByOwner(gymId, user.id);

  if (!gym) {
    throw new ErrorHandler("Gym not found or not authorized", 404);
  }

  return await planRepository.findAllPlansByGym(gymId);
};

export const updatePlan = async (planId, userId, updateData) => {
  const plan = await planRepository.findPlanById(planId);
  if (!plan) {
    throw new ErrorHandler("Plan not found", 404);
  }

  const gym = await planRepository.findGymById(plan.gymId);
  if (!gym || gym.ownerId !== userId) {
    throw new ErrorHandler("Not authorized to modify this plan", 403);
  }

  return await planRepository.updatePlanRecord(plan, updateData);
};

export const getUserPlans = async (userId) => {
  await planRepository.updateUserPlanExpiryStatus(userId);
  return await planRepository.findUserPlans(userId);
};

export const getPurchasedPlans = async (ownerId) => {
  const gym = await planRepository.findGymByOwnerId(ownerId);
  if (!gym) {
    throw new ErrorHandler("Gym not found for this owner", 404);
  }
  return await planRepository.findPurchasedPlans(gym.id);
};

export const getPlanUsage = async (planId, userId) => {
  const plan = await planRepository.findUserPlan({ id: planId, userId });
  if (!plan) {
    throw new ErrorHandler("Plan not found", 404);
  }
  
  const daysUsed = Math.floor((new Date() - plan.purchaseDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, plan.totalDays - daysUsed);
  
  return {
    daysUsed,
    daysRemaining,
    isExpired: daysRemaining <= 0
  };
};
