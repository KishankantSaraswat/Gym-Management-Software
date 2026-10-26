import bcrypt from 'bcrypt';
import {
  AdminUser,
  UserGroup,
  UserGroupRight,
  UserMasterRight,
  UserBranchRight,
  User
} from '../models/index.js';
import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import sessionService from '../services/sessionService.js';
import auditService from '../services/auditService.js';

/**
 * Helper to compute merged page rights for a user/admin
 * Priority: UserMasterRight overrides UserGroupRight
 */
export const resolveUserRights = async (userId, groupId) => {
  const rightsMap = {};

  // 1. Group level rights
  if (groupId) {
    const groupRights = await UserGroupRight.findAll({
      where: { group_id: groupId }
    });
    for (const r of groupRights) {
      rightsMap[r.page_id] = {
        page_id: r.page_id,
        view_right: Boolean(r.view_right),
        add_right: Boolean(r.add_right),
        edit_right: Boolean(r.edit_right),
        excel_right: Boolean(r.excel_right),
        delete_right: Boolean(r.delete_right)
      };
    }
  }

  // 2. User specific rights (override group rights)
  if (userId) {
    const masterRights = await UserMasterRight.findAll({
      where: { user_id: userId }
    });
    for (const r of masterRights) {
      rightsMap[r.page_id] = {
        page_id: r.page_id,
        view_right: Boolean(r.view_right),
        add_right: Boolean(r.add_right),
        edit_right: Boolean(r.edit_right),
        excel_right: Boolean(r.excel_right),
        delete_right: Boolean(r.delete_right)
      };
    }
  }

  return rightsMap;
};

/**
 * Helper to fetch accessible branch IDs
 */
export const resolveUserBranches = async (userId) => {
  if (!userId) return [];
  const branchRights = await UserBranchRight.findAll({
    where: { user_id: userId }
  });
  return branchRights.map(b => b.branch_id);
};

/**
 * Separate Admin Login API (Rights-based, No Roles)
 * POST /admin/login
 * Body: { email, password }
 */
export const adminLogin = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password.", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Find admin user
  const admin = await AdminUser.findOne({
    where: { email: normalizedEmail },
    include: [
      {
        model: UserGroup,
        as: 'group',
        required: false
      },
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'name', 'email', 'phone'],
        required: false
      }
    ]
  });

  if (!admin) {
    return next(new ErrorHandler("Invalid email or password.", 401));
  }

  if (!admin.isActive || admin.isDeleted) {
    return next(new ErrorHandler("Admin account is deactivated or removed.", 403));
  }

  // 2. Validate group status and allowed IP if assigned
  if (admin.group) {
    if (admin.group.status === false) {
      return next(new ErrorHandler("Assigned user group is inactive.", 403));
    }
    if (admin.group.allow_ip && admin.group.allow_ip.trim() !== "") {
      const clientIp = req.ip || req.connection.remoteAddress || "";
      const allowedIps = admin.group.allow_ip.split(",").map(ip => ip.trim());
      const isIpAllowed = allowedIps.some(ip => clientIp.includes(ip) || ip === "*");
      if (!isIpAllowed) {
        return next(new ErrorHandler(`IP ${clientIp} is not authorized for this user group.`, 403));
      }
    }
  }

  // 3. Verify password
  const isPasswordMatched = await admin.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 401));
  }

  // Active Session Detection
  const hasActive = await sessionService.hasActiveSession(admin.id, 'AdminUser');
  const userConsent = req.body.consent === true || req.body.consent === 'true';

  if (hasActive && !userConsent) {
    return res.status(409).json({
      success: false,
      code: "SESSION_ACTIVE",
      requireConsent: true,
      require_consent: true,
      isAlreadyLoggedIn: true,
      message: "You are already logged in on another browser or device. Do you want to log in here?"
    });
  }

  if (hasActive) {
    await sessionService.revokeAllUserSessions(admin.id, 'AdminUser');
  }

  // 4. Resolve rights & branch access (strictly rights-based, no roles)
  const rightsMap = await resolveUserRights(admin.id, admin.groupId);
  const accessibleBranches = await resolveUserBranches(admin.id);

  // Update last login timestamp
  admin.lastLogin = new Date();
  await admin.save();

  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '7', 10);
  const { token, sessionId } = await sessionService.createAdminSession({
    admin,
    rights: rightsMap,
    branches: accessibleBranches,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresInDays: cookieExpireDays
  });

  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  auditService.log({
    actorUserId: admin.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    resourceType: 'ADMIN_SESSION',
    resourceId: sessionId,
    oldValue: null,
    newValue: {
      session_id: sessionId,
      admin_id: admin.id,
      email: admin.email,
      group_id: admin.groupId
    }
  });

  const adminResponse = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    profile_picture: admin.profile_picture,
    manager_id: admin.managerId,
    manager: admin.manager || null,
    group_id: admin.groupId,
    group: admin.group ? {
      id: admin.group.id,
      group_name: admin.group.group_name,
      status: admin.group.status
    } : null,
    cr_usr: admin.crUsr,
    md_usr: admin.mdUsr,
    rights: Object.values(rightsMap),
    branches: accessibleBranches,
    lastLogin: admin.lastLogin,
    createdAt: admin.created_at || admin.createdAt
  };

  res.status(200)
    .cookie("gymshood_token", token, cookieOptions)
    .json({
      success: true,
      message: "Admin login successful.",
      token,
      session_id: sessionId,
      admin: adminResponse
    });
});

