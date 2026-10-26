import {
  User,
  Gym,
  GymMaster,
  GymBranchMaster,
  UserPlan,
  AdminPlan,
  AdminUser,
  UserGroup,
  UserGroupRight,
  UserMasterRight,
  UserBranchRight
} from "../models/index.js";
import { catchAsyncErrors } from "./catchAsyncErrors.js";
import ErrorHandler from "./errorMiddlewares.js";
import jwt from "jsonwebtoken";
import sessionService from "../services/sessionService.js";
import masterAuthzService from "../services/masterAuthzService.js";

/**
 * Primary Authentication Middleware
 * Validates Compact JWT, enforces session revocation, and attaches Redis Authorization Context
 */
export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
    let token;

    // 1. Check Authorization header first (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1]?.trim();
    }
    // 2. Fallback to Cookies
    else if (req.cookies.gymshood_token) {
        token = req.cookies.gymshood_token.trim();
    }

    if (!token) {
        return next(new ErrorHandler("User is not authenticated. Please log in.", 401));
    }

    const secretKey = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');

    try {
        const decoded = jwt.verify(token, secretKey);
        const userId = decoded.sub || decoded.id;

        if (!userId) {
            return next(new ErrorHandler("Invalid authentication token payload.", 401));
        }

        // 3. Session Revocation Check (if session_id is present)
        if (decoded.session_id) {
            const isSessionValid = await sessionService.validateSession(decoded.session_id);
            if (!isSessionValid) {
                return next(new ErrorHandler("Session has been revoked or expired. Please log in again.", 401));
            }
        }

        // 4. Retrieve User (ClientCompanyUser, AdminUser or regular User)
        if (decoded.userType === 'ClientCompanyUser') {
            const { ClientCompanyUser, ClientCompanyMaster, ClientCompanyUserGroup, ClientCompanyUserGroupPermission, ClientCompanyUserPermission } = await import('../models/index.js');
            const clientUser = await ClientCompanyUser.findByPk(userId);

            if (!clientUser || !clientUser.status) {
                return next(new ErrorHandler("Client user account not found or deactivated.", 404));
            }

            // Assign role: if company owner, grant GymOwner role for backward compatibility
            clientUser.role = clientUser.isCompanyOwner ? 'GymOwner' : 'ClientStaff';
            req.user = clientUser;
            req.isClientCompanyUser = true;
            req.sessionId = decoded.session_id || null;

            // Load permissions
            const groupPerms = clientUser.groupId
                ? await ClientCompanyUserGroupPermission.findAll({ where: { groupId: clientUser.groupId, companyId: clientUser.companyId }, raw: true })
                : [];
            const userPerms = await ClientCompanyUserPermission.findAll({ where: { userId: clientUser.id, companyId: clientUser.companyId }, raw: true });

            req.authContext = {
                user_id: clientUser.id,
                email: clientUser.email,
                name: clientUser.name,
                company_id: clientUser.companyId,
                role: clientUser.role,
                is_company_owner: clientUser.isCompanyOwner,
                permissions: groupPerms.concat(userPerms)
            };

            return next();
        }

        if (decoded.isAdminUser || decoded.userType === 'AdminUser') {
            const admin = await AdminUser.findByPk(userId, {
                include: [
                    {
                        model: UserGroup,
                        as: 'group',
                        required: false
                    }
                ]
            });

            if (!admin || admin.isDeleted || !admin.isActive) {
                return next(new ErrorHandler("Admin account not found or has been deactivated.", 404));
            }

            req.user = admin;
            req.isAdminUser = true;
            req.sessionId = decoded.session_id || null;

            // Load rights map (group rights + user master rights) & branch rights
            const { resolveUserRights, resolveUserBranches } = await import('../controllers/adminAuthController.js');
            const rightsMap = await resolveUserRights(admin.id, admin.groupId);
            const accessibleBranches = await resolveUserBranches(admin.id);

            req.rights = rightsMap;
            req.branches = accessibleBranches;

            req.authContext = {
                user_id: admin.id,
                email: admin.email,
                name: admin.name,
                group_id: admin.groupId || null,
                group_name: admin.group?.group_name || null,
                rights: rightsMap,
                branches: accessibleBranches,
                permissions: ['*'] // for backward compatibility with generic guards
            };
            return next();
        }

        const user = await User.findByPk(userId);
        if (!user || user.isDeleted) {
            return next(new ErrorHandler("User account not found or has been deactivated.", 404));
        }

        req.user = user;
        req.sessionId = decoded.session_id || null;

        // 5. Resolve active Gym & Branch from headers or token
        const requestedGymId = req.headers['x-gym-id'] || req.query.gymId || req.body?.gymId || decoded.gym_id || null;
        const requestedBranchId = req.headers['x-branch-id'] || req.query.branchId || req.body?.branchId || decoded.branch_id || null;

        // 6. Resolve Full Authorization Context (cached in Redis)
        try {
            const authContext = await masterAuthzService.resolveAuthContext(
                user.id,
                requestedGymId,
                requestedBranchId
            );
            req.authContext = authContext;
            req.gym = authContext.gym;
            req.branch = authContext.branch;
        } catch (authzErr) {
            console.warn("⚠️ Warning: could not resolve master authz context:", authzErr.message);
        }

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return next(new ErrorHandler("Token has expired. Please log in again.", 401));
        }
        if (error.name === "JsonWebTokenError") {
            return next(new ErrorHandler("Invalid authentication signature. Please log in again.", 401));
        }
        return next(new ErrorHandler("Authentication failed.", 401));
    }
});

