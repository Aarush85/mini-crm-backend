import express from 'express';
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  generateMessage,
  previewCampaignAudience,
  testEmail,
} from '../controllers/campaigns.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
// router.use(protect);

// Test email route
router.post('/test-email', testEmail);

// Specific routes first
router.post('/generate-message', generateMessage);
router.post('/preview-audience', previewCampaignAudience);

// Then parameterized routes
router.route('/')
  .get(getCampaigns)
  .post(createCampaign);

router.route('/:id')
  .get(getCampaign)
  .put(updateCampaign)
  .delete(deleteCampaign);

router.post('/:id/send', sendCampaign);

export default router;