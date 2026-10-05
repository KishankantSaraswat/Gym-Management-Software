import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import * as dashboardService from '../services/dashboardService.js';

export const getGymDashboardStats = catchAsyncErrors(async (req, res, next) => {
  const stats = await dashboardService.getGymDashboardStats(req.params.gymId);
  res.status(200).json({ success: true, stats });
});

export const getRevenueAnalytics = catchAsyncErrors(async (req, res, next) => {
  const data = await dashboardService.getRevenueAnalytics(req.params.gymId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getMemberAnalytics = catchAsyncErrors(async (req, res, next) => {
  const data = await dashboardService.getMemberAnalytics(req.params.gymId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getActiveMemberDetails = catchAsyncErrors(async (req, res, next) => {
  const members = await dashboardService.getActiveMemberDetails(req.params.gymId, req.query.type || 'active');
  res.status(200).json({ success: true, count: members.length, members });
});

export const getSingleMemberDetails = catchAsyncErrors(async (req, res, next) => {
  const member = await dashboardService.getSingleMemberDetails(req.params.planId);
  res.status(200).json({ success: true, member });
});

