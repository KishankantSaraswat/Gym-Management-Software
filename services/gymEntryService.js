import {
  findActiveUserPlan,
  findActiveCheckIn,
  findUserGymLog,
  createUserGymLog,
  findUserById,
  findOrCreateGymDailyStats,
  findGymDailyStats,
  findGymDailyStatsDescending,
  findGymById,
  findAllGyms,
  findGymDailyStatsByDateRange,
  findOrCreateWalletTransaction,
  incrementUserWalletBalance
} from '../repositories/gymEntryRepository.js';

export const updateGymLog = async (userId, didWorkoutToday, gymId, userPlanId, currentDate = new Date()) => {
  let currentLog = await findUserGymLog(userId);

  if (!currentLog) {
    currentLog = await createUserGymLog(userId, currentDate, Array(300).fill(-1));
  }

  const daysSinceStart = Math.floor(
    (currentDate - currentLog.startingDate) / (1000 * 60 * 60 * 24)
  );
  const currentIndex = daysSinceStart % 300;

  const updatedDateArray = [...currentLog.dateArray];
  updatedDateArray[currentIndex] = didWorkoutToday ? 1 : 0;

  for (let i = currentIndex - 1; i >= 0; i--) {
    if (updatedDateArray[i] === -1) {
      updatedDateArray[i] = 0;
    } else {
      break;
    }
  }

  currentLog.dateArray = updatedDateArray;
  currentLog.changed('dateArray', true);
  await currentLog.save();

  return currentLog;
};

export const processQrCheckIn = async (userId, userPlanId) => {
  const currentDate = new Date();
  const checkInTime = currentDate;
  const today = currentDate.toISOString().split("T")[0];

  const userPlan = await findActiveUserPlan(userPlanId, userId, checkInTime);
  if (!userPlan) {
    throw new Error("No active plan found");
  }

  const gymId = userPlan.gymId;

  const alreadyCheckedIn = await findActiveCheckIn(gymId, today, userId);
  if (alreadyCheckedIn) {
    throw new Error("User already checked in the gym (duplicate request)");
  }

  await updateGymLog(userId, true, gymId, userPlanId, currentDate);

  userPlan.usedDays += 1;
  if (
    userPlan.usedDays >= userPlan.totalDays ||
    currentDate > userPlan.maxExpiryDate
  ) {
    userPlan.isExpired = true;
  }
  await userPlan.save();

  const checkOutTime = new Date(
    checkInTime.getTime() + userPlan.planDuration * 60 * 60 * 1000
  );

  const user = await findUserById(userId, ["name", "email", "phone", "photo"]);

  const [stats, created] = await findOrCreateGymDailyStats(gymId, today);

  stats.register = [...stats.register, {
    userId,
    userName: user.name,
    photo: user.photo,
    contactNo: user.phone,
    userPlanId: userPlan.id,
    perDayCost: userPlan.perDayCost,
    checkInTime,
    checkOutTimeCalc: checkOutTime,
    checkOutTimeReal: null
  }];
  stats.totalUsersToday += 1;
  stats.activeUsers += 1;
  stats.changed('register', true);
  await stats.save();

  return {
    checkOutTime,
    remainingDays: userPlan.totalDays - userPlan.usedDays
  };
};

export const processQrCheckOut = async (userId, gymId) => {
  const checkOutTime = new Date();
  const today = checkOutTime.toISOString().split("T")[0];

  const stats = await findActiveCheckIn(gymId, today, userId);
  if (!stats || !stats.register || stats.register.length === 0) {
    throw new Error("No active check-ins found for this gym on the given date.");
  }

  let userUpdated = false;
  stats.register = stats.register.map(entry => {
    if (entry.userId === userId && entry.checkOutTimeReal === null) {
      userUpdated = true;
      return { ...entry, checkOutTimeReal: checkOutTime };
    }
    return entry;
  });

  if (userUpdated) {
    stats.activeUsers = Math.max(0, stats.activeUsers - 1);
    stats.changed('register', true);
    await stats.save();
  }
};

const calculateStreak = (userGym, currentDate = new Date()) => {
  const arr = userGym.dateArray;
  const startingDate = new Date(userGym.startingDate);
  const msInDay = 1000 * 60 * 60 * 24;

  const start = new Date(startingDate.setHours(0, 0, 0, 0));
  let lastWorkoutIndex;

  if (currentDate) {
    const curr = new Date(currentDate.setHours(0, 0, 0, 0));
    const diffInDays = Math.floor((curr - start) / msInDay);
    lastWorkoutIndex = diffInDays;
  } else {
    lastWorkoutIndex = arr.length - 1;
    while (lastWorkoutIndex >= 0 && arr[lastWorkoutIndex] === -1) {
      lastWorkoutIndex--;
    }
  }

  if (lastWorkoutIndex < 0) {
    userGym.currentStreak = 0;
    return;
  }

  const workoutDate = new Date(userGym.startingDate);
  workoutDate.setDate(workoutDate.getDate() + lastWorkoutIndex);
  const dayOfWeek = workoutDate.getDay();

  const daysSinceSunday = (dayOfWeek + 6) % 7;
  const weekStartIndex = Math.max(0, lastWorkoutIndex - daysSinceSunday);

  let thisWeekStreak = 0;
  for (let i = weekStartIndex; i <= lastWorkoutIndex; i++) {
    if (arr[i] === 1) thisWeekStreak++;
  }

  if (thisWeekStreak >= 4) {
    if (dayOfWeek === 0) {
      userGym.currentWeekStreak += 1;
      userGym.thisWeekStreak = 0;
    } else {
      userGym.thisWeekStreak = thisWeekStreak;
    }
    userGym.currentStreak = userGym.currentWeekStreak * 7 + userGym.thisWeekStreak;
  } else if (thisWeekStreak < 4) {
    if (dayOfWeek === 0) {
      userGym.currentStreak = 0;
      userGym.currentWeekStreak = 0;
      userGym.thisWeekStreak = 0;
    } else {
      userGym.thisWeekStreak = thisWeekStreak;
    }
    userGym.currentStreak = userGym.currentWeekStreak * 7 + userGym.thisWeekStreak;
  }
};

