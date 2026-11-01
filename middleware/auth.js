const crypto = require('crypto');
const config = require('../config/env');

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

/** Protects /api/telkom/* (cancel, ad-hoc billing, partner dumps). Send header: x-admin-key */
exports.requireAdmin = (req, res, next) => {
  if (!config.adminApiKey) return res.status(503).json({ success: false, message: 'ADMIN_API_KEY is not configured' });
  if (!safeEqual(req.get('x-admin-key') || '', config.adminApiKey)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

/**
 * Telkom callbacks carry NO signature in the PDF, so we layer:
 *   1) secret token in the callback URL  (CALLBACK_TOKEN)  -> /api/callbacks/subscription/<token>
 *   2) source-IP allowlist               (TELKOM_CALLBACK_IPS)
 * Uses req.ip (honours TRUST_PROXY hops) - NOT the raw X-Forwarded-For header, which any client can forge.
 */
exports.callbackGuard = (req, res, next) => {
  if (config.callbackToken && !safeEqual(req.params.token || '', config.callbackToken)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (config.callbackIps.length) {
    const ip = String(req.ip || '').replace(/^::ffff:/, '');
    if (!config.callbackIps.includes(ip)) {
      console.warn('[callback] blocked ip', ip);
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  }
  if (config.isProd && !config.callbackToken && !config.callbackIps.length) {
    console.warn('[callback] WARNING: no CALLBACK_TOKEN and no TELKOM_CALLBACK_IPS set - callbacks are unauthenticated');
  }
  next();
};

/** Tiny in-memory limiter (per IP). Use Redis/nginx limits if you run >1 instance. */
exports.rateLimit = ({ windowMs = 60000, max = 10 } = {}) => {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const h = hits.get(req.ip) || { n: 0, reset: now + windowMs };
    if (h.reset < now) { h.n = 0; h.reset = now + windowMs; }
    h.n += 1; hits.set(req.ip, h);
    if (h.n > max) return res.status(429).json({ success: false, message: 'Too many requests, please wait a minute.' });
    next();
  };
};
