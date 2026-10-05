import express from 'express';
import { isAuthenticated, isAdmin } from "../middlewares/authMiddleware.js";
import {
  toggleGymVerification,
  toggleGymDeletion,
  getUnverifiedGyms,
  getAllGymsForAdmin,
  createAnnouncement,
  getGymDetailsAdmin,
  getUsersByQuery,
  getGymsByQuery,
  getUserAnnouncements,
  deleteAnnouncement,
  updatePlanFactor,
  getPlansByQuery,
  getAdminDashboardStats,
  updateGymCommission,
  deleteGymPermanently
} from '../controllers/2_adminController.js';

const router = express.Router();

router.put('/gym/:gymId/toggle-verify', isAuthenticated, isAdmin, toggleGymVerification);
router.put('/gym/:gymId/toggle-delete', isAuthenticated, isAdmin, toggleGymDeletion);
router.get('/gyms/unverified', isAuthenticated, isAdmin, getUnverifiedGyms);
router.get('/gyms/admin-all', isAuthenticated, isAdmin, getAllGymsForAdmin);
router.get('/gym/:gymId/details', isAuthenticated, isAdmin, getGymDetailsAdmin);
router.get('/stats', isAuthenticated, isAdmin, getAdminDashboardStats);

// User Management (users->get Users,GymOwner,Admin)
router.get("/users", isAuthenticated, isAdmin, getUsersByQuery);
// Gym Management
router.get("/gyms", isAuthenticated, isAdmin, getGymsByQuery); //add rating query also, (or, by frontend : easily)
// Announcement Management
router.post("/announcements",
  isAuthenticated,
  isAdmin,
  // validateAnnouncement,
  createAnnouncement
);
router.get("/announcements/user", isAuthenticated, isAdmin, getUserAnnouncements);
router.delete("/announcements/:announcementId", isAuthenticated, isAdmin, deleteAnnouncement);
router.get("/plans/search", isAuthenticated, isAdmin, getPlansByQuery);
router.put("/plans/factor",
  isAuthenticated,
  isAdmin,
  updatePlanFactor
);
router.put("/gym/:gymId/commission", isAuthenticated, isAdmin, updateGymCommission);
router.delete("/gym/:gymId", isAuthenticated, isAdmin, deleteGymPermanently);

export default router;