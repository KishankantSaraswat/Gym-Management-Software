import geolib from 'geolib';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import * as dashboardRepo from '../repositories/dashboardRepository.js';

const getWeekNumber = (date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

function formatData(groupedData) {
  const dates = Object.keys(groupedData).sort();
  const totals = dates.map(date => groupedData[date].total);

  const allPlanIds = new Set();
  dates.forEach(date => {
    Object.keys(groupedData[date].plans).forEach(planId => {
      allPlanIds.add(planId);
    });
  });

  const planSeries = {};
  Array.from(allPlanIds).forEach(planId => {
    planSeries[planId] = dates.map(date =>
      groupedData[date].plans[planId] || 0
    );
  });

  return {
    dates,
    totals,
    planSeries
  };
}

async function processRevenueAnalytics(records, gymId) {
  const groupByTimePeriod = (records, period) => {
    const grouped = {};
    const planInfo = {};

    records.forEach(record => {
      const date = new Date(record.date || record.createdAt);
      let key;

      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const week = getWeekNumber(date);
        key = `${date.getFullYear()}-W${week}`;
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = date.getFullYear();
      }

      if (!grouped[key]) {
        grouped[key] = {
          total: 0,
          plans: {}
        };
      }

      const grossRevenue = record.revenue + (record.commission || 0);
      grouped[key].total += grossRevenue;

      const planId = record.planId;
      if (!grouped[key].plans[planId]) {
        grouped[key].plans[planId] = 0;
      }
      grouped[key].plans[planId] += grossRevenue;

      if (record.planId && !planInfo[planId]) {
        planInfo[planId] = {
          name: record.plan?.name || 'Unnamed Plan',
          planType: record.plan?.planType
        };
      }
    });

    return { grouped, planInfo };
  };

  const allWalletTransactions = await dashboardRepo.getCompletedDebitTransactions();
  const walletTransactions = allWalletTransactions.filter(txn => 
    txn.metadata && txn.metadata.gymId === gymId
  );

  let cashTotal = 0;
  let upiTotal = 0;
  const monthlyBreakdown = {};

  walletTransactions.forEach(txn => {
    const isCash = txn.razorpayOrderId && txn.razorpayOrderId.startsWith('CASH_');
    const date = new Date(txn.transactionDate || txn.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyBreakdown[monthKey]) {
      monthlyBreakdown[monthKey] = { cash: 0, upi: 0, total: 0 };
    }

    if (isCash) {
      cashTotal += txn.amount;
      monthlyBreakdown[monthKey].cash += txn.amount;
    } else {
      upiTotal += txn.amount;
      monthlyBreakdown[monthKey].upi += txn.amount;
    }
    monthlyBreakdown[monthKey].total += txn.amount;
  });

  const planBreakdown = {};
  records.forEach(record => {
    const grossRevenue = record.revenue + (record.commission || 0);
    const planId = record.planId;
    if (!planBreakdown[planId]) {
      planBreakdown[planId] = {
        name: record.plan?.name || 'Unnamed Plan',
        totalRevenue: 0,
        count: 0
      };
    }
    planBreakdown[planId].totalRevenue += grossRevenue;
    planBreakdown[planId].count += 1;
  });

  const dailyData = groupByTimePeriod(records, 'daily');
  const weeklyData = groupByTimePeriod(records, 'weekly');
  const monthlyData = groupByTimePeriod(records, 'monthly');
  const yearlyData = groupByTimePeriod(records, 'yearly');

  return {
    daily: formatData(dailyData.grouped),
    weekly: formatData(weeklyData.grouped),
    monthly: formatData(monthlyData.grouped),
    yearly: formatData(yearlyData.grouped),
    planInfo: dailyData.planInfo,
    planBreakdown,
    paymentMethodBreakdown: {
      cash: cashTotal,
      upi: upiTotal,
      total: cashTotal + upiTotal,
      byMonth: monthlyBreakdown
    }
  };
}

