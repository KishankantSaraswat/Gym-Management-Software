import { AdminPlan } from "../models/index.js";

export const createPlan = async (data) => {
  return await AdminPlan.create(data);
};

export const getActivePlans = async () => {
  return await AdminPlan.findAll({ where: { isActive: true } });
};

export const getPlanById = async (id) => {
  return await AdminPlan.findByPk(id);
};

export const updatePlan = async (plan, data) => {
  return await plan.update(data);
};

export const deactivatePlan = async (plan) => {
  plan.isActive = false;
  return await plan.save();
};
