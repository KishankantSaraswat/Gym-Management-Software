import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  companyLogin
} from '../controllers/companyController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Company Partner Login Route
router.post('/login', companyLogin);

// Company CRUD Routes
router.post('/', createCompany);
router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;

