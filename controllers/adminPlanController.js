import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import * as adminPlanService from "../services/adminPlanService.js";

// Create a new admin plan
export const createAdminPlan = catchAsyncErrors(async (req, res, next) => {
  const plan = await adminPlanService.createAdminPlanService(req.body);

  res.status(201).json({
    success: true,
    message: "Admin plan created successfully",
    plan
  });
});

// Get all admin plans
export const getAllAdminPlans = catchAsyncErrors(async (req, res, next) => {
  const plans = await adminPlanService.getAllAdminPlansService();

  res.status(200).json({
    success: true,
    plans
  });
});

// Update an admin plan
export const updateAdminPlan = catchAsyncErrors(async (req, res, next) => {
  const plan = await adminPlanService.updateAdminPlanService(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: "Admin plan updated successfully",
    plan
  });
});

// Delete an admin plan (Soft delete by setting isActive to false)
export const deleteAdminPlan = catchAsyncErrors(async (req, res, next) => {
  await adminPlanService.deleteAdminPlanService(req.params.id);

  res.status(200).json({
    success: true,
    message: "Admin plan deactivated successfully"
  });
});