function calculatePlanDistribution(activeUserPlans) {
  const distribution = {
    totalActiveUsers: 0,
    byPlan: {}
  };

  activeUserPlans.forEach(userPlan => {
    if (!userPlan.planId) return;

    const planId = userPlan.planId.toString();

    if (!distribution.byPlan[planId]) {
      distribution.byPlan[planId] = {
        count: 0,
        planName: userPlan.plan?.name || 'Unnamed Plan',
        planType: userPlan.plan?.planType
      };
    }

    distribution.byPlan[planId].count++;
    distribution.totalActiveUsers++;
  });

  return distribution;
}

function calculateMemberGrowth(userPlans) {
  const groupByTimePeriod = (records, period) => {
    const grouped = {};

    records.forEach(record => {
      const date = new Date(record.purchaseDate);
      let key;

      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        key = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = date.getFullYear();
      }

      if (!grouped[key]) grouped[key] = 0;
      grouped[key]++;
    });

    return grouped;
  };

  const formatGrowthData = (groupedData) => {
    const sortedDates = Object.keys(groupedData).sort();
    const counts = sortedDates.map(date => groupedData[date]);

    const cumulative = counts.reduce((acc, curr, i) => {
      acc.push(i === 0 ? curr : acc[i - 1] + curr);
      return acc;
    }, []);

    return {
      dates: sortedDates,
      counts,
      cumulative
    };
  };

  return {
    daily: formatGrowthData(groupByTimePeriod(userPlans, 'daily')),
    weekly: formatGrowthData(groupByTimePeriod(userPlans, 'weekly')),
    monthly: formatGrowthData(groupByTimePeriod(userPlans, 'monthly')),
    yearly: formatGrowthData(groupByTimePeriod(userPlans, 'yearly'))
  };
}

export const getGymDashboardStats = async (gymId) => {
  const gym = await dashboardRepo.getGymById(gymId);
  if (!gym) throw new ErrorHandler("Gym not found", 404);

  const activeMembersCount = await dashboardRepo.getActiveMembersCount(gymId);
  const allUsers = await dashboardRepo.getAllUsersWithLocation();

  const nearbyUsers = allUsers.filter(user => {
    if (!user.latitude || !user.longitude || !gym.latitude || !gym.longitude) return false;
    return geolib.getDistance(
      { latitude: user.latitude, longitude: user.longitude },
      { latitude: gym.latitude, longitude: gym.longitude }
    ) <= 15000;
  });

  return {
    totalActiveMembers: activeMembersCount,
    totalNearbyUsers: nearbyUsers.length,
    potentialCustomers: nearbyUsers.slice(0, 50),
    gymLocation: { latitude: gym.latitude, longitude: gym.longitude, address: gym.address }
  };
};

export const getRevenueAnalytics = async (gymId, ownerId) => {
  const gym = await dashboardRepo.getGymById(gymId, ownerId);
  if (!gym) throw new ErrorHandler("Gym not found or unauthorized", 404);

  const cachedData = await dashboardRepo.getAnalyticsCache(gym.id, 'revenue');
  const cutoffDate = new Date(Date.now() - 30 * 1000);

  if (cachedData?.updatedAt >= cutoffDate) {
    return cachedData.data;
  }

  const allRecords = await dashboardRepo.getAllPlanRevenues(gym.id);
  const result = await processRevenueAnalytics(allRecords, gym.id);

  await dashboardRepo.updateAnalyticsCache(gym.id, 'revenue', result);
  return result;
};

