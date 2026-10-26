import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import {
  User,
  UserPlan,
  Plan,
  GymUser,
  UserGymMapping,
  UserFitnessProfile,
  Gym,
  ClientCompanyMaster
} from '../models/index.js';
import { sequelize } from '../database/db.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import authorizationService from '../services/authorizationService.js';

/**
 * Helper to resolve gym and verify access
 */
const resolveGymAndAuthorize = async (req, gymId) => {
  if (!gymId) {
    throw new ErrorHandler("Gym ID is required", 400);
  }

  // Check tenant ownership/authorization
  await authorizationService.assertTenantOwnership(req, gymId);

  // Verify Gym or ClientCompanyMaster exists
  let gym = await Gym.findByPk(gymId);
  if (!gym) {
    const company = await ClientCompanyMaster.findByPk(gymId);
    if (!company) {
      throw new ErrorHandler("Gym / Company not found", 404);
    }
  }

  return gymId;
};

/**
 * 1. CREATE MEMBER
 * POST /api/v1/members
 * Payload:
 * {
 *   gymId: number,
 *   name: string,
 *   email: string,
 *   phone?: string,
 *   password?: string,
 *   gender?: string,
 *   age?: number,
 *   height?: number,
 *   weight?: number,
 *   planId?: number,
 *   startDate?: string,
 *   profilePicture?: any
 * }
 */
export const createMember = catchAsyncErrors(async (req, res, next) => {
  const {
    gymId: rawGymId,
    name,
    email,
    phone,
    password,
    gender,
    age,
    height,
    weight,
    planId,
    startDate,
    profilePicture
  } = req.body;

  const gymId = rawGymId || req.user?.companyId || req.authContext?.company_id || req.headers['x-gym-id'];
  await resolveGymAndAuthorize(req, gymId);

  if (!name || !name.trim()) {
    return next(new ErrorHandler("Member name is required", 400));
  }
  if (!email || !email.trim()) {
    return next(new ErrorHandler("Member email is required", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Execute in database transaction to maintain consistency across tables
  const result = await sequelize.transaction(async (t) => {
    // 1. Check or Create User
    let user = await User.findOne({
      where: { email: normalizedEmail, isDeleted: false },
      transaction: t
    });

    let defaultPasswordHash = null;
    if (password) {
      defaultPasswordHash = await bcrypt.hash(password, 10);
    } else {
      defaultPasswordHash = await bcrypt.hash("Gymshood@" + Math.floor(1000 + Math.random() * 9000), 10);
    }

    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone || null,
        password: defaultPasswordHash,
        isPwdAuth: true,
        accountVerified: true,
        role: 'User',
        profile_picture: profilePicture || null
      }, { transaction: t });
    } else {
      // Update basic fields if provided
      if (phone) user.phone = phone;
      if (profilePicture) user.profile_picture = profilePicture;
      await user.save({ transaction: t });
    }

    // 2. Add / Update Gym Membership in gym_user and user_branch_mapping
    let gymMembership = null;
    try {
      gymMembership = await GymUser.findOne({
        where: { userId: user.id, gymId: Number(gymId) },
        transaction: t
      });

      if (!gymMembership) {
        gymMembership = await GymUser.create({
          userId: user.id,
          gymId: Number(gymId),
          userType: 'MEMBER',
          status: 'active',
          joinedAt: startDate ? new Date(startDate) : new Date()
        }, { transaction: t });
      } else {
        gymMembership.status = 'active';
        await gymMembership.save({ transaction: t });
      }
    } catch (gymUserErr) {
      console.warn("⚠️ GymUser record notice:", gymUserErr.message);
    }

    // Maintain UserGymMapping for legacy compatibility
    const [branchMapping] = await UserGymMapping.findOrCreate({
      where: { userId: user.id, gymId: Number(gymId) },
      defaults: { status: 'active', isPrimary: true },
      transaction: t
    });
    if (branchMapping && branchMapping.status !== 'active') {
      branchMapping.status = 'active';
      await branchMapping.save({ transaction: t });
    }

    // 3. User Fitness Profile (Optional)
    let fitnessProfile = null;
    if (gender || age || height || weight) {
      fitnessProfile = await UserFitnessProfile.findOne({
        where: { userId: user.id },
        transaction: t
      });

      if (!fitnessProfile) {
        fitnessProfile = await UserFitnessProfile.create({
          userId: user.id,
          gender: gender || null,
          age: age ? Number(age) : null,
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null
        }, { transaction: t });
      } else {
        if (gender) fitnessProfile.gender = gender;
        if (age) fitnessProfile.age = Number(age);
        if (height) fitnessProfile.height = Number(height);
        if (weight) fitnessProfile.weight = Number(weight);
        await fitnessProfile.save({ transaction: t });
      }
    }

    // 4. Assign Plan (Optional)
    let userPlan = null;
    if (planId) {
      const plan = await Plan.findByPk(planId, { transaction: t });
      if (!plan) {
        throw new ErrorHandler("Selected membership plan not found", 404);
      }

      const purchaseDate = startDate ? new Date(startDate) : new Date();
      const planDurationDays = (plan.duration || 1) * 30; // duration in months to days
      const maxExpiryDate = new Date(purchaseDate);
      maxExpiryDate.setDate(maxExpiryDate.getDate() + planDurationDays);

      userPlan = await UserPlan.create({
        userId: user.id,
        gymId: Number(gymId),
        planId: plan.id,
        perDayCost: plan.price ? Number((plan.price / planDurationDays).toFixed(2)) : 0,
        planDuration: planDurationDays,
        amountDeducted: plan.price || 0,
        purchaseDate,
        totalDays: planDurationDays,
        usedDays: 0,
        maxExpiryDate,
        isExpired: false,
        metadata: {
          assignedBy: req.user?.id,
          planName: plan.name,
          planType: plan.planType
        }
      }, { transaction: t });
    }

    return { user, gymMembership, fitnessProfile, userPlan };
  });

  const memberData = {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    phone: result.user.phone,
    profilePicture: result.user.profile_picture,
    membershipStatus: result.gymMembership?.status || 'active',
    joinedAt: result.gymMembership?.joinedAt || new Date(),
    fitnessProfile: result.fitnessProfile,
    activePlan: result.userPlan
  };

  res.status(201).json({
    success: true,
    message: "Member added successfully",
    member: memberData
  });
});

