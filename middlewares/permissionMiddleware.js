import { catchAsyncErrors } from "./catchAsyncErrors.js";
import ErrorHandler from "./errorMiddlewares.js";
import { UserGymMapping, GroupPermission, UserPermission, PermissionMaster } from "../models/index.js";

// Require specific permissions for an endpoint
export const requirePermissions = (...requiredPermissions) => {
    return catchAsyncErrors(async (req, res, next) => {
        // If GymOwner or Admin, they implicitly might have all permissions
        if (req.user.role === 'GymOwner' || req.user.role === 'Admin') {
            return next();
        }

        const userId = req.user.id;
        const branchId = req.branch ? req.branch.id : null;

        // Find user's role mapping for this branch
        let roleId = null;
        if (branchId) {
            const userMapping = await UserGymMapping.findOne({ where: { userId, gymId: branchId, status: 'active' } });
            if (userMapping && userMapping.roleId) {
                roleId = userMapping.roleId;
            }
        }

        // Fetch required permission IDs
        const permissions = await PermissionMaster.findAll({
            where: { name: requiredPermissions }
        });
        const requiredPermIds = permissions.map(p => p.id);

        if (requiredPermIds.length !== requiredPermissions.length) {
            console.warn(`Some required permissions were not found in DB: ${requiredPermissions}`);
            return next(new ErrorHandler("Configuration error: permissions not found.", 500));
        }

        const resolvedPermIds = new Set();

        // Add group permissions
        if (roleId) {
            const groupPerms = await GroupPermission.findAll({
                where: { groupId: roleId }
            });
            groupPerms.forEach(gp => {
                if (!gp.branchId || gp.branchId === branchId) {
                    resolvedPermIds.add(gp.permissionId);
                }
            });
        }

        // Apply user overrides
        const userPermOverrides = await UserPermission.findAll({
            where: { userId }
        });
        userPermOverrides.forEach(up => {
            if (!up.branchId || up.branchId === branchId) {
                if (up.isAllowed) {
                    resolvedPermIds.add(up.permissionId);
                } else {
                    resolvedPermIds.delete(up.permissionId);
                }
            }
        });

        // Check if all required permissions are present
        const hasAll = requiredPermIds.every(id => resolvedPermIds.has(id));

        if (!hasAll) {
            return next(new ErrorHandler("You do not have permission to perform this action.", 403));
        }

        next();
    });
};
