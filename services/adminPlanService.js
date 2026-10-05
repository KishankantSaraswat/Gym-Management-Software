import * as adminPlanRepository from "../repositories/adminPlanRepository.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";

export const createAdminPlanService = async (data) => {
  const { name, duration, price } = data;
  
  if (!name || !duration || price === undefined) {
    throw new ErrorHandler("Please provide all required fields", 400);
  }

  return await adminPlanRepository.createPlan(data);
};

export const getAllAdminPlansService = async () => {
  return await adminPlanRepository.getActivePlans();
};

export const updateAdminPlanService = async (id, data) => {
  const plan = await adminPlanRepository.getPlanById(id);
  
  if (!plan) {
    throw new ErrorHandler("Plan not found", 404);
  }

  return await adminPlanRepository.updatePlan(plan, data);
};

export const deleteAdminPlanService = async (id) => {
  const plan = await adminPlanRepository.getPlanById(id);
  
  if (!plan) {
    throw new ErrorHandler("Plan not found", 404);
  }

  await adminPlanRepository.deactivatePlan(plan);
};
