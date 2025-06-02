import express from 'express';
import multer from 'multer';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  createBulkCustomers,
  updateCustomer,
  deleteCustomer,
  bulkUploadCustomers,
} from '../controllers/customers.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Apply authentication middleware to all routes
// router.use(protect);

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.route('/bulk')
  .post(createBulkCustomers);

router.post('/bulk-upload', upload.single('file'), bulkUploadCustomers);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

export default router;