import { Gym, AdminPlan, GymSubscription } from "../models/index.js";

export const subscriptionRepository = {
  findGymWithAssignedPlanByOwnerId: async (ownerId) => {
    return await Gym.findOne({ 
      where: { ownerId }, 
      include: [{ model: AdminPlan, as: 'assignedPlan' }] 
    });
  },

  findGymByOwnerId: async (ownerId, options = {}) => {
    return await Gym.findOne({ where: { ownerId }, ...options });
  },

  findAdminPlanById: async (planId, options = {}) => {
    return await AdminPlan.findByPk(planId, options);
  },

  createSubscription: async (subscriptionData, options = {}) => {
    return await GymSubscription.create(subscriptionData, options);
  },

  updateGym: async (gym, updateData, options = {}) => {
    // In Sequelize, passing options to update can be done via gym.update()
    return await gym.update(updateData, options);
  }
};
