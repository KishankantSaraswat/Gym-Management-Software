import express from "express";
import { getAuthorizedMenus } from "../controllers/menuController.js";
import { isAuthenticated, tenantContext } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/v1/menus
router.get("/", isAuthenticated, tenantContext, getAuthorizedMenus);

export default router;
