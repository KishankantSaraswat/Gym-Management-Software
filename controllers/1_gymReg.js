import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import * as gymService from "../services/gymService.js";

export const registerGym = catchAsyncErrors(async (req, res, next) => {
  console.log("📩 Received Gym Registration Request:", req.body);
  console.log("👤 User ID from token:", req.user?.id);

  const gym = await gymService.registerGymService(req.user, req.body);

  res.status(201).json({
    success: true,
    message: "Gym registered successfully. Waiting for admin verification.",
    gym
  });
});

export const addUpdateGymMedia = catchAsyncErrors(async (req, res, next) => {
  const mediaDoc = await gymService.addUpdateGymMediaService(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: "Media updated successfully",
    media: mediaDoc
  });
});

export const getGymDetails = catchAsyncErrors(async (req, res, next) => {
  const gym = await gymService.getGymDetailsService(req.params.id);

  res.status(200).json({
    success: true,
    gym
  });
});

export const updateGym = catchAsyncErrors(async (req, res, next) => {
  const gym = await gymService.updateGymService(req.params.id, req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: "Gym updated successfully",
    gym
  });
});

export const getAllGyms = catchAsyncErrors(async (req, res, next) => {
  const gyms = await gymService.getAllGymsService(req.query);

  res.status(200).json({
    success: true,
    count: gyms.length,
    gyms
  });
});

export const getGymsByOwner = catchAsyncErrors(async (req, res, next) => {
  const gyms = await gymService.getGymsByOwnerService(req.user, req.body);

  res.status(200).json({ success: true, gyms });
});

export const toggleGymStatus = catchAsyncErrors(async (req, res, next) => {
  const gym = await gymService.toggleGymStatusService(req.user.id);

  res.status(200).json({ success: true, gym });
});

export const addUpdateVerificationDocuments = catchAsyncErrors(async (req, res, next) => {
  const doc = await gymService.addUpdateVerificationDocumentsService(req.user.id, req.body);

  res.status(200).json({ success: true, message: "Documents updated", doc });
});

export const createGymAnnouncement = catchAsyncErrors(async (req, res, next) => {
  const announcement = await gymService.createGymAnnouncementService(req.user.id, req.body.message);

  res.status(201).json({ success: true, announcement });
});

export const getUserAnnouncementsByGym = catchAsyncErrors(async (req, res, next) => {
  const announcements = await gymService.getUserAnnouncementsByGymService(req.user);

  res.status(200).json({ success: true, announcements });
});

export const deleteGymAnnouncement = catchAsyncErrors(async (req, res, next) => {
  await gymService.deleteGymAnnouncementService(req.params.announcementId, req.user.id);

  res.status(200).json({ success: true, message: "Announcement deleted" });
});
