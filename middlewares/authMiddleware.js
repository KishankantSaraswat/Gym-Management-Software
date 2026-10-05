import { User, Gym, UserPlan, AdminPlan } from "../models/index.js";
import { catchAsyncErrors } from "./catchAsyncErrors.js";
import ErrorHandler from "./errorMiddlewares.js"
import jwt from "jsonwebtoken";

export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
    let token;

    // 1. Check Authorization header first (explicit token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1]?.trim();
        console.log("🔍 Auth Middleware - Found token in Header");
    }
    // 2. Fallback to Cookies
    else if (req.cookies.gymshood_token) {
        token = req.cookies.gymshood_token.trim();
        console.log("🔍 Auth Middleware - Found token in Cookie");
    }

    if (!token) {
        console.log("❌ Auth Middleware - No token found in Header or Cookie");
        return next(new ErrorHandler("User is not authenticated.", 401));
    }

    // Strip quotes if any (e.g. JWT_SECRET_KEY="secret")
    const secretKey = process.env.JWT_SECRET_KEY?.trim().replace(/^["']|["']$/g, '');

    if (!secretKey) {
        console.error("🚨 CRITICAL: JWT_SECRET_KEY is MISSING in backend config!");
    }

    try {
        // Decode without verification just for debugging
        const payload = jwt.decode(token);

        if (!payload || !payload.id) {
            console.error("🚨 SECURITY ALERT: Token payload is missing 'id'. Likely an external token.");
            return next(new ErrorHandler("Detected a token from another application. Please click 'Reset Session' and log in again.", 401));
        }

        console.log("🔑 Auth Middleware - Verifying token...");
        const decoded = jwt.verify(token, secretKey);
        console.log("✅ Auth Middleware - Token verified, user ID:", decoded.id);
        req.user = await User.findByPk(decoded.id);
        if (!req.user) {
            console.log("❌ Auth Middleware - User not found in DB");
            return next(new ErrorHandler("User not found.", 404));
        }
        next();
    } catch (error) {
        console.error("❌ Auth Middleware - JWT Error:", error.message);

        if (error.message === "invalid signature") {
            return next(new ErrorHandler("Signature mismatch! Your token might be from another application or server instance. Please click 'Reset Session' and log in again.", 401));
        }

        return next(new ErrorHandler("Invalid or expired token.", 401));
    }
});

// Role-based authorization middleware (both isAuthorized & requireRole is truely identical)

// Generic role-based authorization middleware
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new ErrorHandler(
                    `Role ${req.user.role} is not authorized to access this resource.`,
                    403
                )
            );
        }
        next();
    };
};

// Specific role middlewares (for better readability in routes)

export const isAdmin = requireRole('Admin');
export const isGymOwner = requireRole('GymOwner');
export const isMember = requireRole('User');

// Composite middlewares for common scenarios
export const isGymOwnerOrAdmin = requireRole('GymOwner', 'Admin');
export const isVerifiedUser = requireRole('User', 'GymOwner', 'Admin');


// Optional: Middleware to check if user owns the gym resource
export const isGymResourceOwner = catchAsyncErrors(async (req, res, next) => {
    const gymId = req.params.id || req.body.gymId;

    if (!gymId) {
        return next(new ErrorHandler("Gym ID not provided", 400));
    }

    // Assuming you have a Gym model with owner reference
    const gym = await Gym.findByPk(gymId);
    if (!gym) {
        return next(new ErrorHandler("Gym not found", 404));
    }

    if (gym.ownerId !== req.user.id) {
        return next(new ErrorHandler("You are not the owner of this gym", 403));
    }

    next();
});

// Optional: Middleware to check if user has active plan for gym-specific actions
export const hasActivePlan = catchAsyncErrors(async (req, res, next) => {
    const gymId = req.params.gymId || req.body.gymId;
    const userId = req.user.id;

    if (!gymId) {
        return next(new ErrorHandler("Gym ID not provided", 400));
    }

    const activePlan = await UserPlan.findOne({
        where: { userId: req.user.id, gymId, isExpired: false }
    });

    if (!activePlan) {
        return next(new ErrorHandler("You need an active plan to perform this action", 403));
    }

    req.activePlan = activePlan; // Attach plan to request for later use
    next();
});

// Middleware to check if Gym Owner has an active subscription
export const isSubscriptionActive = catchAsyncErrors(async (req, res, next) => {
    // Skip check for Admins
    if (req.user.role === 'Admin') {
        return next();
    }

    if (req.user.role !== 'GymOwner') {
        return next(new ErrorHandler("This resource is only for Gym Owners", 403));
    }

    const gym = await Gym.findOne({ where: { ownerId: req.user.id }, include: [{ model: AdminPlan, as: 'assignedPlan' }] });

    if (!gym) {
        return next(new ErrorHandler("Gym not found for this owner", 404));
    }

    // Check if subscription is active and not expired
    const today = new Date();
    if (gym.subscriptionStatus !== 'active' || (gym.subscriptionExpiry && gym.subscriptionExpiry < today)) {
        // Automatically update status if expired
        if (gym.subscriptionStatus === 'active' && gym.subscriptionExpiry && gym.subscriptionExpiry < today) {
            gym.subscriptionStatus = 'expired';
            await gym.save();
        }

        return res.status(403).json({
            success: false,
            message: "Your subscription is not active. Please pay to continue using the portal.",
            gymId: gym.id,
            name: gym.name,
            contactEmail: gym.contactEmail,
            phone: gym.phone,
            subscriptionStatus: gym.subscriptionStatus,
            subscriptionExpiry: gym.subscriptionExpiry,
            assignedPlan: gym.assignedPlan,
            requiresPayment: true
        });
    }

    req.gym = gym; // Attach gym to request
    next();
});

// SaaS Tenant & Branch Context Middleware
export const tenantContext = catchAsyncErrors(async (req, res, next) => {
    if (!req.user) {
        return next(new ErrorHandler("User not authenticated", 401));
    }

    // 1. Identify Client (Tenant)
    let client = null;
    if (req.user.role === 'GymOwner') {
        const { Client } = await import('../models/index.js');
        client = await Client.findOne({ where: { ownerId: req.user.id } });
    }
    
    if (client) {
        req.client = client;
    }

    // 2. Identify Branch Scope
    // The frontend should pass the active branch ID in headers or body/query
    const requestedBranchId = req.headers['x-branch-id'] || req.body.branchId || req.query.branchId;
    
    if (requestedBranchId) {
        // Validate that this user has access to this branch
        if (req.user.role === 'GymOwner' && client) {
            const branch = await Gym.findOne({ where: { id: requestedBranchId, clientId: client.id } });
            if (!branch) {
                return next(new ErrorHandler("Branch not found or does not belong to your tenant.", 403));
            }
            req.branch = branch;
        } else if (req.user.role === 'Admin') {
            const branch = await Gym.findByPk(requestedBranchId);
            if (branch) req.branch = branch;
        } else {
            // Check UserGymMapping for staff
            const { UserGymMapping } = await import('../models/index.js');
            const mapping = await UserGymMapping.findOne({ where: { userId: req.user.id, gymId: requestedBranchId, status: 'active' } });
            if (!mapping) {
                return next(new ErrorHandler("You do not have access to this branch.", 403));
            }
            req.branch = await Gym.findByPk(requestedBranchId);
            // Derive client from branch
            if (!req.client && req.branch.clientId) {
                const { Client } = await import('../models/index.js');
                req.client = await Client.findByPk(req.branch.clientId);
            }
        }
    }

    next();
});
