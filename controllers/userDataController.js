import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import {
  createOrUpdateUserData,
  updateUserDataService,
  deleteUserDataService,
  getUserDataService
} from "../services/userDataService.js";

// Create or Update user data by userId (upsert)
export const createUserData = catchAsyncErrors(async (req, res, next) => {
  const targetUserId = req.params.userId || req.body.userId;
  if (targetUserId && targetUserId !== req.user.id && req.user.role !== 'Admin' && !req.user.isSuperAdmin) {
    return next(new ErrorHandler("Access denied: You cannot modify another user's profile data", 403));
  }
  const payload = { ...req.body, userId: req.params.userId || req.body.userId || req.user.id };
  const userData = await createOrUpdateUserData(payload);
  res.status(201).json({ message: "User data created/updated", userData });
});

// Update user data by userId
export const updateUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;
  if (req.user.id !== userId && req.user.role !== 'Admin' && !req.user.isSuperAdmin) {
    return next(new ErrorHandler("Access denied: You can only update your own user data", 403));
  }

  const updatedData = req.body;
  const userData = await updateUserDataService(userId, updatedData);

  res.json({ message: "User data updated", userData });
});

// Delete user data by userId
export const deleteUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;
  if (req.user.id !== userId && req.user.role !== 'Admin' && !req.user.isSuperAdmin) {
    return next(new ErrorHandler("Access denied: You can only delete your own user data", 403));
  }
  
  await deleteUserDataService(userId);

  res.json({ message: "User data deleted" });
});

// Get user data by userId
export const getUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;
  if (req.user.id !== userId && req.user.role !== 'Admin' && !req.user.isSuperAdmin) {
    return next(new ErrorHandler("Access denied: You can only view your own user data", 403));
  }

  const userData = await getUserDataService(userId);

  res.json(userData);
});

