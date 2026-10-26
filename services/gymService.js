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

  const { GymMaster, GymBranchMaster, GymUser, GymBranchUser, GymUserGroup, UserGroupMaster, SubscriptionPlan, GymPermission, UserPermissionMaster } = await import('../models/index.js');

  // Check if owner already has a tenant in gym_master
  let gymMaster = await GymMaster.findOne({ where: { ownerId: userData.id, status: 'active' } });

  if (gymMaster) {
    // Check subscription plan limit for multi-branch
    let maxBranches = 1;
    if (gymMaster.subscriptionPlanId) {
      const plan = await SubscriptionPlan.findByPk(gymMaster.subscriptionPlanId);
      if (plan) maxBranches = plan.maxBranches;
    }

    const currentBranchCount = await GymBranchMaster.count({ where: { gymId: gymMaster.id } });
    if (currentBranchCount >= maxBranches) {
      throw new ErrorHandler(`Your current subscription allows a maximum of ${maxBranches} branch(es). Please upgrade to PRO or ENTERPRISE to add more branches.`, 403);
    }
  }

  const { location, coordinates, ...rest } = gymData;
  const address = location || gymData.address || '';
  const longitude = Array.isArray(coordinates) ? coordinates[0] : (gymData.longitude || 0);
  const latitude = Array.isArray(coordinates) ? coordinates[1] : (gymData.latitude || 0);

  // Use transaction to ensure complete integrity across tenant, branch, and RBAC tables
  return await sequelize.transaction(async (t) => {
    // 1. Create GymMaster tenant if first gym
    if (!gymMaster) {
      const tenantCode = 'GYM_' + Date.now();
      gymMaster = await GymMaster.create({
        gymCode: tenantCode,
        gymName: gymData.name,
        email: gymData.contactEmail,
        phone: gymData.phone,
        ownerId: userData.id,
        status: 'active'
      }, { transaction: t });

      // Create GymUser membership as OWNER
      const gymUser = await GymUser.create({
        userId: userData.id,
        gymId: gymMaster.id,
        userType: 'OWNER',
        status: 'active'
      }, { transaction: t });

      // Assign GYM_OWNER role
      const ownerGroup = await UserGroupMaster.findOne({ where: { groupCode: 'GYM_OWNER' } });
      if (ownerGroup) {
        await GymUserGroup.create({
          gymUserId: gymUser.id,
          groupId: ownerGroup.id,
          isPrimary: true,
          isActive: true
        }, { transaction: t });
      }

      // Initialize all permissions in gym_permission
      const allPerms = await UserPermissionMaster.findAll({ where: { isActive: true } });
      for (const p of allPerms) {
        await GymPermission.findOrCreate({
          where: { gymId: gymMaster.id, permissionId: p.id },
          defaults: { isEnabled: true },
          transaction: t
        });
      }
    }

    // 2. Create the branch in gym_branch_master
    const branchCode = 'BR_' + (gymData.name ? gymData.name.replace(/\s+/g, '_').toUpperCase().substring(0, 8) : 'HQ') + '_' + Math.floor(1000 + Math.random() * 9000);
    const branch = await GymBranchMaster.create({
      gymId: gymMaster.id,
      branchCode,
      branchName: gymData.name,
      address,
      latitude,
      longitude,
      pincode: gymData.pincode || null,
      phone: gymData.phone,
      contactEmail: gymData.contactEmail,
      capacity: gymData.capacity || 50,
      openTime: gymData.openTime || '06:00',
      closeTime: gymData.closeTime || '22:00',
      status: 'active'
    }, { transaction: t });

    // 3. Create legacy gym record for backward compatibility
    const legacyGym = await gymRepo.createGym({
      ...rest,
      id: branch.id,
      clientId: gymMaster.id,
      address,
      longitude,
      latitude,
      ownerId: userData.id,
    }, { transaction: t });

    // 4. Assign branch access to owner in gym_branch_user
    const gymUser = await GymUser.findOne({ where: { userId: userData.id, gymId: gymMaster.id }, transaction: t });
    if (gymUser) {
      await GymBranchUser.findOrCreate({
        where: { gymId: gymMaster.id, branchId: branch.id, gymUserId: gymUser.id },
        defaults: { isActive: true },
        transaction: t
      });
    }

    return legacyGym;
  });
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

export const getGymsByOwnerService = async (user, bodyData = {}) => {
  const { ClientCompanyMaster, ClientCompanyUser } = await import('../models/index.js');

  // If user is a ClientCompanyUser or linked to a company, return the client company as the gym partner entity
  let company = null;
  if (user.companyId) {
    company = await ClientCompanyMaster.findByPk(user.companyId);
  } else if (user.email) {
    company = await ClientCompanyMaster.findOne({ where: { email: user.email } });
  }

  if (company) {
    const companyGymObject = {
      id: company.id,
      name: company.name,
      contactEmail: company.email,
      phone: company.mobile_no,
      address: company.address,
      website: company.website,
      status: company.status ? 'active' : 'inactive',
      isVerified: true,
      onboardingStatus: 'completed',
      subscriptionStatus: 'active',
      isDeleted: false,
      ownerId: user.id,
      companyId: company.id,
      company
    };
    return [companyGymObject];
  }

  const query = { isDeleted: false };

  if (user.role !== 'Admin' && !user.isSuperAdmin) {
    const { GymMaster, GymUser, GymBranchUser } = await import('../models/index.js');
    const tenant = await GymMaster.findOne({ where: { ownerId: user.id } });
    if (tenant) {
      query[Op.or] = [
        { clientId: tenant.id },
        { ownerId: user.id }
      ];
    } else {
      const branchMappings = await GymBranchUser.findAll({
        include: [{
          model: GymUser,
          as: 'gymUser',
          where: { userId: user.id, status: 'active' }
        }],
        where: { isActive: true }
      });
      const branchIds = branchMappings.map(b => b.branchId);
      query.id = { [Op.in]: branchIds.length ? branchIds : [-1] };
    }
  } else if (bodyData.gymIds && (user.role === 'Admin' || user.isSuperAdmin)) {
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
