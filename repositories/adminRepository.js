import { Op } from 'sequelize';
import { sequelize } from '../database/db.js';
import { GymMedia, Gym, VerificationDocument, Announcement, Plan, User, GymPlanRevenue, UserPlan, AdminPlan } from '../models/index.js';

export const adminRepository = {
  findGymByIdWithOwner: async (gymId) => {
    return Gym.findByPk(gymId, {
      include: [{ model: User, as: 'owner', attributes: ['name', 'email'] }]
    });
  },

  findGymById: async (gymId) => {
    return Gym.findByPk(gymId);
  },

  saveGym: async (gym) => {
    return gym.save();
  },

  findAdminPlanById: async (planId) => {
    return AdminPlan.findByPk(planId);
  },

  findAllUnverifiedGyms: async () => {
    return Gym.findAll({
      where: { isVerified: false, isDeleted: false },
      include: [
        { model: GymMedia, as: 'media' },
        { model: VerificationDocument, as: 'verificationDocument' },
        { model: AdminPlan, as: 'assignedPlan' },
        { model: User, as: 'owner', attributes: ['name', 'email', 'phone', 'walletBalance'] }
      ]
    });
  },

  findAllGymsForAdmin: async () => {
    return Gym.findAll({
      where: { isDeleted: false },
      order: [['createdAt', 'DESC']],
      include: [
        { model: GymMedia, as: 'media' },
        { model: VerificationDocument, as: 'verificationDocument' },
        { model: AdminPlan, as: 'assignedPlan' },
        { model: User, as: 'owner', attributes: ['name', 'email', 'phone', 'walletBalance'] }
      ]
    });
  },

  getGymPlanRevenueStats: async (startOfToday, startOfCurrentMonth, startOfCurrentYear) => {
    return GymPlanRevenue.findAll({
      attributes: [
        'gymId',
        [sequelize.fn('SUM', sequelize.col('revenue')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('commission')), 'totalCommission'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfToday.toISOString()}' THEN "revenue" ELSE 0 END`)), 'todayRevenue'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfToday.toISOString()}' THEN "commission" ELSE 0 END`)), 'todayCommission'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfCurrentMonth.toISOString()}' THEN "revenue" ELSE 0 END`)), 'monthRevenue'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfCurrentMonth.toISOString()}' THEN "commission" ELSE 0 END`)), 'monthCommission'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfCurrentYear.toISOString()}' THEN "revenue" ELSE 0 END`)), 'yearRevenue'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN "date" >= '${startOfCurrentYear.toISOString()}' THEN "commission" ELSE 0 END`)), 'yearCommission']
      ],
      group: ['gymId']
    });
  },

  findGymDetailsAdmin: async (gymId) => {
    return Gym.findByPk(gymId, {
      include: [
        { model: GymMedia, as: 'media' },
        { model: VerificationDocument, as: 'verificationDocument' },
        { model: AdminPlan, as: 'assignedPlan' },
        { model: User, as: 'owner', attributes: ['name', 'email', 'phone', 'walletBalance', 'role'] }
      ]
    });
  },

  findPlansByGymId: async (gymId) => {
    return Plan.findAll({ where: { gymId } });
  },

  getTotalRevenueByGymId: async (gymId) => {
    return GymPlanRevenue.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('revenue')), 'total']
      ],
      where: { gymId }
    });
  },

  countUserPlans: async (where) => {
    return UserPlan.count({ where });
  },

  getPlanBreakdownByGymId: async (gymId) => {
    return UserPlan.findAll({
      attributes: [
        'planId',
        [sequelize.fn('COUNT', sequelize.col('UserPlan.id')), 'count']
      ],
      where: { gymId },
      include: [{ model: Plan, as: 'plan', attributes: ['name', 'planType'] }],
      group: ['UserPlan.planId', 'plan.id']
    });
  },

  createAnnouncement: async (data) => {
    return Announcement.create(data);
  },

  findUsersForAnnouncement: async (where) => {
    return User.findAll({ where, attributes: ['id'] });
  },

  findGymsForAnnouncement: async (where) => {
    return Gym.findAll({ where, attributes: ['ownerId'] });
  },

  findAnnouncementById: async (id) => {
    return Announcement.findByPk(id);
  },

  destroyAnnouncement: async (announcement) => {
    return announcement.destroy();
  },

  findUserById: async (id) => {
    return User.findByPk(id);
  },

  findAllAnnouncements: async () => {
    return Announcement.findAll({
      attributes: ['id', 'title', 'message', 'createdAt', 'updatedAt', 'targetType', 'targetGyms', 'targetUsers'],
      order: [['createdAt', 'DESC']]
    });
  },

  findGymsByOwnerId: async (ownerId) => {
    return Gym.findAll({ where: { ownerId }, attributes: ['id'] });
  },

  findUsersByQuery: async (where) => {
    return User.findAll({ where, attributes: ['id', 'name', 'email', 'role'] });
  },

  findGymsByQuery: async (where) => {
    return Gym.findAll({ where, attributes: ['id', 'name', 'status'] });
  },

  findPlansByQuery: async (where) => {
    return Plan.findAll({
      where,
      include: [{ model: Gym, as: 'gym', attributes: ['name', 'location', 'status'] }]
    });
  },

  findGymsByLocation: async (lat, lng, radius) => {
    return Gym.findAll({
      where: sequelize.literal(`ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radius || 10000})`),
      attributes: ['id']
    });
  },

  updatePlanFactor: async (factor, planIds) => {
    return Plan.update(
      { maxExpiryFactor: factor },
      { where: { id: { [Op.in]: planIds } } }
    );
  },

  countGyms: async (where) => {
    return Gym.count({ where });
  },

  countUsers: async (where) => {
    return User.count({ where });
  },

  getTotalRevenueAggregation: async () => {
    return GymPlanRevenue.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('revenue')), 'total']
      ]
    });
  },

  getMonthlyRevenue: async (twelveMonthsAgo) => {
    return GymPlanRevenue.findAll({
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "date"')), 'year'],
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "date"')), 'month'],
        [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue']
      ],
      where: {
        date: { [Op.gte]: twelveMonthsAgo }
      },
      group: [
        sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "date"')),
        sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "date"'))
      ],
      order: [
        [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "date"')), 'ASC'],
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "date"')), 'ASC']
      ]
    });
  },

  getGymTypeRevenue: async () => {
    return GymPlanRevenue.findAll({
      attributes: [
        [sequelize.col('gym.gymType'), 'gymType'],
        [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue']
      ],
      include: [{
        model: Gym,
        as: 'gym',
        attributes: [],
        where: { isDeleted: false }
      }],
      group: ['gym.gymType']
    });
  },

  getTopGymsByRevenue: async () => {
    return GymPlanRevenue.findAll({
      attributes: [
        'gymId',
        [sequelize.fn('SUM', sequelize.col('revenue')), 'totalRevenue']
      ],
      include: [{
        model: Gym,
        as: 'gym',
        attributes: ['name'],
        where: { isDeleted: false }
      }],
      group: ['gymId', 'gym.id'],
      order: [[sequelize.fn('SUM', sequelize.col('revenue')), 'DESC']],
      limit: 10
    });
  },

  findAdminUserWithPassword: async (userId) => {
    return User.findOne({ where: { id: userId }, attributes: { include: ['password'] } });
  },

  deleteGymPermanently: async (gymId, gym, t) => {
    await Plan.destroy({ where: { gymId }, transaction: t });
    await GymMedia.destroy({ where: { gymId }, transaction: t });
    await VerificationDocument.destroy({ where: { gymId }, transaction: t });
    await UserPlan.destroy({ where: { gymId }, transaction: t });
    await GymPlanRevenue.destroy({ where: { gymId }, transaction: t });
    await gym.destroy({ transaction: t });
  }
};