export const processStreak = async (userId) => {
  const currentDate = new Date();
  
  let currentLog = await findUserGymLog(userId);
  if (!currentLog) {
    return null;
  }

  const daysSinceStart = Math.floor(
    (currentDate - currentLog.startingDate) / (1000 * 60 * 60 * 24)
  );
  const currentIndex = daysSinceStart % 300;

  const updatedDateArray = [...currentLog.dateArray];
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (updatedDateArray[i] === -1) {
      updatedDateArray[i] = 0;
    } else {
      break;
    }
  }

  currentLog.dateArray = updatedDateArray;
  currentLog.changed('dateArray', true);
  
  calculateStreak(currentLog, currentDate);
  await currentLog.save();

  return currentLog;
};

export const fetchYearlyGymHeatmap = async (userId) => {
  return await findUserGymLog(userId);
};

export const fetchGymRegisterByDate = async (gymId, dateParam) => {
  const targetDate = dateParam
    ? new Date(dateParam).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const stats = await findGymDailyStatsDescending(gymId, targetDate);
  if (!stats) {
    throw new Error(`No gym register found for date ${targetDate}`);
  }
  return { register: stats.register || [], date: targetDate };
};

export const fetchActiveUsers = async (gymId) => {
  const today = new Date().toISOString().split("T")[0];
  const stats = await findGymDailyStats(gymId, today);
  const now = new Date();

  const activeUsers = stats?.register.filter(
    (user) => !user.checkOutTimeReal && new Date(user.checkOutTimeCalc) > now
  ) || [];

  const expiredUsers = stats?.register.filter(
    (user) => !user.checkOutTimeReal && new Date(user.checkOutTimeCalc) <= now
  ) || [];

  return { activeUsers, expiredUsers };
};

export const processCleanExpiredUsers = async (gymId) => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const stat = await findGymDailyStats(gymId, today);

  if (!stat) {
    throw new Error("No active check-in found for this gym today.");
  }

  const expiredUsers = stat.register.filter(
    (user) => !user.checkOutTimeReal && new Date(user.checkOutTimeCalc) <= now
  );

  if (expiredUsers.length === 0) {
    return { cleanedUsers: [], count: 0 };
  }

  stat.register = stat.register.map(user => {
    if (!user.checkOutTimeReal && new Date(user.checkOutTimeCalc) <= now) {
      return { ...user, checkOutTimeReal: now };
    }
    return user;
  });

  stat.activeUsers = Math.max(0, stat.activeUsers - expiredUsers.length);
  stat.changed('register', true);
  await stat.save();

  return {
    cleanedUsers: expiredUsers.map((u) => u.userId),
    count: expiredUsers.length
  };
};

export const fetchActiveCapacity = async (gymId) => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const options = { timeZone: 'Asia/Kolkata' };
  const currentDay = now.toLocaleDateString('en-US', { ...options, weekday: 'long' }).toLowerCase();

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const [istHour, istMinute] = timeFormatter.format(now).split(':').map(Number);
  const currentTime = istHour * 60 + istMinute;

  const gym = await findGymById(gymId);
  if (!gym) {
    throw new Error("Gym not found");
  }

  let activeShift = null;
  if (gym.shifts && gym.shifts.length > 0) {
    activeShift = gym.shifts.find((shift) => {
      if (!shift.day || shift.day.toLowerCase() !== currentDay) return false;
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      if (endTotal > startTotal) {
        return currentTime >= startTotal && currentTime < endTotal;
      } else {
        return currentTime >= startTotal || currentTime < endTotal;
      }
    });
  }

  if (!activeShift) {
    return {
      isOpen: false,
      activeCount: 0,
      capacity: 0,
      message: "Gym is currently closed",
    };
  }

  const stats = await findGymDailyStats(gymId, today);
  const activeUsers = stats?.register.filter(
    (user) => !user.checkOutTimeReal && new Date(user.checkOutTimeCalc) > now
  ) || [];

  return {
    isOpen: true,
    activeCount: activeUsers.length,
    capacity: activeShift.capacity,
    shiftInfo: {
      name: activeShift.name,
      startTime: activeShift.startTime,
      endTime: activeShift.endTime,
      gender: activeShift.gender,
    }
  };
};

export const processGymDailyEarnings = async (testDate) => {
  const yesterday = testDate ? new Date(testDate) : new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const tomorrow = new Date(yesterday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const gyms = await findAllGyms();

  for (const gym of gyms) {
    const gymId = gym.id;
    const gymOwnerId = gym.ownerId;

    const stats = await findGymDailyStatsByDateRange(gymId, yesterday, tomorrow);

    if (!stats || !Array.isArray(stats.register)) continue;

    let totalAmount = 0;
    for (const { perDayCost } of stats.register) {
      if (typeof perDayCost === "number") {
        totalAmount += perDayCost;
      }
    }

    if (totalAmount > 0) {
      const [walletTxn] = await findOrCreateWalletTransaction(gymOwnerId, gymId, yesterday, yesterday, tomorrow);
      
      walletTxn.amount += totalAmount;
      await walletTxn.save();

      await incrementUserWalletBalance(gymOwnerId, totalAmount);
    }
  }
};
