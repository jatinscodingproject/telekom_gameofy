const config = require('../config/env');

function checkIp(req) {
  if (!config.callbackIps.length) return true; // Configure when Telkom supplies the allowlist.
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip;
  return config.callbackIps.includes(ip) || config.callbackIps.includes(ip.replace(/^::ffff:/, ''));
}

exports.subscription = (req, res) => {
  if (!checkIp(req)) return res.status(403).json({ success: false, message: 'Forbidden' });

  const reason = req.get('Reason') || req.get('reason') || null;
  console.log('[TELKOM SUBSCRIPTION CALLBACK]', { reason, body: req.body });

  // TODO: Persist/update your local subscription here.
  // Return 2xx so PartnerHUB does not retry the same notification.
  return res.status(200).json({ received: true });
};

exports.billing = (req, res) => {
  if (!checkIp(req)) return res.status(403).json({ success: false, message: 'Forbidden' });

  console.log('[TELKOM BILLING CALLBACK]', req.body);

  // TODO: Persist billing event using billing_ref as your idempotency key.
  return res.status(204).send();
};
