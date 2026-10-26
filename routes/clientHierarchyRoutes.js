import express from 'express';
import {
  clientCompanyUserLogin,
  getClientMyProfile,
  getAllClientUserGroups,
  getClientUserGroupById,
  createClientUserGroup,
  updateClientUserGroup,
  deleteClientUserGroup,
  getClientGroupRightsMatrix,
  saveClientGroupRights,
  createClientUser,
  getClientCompanyUsers,
  getClientCompanyUserById,
  updateClientUser,
  deleteClientUser,
  getClientUserRightsMatrix,
  saveClientUserRights,
  removeClientUserRight
} from '../controllers/clientHierarchyController.js';
import { isAuthenticated, isClientUser } from '../middlewares/authMiddleware.js';

const router = express.Router();

// 1. Client Company Authentication & Profile
router.post('/login', clientCompanyUserLogin);
router.get('/me', isAuthenticated, isClientUser, getClientMyProfile);

// 2. Client Company User Group Management (/groups)
router.get('/groups', isAuthenticated, isClientUser, getAllClientUserGroups);
router.post('/groups', isAuthenticated, isClientUser, createClientUserGroup);
router.get('/groups/:id', isAuthenticated, isClientUser, getClientUserGroupById);
router.put('/groups/:id', isAuthenticated, isClientUser, updateClientUserGroup);
router.delete('/groups/:id', isAuthenticated, isClientUser, deleteClientUserGroup);

// 3. Client Company Group Permissions Matrix (/groups/:groupId/rights)
router.get('/groups/:groupId/rights', isAuthenticated, isClientUser, getClientGroupRightsMatrix);
router.post('/groups/:groupId/rights', isAuthenticated, isClientUser, saveClientGroupRights);

// 4. Client Company User Management (/users)
router.get('/users', isAuthenticated, isClientUser, getClientCompanyUsers);
router.post('/users', isAuthenticated, isClientUser, createClientUser);
router.get('/users/:id', isAuthenticated, isClientUser, getClientCompanyUserById);
router.put('/users/:id', isAuthenticated, isClientUser, updateClientUser);
router.delete('/users/:id', isAuthenticated, isClientUser, deleteClientUser);

// 5. Client Company User Permissions Override Matrix (/users/:userId/rights)
router.get('/users/:userId/rights', isAuthenticated, isClientUser, getClientUserRightsMatrix);
router.post('/users/:userId/rights', isAuthenticated, isClientUser, saveClientUserRights);
router.delete('/users/:userId/rights/:pageId', isAuthenticated, isClientUser, removeClientUserRight);

export default router;

