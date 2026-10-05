import * as gymRepo from '../repositories/gymRepository.js';
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { sequelize } from '../database/db.js';
import { sendPushNotification } from "../utils/notificationUtils.js";
import { Op } from 'sequelize';
import { User, GymMedia, VerificationDocument, Gym } from "../models/index.js";

export const registerGymService = async (userData, gymData) => {
  if (userData.role !== 'GymOwner') {
    throw new ErrorHandler("Only gym owners can register gyms", 403);
  }

  const existingGym = await gymRepo.findGymByOwnerId(userData.id);
  if (existingGym) {
    throw new ErrorHandler("Only one gym can be registered per gym owner", 400);
  }

  const { location, coordinates, ...rest } = gymData;

  const gym = await gymRepo.createGym({
    ...rest,
    address: location,
    longitude: Array.isArray(coordinates) ? coordinates[0] : 0,
    latitude: Array.isArray(coordinates) ? coordinates[1] : 0,
    ownerId: userData.id,
  });

  return gym;
};

export const addUpdateGymMediaService = async (userId, mediaData) => {
  return await sequelize.transaction(async (t) => {
    const {
      mediaUrls = [],
      logoUrl,
      bannerPhotoUrl,
      frontPhotoUrl,
      receptionPhotoUrl,
      workoutFloorPhotoUrl,
      lockerRoomPhotoUrl,
      trainerTeamPhotoUrl
    } = mediaData;

    if (!Array.isArray(mediaUrls) || (logoUrl && typeof logoUrl !== 'string')) {
      throw new ErrorHandler("Invalid media data format", 400);
    }

    const gym = await gymRepo.findGymByOwnerId(userId, { transaction: t });
    if (!gym) {
      throw new ErrorHandler("Gym not found or unauthorized", 404);
    }

    let mediaDoc = await gymRepo.findGymMediaByGymId(gym.id, { transaction: t });

    if (mediaDoc) {
      mediaDoc.mediaUrls = mediaUrls.filter(url => url.trim() !== "");
      if (logoUrl && logoUrl.trim() !== "") mediaDoc.logoUrl = logoUrl;
      if (bannerPhotoUrl) mediaDoc.bannerPhotoUrl = bannerPhotoUrl;
      if (frontPhotoUrl) mediaDoc.frontPhotoUrl = frontPhotoUrl;
      if (receptionPhotoUrl) mediaDoc.receptionPhotoUrl = receptionPhotoUrl;
      if (workoutFloorPhotoUrl) mediaDoc.workoutFloorPhotoUrl = workoutFloorPhotoUrl;
      if (lockerRoomPhotoUrl) mediaDoc.lockerRoomPhotoUrl = lockerRoomPhotoUrl;
      if (trainerTeamPhotoUrl) mediaDoc.trainerTeamPhotoUrl = trainerTeamPhotoUrl;

      await mediaDoc.save({ transaction: t });
    } else {
      mediaDoc = await gymRepo.createGymMedia({
        gymId: gym.id,
        mediaUrls: mediaUrls.filter(url => url.trim() !== ""),
        logoUrl: logoUrl?.trim() || "",
        bannerPhotoUrl,
        frontPhotoUrl,
        receptionPhotoUrl,
        workoutFloorPhotoUrl,
        lockerRoomPhotoUrl,
        trainerTeamPhotoUrl
      }, { transaction: t });
    }

    return mediaDoc;
  });
};

export const getGymDetailsService = async (gymId) => {
  const gym = await gymRepo.findGymById(gymId, {
    include: [
      { model: GymMedia, as: 'media' },
      { model: User, as: 'owner', attributes: ['name', 'email', 'phone'] }
    ]
  });

  if (!gym || gym.isDeleted) {
    throw new ErrorHandler("Gym not found", 404);
  }

  return gym;
};

export const updateGymService = async (gymId, userId, updateData) => {
  const updates = Object.keys(updateData);
  const allowedUpdates = ['name', 'capacity', 'openTime', 'closeTime',
    'contactEmail', 'phone', 'alternatePhone', 'about', 'shifts', 'gymSlogan', 'equipmentList',
    'gymType', 'facilities', 'onboardingStep', 'onboardingStatus', 'pincode', 'location'];

  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    throw new ErrorHandler("Invalid updates!", 400);
  }

  const gym = await gymRepo.findGymByIdAndOwner(gymId, userId);

  if (!gym) {
    console.log("❌ Gym not found or not authorized for ID:", gymId, "User:", userId);
    throw new ErrorHandler("Gym not found or not authorized", 404);
  }

  updates.forEach(update => {
    if (update === 'equipmentList') {
      if (!Array.isArray(updateData.equipmentList)) {
        throw new ErrorHandler("equipmentList must be an array", 400);
      }
      gym.equipmentList = updateData.equipmentList;
    } else if (update === 'location') {
      if (typeof updateData.location === 'object') {
        const currentLoc = gym.location || {};
        gym.location = {
          address: updateData.location.address || currentLoc.address,
          coordinates: updateData.location.coordinates || currentLoc.coordinates
        };
      } else {
        const currentLoc = gym.location || {};
        currentLoc.address = updateData.location;
        gym.location = currentLoc;
      }
    } else {
      gym[update] = updateData[update];
    }
  });

  await gym.save();
  return gym;
};

