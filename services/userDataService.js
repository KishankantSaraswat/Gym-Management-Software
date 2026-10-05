import { upsertUserData, findUserDataByUserId, deleteUserDataByUserId } from "../repositories/userRepository.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";

export const createOrUpdateUserData = async (data) => {
  const {
    userId,
    gender,
    dob,
    weight,
    height,
    location,
    workoutExperience,
    jobProfile,
    bodyType,
    sleepHoursPerDay,
    smokingStatus,
    alcoholConsumption,
    dailyWaterIntake,
    foodAllergies,
    foodType,
    income,
    pastInjury,
    preferredGymTime
  } = data;

  const [userData, created] = await upsertUserData({
    userId,
    gender,
    dob,
    weight,
    height,
    location,
    workoutExperience,
    jobProfile,
    bodyType,
    sleepHoursPerDay,
    smokingStatus,
    alcoholConsumption,
    dailyWaterIntake,
    foodAllergies,
    foodType,
    income,
    pastInjury,
    preferredGymTime
  });

  return userData;
};

export const updateUserDataService = async (userId, updatedData) => {
  const userData = await findUserDataByUserId(userId);

  if (!userData) {
    throw new ErrorHandler("User data not found", 404);
  }

  await userData.update(updatedData);

  return userData;
};

export const deleteUserDataService = async (userId) => {
  const deleted = await deleteUserDataByUserId(userId);

  if (!deleted) {
    throw new ErrorHandler("User data not found", 404);
  }

  return true;
};

export const getUserDataService = async (userId) => {
  const userData = await findUserDataByUserId(userId);
  
  if (!userData) {
    throw new ErrorHandler("User data not found", 404);
  }

  return userData;
};
