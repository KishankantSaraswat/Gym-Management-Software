import express from "express";
import {
  createUserData,
  updateUserData,
  deleteUserData,
  getUserData,
} from "../controllers/userDataController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/:userId", isAuthenticated, createUserData);
router.get("/:userId", isAuthenticated, getUserData);
router.put("/:userId", isAuthenticated, updateUserData);
router.delete("/:userId", isAuthenticated, deleteUserData);

export default router;
