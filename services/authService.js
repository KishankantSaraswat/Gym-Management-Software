import * as userRepository from "../repositories/userRepository.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { generateForgotPasswordOtpEmailTemplate } from "../utils/emailTemplate.js";
import { OAuth2Client } from "google-auth-library";
import ErrorHandler from "../middlewares/errorMiddlewares.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getSuperAdminEmail = () => process.env.ADMIN_EMAIL?.trim().toLowerCase();

export const registerUser = async (data) => {
  const { name, email, password, role, phone, height, weight, gender, foodType, address, pincode } = data;

  if (email?.trim().toLowerCase() === getSuperAdminEmail()) {
    throw new ErrorHandler("This email is reserved for the super-admin account.", 403);
  }

  if (role === "Admin") {
    throw new ErrorHandler("Admin accounts must be created using the admin setup script.", 403);
  }

  if (/[^a-zA-Z0-9!@#$%^&*]/.test(password)) {
    throw new ErrorHandler("Invalid characters in password.", 400);
  }
  let existing = await userRepository.findUserByEmail(email);

  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing && existing.accountVerified && existing.isPwdAuth) {
    if (existing.role === 'GymOwner') {
      const { Gym } = await import("../models/index.js");
      const gym = await Gym.findOne({ where: { ownerId: existing.id, isDeleted: false } });
      if (!gym) {
        await existing.destroy();
        existing = null;
      } else {
        throw new ErrorHandler("User already exists and has an active gym.", 400);
      }
    } else {
      throw new ErrorHandler("User already exists.", 400);
    }
  }

  const registrationSessionId = crypto.randomUUID();
  const verificationCode = Math.floor(100000 + Math.random() * 900000);
  const verificationCodeExpire = new Date(Date.now() + 15 * 60 * 1000);

  let user;
  if (existing) {
    existing.name = name;
    existing.password = hashedPassword;
    existing.role = role;
    existing.phone = phone || existing.phone;
    if (address || pincode) {
      if (address) existing.address = address;
      if (pincode) existing.pincode = pincode;
    }
    existing.accountVerified = false;
    existing.isPwdAuth = true;
    existing.verificationCode = verificationCode;
    existing.verificationCodeExpire = verificationCodeExpire;
    existing.registrationSessionId = registrationSessionId;
    await existing.save();
    console.log(`👤 DB - Updated existing user: ${existing.email} (ID: ${existing.id}, Role: ${existing.role})`);
    user = existing;
  } else {
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      phone: phone || undefined,
      registrationSessionId,
      accountVerified: false,
      isPwdAuth: true,
      verificationCode,
      verificationCodeExpire,
    };

    if (address) userData.address = address;
    if (pincode) userData.pincode = pincode;

    user = await userRepository.createUser(userData);
    console.log(`👤 DB - Created NEW user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
  }

  if (height || weight || gender || foodType) {
    try {
      const userDataObj = await userRepository.findUserDataByUserId(user.id);
      if (userDataObj) {
        if (height) userDataObj.height = height;
        if (weight) userDataObj.weight = weight;
        if (gender) userDataObj.gender = gender;
        if (foodType) userDataObj.foodType = foodType;
        await userDataObj.save();
      } else {
        await userRepository.createUserData({
          userId: user.id,
          height: height || undefined,
          weight: weight || undefined,
          gender: gender || undefined,
          foodType: foodType || undefined,
        });
      }
    } catch (error) {
      console.error("Failed to create/update UserData during registration:", error);
    }
  }

  return { user, verificationCode, registrationSessionId };
};

export const verifyOTP = async (email, otp, registrationSessionId) => {
  const user = await userRepository.findUserByRegistrationSession(email, registrationSessionId);

  if (!user) {
    throw new ErrorHandler("Invalid session or user not found.", 400);
  }

  if (user.accountVerified) {
    return { success: true, message: "User already verified.", alreadyVerified: true };
  }

  if (user.verificationCode !== Number(otp)) {
    throw new ErrorHandler("Invalid OTP.", 400);
  }

  if (new Date(user.verificationCodeExpire).getTime() < Date.now()) {
    throw new ErrorHandler("OTP expired. Please register again.", 400);
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpire = null;
  user.registrationSessionId = null;
  await user.save();
  console.log(`✅ DB - User verified and activated: ${user.email} (Role: ${user.role})`);

  return { user };
};

export const loginUser = async (email, password, role) => {
  const normalizedEmail = email.trim().toLowerCase();
  const isSuperAdmin = normalizedEmail === getSuperAdminEmail();
  const user = isSuperAdmin
    ? await userRepository.findUserByEmail(normalizedEmail)
    : await userRepository.findUserByEmailAndRole(normalizedEmail, role);

  if (!user || !user.accountVerified) {
    console.log("❌ Login Failed: User not found or not verified/role mismatch");
    const debugUser = user || await userRepository.findUserByEmail(normalizedEmail);
    if (debugUser) {
      console.log("🔍 Debug: User exists but...", {
        verified: debugUser.accountVerified,
        role: debugUser.role,
        reqRole: role
      });
    } else {
      console.log("🔍 Debug: User does not exist at all");
    }
    throw new ErrorHandler("User not found. Please register first.", 400);
  }

  if (!user.isPwdAuth) {
    console.log("❌ Login Failed: Not password authenticated");
    throw new ErrorHandler("Use Google Sign-In to log in, or register with your email and password.", 400);
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);
  console.log("🔐 Password Match Result:", isPasswordMatched);

  if (!isPasswordMatched) {
    console.log("❌ Login Failed: Invalid password");
    throw new ErrorHandler("Invalid email or password", 400);
  }

  if (isSuperAdmin && (user.role !== "Admin" || !user.isSuperAdmin)) {
    user.role = "Admin";
    user.isSuperAdmin = true;
    await user.save();
  }

  return user;
};

export const googleLogin = async (token, role) => {
  if (role === "Admin") {
    throw new ErrorHandler("Admin accounts cannot be created using Google login.", 403);
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    throw error;
  }
  const googleUser = ticket.getPayload();
  const { name, email, picture, sub: googleId } = googleUser;

  if (email?.trim().toLowerCase() === getSuperAdminEmail()) {
    throw new ErrorHandler("The super-admin account must use password login.", 403);
  }
  
  let user = await userRepository.findUserByEmail(email);
  if (!user) {
    user = await userRepository.createUser({
      name,
      email,
      googleId,
      isPwdAuth: false,
      password: null,
      profile_picture: { url: picture, public_id: null },
      role,
      accountVerified: true,
    });
  } else {
    if (user.role !== role) throw new ErrorHandler("incorrect role.", 400);
    if (!user.googleId) {
      user.googleId = googleId;
      user.profile_picture = { url: picture, public_id: null };
      await user.save();
    }
  }
  return user;
};

export const updateUserProfile = async (userId, data) => {
  const { name, phone, address, pincode } = data;

  const updateData = {};
  if (name !== undefined) {
    if (!name || name.trim().length === 0) {
      throw new ErrorHandler("Name cannot be empty.", 400);
    }
    updateData.name = name.trim();
  }
  if (phone !== undefined) {
    updateData.phone = phone ? phone.trim() : null;
  }

  if (address !== undefined || pincode !== undefined) {
    const currentUser = await userRepository.findUserById(userId);
    if (address !== undefined) {
      updateData.address = address ? address.trim() : currentUser?.address;
    }
    if (pincode !== undefined) {
      updateData.pincode = pincode ? pincode.trim() : currentUser?.pincode;
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ErrorHandler("No valid fields to update.", 400);
  }

  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new ErrorHandler("User not found.", 404);
  }
  await user.update(updateData);
  return user;
};

export const forgotPassword = async (email) => {
  const user = await userRepository.findUserByEmailVerified(email);
  if (!user) throw new ErrorHandler("Invalid email.", 400);

  if (!user.isPwdAuth) {
    throw new ErrorHandler("Use Google Sign-In to log in, or register with your email and password.", 400);
  }

  if (!user.forgotPasswordAttemptsExpire || new Date(user.forgotPasswordAttemptsExpire).getTime() < Date.now()) {
    user.forgotPasswordAttempts = 0;
    user.forgotPasswordAttemptsExpire = new Date(Date.now() + 60 * 60 * 1000);
  }

  if (user.forgotPasswordAttempts >= 3) {
    throw new ErrorHandler("Too many reset requests. Try again after 1 hour.", 429);
  }

  user.forgotPasswordAttempts += 1;

  const resetOTP = Math.floor(100000 + Math.random() * 900000);
  user.resetPasswordOTP = resetOTP;
  user.resetPasswordOTPExpire = new Date(Date.now() + 15 * 60 * 1000);

  await user.save({ validate: false });
  if (process.env.NODE_ENV === "development") {
    console.info(`Password reset OTP for ${user.email}: ${resetOTP}`);
  }

  const message = generateForgotPasswordOtpEmailTemplate(resetOTP);

  try {
    await sendEmail({
      to: user.email,
      subject: "🔐 Reset Your gymsHood Password - OTP Verification",
      message,
    });
  } catch (error) {
    user.resetPasswordOTP = null;
    user.resetPasswordOTPExpire = null;
    await user.save({ validate: false });
    throw new ErrorHandler("Failed to send OTP email.", 500);
  }
  return user;
};

export const verifyResetOTP = async (email, otp) => {
  const user = await userRepository.findUserByEmailVerified(email);

  if (!user) {
    throw new ErrorHandler("Invalid email.", 400);
  }

  if (!user.resetPasswordOTP) {
    throw new ErrorHandler("No OTP request found. Please request a new OTP.", 400);
  }

  if (user.resetPasswordOTP !== Number(otp)) {
    throw new ErrorHandler("Invalid OTP.", 400);
  }

  if (new Date(user.resetPasswordOTPExpire).getTime() < Date.now()) {
    throw new ErrorHandler("OTP expired. Please request a new one.", 400);
  }

  const resetSessionId = crypto.randomUUID();
  user.resetPasswordSessionId = resetSessionId;
  user.resetPasswordSessionExpire = new Date(Date.now() + 15 * 60 * 1000);
  user.resetPasswordOTP = null;
  user.resetPasswordOTPExpire = null;

  await user.save({ validate: false });
  return resetSessionId;
};

export const resetPassword = async (resetSessionId, password, confirmPassword) => {
  const user = await userRepository.findUserByResetSession(resetSessionId);

  if (!user) {
    throw new ErrorHandler("Invalid or expired reset session.", 400);
  }

  const newPassword = String(password).trim();
  const confirmPass = String(confirmPassword).trim();

  if (newPassword !== confirmPass) {
    throw new ErrorHandler("Password & confirm password don't match.", 400);
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    throw new ErrorHandler("New password must be different from the old password.", 400);
  }

  if (newPassword.length < 8 || newPassword.length > 16) {
    throw new ErrorHandler("Password must be between 8 & 16 characters.", 400);
  }

  if (/^0+$/.test(newPassword)) {
    throw new ErrorHandler("Password cannot be all zeros.", 400);
  }

  const invalidChars = newPassword.match(/[^a-zA-Z0-9!@#$%^&*]/);
  if (invalidChars) {
    throw new ErrorHandler(`Invalid character(s) in password: ${invalidChars.join(", ")}`, 400);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordSessionId = null;
  user.resetPasswordSessionExpire = null;
  user.resetPasswordToken = null;
  user.resetPasswordExpire = null;

  await user.save();
  return user;
};

export const updateFcmToken = async (userId, fcmToken) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new ErrorHandler("User not found.", 404);
  }
  await user.update({ fcmToken });
  return user;
};