export const getAllGymsService = async (queryData) => {
  const { status, search, near } = queryData;
  const query = { isDeleted: false };

  if (status) query.status = status;
  if (search) query.name = { [Op.iLike]: '%' + search + '%' };

  let orderOptions = [];

  if (near) {
    const [lat, lng, radius] = near.split(',').map(Number);
    const delta = (radius || 5000) / 111320;
    
    query.latitude = { [Op.between]: [lat - delta, lat + delta] };
    query.longitude = { [Op.between]: [lng - delta, lng + delta] };
    
    orderOptions.push([sequelize.literal(`ABS(latitude - ${lat}) + ABS(longitude - ${lng})`), 'ASC']);
  }

  const gyms = await gymRepo.findAllGyms({
    where: query,
    include: [
      { model: GymMedia, as: 'media' },
      { model: User, as: 'owner', attributes: ['name'] }
    ],
    order: orderOptions.length > 0 ? orderOptions : undefined
  });

  return gyms;
};

export const getGymsByOwnerService = async (user, bodyData) => {
  const query = { isDeleted: false };

  if (user.role !== 'Admin') {
    query.ownerId = user.id;
  } else if (bodyData.gymIds && user.role === 'Admin') {
    query.id = { [Op.in]: bodyData.gymIds };
  }

  const gyms = await gymRepo.findAllGyms({
    where: query,
    include: [
      { model: User, as: 'owner', attributes: ['name', 'email'] },
      { model: VerificationDocument, as: 'verificationDocument' },
      { model: GymMedia, as: 'media' }
    ]
  });

  return gyms;
};

export const toggleGymStatusService = async (userId) => {
  const gym = await gymRepo.findGymByOwnerId(userId);

  if (!gym) {
    throw new ErrorHandler("Gym not found or unauthorized", 404);
  }

  gym.status = gym.status === 'open' ? 'closed' : 'open';
  await gym.save();
  
  return gym;
};

export const addUpdateVerificationDocumentsService = async (userId, docData) => {
  const { documentUrls = [], gstUrl, idProofUrl, certificationUrl } = docData;
  
  const gym = await gymRepo.findGymByOwnerId(userId);
  if (!gym) {
    throw new ErrorHandler('Gym not found for this user.', 404);
  }

  if (gym.isVerified) {
    throw new ErrorHandler("Cannot update documents after verification", 400);
  }

  const isPdf = (url) => typeof url === 'string' && url.toLowerCase().endsWith('.pdf');

  if ((gstUrl && !isPdf(gstUrl)) ||
    (idProofUrl && !isPdf(idProofUrl)) ||
    (certificationUrl && !isPdf(certificationUrl))) {
    throw new ErrorHandler("Verification documents must be PDF files", 400);
  }

  const [doc, created] = await gymRepo.upsertVerificationDocument({
    gymId: gym.id,
    documentUrls,
    gstUrl,
    idProofUrl,
    certificationUrl
  }, { returning: true });

  return doc;
};

export const createGymAnnouncementService = async (userId, message) => {
  const gym = await gymRepo.findGymByOwnerId(userId);
  if (!gym) {
    throw new ErrorHandler('Gym not found for this user.', 404);
  }

  const gymId = gym.id;

  if (!message) throw new ErrorHandler("Message required", 400);

  const activePlans = await gymRepo.getActiveUserPlansByGymId(gymId);
  const targetUsers = activePlans.map(p => p.userId);
  console.log(`📢 Announcement being created for Gym ${gym.name}. Resolved ${targetUsers.length} target users.`);

  const announcement = await gymRepo.createAnnouncement({
    gymId,
    message,
    targetUsers,
    createdBy: userId
  });

  if (targetUsers.length > 0) {
    console.log("🚀 Triggering push notification utility...");
    sendPushNotification(
      targetUsers,
      `New Announcement from ${gym.name}`,
      message,
      { type: "GYM_ANNOUNCEMENT", gymId: gymId.toString() }
    );
  } else {
    console.warn("⚠️ No target users found with active plans to send notifications to.");
  }

  return announcement;
};

export const getUserAnnouncementsByGymService = async (user) => {
  const userId = user.id;
  const role = user.role;
  let gymIds = [];

  if (role === 'GymOwner') {
    const ownerGym = await gymRepo.findGymByOwnerId(userId, { attributes: ['id'] });
    if (ownerGym) {
      gymIds = [ownerGym.id];
    }
  } else {
    const userPlans = await gymRepo.findUserPlansByUserId(userId);
    gymIds = userPlans.map(plan => plan.gymId);
  }

  if (!gymIds.length) {
    return [];
  }

  const announcements = await gymRepo.findAnnouncements({
    where: { gymId: { [Op.in]: gymIds } },
    attributes: ['id', 'message', 'gymId', 'createdAt', 'updatedAt'],
    include: [
      {
        model: Gym,
        as: 'gym',
        attributes: ['name'],
        include: [
          {
            model: GymMedia,
            as: 'media',
            attributes: ['logoUrl']
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  return announcements;
};

export const deleteGymAnnouncementService = async (announcementId, userId) => {
  const deletedCount = await gymRepo.deleteAnnouncement({
    id: announcementId,
    createdBy: userId
  });

  if (deletedCount === 0) {
    throw new ErrorHandler("Announcement not found or unauthorized", 404);
  }
};
