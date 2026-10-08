import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import * as gymEntryService from "../services/gymEntryService.js";
import { assertTenantOwnership } from "../services/authorizationService.js";

export const qrCheckIn = catchAsyncErrors(async (req, res, next) => {
  try {
    const { userPlanId } = req.body;
    const userId = req.user.id;

    const result = await gymEntryService.processQrCheckIn(userId, userPlanId);

    res.status(200).json({
      success: true,
      message: "Check-in successful",
      checkOutTime: result.checkOutTime,
      remainingDays: result.remainingDays,
    });
  } catch (error) {
    if (error.message === "No active plan found" || error.message === "User already checked in the gym (duplicate request)") {
      return next(new ErrorHandler(error.message, 400));
    }
    return next(error);
  }
});

export const qrCheckOut = catchAsyncErrors(async (req, res, next) => {
  try {
    const { gymId } = req.body;
    const userId = req.user.id;

    await gymEntryService.processQrCheckOut(userId, gymId);

    res.status(200).json({
      success: true,
      message: "Check-out successful",
    });
  } catch (error) {
    if (error.message === "No active check-ins found for this gym on the given date.") {
      return next(new ErrorHandler(error.message, 400));
    }
    return next(error);
  }
});

export const streak = catchAsyncErrors(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentLog = await gymEntryService.processStreak(userId);

    if (!currentLog) {
      return res.status(404).json({
        success: false,
        message: "No gym history found to calculate streak."
      });
    }

    res.status(200).json({
      success: true,
      currentStreak: currentLog.currentStreak,
      currentWeekStreak: currentLog.currentWeekStreak,
      thisWeekStreak: currentLog.thisWeekStreak,
    });
  } catch (error) {
    return next(error);
  }
});

export const getYearlyGymHeatmap = catchAsyncErrors(async (req, res) => {
  const userId = req.user.id;
  const userLog = await gymEntryService.fetchYearlyGymHeatmap(userId);

  if (!userLog) {
    return res.status(200).json({
      success: true,
      data: null,
      message: "No gym log found for the user",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      startingDate: userLog.startingDate,
      dateArray: userLog.dateArray,
    },
  });
});

export const getGymRegisterByDate = catchAsyncErrors(async (req, res, next) => {
  try {
    const { gymId } = req.params;
    await assertTenantOwnership(req, gymId);
    const { date } = req.body;

    const result = await gymEntryService.fetchGymRegisterByDate(gymId, date);

    res.status(200).json({
      success: true,
      register: result.register,
      date: result.date,
    });
  } catch (error) {
    if (error.message.startsWith("No gym register found for date")) {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(error);
  }
});

export const getActiveUsers = catchAsyncErrors(async (req, res) => {
  const { gymId } = req.params;
  await assertTenantOwnership(req, gymId);
  const result = await gymEntryService.fetchActiveUsers(gymId);

  res.status(200).json({
    success: true,
    activeUsers: result.activeUsers,
    expiredUsers: result.expiredUsers,
    activeCount: result.activeUsers.length,
    expiredCount: result.expiredUsers.length
  });
});

export const cleanExpiredUsers = catchAsyncErrors(async (req, res) => {
  try {
    const { gymId } = req.params;
    await assertTenantOwnership(req, gymId);
    const result = await gymEntryService.processCleanExpiredUsers(gymId);

    if (result.count === 0) {
      return res.status(200).json({
        success: true,
        message: "No expired users to clean.",
      });
    }

    res.status(200).json({
      success: true,
      cleanedUsers: result.cleanedUsers,
      count: result.count,
    });
  } catch (error) {
    if (error.message === "No active check-in found for this gym today.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
});

export const getActiveCapacity = catchAsyncErrors(async (req, res, next) => {
  try {
    const { gymId } = req.params;
    await assertTenantOwnership(req, gymId);
    const result = await gymEntryService.fetchActiveCapacity(gymId);

    if (!result.isOpen) {
      return res.status(200).json({
        success: true,
        isOpen: false,
        activeCount: 0,
        capacity: 0,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      isOpen: true,
      activeCount: result.activeCount,
      capacity: result.capacity,
      shiftInfo: result.shiftInfo,
    });
  } catch (error) {
    if (error.message === "Gym not found") {
      return next(new ErrorHandler(error.message, 404));
    }
    return next(error);
  }
});

export const calculateGymDailyEarnings = catchAsyncErrors(async (req, res, next) => {
  const { testDate } = req.body || {};
  await gymEntryService.processGymDailyEarnings(testDate);

  if (res) {
    res.status(200).json({ success: true, message: "Gym daily earnings calculated successfully." });
  }
});
