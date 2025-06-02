import express from 'express';
import multer from 'multer';
import {
  getOrders,
  getOrder,
  createOrder,
  createBulkOrders,
  updateOrder,
  deleteOrder,
  bulkUploadOrders,
} from '../controllers/orders.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Apply authentication middleware to all routes
// router.use(protect);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/bulk')
  .post(createBulkOrders);

router.post('/bulk-upload', upload.single('file'), bulkUploadOrders);

router.route('/:id')
  .get(getOrder)
  .put(updateOrder)
  .delete(deleteOrder);

export default router;