import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import * as planService from "../services/planService.js";

// Create Plan (by isVerified:Ture && isDeleted:False)
export const createPlan = catchAsyncErrors(async (req, res, next) => {
  const {
    name,
    validity,
    price,
    discountPercent,
    features,
    planType,
    isTrainerIncluded,
    duration
  } = req.body;
  const gymId = req.params.gymId;

  const planData = {
    name,
    validity,
    price,
    discountPercent,
    features,
    planType,
    isTrainerIncluded,
    duration
  };

  const plan = await planService.createPlan(gymId, req.user.id, planData);

  res.status(201).json({
    success: true,
    message: "Plan created successfully",
    plan
  });
});

// Get Plans by user (isActive: true)
export const getGymPlans = catchAsyncErrors(async (req, res, next) => {
  const { gymId } = req.params;

  const plans = await planService.getGymPlans(gymId);

  res.status(200).json({
    success: true,
    count: plans.length,
    plans
  });
});

export const getPlanNameById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const planName = await planService.getPlanNameById(id);

  res.status(200).json({
    success: true,
    planName,
  });
});

// Get plans also (isActive: true && false)==>keep noted by frontend which for whom
export const getGymPlansAdminView = catchAsyncErrors(async (req, res, next) => {
  const { gymId } = req.params;

  const plans = await planService.getGymPlansAdminView(gymId, req.user);
  
  res.status(200).json({
    success: true,
    count: plans.length,
    plans
  });
});

//updatePlan->use for delete plan also, as can update the isActive button****
export const updatePlan = catchAsyncErrors(async (req, res, next) => {
  const updateData = {
    name: req.body.name,
    price: req.body.price,
    discountPercent: req.body.discountPercent,
    features: req.body.features,
    duration: req.body.duration,
    isTrainerIncluded: req.body.isTrainerIncluded,
    isActive: req.body.isActive
  };

  const plan = await planService.updatePlan(req.params.planId, req.user.id, updateData);

  res.status(200).json({
    success: true,
    message: "Plan updated successfully",
    plan
  });
});
