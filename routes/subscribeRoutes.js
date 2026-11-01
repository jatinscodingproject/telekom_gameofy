const express = require('express');
const c = require('../controllers/subscribeController');
const consent = require('../controllers/consentController');
const { rateLimit } = require('../middleware/auth');
const router = express.Router();

router.post('/api/subscribe/start', rateLimit({ max: 10 }), c.start);
router.get('/api/subscribe/status', c.status);
router.post('/api/subscribe/resend-doi', rateLimit({ max: 3 }), c.resendDoi);
router.post('/api/subscribe/cancel', rateLimit({ max: 5 }), c.cancel);

router.get('/subscribe/wifi', rateLimit({ max: 10 }), c.wifiRedirect);
router.get('/consent/return', consent.consentReturn);

module.exports = router;
