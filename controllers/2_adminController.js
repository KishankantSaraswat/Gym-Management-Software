import { adminService } from '../services/adminService.js';
import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';

export const toggleGymVerification = catchAsyncErrors(async (req, res, next) => {
  const result = await adminService.toggleGymVerification(req.params.gymId, req.body.adminPlanId);
  res.json({ success: true, ...result });
});

export const toggleGymDeletion = catchAsyncErrors(async (req, res, next) => {
  const result = await adminService.toggleGymDeletion(req.params.gymId);
  res.json({ success: true, ...result });
});

export const getUnverifiedGyms = catchAsyncErrors(async (req, res, next) => {
  const gyms = await adminService.getUnverifiedGyms();
  res.json({ success: true, gyms });
});

export const getAllGymsForAdmin = catchAsyncErrors(async (req, res, next) => {
  const gyms = await adminService.getAllGymsForAdmin();
  res.json({ success: true, gyms });
});

export const getGymDetailsAdmin = catchAsyncErrors(async (req, res, next) => {
  const details = await adminService.getGymDetailsAdmin(req.params.gymId);
  res.json({ success: true, ...details });
});

export const createAnnouncement = catchAsyncErrors(async (req, res, next) => {
  const announcement = await adminService.createAnnouncement(req.body, req.user.id);
  res.status(201).json({ success: true, message: "Announcement created", announcement });
});

export const deleteAnnouncement = catchAsyncErrors(async (req, res, next) => {
  await adminService.deleteAnnouncement(req.params.announcementId);
  res.status(200).json({ success: true, message: "Announcement deleted successfully" });
});

export const getUserAnnouncements = catchAsyncErrors(async (req, res, next) => {
  const announcements = await adminService.getUserAnnouncements(req.user.id);
  res.status(200).json({ success: true, announcements });
});

export const getUsersByQuery = catchAsyncErrors(async (req, res, next) => {
  const users = await adminService.getUsersByQuery(req.query);
  res.status(200).json({ success: true, users });
});

export const getGymsByQuery = catchAsyncErrors(async (req, res, next) => {
  const gyms = await adminService.getGymsByQuery(req.query);
  res.status(200).json({ success: true, gyms });
});

export const getPlansByQuery = catchAsyncErrors(async (req, res, next) => {
  const plans = await adminService.getPlansByQuery(req.query);
  res.status(200).json({ success: true, count: plans.length, plans });
});

export const updatePlanFactor = catchAsyncErrors(async (req, res, next) => {
  const { factor, planIds } = req.body;
  const modifiedCount = await adminService.updatePlanFactor(factor, planIds);
  res.status(200).json({
    success: true,
    message: `${modifiedCount} plans updated with factor ${factor}`,
    updatedPlanIds: planIds
  });
});

export const getAdminDashboardStats = catchAsyncErrors(async (req, res, next) => {
  const stats = await adminService.getAdminDashboardStats();
  res.status(200).json({ success: true, stats });
});

export const updateGymCommission = catchAsyncErrors(async (req, res, next) => {
  const commissionRate = await adminService.updateGymCommission(req.params.gymId, req.body.commissionRate);
  res.status(200).json({
    success: true,
    message: "Commission rate updated successfully",
    commissionRate
  });
});

export const deleteGymPermanently = catchAsyncErrors(async (req, res, next) => {
  await adminService.deleteGymPermanently(req.params.gymId, req.body.password, req.user.id);
  res.status(200).json({
    success: true,
    message: "Gym and all associated records have been permanently deleted.",
  });
});