/**
 * Centralized RBAC Permission Guard Middleware
 * Evaluates requested permissions against Redis cached authContext
 */
export const requirePermissions = (...requiredPermissions) => {
    return catchAsyncErrors(async (req, res, next) => {
        if (!req.user) {
            return next(new ErrorHandler("User not authenticated", 401));
        }

        // Super Admin has unrestricted bypass
        if (req.user.isSuperAdmin || req.user.role === 'Admin') {
            return next();
        }

        if (!req.authContext || !Array.isArray(req.authContext.permissions)) {
            return next(new ErrorHandler("Authorization context missing. Access denied.", 403));
        }

        const userPerms = new Set(req.authContext.permissions);
        const hasAll = requiredPermissions.every(p => userPerms.has(p));

        if (!hasAll) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to perform this action",
                    required_permissions: requiredPermissions
                }
            });
        }

        next();
    });
};

/**
 * Tenant & Branch Scope Isolation Middleware
 */
export const tenantContext = catchAsyncErrors(async (req, res, next) => {
    if (!req.user) {
        return next(new ErrorHandler("User not authenticated", 401));
    }

    const requestedGymId = req.headers['x-gym-id'] || req.query.gymId || req.body?.gymId || req.params?.gymId;
    const requestedBranchId = req.headers['x-branch-id'] || req.query.branchId || req.body?.branchId || req.params?.branchId;

    if (requestedGymId && req.authContext?.available_gyms) {
        const hasGymAccess = req.user.isSuperAdmin || req.user.role === 'Admin' || 
            req.authContext.available_gyms.some(g => String(g.id) === String(requestedGymId));

        if (!hasGymAccess) {
            return next(new ErrorHandler("Access denied: You do not have access to this gym tenant.", 403));
        }
    }

    if (requestedBranchId && req.authContext?.available_branches) {
        const hasBranchAccess = req.user.isSuperAdmin || req.user.role === 'Admin' || req.authContext.role === 'GYM_OWNER' ||
            req.authContext.available_branches.some(b => String(b.id) === String(requestedBranchId));

        if (!hasBranchAccess) {
            return next(new ErrorHandler("Access denied: You do not have access to this branch.", 403));
        }
    }

    next();
});

// Role-free authorization middleware (all permissions and rights-based)
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // No role-based blocking: all authenticated users proceed to resource/permission checks
        next();
    };
};

export const isAdmin = (req, res, next) => {
    // Only AdminUser (or users with Admin role / isSuperAdmin) can access Admin portal & APIs
    if (req.isAdminUser || req.user?.isSuperAdmin || req.user?.role === 'Admin') {
        return next();
    }
    return next(new ErrorHandler("Access denied: Admin privileges required. Client company users cannot access the admin portal.", 403));
};

