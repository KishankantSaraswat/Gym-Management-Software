import { adminRepository } from '../repositories/adminRepository.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import { sendEmail } from '../utils/sendEmail.js';
import { sendPushNotification } from '../utils/notificationUtils.js';
import { Op } from 'sequelize';
import { sequelize } from '../database/db.js';

export const adminService = {
  toggleGymVerification: async (gymId, adminPlanId) => {
    const gym = await adminRepository.findGymByIdWithOwner(gymId);
    if (!gym) throw new ErrorHandler("Gym not found", 404);

    if (!gym.isVerified) {
      if (!adminPlanId) {
        throw new ErrorHandler("Please select a plan while verifying the gym", 400);
      }

      const plan = await adminRepository.findAdminPlanById(adminPlanId);
      if (!plan || !plan.isActive) {
        throw new ErrorHandler("Selected plan is invalid or inactive", 404);
      }

      gym.isVerified = true;
      gym.isDeleted = false;
      gym.assignedPlanId = adminPlanId;
      gym.subscriptionStatus = 'pending';

      try {
        const emailContent = `
          <h2>Congratulations ${gym.owner.name}!</h2>
          <p>Your gym, <strong>${gym.name}</strong>, has been verified by the admin.</p>
          <p>To start using our portal, you need to subscribe to the assigned plan:</p>
          <ul>
            <li><strong>Plan Name:</strong> ${plan.name}</li>
            <li><strong>Price:</strong> ₹${plan.price}</li>
            <li><strong>Duration:</strong> ${plan.duration} days</li>
          </ul>
          <p>Please log in to your partner portal and complete the payment to activate your account.</p>
          <p>Stay fit,<br/>Team GymsHood</p>
        `;

        await sendEmail({
          to: gym.owner.email,
          subject: "🎉 Gym Verified - Action Required",
          message: emailContent
        });
      } catch (error) {
        console.error("Error sending verification email:", error);
      }
    } else {
      gym.isVerified = false;
    }

    await adminRepository.saveGym(gym);
    return {
      isVerified: gym.isVerified,
      isDeleted: gym.isDeleted,
      subscriptionStatus: gym.subscriptionStatus
    };
  },

  toggleGymDeletion: async (gymId) => {
    const gym = await adminRepository.findGymById(gymId);
    if (!gym) throw new ErrorHandler("Gym not found", 404);
    
    gym.isDeleted = !gym.isDeleted;
    if (gym.isDeleted) gym.isVerified = false;
    
    await adminRepository.saveGym(gym);
    return { isDeleted: gym.isDeleted, isVerified: gym.isVerified };
  },

  getUnverifiedGyms: async () => {
    return adminRepository.findAllUnverifiedGyms();
  },

  getAllGymsForAdmin: async () => {
    const gyms = await adminRepository.findAllGymsForAdmin();
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);

    const statsBreakdown = await adminRepository.getGymPlanRevenueStats(startOfToday, startOfCurrentMonth, startOfCurrentYear);

    const statsMap = statsBreakdown.reduce((acc, curr) => {
      const data = curr.get({ plain: true });
      if (data.gymId) {
        acc[data.gymId.toString()] = {
          totalRevenue: Number(data.totalRevenue) || 0,
          totalCommission: Number(data.totalCommission) || 0,
          todayRevenue: Number(data.todayRevenue) || 0,
          todayCommission: Number(data.todayCommission) || 0,
          monthRevenue: Number(data.monthRevenue) || 0,
          monthCommission: Number(data.monthCommission) || 0,
          yearRevenue: Number(data.yearRevenue) || 0,
          yearCommission: Number(data.yearCommission) || 0
        };
      }
      return acc;
    }, {});

    return gyms.map(gym => {
      const stats = statsMap[gym.id.toString()] || {
        totalRevenue: 0, totalCommission: 0, todayRevenue: 0, todayCommission: 0,
        monthRevenue: 0, monthCommission: 0, yearRevenue: 0, yearCommission: 0
      };

      return {
        ...gym.toJSON(),
        revenueBreakdown: stats,
        walletBalance: gym.owner?.walletBalance || 0
      };
    });
  },

  getGymDetailsAdmin: async (gymId) => {
    const gym = await adminRepository.findGymDetailsAdmin(gymId);
    if (!gym) throw new ErrorHandler("Gym not found", 404);

    const plans = await adminRepository.findPlansByGymId(gymId);
    const totalRevenueAggregation = await adminRepository.getTotalRevenueByGymId(gymId);
    const totalRevenue = totalRevenueAggregation.length > 0 ? (Number(totalRevenueAggregation[0].get('total')) || 0) : 0;

    const activeUsersCount = await adminRepository.countUserPlans({ gymId, isExpired: false });
    const expiredUsersCount = await adminRepository.countUserPlans({ gymId: gym.id, isExpired: true });

    const planBreakdownData = await adminRepository.getPlanBreakdownByGymId(gym.id);
    const planBreakdown = planBreakdownData.map(pb => {
      const data = pb.get({ plain: true });
      return {
        _id: data.planId,
        count: Number(data.count),
        planName: data.plan?.name,
        planType: data.plan?.planType
      };
    });

    return {
      gym,
      plans,
      totalRevenue,
      userStats: {
        active: activeUsersCount,
        expired: expiredUsersCount,
        planBreakdown
      }
    };
  },

  createAnnouncement: async (data, creatorId) => {
    const { title, message, targetType, targetGyms = [], targetUsers = [] } = data;
    if (!title || !message) throw new ErrorHandler("Title and message required", 400);

    const announcement = await adminRepository.createAnnouncement({
      title, message, createdBy: creatorId, targetType, targetGyms, targetUsers
    });

    let notificationTargetIds = [];
    try {
      if (targetType === "ALL") {
        const users = await adminRepository.findUsersForAnnouncement({ accountVerified: true });
        notificationTargetIds = users.map(u => u.id);
      } else if (targetType === "ALL_USERS") {
        const users = await adminRepository.findUsersForAnnouncement({ role: "User", accountVerified: true });
        notificationTargetIds = users.map(u => u.id);
      } else if (targetType === "ALL_GYMS") {
        const users = await adminRepository.findUsersForAnnouncement({ role: "GymOwner", accountVerified: true });
        notificationTargetIds = users.map(u => u.id);
      } else if (targetType === "SPECIFIC_GYMS") {
        const gyms = await adminRepository.findGymsForAnnouncement({ id: { [Op.in]: targetGyms } });
        notificationTargetIds = gyms.map(g => g.ownerId);
      } else if (targetType === "SPECIFIC_USERS") {
        notificationTargetIds = targetUsers;
      }

      if (notificationTargetIds.length > 0) {
        sendPushNotification(notificationTargetIds, title, message, {
          type: "ADMIN_ANNOUNCEMENT",
          announcementId: announcement.id.toString()
        });
      }
    } catch (error) {
      console.error("Error in admin announcement notification logic:", error);
    }

    return announcement;
  },

  deleteAnnouncement: async (announcementId) => {
    const announcement = await adminRepository.findAnnouncementById(announcementId);
    if (!announcement) {
      throw new ErrorHandler("Announcement not found", 404);
    }
    await adminRepository.destroyAnnouncement(announcement);
  },

  getUserAnnouncements: async (userId) => {
    const user = await adminRepository.findUserById(userId);
    const allAnnouncements = await adminRepository.findAllAnnouncements();

    let filtered = [];
    if (user.role === 'Admin') {
      filtered = allAnnouncements;
    } else if (user.role === 'GymOwner') {
      const gyms = await adminRepository.findGymsByOwnerId(userId);
      const gymIds = gyms.map(g => g.id.toString());
      filtered = allAnnouncements.filter(a => 
        a.targetType === 'ALL' || 
        a.targetType === 'ALL_GYMS' || 
        (a.targetType === 'SPECIFIC_GYMS' && Array.isArray(a.targetGyms) && a.targetGyms.some(id => gymIds.includes(id.toString())))
      );
    } else {
      const uIdStr = userId.toString();
      filtered = allAnnouncements.filter(a => 
        a.targetType === 'ALL' || 
        a.targetType === 'ALL_USERS' || 
        (a.targetType === 'SPECIFIC_USERS' && Array.isArray(a.targetUsers) && a.targetUsers.some(id => id.toString() === uIdStr))
      );
    }
    return filtered;
  },

  getUsersByQuery: async (query) => {
    const { search, role, email, phone, near } = query;
    const where = {};

    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (role) where.role = role;
    if (email) where.email = email;
    if (phone) where.phone = phone;
    
    if (near) {
      const [lat, lng, radius] = near.split(',').map(Number);
      where[Op.and] = sequelize.literal(
        `ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radius || 5000})`
      );
    }

    return adminRepository.findUsersByQuery(where);
  },

  getGymsByQuery: async (query) => {
    const { status, search, near } = query;
    const where = { isDeleted: false };

    if (status) where.status = status;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    if (near) {
      const [lat, lng, radius] = near.split(',').map(Number);
      where[Op.and] = sequelize.literal(
        `ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radius || 5000})`
      );
    }

    return adminRepository.findGymsByQuery(where);
  },

  getPlansByQuery: async (query) => {
    const { minValidity, maxValidity, minPrice, maxPrice, minDiscount, maxDiscount, near } = query;
    const where = { isActive: true };

    if (minValidity || maxValidity) {
      where.validity = {};
      if (minValidity) where.validity[Op.gte] = Number(minValidity);
      if (maxValidity) where.validity[Op.lte] = Number(maxValidity);
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = Number(minPrice);
      if (maxPrice) where.price[Op.lte] = Number(maxPrice);
    }

    if (minDiscount || maxDiscount) {
      where.discountPercent = {};
      if (minDiscount) where.discountPercent[Op.gte] = Number(minDiscount);
      if (maxDiscount) where.discountPercent[Op.lte] = Number(maxDiscount);
    }

    if (near) {
      const [lat, lng, radius] = near.split(',').map(Number);
      const gyms = await adminRepository.findGymsByLocation(lat, lng, radius);
      where.gymId = { [Op.in]: gyms.map(g => g.id) };
    }

    return adminRepository.findPlansByQuery(where);
  },

  updatePlanFactor: async (factor, planIds) => {
    if (!factor || factor < 1) {
      throw new ErrorHandler("Invalid factor value", 400);
    }
    if (!Array.isArray(planIds) || planIds.length === 0) {
      throw new ErrorHandler("No plan IDs provided", 400);
    }

    const [modifiedCount] = await adminRepository.updatePlanFactor(factor, planIds);
    return modifiedCount;
  },

  getAdminDashboardStats: async () => {
    const totalGyms = await adminRepository.countGyms({ isDeleted: false });
    const totalUsers = await adminRepository.countUsers({ role: 'User' });
    const pendingGyms = await adminRepository.countGyms({ isVerified: false, isDeleted: false });

    const revenueAggregation = await adminRepository.getTotalRevenueAggregation();
    const totalRevenue = revenueAggregation.length > 0 ? (Number(revenueAggregation[0].get('total')) || 0) : 0;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenue = await adminRepository.getMonthlyRevenue(twelveMonthsAgo);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedRevenueData = monthlyRevenue.map(item => {
      const data = item.get({ plain: true });
      return {
        month: monthNames[Number(data.month) - 1],
        revenue: Number(data.revenue) || 0
      };
    });

    const gymTypeDataRaw = await adminRepository.getGymTypeRevenue();
    const colors = ['#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#6366f1'];
    const formattedGymTypeData = gymTypeDataRaw.map((item, index) => {
      const type = item.get('gymType') || 'Others';
      return {
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: Number(item.get('revenue')) || 0,
        color: colors[index % colors.length]
      };
    });

    const topGymsData = await adminRepository.getTopGymsByRevenue();
    const topGyms = topGymsData.map(g => {
      const data = g.get({ plain: true });
      return {
        name: data.gym?.name,
        revenue: Number(data.totalRevenue) || 0,
        growth: "+15%",
        trend: "up"
      };
    });

    return {
      totalGyms,
      totalUsers,
      totalRevenue,
      pendingGyms,
      revenueData: formattedRevenueData,
      gymTypeData: formattedGymTypeData,
      topGyms
    };
  },

  updateGymCommission: async (gymId, commissionRate) => {
    if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
      throw new ErrorHandler("Please provide a valid commission rate between 0 and 100", 400);
    }

    const gym = await adminRepository.findGymById(gymId);
    if (!gym) throw new ErrorHandler("Gym not found", 404);

    gym.commissionRate = commissionRate;
    await adminRepository.saveGym(gym);
    
    return gym.commissionRate;
  },

  deleteGymPermanently: async (gymId, password, adminId) => {
    if (!password) {
      throw new ErrorHandler("Please provide your admin password to confirm deletion", 400);
    }

    const adminUser = await adminRepository.findAdminUserWithPassword(adminId);
    if (!adminUser) {
      throw new ErrorHandler("Admin user not found", 404);
    }

    const isPasswordMatched = await adminUser.comparePassword(password);
    if (!isPasswordMatched) {
      throw new ErrorHandler("Incorrect admin password. Deletion aborted.", 401);
    }

    const gym = await adminRepository.findGymById(gymId);
    if (!gym) {
      throw new ErrorHandler("Gym not found", 404);
    }

    const t = await sequelize.transaction();
    try {
      await adminRepository.deleteGymPermanently(gymId, gym, t);
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
};
