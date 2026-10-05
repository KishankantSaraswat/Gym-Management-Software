import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ratingService from "../services/ratingService.js";

// Add Rating
export const addRating = catchAsyncErrors(async (req, res, next) => {
  const { gymId, rating, feedback } = req.body;
  const userId = req.user.id;

  const newRating = await ratingService.addRating(userId, gymId, rating, feedback);

  res.status(201).json({
    success: true,
    message: "Rating submitted successfully",
    rating: newRating
  });
});

// Like/Dislike Rating
export const handleRatingAction = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isLike = req.path.includes('like');

  const rating = await ratingService.handleRatingAction(id, userId, isLike);

  res.status(200).json({
    success: true,
    message: `Rating ${isLike ? 'liked' : 'disliked'} successfully`,
    rating
  });
});

export const getGymRatings = catchAsyncErrors(async (req, res, next) => {
  const { gymId } = req.params;
  
  const result = await ratingService.getGymRatings(gymId);

  res.status(200).json({
    success: true,
    average: result.average,
    ratings: result.ratings
  });
});

// Update rating
export const updateRating = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { stars, comment } = req.body;
  const userId = req.user.id;
  
  const rating = await ratingService.updateRating(id, userId, stars, comment);

  res.status(200).json({
    success: true,
    rating
  });
});

// Delete rating
export const deleteRating = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  await ratingService.deleteRating(id, userId);

  res.status(200).json({
    success: true,
    message: "Rating deleted successfully"
  });
});
