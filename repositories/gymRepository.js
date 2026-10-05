import { Gym, GymMedia, GymAnnouncement, UserPlan, VerificationDocument, User } from "../models/index.js";
import { Op } from 'sequelize';
import { sequelize } from '../database/db.js';

export const findGymByOwnerId = async (ownerId, options = {}) => {
  return await Gym.findOne({ where: { ownerId }, ...options });
};

export const createGym = async (gymData, options = {}) => {
  return await Gym.create(gymData, options);
};

export const findGymMediaByGymId = async (gymId, options = {}) => {
  return await GymMedia.findOne({ where: { gymId }, ...options });
};

export const createGymMedia = async (mediaData, options = {}) => {
  return await GymMedia.create(mediaData, options);
};

export const findGymById = async (id, options = {}) => {
  return await Gym.findByPk(id, options);
};

export const findGymByIdAndOwner = async (id, ownerId, options = {}) => {
  return await Gym.findOne({ where: { id, ownerId }, ...options });
};

export const findAllGyms = async (options = {}) => {
  return await Gym.findAll(options);
};

export const upsertVerificationDocument = async (docData, options = {}) => {
  return await VerificationDocument.upsert(docData, options);
};

export const getActiveUserPlansByGymId = async (gymId) => {
  return await UserPlan.findAll({
    where: { gymId, isExpired: false },
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('userId')), 'userId']],
    raw: true,
  });
};

export const createAnnouncement = async (announcementData) => {
  return await GymAnnouncement.create(announcementData);
};

export const findUserPlansByUserId = async (userId) => {
  return await UserPlan.findAll({ where: { userId, isExpired: false }, attributes: ['gymId'] });
};

export const findAnnouncements = async (options = {}) => {
  return await GymAnnouncement.findAll(options);
};

export const deleteAnnouncement = async (whereOptions) => {
  return await GymAnnouncement.destroy({ where: whereOptions });
};