export const getMemberAnalytics = async (gymId, ownerId) => {
  const currentDate = new Date();
  const gym = await dashboardRepo.getGymById(gymId, ownerId);
  if (!gym) throw new ErrorHandler("Gym not found or unauthorized", 404);

  const cachedData = await dashboardRepo.getAnalyticsCache(gym.id, 'members');
  const cutoffDate = new Date(currentDate.getTime() - 30 * 1000); 

  const activeUserPlans = await dashboardRepo.getActiveUserPlans(gym.id);
  const planDistribution = calculatePlanDistribution(activeUserPlans);

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const expiringSoonCount = await dashboardRepo.getExpiringSoonCount(gym.id, currentDate, sevenDaysFromNow);

  let memberGrowth;
  if (cachedData?.updatedAt >= cutoffDate) {
    memberGrowth = cachedData.data.memberGrowth;
  } else {
    const minPurchaseDate = cachedData?.updatedAt || null;
    const newUserPlans = await dashboardRepo.getNewUserPlans(gym.id, minPurchaseDate);
    const allUserPlans = cachedData
      ? [...cachedData.data.allUserPlans, ...newUserPlans]
      : newUserPlans;

    memberGrowth = calculateMemberGrowth(allUserPlans);

    await dashboardRepo.updateAnalyticsCache(gym.id, 'members', {
      planDistribution,
      memberGrowth,
      allUserPlans
    });
  }

  return {
    planDistribution,
    memberGrowth,
    expiringSoon: expiringSoonCount
  };
};

export const getActiveMemberDetails = async (gymId, type) => {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const userPlans = await dashboardRepo.getUserPlansList(gymId, type, sevenDaysFromNow);

  return userPlans.map(plan => {
    if (!plan.user) return null;

    const remainingDays = Math.max(0, Math.ceil((new Date(plan.maxExpiryDate) - new Date()) / (1000 * 60 * 60 * 24)));

    return {
      id: plan.user.id,
      planId: plan.id,
      name: plan.user.name,
      email: plan.user.email,
      phone: plan.user.phone,
      photo: plan.user.photo,
      gender: plan.user.gender,

      planName: plan.plan?.name || 'Unknown Plan',
      planType: plan.plan?.planType,

      joinDate: plan.purchaseDate,
      expiryDate: plan.maxExpiryDate,
      remainingDays: type === 'expired' ? 0 : remainingDays,

      totalDays: plan.totalDays,
      usedDays: plan.usedDays,
      status: type === 'expired' ? 'Expired' : 'Active'
    };
  }).filter(member => member !== null);
};

export const getSingleMemberDetails = async (planId) => {
  const userPlan = await dashboardRepo.getUserPlanById(planId);
  if (!userPlan) {
    throw new ErrorHandler("Member plan not found", 404);
  }

  const stats = await dashboardRepo.getGymDailyStats(userPlan.gymId);

  let totalDurationMinutes = 0;
  stats.forEach(dayStat => {
    if (!dayStat.register || !Array.isArray(dayStat.register)) return;
    const userEntries = dayStat.register.filter(r => r.userId?.toString() === userPlan.userId.toString());

    userEntries.forEach(userEntry => {
      if (userEntry.checkInTime) {
        const endTime = userEntry.checkOutTimeReal || userEntry.checkOutTimeCalc;
        if (endTime) {
          const durationMs = new Date(endTime) - new Date(userEntry.checkInTime);
          if (durationMs > 0) {
            totalDurationMinutes += Math.floor(durationMs / (1000 * 60));
          }
        }
      }
    });
  });

  const durationHours = (totalDurationMinutes / 60).toFixed(1);
  const remainingDays = Math.max(0, Math.ceil((new Date(userPlan.maxExpiryDate) - new Date()) / (1000 * 60 * 60 * 24)));

  return {
    id: userPlan.user?.id,
    planId: userPlan.id,
    name: userPlan.user?.name,
    email: userPlan.user?.email,
    phone: userPlan.user?.phone,
    photo: userPlan.user?.photo,
    gender: userPlan.user?.gender,

    planName: userPlan.plan?.name || 'Unknown Plan',
    planType: userPlan.plan?.planType,
    planDuration: userPlan.planDuration,

    amountDeducted: userPlan.amountDeducted,
    purchaseDate: userPlan.purchaseDate,
    usedDays: userPlan.usedDays,
    expiryDate: userPlan.maxExpiryDate,
    isExpired: userPlan.isExpired,
    remainingDays,

    workoutDurationHours: durationHours,
    refundHistory: userPlan.metadata?.refundHistory || []
  };
};