/**
 * Get Current Admin Profile & Rights
 * GET /admin/profile or GET /admin/me
 */
export const getAdminProfile = catchAsyncErrors(async (req, res, next) => {
  const currentAdmin = req.user;
  if (!currentAdmin) {
    return next(new ErrorHandler("Admin profile not found.", 404));
  }

  const admin = await AdminUser.findByPk(currentAdmin.id, {
    include: [
      {
        model: UserGroup,
        as: 'group',
        required: false
      },
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'name', 'email', 'phone'],
        required: false
      }
    ]
  });

  const rightsMap = await resolveUserRights(admin.id, admin.groupId);
  const accessibleBranches = await resolveUserBranches(admin.id);

  const adminResponse = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    profile_picture: admin.profile_picture,
    manager_id: admin.managerId,
    manager: admin.manager || null,
    group_id: admin.groupId,
    group: admin.group ? {
      id: admin.group.id,
      group_name: admin.group.group_name,
      status: admin.group.status
    } : null,
    cr_usr: admin.crUsr,
    md_usr: admin.mdUsr,
    rights: Object.values(rightsMap),
    branches: accessibleBranches,
    lastLogin: admin.lastLogin,
    createdAt: admin.created_at || admin.createdAt
  };

  res.status(200).json({
    success: true,
    admin: adminResponse
  });
});

/**
 * Create a new Admin User (Master references, No roles)
 * POST /admin/create-admin
 */
export const createAdminUser = catchAsyncErrors(async (req, res, next) => {
  const {
    name,
    email,
    password,
    manager_id,
    managerId,
    group_id,
    groupId,
    phone
  } = req.body;

  if (!name || !email || !password) {
    return next(new ErrorHandler("Name, email, and password are required.", 400));
  }

  if (password.length < 6) {
    return next(new ErrorHandler("Password must be at least 6 characters long.", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingAdmin = await AdminUser.findOne({ where: { email: normalizedEmail } });
  if (existingAdmin) {
    return next(new ErrorHandler("An admin account with this email already exists.", 409));
  }

  const assignedGroupId = groupId || group_id || null;
  const assignedManagerId = managerId || manager_id || null;

  if (assignedGroupId) {
    const groupExists = await UserGroup.findByPk(assignedGroupId);
    if (!groupExists) {
      return next(new ErrorHandler(`Group with id ${assignedGroupId} not found in users_group_master.`, 404));
    }
  }

  if (assignedManagerId) {
    const managerExists = await User.findByPk(assignedManagerId);
    if (!managerExists) {
      return next(new ErrorHandler(`Manager with id ${assignedManagerId} not found in users.`, 404));
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const currentUserId = req.user?.id || null;

  const newAdmin = await AdminUser.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    managerId: assignedManagerId,
    groupId: assignedGroupId,
    crUsr: currentUserId,
    mdUsr: currentUserId,
    phone: phone || null,
    isActive: true,
    isDeleted: false
  });

  res.status(201).json({
    success: true,
    message: "Admin user created successfully with master references.",
    admin: {
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      manager_id: newAdmin.managerId,
      group_id: newAdmin.groupId,
      cr_usr: newAdmin.crUsr,
      md_usr: newAdmin.mdUsr,
      phone: newAdmin.phone
    }
  });
});

/**
 * Admin Logout API
 * GET /admin/logout
 */
export const adminLogout = catchAsyncErrors(async (req, res, next) => {
  if (req.sessionId) {
    await sessionService.revokeSession(req.sessionId);
  }

  res.status(200)
    .cookie("gymshood_token", "", {
      expires: new Date(0),
      httpOnly: true
    })
    .json({
      success: true,
      message: "Admin logged out successfully."
    });
});
