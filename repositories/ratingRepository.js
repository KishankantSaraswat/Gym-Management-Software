import { GymRating, UserPlan, User, Gym } from "../models/index.js";
import { sequelize } from '../database/db.js';

class RatingRepository {
  async runTransaction(callback) {
    return await sequelize.transaction(callback);
  }

  async checkUserPlan(userId, gymId) {
    return await UserPlan.findOne({
      where: {
        userId,
        gymId,
        isExpired: false
      }
    });
  }

  async getRatingByUserAndGym(userId, gymId) {
    return await GymRating.findOne({ where: { userId, gymId } });
  }

  async createRating(ratingData) {
    return await GymRating.create(ratingData);
  }

  async getRatingsByGymId(gymId) {
    return await GymRating.findAll({ where: { gymId } });
  }

  async updateGymRating(gymId, avg) {
    return await Gym.update({ avgRating: avg }, { where: { id: gymId } });
  }

  async getRatingById(id, transaction = null) {
    return await GymRating.findByPk(id, { transaction });
  }

  async getUserById(id, transaction = null) {
    return await User.findByPk(id, { transaction });
  }

  async saveRating(rating, transaction = null) {
    return await rating.save({ transaction });
  }

  async saveUser(user, transaction = null) {
    return await user.save({ transaction });
  }

  async getGymById(id) {
    return await Gym.findByPk(id);
  }

  async getGymRatingsWithUser(gymId) {
    return await GymRating.findAll({
      where: { gymId },
      include: [{ model: User, as: 'user', attributes: ['name', 'profilePicture'] }],
      order: [['createdAt', 'DESC']]
    });
  }

  async getAvgRatingByGymId(gymId) {
    return await GymRating.findAll({
      where: { gymId },
      attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'average']],
      raw: true
    });
  }

  async getRatingByIdAndUser(id, userId) {
    return await GymRating.findOne({ where: { id, userId } });
  }

  async updateRatingContent(rating, stars, comment) {
    return await rating.update({ rating: stars, feedback: comment });
  }

  async deleteRating(id, userId) {
    return await GymRating.destroy({ where: { id, userId } });
  }
}

export default new RatingRepository();
