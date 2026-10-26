import express from 'express';
import { isAuthenticated, isAdmin } from "../middlewares/authMiddleware.js";
import {
  adminLogin,
  getAdminProfile,
  createAdminUser,
  adminLogout
} from '../controllers/adminAuthController.js';
import {
  getAllUserGroups,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  getGroupRights,
  saveGroupRights,
  getUserRightsMatrix,
  saveUserRightsOverride,
  removeUserRightOverride,
  getCompanyRightsMatrix,
  saveCompanyRights,
  removeCompanyRight,
  getMyAuthorizedMenus
} from '../controllers/adminRightsController.js';
import {
  createGlobalMenu,
  getAllGlobalMenus,
  getAllAdminMenus,
  getAllClientMenus,
  getGlobalMenuById,
  updateGlobalMenu,
  deleteGlobalMenu
} from '../controllers/globalMenuController.js';
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

// Admin Authentication Routes
router.post('/login', adminLogin);
router.get('/profile', isAuthenticated, isAdmin, getAdminProfile);
router.get('/me', isAuthenticated, isAdmin, getAdminProfile);
router.post('/create-admin', isAuthenticated, isAdmin, createAdminUser);
router.get('/logout', isAuthenticated, adminLogout);

// Dynamic Authorized Menus for logged-in Admin
router.get('/menus/me', isAuthenticated, isAdmin, getMyAuthorizedMenus);

// Global Menu Master Management (/admin/menus)
router.get('/menus', isAuthenticated, isAdmin, getAllGlobalMenus);
router.get('/menus/admin-menus', isAuthenticated, isAdmin, getAllAdminMenus);
router.get('/menus/client-menus', isAuthenticated, isAdmin, getAllClientMenus);
router.post('/menus', isAuthenticated, isAdmin, createGlobalMenu);
router.get('/menus/:id', isAuthenticated, isAdmin, getGlobalMenuById);
router.put('/menus/:id', isAuthenticated, isAdmin, updateGlobalMenu);
router.delete('/menus/:id', isAuthenticated, isAdmin, deleteGlobalMenu);

// User Group Management (/admin/groups)
router.get('/groups', isAuthenticated, isAdmin, getAllUserGroups);
router.post('/groups', isAuthenticated, isAdmin, createUserGroup);
router.put('/groups/:id', isAuthenticated, isAdmin, updateUserGroup);
router.delete('/groups/:id', isAuthenticated, isAdmin, deleteUserGroup);

// Group-level Rights Matrix (/admin/groups/:groupId/rights)
router.get('/groups/:groupId/rights', isAuthenticated, isAdmin, getGroupRights);
router.post('/groups/:groupId/rights', isAuthenticated, isAdmin, saveGroupRights);

// User-level Override Rights Matrix (/admin/users/:userId/rights)
router.get('/users/:userId/rights', isAuthenticated, isAdmin, getUserRightsMatrix);
router.post('/users/:userId/rights', isAuthenticated, isAdmin, saveUserRightsOverride);
router.delete('/users/:userId/rights/:pageId', isAuthenticated, isAdmin, removeUserRightOverride);

// Company-level Permissions Matrix (/admin/companies/:companyId/rights)
router.get('/companies/:companyId/rights', isAuthenticated, isAdmin, getCompanyRightsMatrix);
router.post('/companies/:companyId/rights', isAuthenticated, isAdmin, saveCompanyRights);
router.delete('/companies/:companyId/rights/:pageId', isAuthenticated, isAdmin, removeCompanyRight);

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