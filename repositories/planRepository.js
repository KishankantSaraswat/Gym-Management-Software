import { Plan, Gym } from "../models/index.js";

export const findVerifiedGymByOwner = async (gymId, ownerId) => {
  const gym = await Gym.findOne({
    where: {
      id: gymId,
      ownerId,
      isVerified: true
    }
  });

  if (gym) return gym;

  // Fallback: check ClientCompanyMaster (Company is our Gym)
  const { ClientCompanyMaster, ClientCompanyUser } = await import("../models/index.js");
  const company = await ClientCompanyMaster.findByPk(gymId);
  if (company && (company.status === 1 || company.status === true)) {
    // Check if user belongs to this company
    const clientUser = await ClientCompanyUser.findOne({
      where: { id: ownerId, companyId: company.id }
    });
    if (clientUser) {
      return {
        id: company.id,
        name: company.name,
        ownerId: clientUser.id,
        isVerified: true,
        status: 'open',
        company
      };
    }
  }

  return null;
};

export const findGymByOwner = async (gymId, ownerId) => {
  return await Gym.findOne({
    where: {
      id: gymId,
      ownerId
    }
  });
};

export const findGymById = async (gymId) => {
  return await Gym.findByPk(gymId);
};

export const createPlan = async (planData) => {
  return await Plan.create(planData);
};

export const findActivePlansByGym = async (gymId) => {
  return await Plan.findAll({
    where: { gymId, isActive: true },
    order: [['price', 'ASC']]
  });
};

export const findPlanNameById = async (id) => {
  return await Plan.findByPk(id, { attributes: ["name"] });
};

export const findAllPlansByGym = async (gymId) => {
  return await Plan.findAll({
    where: { gymId },
    order: [['createdAt', 'DESC']]
  });
};

export const findPlanById = async (planId) => {
  return await Plan.findByPk(planId);
};

export const updatePlanRecord = async (plan, updateData) => {
  if (updateData.name !== undefined) plan.name = updateData.name;
  if (updateData.price !== undefined) plan.price = updateData.price;
  if (updateData.discountPercent !== undefined) plan.discountPercent = updateData.discountPercent;
  if (updateData.features !== undefined) plan.features = updateData.features;
  if (updateData.duration !== undefined) plan.duration = updateData.duration;
  if (updateData.isTrainerIncluded !== undefined) plan.isTrainerIncluded = updateData.isTrainerIncluded;
  if (updateData.isActive !== undefined) plan.isActive = updateData.isActive;
  
  return await plan.save();
};

export const findGymByOwnerId = async (ownerId) => {
  return await Gym.findOne({ where: { ownerId } });
};
