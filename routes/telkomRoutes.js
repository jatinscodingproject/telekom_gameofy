const express = require('express');
const c = require('../controllers/telkomController');
<<<<<<< HEAD
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ADMIN-ONLY thin proxy to PartnerHUB (send header x-admin-key). Never expose to browsers.
router.use(requireAdmin);

=======
const router = express.Router();

>>>>>>> 58c7b0da7a779c9c70a615c12ec4b7a246708d69
router.post('/subscriptions', c.createSubscription);
router.get('/subscriptions/:subscriptionId', c.getSubscription);
router.get('/partners/:partnerId', c.getPartner);
router.get('/services/:svcId', c.getService);
router.delete('/subscriptions/:subscriptionId', c.cancelSubscription);
router.patch('/subscriptions/:subscriptionId/doi', c.resendDoi);
router.post('/billing/ad-hoc', c.createAdHocBill);

<<<<<<< HEAD
=======
// Direct Consent Gateway URL when MSISDN is already known.
router.get('/consent/direct', (req, res) => {
  const { svc_id, ext_ref } = req.query;
  if (!svc_id || !ext_ref) return res.status(400).json({ message: 'svc_id and ext_ref are required' });
  const base = process.env.TELKOM_ENV === 'production'
    ? 'https://sdp-p-vas-payment.telkom.co.za'
    : 'https://sdp-s-vas-payment.telkom.co.za';
  const url = new URL(`/service/${encodeURIComponent(svc_id)}`, base);
  url.searchParams.set('ext_ref', ext_ref);
  return res.redirect(url.toString());
});

>>>>>>> 58c7b0da7a779c9c70a615c12ec4b7a246708d69
module.exports = router;