export const isClientUser = (req, res, next) => {
    if (req.isClientCompanyUser || req.user?.companyId) {
        return next();
    }
    return next(new ErrorHandler("Access denied: Client company user privileges required.", 403));
};

export const isGymOwner = (req, res, next) => next();
export const isMember = (req, res, next) => next();
export const isGymOwnerOrAdmin = (req, res, next) => next();
export const isVerifiedUser = (req, res, next) => next();

// Middleware to check if user owns the gym resource (IDOR protection)
export const isGymResourceOwner = catchAsyncErrors(async (req, res, next) => {
    const gymId = req.params.id || req.params.gymId || req.body.gymId;

    if (!gymId) {
        return next(new ErrorHandler("Gym ID not provided", 400));
    }

    if (req.user.isSuperAdmin || req.user.role === 'Admin') {
        return next();
    }

    if (req.isClientCompanyUser || req.user?.companyId) {
        const userCompanyId = String(req.user.companyId || req.authContext?.company_id);
        if (String(gymId) === userCompanyId) {
            return next();
        }
    }

    const gym = await Gym.findByPk(gymId);
    if (!gym) {
        return next(new ErrorHandler("Gym not found", 404));
    }

    if (gym.ownerId !== req.user.id && String(gym.clientId) !== String(req.user.companyId)) {
        return next(new ErrorHandler("You are not authorized for this gym", 403));
    }

    next();
});

// Middleware to check if user has active plan for gym-specific actions
export const hasActivePlan = catchAsyncErrors(async (req, res, next) => {
    const gymId = req.params.gymId || req.body.gymId;

    if (!gymId) {
        return next(new ErrorHandler("Gym ID not provided", 400));
    }

    const activePlan = await UserPlan.findOne({
        where: { userId: req.user.id, gymId, isExpired: false }
    });

    if (!activePlan) {
        return next(new ErrorHandler("You need an active plan to perform this action", 403));
    }

    req.activePlan = activePlan;
    next();
});

// Middleware to check if Gym Owner has an active subscription
export const isSubscriptionActive = catchAsyncErrors(async (req, res, next) => {
    if (req.user.role === 'Admin' || req.user.isSuperAdmin) {
        return next();
    }

    // 1. If Client Company User (Company is our Gym)
    if (req.isClientCompanyUser || req.user?.companyId) {
        const { ClientCompanyMaster } = await import('../models/index.js');
        const companyId = req.user.companyId || req.authContext?.company_id;
        const company = await ClientCompanyMaster.findByPk(companyId);

        if (!company) {
            return next(new ErrorHandler("Company not found for this account", 404));
        }

        if (company.status === 0 || company.status === false) {
            return res.status(403).json({
                success: false,
                message: "Your company account is inactive. Please contact administrator.",
                gymId: company.id,
                name: company.name
            });
        }

        req.gym = {
            id: company.id,
            name: company.name,
            ownerId: req.user.id,
            companyId: company.id,
            subscriptionStatus: 'active',
            latitude: company.latitude || null,
            longitude: company.longitude || null,
            address: company.address || null
        };
        return next();
    }

    // 2. Fallback to Legacy Gym table
    const gym = await Gym.findOne({ 
        where: { ownerId: req.user.id }, 
        include: [{ model: AdminPlan, as: 'assignedPlan' }] 
    });

    if (!gym) {
        return next(new ErrorHandler("Gym not found for this account", 404));
    }

    const today = new Date();
    if (gym.subscriptionStatus !== 'active' || (gym.subscriptionExpiry && gym.subscriptionExpiry < today)) {
        if (gym.subscriptionStatus === 'active' && gym.subscriptionExpiry && gym.subscriptionExpiry < today) {
            gym.subscriptionStatus = 'expired';
            await gym.save();
        }

        return res.status(403).json({
            success: false,
            message: "Your subscription is not active. Please renew your plan.",
            gymId: gym.id,
            name: gym.name,
            subscriptionStatus: gym.subscriptionStatus,
            subscriptionExpiry: gym.subscriptionExpiry,
            requiresPayment: true
        });
    }

    req.gym = gym;
    next();
});
