import express from "express";
import {
  forgotPassword,
  getUser,
  getMe,
  switchGym,
  login,
  logout,
  register,
  resetPassword,
  verifyOTP,
  verifyResetOTP,
  googleLogin,
  updateUserProfile,
  updateFcmToken,
} from "../controllers/authController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { body, validationResult } from "express-validator";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
const router = express.Router();

const validateRegistration = [

  (req, res, next) => {
    const requiredFields = ["name", "email", "password"];
    const missingFields = requiredFields.filter(
      (field) => req.body[field] === undefined
    );

    if (missingFields.length > 0) {
      return next(
        new ErrorHandler(
          `Please enter all fields: ${missingFields.join(", ")}`,
          400
        )
      );
    }

    next(); // ✅ Move to the next validation middleware
  },

  body("name")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Name must be between 3 and 20 characters long."),

  body("email").isEmail().withMessage("Invalid email format."),

  body("password")
    .isLength({ min: 6, max: 15 })
    .withMessage("Password must be between 6 and 15 characters long."),

  // Final middleware to check validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors
        .array()
        .map((err) => err.msg)
        .join(", ");
      return next(new ErrorHandler(`Validation error: ${errorMessages}`, 400));
    }
    next(); // Continue if no errors
  },
];


router.post("/register", validateRegistration, register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/profile", isAuthenticated, getUser);
router.get("/me", isAuthenticated, getMe);
router.post("/switch-gym", isAuthenticated, switchGym);
router.put("/profile", isAuthenticated, updateUserProfile);
router.post("/password/forgot", forgotPassword);
router.post("/password/verify-reset-otp", verifyResetOTP);
router.put("/password/reset", resetPassword);

router.post("/google-login", googleLogin);
router.put('/update-fcm-token', isAuthenticated, updateFcmToken);

export default router;