/**
 * 2. GET ALL MEMBERS (List with search, status filter, pagination)
 * GET /api/v1/members?gymId=1&status=active&search=john&page=1&limit=20
 */
export const getMembers = catchAsyncErrors(async (req, res, next) => {
  const gymId = req.query.gymId || req.user?.companyId || req.authContext?.company_id || req.headers['x-gym-id'];
  await resolveGymAndAuthorize(req, gymId);

  const { status, search, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  // Find users in gym_user or user_plans
  const gymUserWhere = { gymId: Number(gymId) };
  if (status && status !== 'all') {
    gymUserWhere.status = status;
  }

  // Filter by user search (name, email, phone)
  const userWhere = { isDeleted: false };
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    userWhere[Op.or] = [
      { name: { [Op.iLike]: s } },
      { email: { [Op.iLike]: s } },
      { phone: { [Op.iLike]: s } }
    ];
  }

  const { count, rows } = await GymUser.findAndCountAll({
    where: gymUserWhere,
    include: [
      {
        model: User,
        as: 'user',
        where: userWhere,
        attributes: ['id', 'name', 'email', 'phone', 'profile_picture', 'role']
      }
    ],
    order: [['joined_at', 'DESC'], ['id', 'DESC']],
    limit: limitNum,
    offset
  });

  const memberUserIds = rows.map(r => r.userId);

  // Fetch fitness profiles and active plans in parallel
  const [fitnessProfiles, activePlans] = await Promise.all([
    memberUserIds.length > 0
      ? UserFitnessProfile.findAll({ where: { userId: { [Op.in]: memberUserIds } } })
      : [],
    memberUserIds.length > 0
      ? UserPlan.findAll({
          where: {
            userId: { [Op.in]: memberUserIds },
            gymId: Number(gymId)
          },
          include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'planType', 'duration', 'price'] }],
          order: [['purchaseDate', 'DESC']]
        })
      : []
  ]);

  const fitnessMap = new Map();
  fitnessProfiles.forEach(fp => fitnessMap.set(fp.userId, fp));

  const planMap = new Map();
  activePlans.forEach(p => {
    // Keep the most recent plan for each user
    if (!planMap.has(p.userId)) {
      planMap.set(p.userId, p);
    }
  });

  const members = rows.map(item => {
    const u = item.user;
    const plan = planMap.get(item.userId);
    const fitness = fitnessMap.get(item.userId);

    let remainingDays = 0;
    if (plan && plan.maxExpiryDate) {
      remainingDays = Math.max(0, Math.ceil((new Date(plan.maxExpiryDate) - new Date()) / (1000 * 60 * 60 * 24)));
    }

    return {
      id: u.id,
      gymUserId: item.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      profilePicture: u.profile_picture,
      status: item.status,
      joinedAt: item.joinedAt,
      fitnessProfile: fitness || null,
      plan: plan ? {
        id: plan.id,
        planId: plan.planId,
        planName: plan.plan?.name || 'Custom Plan',
        planType: plan.plan?.planType,
        purchaseDate: plan.purchaseDate,
        expiryDate: plan.maxExpiryDate,
        totalDays: plan.totalDays,
        usedDays: plan.usedDays,
        remainingDays,
        isExpired: plan.isExpired || remainingDays === 0
      } : null
    };
  });

  res.status(200).json({
    success: true,
    count,
    page: pageNum,
    totalPages: Math.ceil(count / limitNum),
    members
  });
});

