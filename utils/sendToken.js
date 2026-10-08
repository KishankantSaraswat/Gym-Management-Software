import sessionService from "../services/sessionService.js";
import auditService from "../services/auditService.js";

export const sendToken = async (user, statusCode, message, res, optionsOverride = {}) => {
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '7', 10);

    // Create session & compact JWT token
    const { token, sessionId } = await sessionService.createSession({
        user,
        gymId: optionsOverride.gymId || null,
        branchId: optionsOverride.branchId || null,
        deviceId: optionsOverride.deviceId || null,
        ipAddress: optionsOverride.ipAddress || null,
        userAgent: optionsOverride.userAgent || null,
        expiresInDays: cookieExpireDays
    });

    const cookieOptions = {
        expires: new Date(
            Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    };

    const userData = user.toJSON ? user.toJSON() : { ...user };
    delete userData.password;
    delete userData.tempPassword;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpire;
    delete userData.verificationCode;
    delete userData.verificationCodeExpire;

    // Log successful authentication event asynchronously
    auditService.log({
        actorUserId: user.id,
        action: 'LOGIN_SUCCESS',
        resourceType: 'AUTH_SESSION',
        resourceId: sessionId,
        oldValue: null,
        newValue: { session_id: sessionId, user_id: user.id }
    });

    res.status(statusCode)
        .cookie("gymshood_token", token, cookieOptions)
        .json({
            success: true,
            user: userData,
            message,
            token,
            session_id: sessionId
        });
};