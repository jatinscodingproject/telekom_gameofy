const config = require('../config/env');
const svc = require('../services/subscriptionService');
const session = require('../utils/session');
const { msisdnFromHeaders, normalizeMsisdn } = require('../utils/msisdn');
const { isEntitled } = require('../services/subscriptionState');

/**
 * POST /api/subscribe/start      body: { mode?: 'sms', msisdn?: '0831234567' }
 *
 *   header-detected MSISDN  -> CLICK flow : POST /subscription (doi_channel=WAP) -> redirect to Consent Gateway
 *   no MSISDN               -> WIFI flow  : redirect straight to Consent Gateway (it detects/OTPs the number)
 *   mode=sms (+typed number)-> SMS flow   : POST /subscription (doi_channel=SMS) -> user confirms by SMS
 */
exports.start = async (req, res, next) => {
  try {
    const mode = req.body && req.body.mode;

    if (mode === 'sms') {
      if (!config.allowSmsDoi) return res.status(403).json({ success: false, message: 'SMS confirmation is not enabled' });
      const out = await svc.startWithMsisdn({ msisdn: req.body.msisdn, doiChannel: 'SMS', flow: 'SMS' });
      return respondStart(res, out, 'SMS');
    }

    const msisdn = msisdnFromHeaders(req.headers);
    if (msisdn) {
      const out = await svc.startWithMsisdn({ msisdn, doiChannel: 'WAP', flow: 'CLICK' });
      return respondStart(res, out, 'CLICK');
    }

    const out = await svc.startDirectConsent();
    return respondStart(res, out, 'WIFI');
  } catch (e) { next(e); }
};

function respondStart(res, out, flow) {
  if (!out.ok) return res.status(out.httpStatus || 400).json({ success: false, message: out.message, errorCode: out.errorCode });

  if (out.alreadyActive) {
    session.setSession(res, { msisdn: out.msisdn });
    return res.json({ success: true, flow, alreadyActive: true });
  }
  if (out.extRef) session.setPending(res, out.extRef);       // bind this browser to the attempt

  return res.json({
    success: true, flow, extRef: out.extRef,
    redirectUrl: out.consentUrl || null,                      // null for SMS => show "reply to the SMS" screen
    awaitingSms: flow === 'SMS'
  });
}

/** GET /subscribe/wifi - no-JS fallback: creates the pending row and 302s to the Consent Gateway. */
exports.wifiRedirect = async (req, res, next) => {
  try {
    const out = await svc.startDirectConsent();
    session.setPending(res, out.extRef);
    return res.redirect(302, out.consentUrl);
  } catch (e) { next(e); }
};

/** GET /api/subscribe/status - polled by the consent-result page. Never trusts query params. */
exports.status = async (req, res, next) => {
  try {
    const pending = session.getPending(req);
    const sess = session.getSession(req);

    let row = pending ? await svc.findByExtRef(pending.extRef) : null;
    if (!row && sess) row = await svc.latestForMsisdn(sess.msisdn);
    if (!row) return res.json({ success: true, state: 'NONE', entitled: false });

    const entitled = isEntitled(row.status, config.entitledStatuses);
    if (entitled && row.msisdn) session.setSession(res, { msisdn: row.msisdn });   // session only after a Telkom-confirmed ACTIVE

    return res.json({ success: true, state: row.status, entitled, flow: row.flow, canResendDoi: row.status === 'PENDING' && !!row.subscription_id });
  } catch (e) { next(e); }
};

exports.resendDoi = async (req, res, next) => {
  try {
    const pending = session.getPending(req);
    const row = pending && await svc.findByExtRef(pending.extRef);
    if (!row || row.status !== 'PENDING') return res.status(404).json({ success: false, message: 'No pending subscription' });
    const out = await svc.resendDoi(row, 'SMS');
    return res.status(out.ok ? 200 : out.httpStatus).json({ success: out.ok, message: out.message });
  } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try {
    const sess = session.getSession(req);
    const row = sess && await svc.getActiveFor(normalizeMsisdn(sess.msisdn));
    if (!row) return res.status(404).json({ success: false, message: 'No active subscription' });
    const out = await svc.cancel(row);
    if (out.ok) session.clearSession(res);
    return res.status(out.ok ? 200 : out.httpStatus).json({ success: out.ok, message: out.message });
  } catch (e) { next(e); }
};
