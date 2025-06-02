import express from 'express';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  createBulkCustomers,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customers.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(protect);

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.route('/bulk')
  .post(createBulkCustomers);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

export default router;