/**
 * 3. GET SINGLE MEMBER BY ID
 * GET /api/v1/members/:id?gymId=1
 */
export const getMemberById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const gymId = req.query.gymId || req.user?.companyId || req.authContext?.company_id || req.headers['x-gym-id'];
  await resolveGymAndAuthorize(req, gymId);

  const user = await User.findOne({
    where: { id, isDeleted: false },
    attributes: ['id', 'name', 'email', 'phone', 'address', 'pincode', 'profile_picture', 'createdAt']
  });

  if (!user) {
    return next(new ErrorHandler("Member not found", 404));
  }

  const [gymMembership, fitnessProfile, plans] = await Promise.all([
    GymUser.findOne({ where: { userId: id, gymId: Number(gymId) } }),
    UserFitnessProfile.findOne({ where: { userId: id } }),
    UserPlan.findAll({
      where: { userId: id, gymId: Number(gymId) },
      include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'planType', 'duration', 'price'] }],
      order: [['purchaseDate', 'DESC']]
    })
  ]);

  res.status(200).json({
    success: true,
    member: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      pincode: user.pincode,
      profilePicture: user.profile_picture,
      membership: gymMembership || null,
      fitnessProfile: fitnessProfile || null,
      plans: plans || []
    }
  });
});

/**
 * 4. UPDATE MEMBER
 * PUT /api/v1/members/:id
 * Payload:
 * {
 *   gymId: number,
 *   name?: string,
 *   email?: string,
 *   phone?: string,
 *   gender?: string,
 *   age?: number,
 *   height?: number,
 *   weight?: number,
 *   status?: string, // 'active' | 'inactive' | 'suspended'
 *   profilePicture?: any,
 *   planId?: number,
 *   expiryDate?: string
 * }
 */
