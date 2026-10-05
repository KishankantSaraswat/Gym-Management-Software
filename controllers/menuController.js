import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import menuService from "../services/menuService.js";

export const getAuthorizedMenus = catchAsyncErrors(async (req, res, next) => {
    // Requires tenantContext middleware to have run
    const client = req.client;
    const branch = req.branch;
    const user = req.user;

    if (!client) {
        return next(new ErrorHandler("Client (Tenant) context is missing. Cannot load menus.", 400));
    }

    // Determine application type from query or headers
    const appType = req.query.appType || req.headers['x-app-type'] || 'web';
    const isAppMenu = appType === 'app';

    const menuTree = await menuService.getAuthorizedMenuTree(
        client.id,
        user.id,
        branch ? branch.id : null,
        user.role,
        isAppMenu
    );

    res.status(200).json({
        success: true,
        menus: menuTree
    });
});
