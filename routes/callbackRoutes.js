const express = require('express');
const c = require('../controllers/callbackController');
const router = express.Router();
router.post('/subscription', c.subscription);
router.post('/billing', c.billing);
module.exports = router;