export const updateMember = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const {
    gymId: rawGymId,
    name,
    email,
    phone,
    gender,
    age,
    height,
    weight,
    status,
    profilePicture,
    planId,
    expiryDate
  } = req.body;

  const gymId = rawGymId || req.user?.companyId || req.authContext?.company_id || req.headers['x-gym-id'];
  await resolveGymAndAuthorize(req, gymId);

  const user = await User.findOne({ where: { id, isDeleted: false } });
  if (!user) {
    return next(new ErrorHandler("Member not found", 404));
  }

  await sequelize.transaction(async (t) => {
    // 1. Update User info
    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (profilePicture !== undefined) user.profile_picture = profilePicture;
    if (email && email.trim().toLowerCase() !== user.email) {
      const existing = await User.findOne({
        where: { email: email.trim().toLowerCase(), id: { [Op.ne]: id }, isDeleted: false },
        transaction: t
      });
      if (existing) {
        throw new ErrorHandler("Email is already taken by another user", 409);
      }
      user.email = email.trim().toLowerCase();
    }
    await user.save({ transaction: t });

    // 2. Update Gym Membership status
    let gymMembership = await GymUser.findOne({
      where: { userId: id, gymId: Number(gymId) },
      transaction: t
    });

    if (gymMembership) {
      if (status) gymMembership.status = status;
      await gymMembership.save({ transaction: t });
    } else if (status) {
      gymMembership = await GymUser.create({
        userId: id,
        gymId: Number(gymId),
        status,
        userType: 'MEMBER'
      }, { transaction: t });
    }

    // 3. Update Fitness Profile
    if (gender !== undefined || age !== undefined || height !== undefined || weight !== undefined) {
      let fitnessProfile = await UserFitnessProfile.findOne({
        where: { userId: id },
        transaction: t
      });

      if (!fitnessProfile) {
        await UserFitnessProfile.create({
          userId: id,
          gender: gender || null,
          age: age ? Number(age) : null,
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null
        }, { transaction: t });
      } else {
        if (gender !== undefined) fitnessProfile.gender = gender;
        if (age !== undefined) fitnessProfile.age = Number(age);
        if (height !== undefined) fitnessProfile.height = Number(height);
        if (weight !== undefined) fitnessProfile.weight = Number(weight);
        await fitnessProfile.save({ transaction: t });
      }
    }

    // 4. Update / Assign Plan if requested
    if (planId) {
      const plan = await Plan.findByPk(planId, { transaction: t });
      if (plan) {
        const purchaseDate = new Date();
        const planDurationDays = (plan.duration || 1) * 30;
        const maxExpiry = expiryDate ? new Date(expiryDate) : new Date(Date.now() + planDurationDays * 24 * 60 * 60 * 1000);

        await UserPlan.create({
          userId: id,
          gymId: Number(gymId),
          planId: plan.id,
          perDayCost: plan.price ? Number((plan.price / planDurationDays).toFixed(2)) : 0,
          planDuration: planDurationDays,
          amountDeducted: plan.price || 0,
          purchaseDate,
          totalDays: planDurationDays,
          usedDays: 0,
          maxExpiryDate: maxExpiry,
          isExpired: false,
          metadata: { assignedBy: req.user?.id, planName: plan.name }
        }, { transaction: t });
      }
    } else if (expiryDate) {
      // Extend current active plan
      const latestPlan = await UserPlan.findOne({
        where: { userId: id, gymId: Number(gymId) },
        order: [['purchaseDate', 'DESC']],
        transaction: t
      });
      if (latestPlan) {
        latestPlan.maxExpiryDate = new Date(expiryDate);
        latestPlan.isExpired = new Date(expiryDate) < new Date();
        await latestPlan.save({ transaction: t });
      }
    }
  });

  res.status(200).json({
    success: true,
    message: "Member updated successfully"
  });
});

/**
 * 5. DELETE MEMBER (Soft delete / Deactivate from Gym)
 * DELETE /api/v1/members/:id?gymId=1
 */
export const deleteMember = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const gymId = req.query.gymId || req.body?.gymId || req.user?.companyId || req.authContext?.company_id || req.headers['x-gym-id'];
  await resolveGymAndAuthorize(req, gymId);

  const user = await User.findByPk(id);
  if (!user) {
    return next(new ErrorHandler("Member not found", 404));
  }

  await sequelize.transaction(async (t) => {
    // 1. Mark gym_user membership as inactive or deleted
    const gymMembership = await GymUser.findOne({
      where: { userId: id, gymId: Number(gymId) },
      transaction: t
    });

    if (gymMembership) {
      gymMembership.status = 'inactive';
      await gymMembership.save({ transaction: t });
    }

    // 2. Mark active user plans in this gym as expired
    await UserPlan.update(
      { isExpired: true },
      {
        where: { userId: id, gymId: Number(gymId), isExpired: false },
        transaction: t
      }
    );
  });

  res.status(200).json({
    success: true,
    message: "Member successfully deactivated/removed from gym"
  });
});
