import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import {
  createOrUpdateUserData,
  updateUserDataService,
  deleteUserDataService,
  getUserDataService
} from "../services/userDataService.js";

// Create or Update user data by userId (upsert)
export const createUserData = catchAsyncErrors(async (req, res, next) => {
  const userData = await createOrUpdateUserData(req.body);
  res.status(201).json({ message: "User data created/updated", userData });
});

// Update user data by userId
export const updateUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;
  const updatedData = req.body;

  const userData = await updateUserDataService(userId, updatedData);

  res.json({ message: "User data updated", userData });
});

// Delete user data by userId
export const deleteUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;
  
  await deleteUserDataService(userId);

  res.json({ message: "User data deleted" });
});

// Get user data by userId
export const getUserData = catchAsyncErrors(async (req, res, next) => {
  const userId = req.params.userId;

  const userData = await getUserDataService(userId);

  res.json(userData);
});
