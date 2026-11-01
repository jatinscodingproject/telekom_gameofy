const express = require('express');
const c = require('../controllers/callbackController');
<<<<<<< HEAD
const { callbackGuard } = require('../middleware/auth');
const router = express.Router();

// Register these URLs with Telkom (per service):
//   Subscription: https://<domain>/api/callbacks/subscription/<CALLBACK_TOKEN>
//   Billing:      https://<domain>/api/callbacks/billing/<CALLBACK_TOKEN>
// (without CALLBACK_TOKEN configured, the plain /subscription and /billing paths work too)
router.post(['/subscription', '/subscription/:token'], callbackGuard, c.subscription);
router.post(['/billing', '/billing/:token'], callbackGuard, c.billing);

=======
const router = express.Router();
router.post('/subscription', c.subscription);
router.post('/billing', c.billing);
>>>>>>> 58c7b0da7a779c9c70a615c12ec4b7a246708d69
module.exports = router;
