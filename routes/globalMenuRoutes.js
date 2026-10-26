import express from 'express';
import {
  createGlobalMenu,
  getAllGlobalMenus,
  getGlobalMenuById,
  updateGlobalMenu,
  deleteGlobalMenu
} from '../controllers/globalMenuController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', isAuthenticated, createGlobalMenu);
router.get('/', isAuthenticated, getAllGlobalMenus);
router.get('/:id', isAuthenticated, getGlobalMenuById);
router.put('/:id', isAuthenticated, updateGlobalMenu);
router.delete('/:id', isAuthenticated, deleteGlobalMenu);

export default router;

