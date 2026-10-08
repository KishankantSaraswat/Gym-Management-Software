import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import * as dashboardService from '../services/dashboardService.js';
import authorizationService from '../services/authorizationService.js';
import { UserPlan } from '../models/index.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';

export const getGymDashboardStats = catchAsyncErrors(async (req, res, next) => {
  await authorizationService.assertTenantOwnership(req, req.params.gymId);
  const stats = await dashboardService.getGymDashboardStats(req.params.gymId);
  res.status(200).json({ success: true, stats });
});

export const getRevenueAnalytics = catchAsyncErrors(async (req, res, next) => {
  await authorizationService.assertTenantOwnership(req, req.params.gymId);
  const data = await dashboardService.getRevenueAnalytics(req.params.gymId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getMemberAnalytics = catchAsyncErrors(async (req, res, next) => {
  await authorizationService.assertTenantOwnership(req, req.params.gymId);
  const data = await dashboardService.getMemberAnalytics(req.params.gymId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getActiveMemberDetails = catchAsyncErrors(async (req, res, next) => {
  await authorizationService.assertTenantOwnership(req, req.params.gymId);
  const members = await dashboardService.getActiveMemberDetails(req.params.gymId, req.query.type || 'active');
  res.status(200).json({ success: true, count: members.length, members });
});

export const getSingleMemberDetails = catchAsyncErrors(async (req, res, next) => {
  const userPlan = await UserPlan.findByPk(req.params.planId);
  if (!userPlan) {
    return next(new ErrorHandler("Member plan not found", 404));
  }
  await authorizationService.assertTenantOwnership(req, userPlan.gymId);
  const member = await dashboardService.getSingleMemberDetails(req.params.planId);
  res.status(200).json({ success: true, member });
});
