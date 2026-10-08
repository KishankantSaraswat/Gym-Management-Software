import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import masterAuthzService from "../services/masterAuthzService.js";

export const getAuthorizedMenus = catchAsyncErrors(async (req, res, next) => {
    const gymId = req.headers['x-gym-id'] || req.query.gymId || req.gym?.id;
    const branchId = req.headers['x-branch-id'] || req.query.branchId || req.branch?.id;
    const userId = req.user?.id;

    if (!userId) {
        return next(new ErrorHandler("User authentication required.", 401));
    }

    const authContext = await masterAuthzService.resolveAuthContext(userId, gymId, branchId);

    res.status(200).json({
        success: true,
        menus: authContext?.menus || []
    });
});
