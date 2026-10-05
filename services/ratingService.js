import ratingRepository from '../repositories/ratingRepository.js';
import ErrorHandler from "../middlewares/errorMiddlewares.js";

class RatingService {
  async addRating(userId, gymId, rating, feedback) {
    const hasPurchased = await ratingRepository.checkUserPlan(userId, gymId);
    if (!hasPurchased) {
      throw new ErrorHandler("You need an active plan to rate this gym", 403);
    }

    const existingRating = await ratingRepository.getRatingByUserAndGym(userId, gymId);
    if (existingRating) {
      throw new ErrorHandler("You have already rated this gym", 400);
    }

    const newRating = await ratingRepository.createRating({
      userId,
      gymId,
      rating,
      feedback,
      verifiedBuyer: true
    });

    await this.updateGymAvgRating(gymId);
    return newRating;
  }

  async updateGymAvgRating(gymId) {
    const ratings = await ratingRepository.getRatingsByGymId(gymId);
    if (ratings.length > 0) {
      const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);
      const avg = total / ratings.length;
      await ratingRepository.updateGymRating(gymId, avg);
    }
  }

  async handleRatingAction(id, userId, isLike) {
    return await ratingRepository.runTransaction(async (t) => {
      const action = isLike ? 1 : -1;
      const rating = await ratingRepository.getRatingById(id, t);
      
      if (!rating) {
        throw new ErrorHandler("Rating not found", 404);
      }

      const user = await ratingRepository.getUserById(userId, t);
      
      const ratingInteractions = user.ratingInteractions || [];
      const existingInteractionIndex = ratingInteractions.findIndex(
        i => i.ratingId.toString() === id.toString()
      );
      const existingInteraction = existingInteractionIndex !== -1 ? ratingInteractions[existingInteractionIndex] : null;

      if (existingInteraction) {
        if (existingInteraction.action === action) {
          throw new ErrorHandler(`Already ${isLike ? 'liked' : 'disliked'} this rating`, 400);
        }
        ratingInteractions[existingInteractionIndex].action = action;
      } else {
        ratingInteractions.push({
          ratingId: rating.id,
          action
        });
      }
      
      user.ratingInteractions = ratingInteractions;
      user.changed('ratingInteractions', true);

      if (isLike) {
        rating.likes += action;
      } else {
        rating.dislikes += action;
      }

      await Promise.all([
        ratingRepository.saveRating(rating, t),
        ratingRepository.saveUser(user, t)
      ]);

      return rating;
    });
  }

  async getGymRatings(gymId) {
    if (!gymId || isNaN(parseInt(gymId))) {
      throw new ErrorHandler('Invalid Gym ID format', 400);
    }

    const gym = await ratingRepository.getGymById(gymId);
    if (!gym) {
      throw new ErrorHandler('Gym not found', 404);
    }

    const ratings = await ratingRepository.getGymRatingsWithUser(gymId);

    if (!ratings || ratings.length === 0) {
      return { average: 0, ratings: [] };
    }

    const avgRatingData = await ratingRepository.getAvgRatingByGymId(gymId);
    const average = avgRatingData[0]?.average ? parseFloat(avgRatingData[0].average) : 0;

    const formattedRatings = ratings.map(r => ({
      id: r.id,
      rating: r.rating,
      feedback: r.feedback,
      user: {
        name: r.user?.name || "Anonymous",
        profile_picture: r.user?.profilePicture || null
      },
      createdAt: r.createdAt
    }));

    return { average, ratings: formattedRatings };
  }

  async updateRating(id, userId, stars, comment) {
    const rating = await ratingRepository.getRatingByIdAndUser(id, userId);

    if (!rating) {
      throw new ErrorHandler("Rating not found", 404);
    }
    
    return await ratingRepository.updateRatingContent(rating, stars, comment);
  }

  async deleteRating(id, userId) {
    const deletedCount = await ratingRepository.deleteRating(id, userId);

    if (deletedCount === 0) {
      throw new ErrorHandler("Rating not found", 404);
    }
  }
}

export default new RatingService();
