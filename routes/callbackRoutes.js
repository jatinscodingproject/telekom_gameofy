const express = require('express');
const c = require('../controllers/callbackController');
const { callbackGuard } = require('../middleware/auth');
const router = express.Router();

// Register these URLs with Telkom (per service):
//   Subscription: https://<domain>/api/callbacks/subscription/<CALLBACK_TOKEN>
//   Billing:      https://<domain>/api/callbacks/billing/<CALLBACK_TOKEN>
// (without CALLBACK_TOKEN configured, the plain /subscription and /billing paths work too)
router.post(['/subscription', '/subscription/:token'], callbackGuard, c.subscription);
router.post(['/billing', '/billing/:token'], callbackGuard, c.billing);

module.exports = router;
