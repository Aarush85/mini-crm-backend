import express from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  createBulkOrders,
  updateOrder,
  deleteOrder,
} from '../controllers/orders.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(protect);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/bulk')
  .post(createBulkOrders);

router.route('/:id')
  .get(getOrder)
  .put(updateOrder)
  .delete(deleteOrder);

export default router;