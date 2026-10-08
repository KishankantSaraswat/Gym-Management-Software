import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import { GymMaster, GymBranchMaster, GymUser, GymBranchUser, SubscriptionPlan } from '../models/index.js';
import authorizationService from '../services/authorizationService.js';
import masterAuthzService from '../services/masterAuthzService.js';
import auditService from '../services/auditService.js';

export const getMyGyms = catchAsyncErrors(async (req, res, next) => {
  const gyms = req.authContext?.available_gyms || [];
  res.status(200).json({
    success: true,
    gyms
  });
});

export const getGymBranches = catchAsyncErrors(async (req, res, next) => {
  const gymId = req.params.gymId || req.headers['x-gym-id'] || req.query.gymId || req.gym?.id;
  if (!gymId) {
    return next(new ErrorHandler("Gym ID is required.", 400));
  }

  await authorizationService.assertTenantOwnership(req, gymId);

  const branches = await GymBranchMaster.findAll({
    where: { gymId, status: 'active' },
    order: [['id', 'ASC']]
  });

  res.status(200).json({
    success: true,
    count: branches.length,
    branches
  });
});

export const createBranch = catchAsyncErrors(async (req, res, next) => {
  const gymId = req.params.gymId || req.headers['x-gym-id'] || req.body.gymId || req.gym?.id;
  if (!gymId) {
    return next(new ErrorHandler("Gym ID is required.", 400));
  }

  await authorizationService.assertTenantOwnership(req, gymId);

  // Check subscription branch limit
  const tenant = await GymMaster.findByPk(gymId, {
    include: [{ model: SubscriptionPlan, as: 'subscriptionPlan' }]
  });

  if (!tenant) {
    return next(new ErrorHandler("Gym tenant not found.", 404));
  }

  const maxBranches = tenant.subscriptionPlan?.maxBranches || 1;
  const currentCount = await GymBranchMaster.count({ where: { gymId } });

  if (currentCount >= maxBranches) {
    return next(new ErrorHandler(`Your subscription plan (${tenant.subscriptionPlan?.planName || 'FREE'}) allows a maximum of ${maxBranches} branch(es). Please upgrade to add more.`, 403));
  }

  const { branchName, address, city, pincode, phone, contactEmail, capacity, openTime, closeTime } = req.body;
  if (!branchName || !address) {
    return next(new ErrorHandler("Branch name and address are required.", 400));
  }

  const branchCode = 'BR_' + branchName.replace(/\s+/g, '_').toUpperCase().substring(0, 8) + '_' + Math.floor(1000 + Math.random() * 9000);

  const branch = await GymBranchMaster.create({
    gymId,
    branchCode,
    branchName,
    address,
    city: city || null,
    pincode: pincode || null,
    phone: phone || tenant.phone,
    contactEmail: contactEmail || tenant.email,
    capacity: capacity || 50,
    openTime: openTime || '06:00',
    closeTime: closeTime || '22:00',
    status: 'active'
  });

  // Assign branch to creating owner
  const gymUser = await GymUser.findOne({ where: { userId: req.user.id, gymId } });
  if (gymUser) {
    await GymBranchUser.create({
      gymId,
      branchId: branch.id,
      gymUserId: gymUser.id,
      isActive: true
    });
  }

  // Invalidate Redis authorization cache
  await masterAuthzService.invalidateAuthzVersion(req.user.id);

  // Audit log
  auditService.log({
    actorUserId: req.user.id,
    gymId,
    branchId: branch.id,
    action: 'BRANCH_CREATED',
    resourceType: 'BRANCH',
    resourceId: branch.id,
    newValue: { branchName, branchCode }
  });

  res.status(201).json({
    success: true,
    message: "Branch created successfully",
    branch
  });
});
