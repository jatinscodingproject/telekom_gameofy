const express = require('express');
const c = require('../controllers/telkomController');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ADMIN-ONLY thin proxy to PartnerHUB (send header x-admin-key). Never expose to browsers.
router.use(requireAdmin);

router.post('/subscriptions', c.createSubscription);
router.get('/subscriptions/:subscriptionId', c.getSubscription);
router.get('/partners/:partnerId', c.getPartner);
router.get('/services/:svcId', c.getService);
router.delete('/subscriptions/:subscriptionId', c.cancelSubscription);
router.patch('/subscriptions/:subscriptionId/doi', c.resendDoi);
router.post('/billing/ad-hoc', c.createAdHocBill);

module.exports = router;
