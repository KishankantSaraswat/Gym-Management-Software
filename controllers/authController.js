import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import * as authService from "../services/authService.js";
import { sendToken } from "../utils/sendToken.js";
import { sendVerificationCode } from "../utils/sendVerificationCode.js";
import sessionService from "../services/sessionService.js";
import masterAuthzService from "../services/masterAuthzService.js";
import auditService from "../services/auditService.js";

export const register = catchAsyncErrors(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return next(new ErrorHandler("Please enter all fields.", 400));
  }

  const { user, verificationCode, registrationSessionId } = await authService.registerUser(req.body);

  try {
    await sendVerificationCode(verificationCode, email, res, registrationSessionId);
  } catch (error) {
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save();
    return next(new ErrorHandler("Failed to send verification email.", 500));
  }
});

export const verifyOTP = catchAsyncErrors(async (req, res, next) => {
  const { otp } = req.body;
  const email = req.cookies.email || req.body.email;
  const registrationSessionId = req.cookies.reg_session || req.body.registrationSessionId;

  if (!email || !otp || !registrationSessionId) {
    return next(new ErrorHandler("Required fields are missing.", 400));
  }

  const result = await authService.verifyOTP(email, otp, registrationSessionId);

  if (result.alreadyVerified) {
    return res.status(200).json({ success: true, message: result.message });
  }

  await sendToken(result.user, 200, "Account verified successfully.", res, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role, gymId, branchId, consent } = req.body;
  
  if (!email || !password || !role) {
    return next(new ErrorHandler("Please enter all fields.", 400));
  }

  const user = await authService.loginUser(email, password, role);

  // Active Session Detection
  const hasActive = await sessionService.hasActiveSession(user.id, 'User');
  const userConsent = consent === true || consent === 'true';

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

  // If active session exists and consent is granted, invalidate previous sessions
  if (hasActive) {
    await sessionService.revokeAllUserSessions(user.id, 'User');
  }

  await sendToken(user, 200, "User login successfully.", res, {
    gymId,
    branchId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
});

export const googleLogin = catchAsyncErrors(async (req, res, next) => {
  const { token, role, gymId, branchId, consent } = req.body;
  if (!token || !role) return next(new ErrorHandler("either token or role is missing.", 400));
  
  const user = await authService.googleLogin(token, role);

  // Active Session Detection
  const hasActive = await sessionService.hasActiveSession(user.id, 'User');
  const userConsent = consent === true || consent === 'true';

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
    await sessionService.revokeAllUserSessions(user.id, 'User');
  }

  await sendToken(user, 200, "Google Login successful", res, {
    gymId,
    branchId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  if (req.sessionId) {
    await sessionService.revokeSession(req.sessionId);
  }
  
  if (req.user) {
    auditService.log({
      actorUserId: req.user.id,
      action: 'LOGOUT',
      resourceType: 'AUTH_SESSION',
      resourceId: req.sessionId
    });
  }

  res.status(200)
    .cookie("gymshood_token", "", { expires: new Date(0), httpOnly: true })
    .json({ success: true, message: "Logged out successfully." });
});

/**
 * Authorization Context API (GET /api/v1/auth/me and GET /auth/me)
 * Returns authenticated user, active tenant gym, active branch, active subscription,
 * effective role, permissions, dynamic menus, and switcher options.
 */
export const getMe = catchAsyncErrors(async (req, res, next) => {
  const requestedGymId = req.headers['x-gym-id'] || req.query.gymId;
  const requestedBranchId = req.headers['x-branch-id'] || req.query.branchId;

  // Resolve authorization context (using Redis cache)
  const authContext = await masterAuthzService.resolveAuthContext(
    req.user.id,
    requestedGymId,
    requestedBranchId
  );

  res.status(200).json({
    success: true,
    ...authContext
  });
});

/**
 * Switch Active Gym or Branch (POST /api/v1/auth/switch-gym)
 */
export const switchGym = catchAsyncErrors(async (req, res, next) => {
  const { gymId, branchId } = req.body;
  if (!gymId) {
    return next(new ErrorHandler("Target gym ID is required.", 400));
  }

  // Refresh auth context for target gym/branch
  const newAuthContext = await masterAuthzService.resolveAuthContext(
    req.user.id,
    gymId,
    branchId,
    true
  );

  // Issue updated compact JWT token
  const { token, sessionId } = await sessionService.createSession({
    user: req.user,
    gymId,
    branchId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(200).json({
    success: true,
    message: `Switched to ${newAuthContext.gym?.name || 'gym'} successfully`,
    token,
    session_id: sessionId,
    authContext: newAuthContext
  });
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({ success: true, user });
});

export const updateUserProfile = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user.id;
  const user = await authService.updateUserProfile(userId, req.body);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});

export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  if (!req.body.email) return next(new ErrorHandler("Email is required.", 400));

  const user = await authService.forgotPassword(req.body.email);

  res.status(200).json({
    success: true,
    message: `OTP sent to ${user.email} successfully.`,
  });
});

export const verifyResetOTP = catchAsyncErrors(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorHandler("Email and OTP are required.", 400));
  }

  const resetSessionId = await authService.verifyResetOTP(email, otp);

  res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
    resetSessionId,
  });
});

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { resetSessionId, password, confirmPassword } = req.body;

  if (!resetSessionId) {
    return next(new ErrorHandler("Reset session ID is required.", 400));
  }

  const user = await authService.resetPassword(resetSessionId, password, confirmPassword);
  
  await sendToken(user, 200, "Password reset successfully. Please log in again.", res);
});

export const updateFcmToken = catchAsyncErrors(async (req, res, next) => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    return next(new ErrorHandler("FCM token is required.", 400));
  }

  await authService.updateFcmToken(req.user.id, fcmToken);

  res.status(200).json({
    success: true,
    message: "FCM token updated successfully",
  });
});
