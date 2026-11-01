const telkom = require('../services/telkomClient');
const svc = require('../services/subscriptionService');

function forward(res, result) {
  const extra = result.consentUrl ? { consentUrl: result.consentUrl } : {};
  return res.status(result.status || 502).json({ success: result.ok, data: result.data, ...extra });
}
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.createSubscription = wrap(async (req, res) => forward(res, await telkom.createSubscription(req.body)));
exports.getSubscription    = wrap(async (req, res) => forward(res, await telkom.getSubscription(req.params.subscriptionId)));
exports.getPartner         = wrap(async (req, res) => forward(res, await telkom.getPartner(req.params.partnerId, req.query.expand)));
exports.getService         = wrap(async (req, res) => forward(res, await telkom.getService(req.params.svcId, req.query.expand)));
exports.cancelSubscription = wrap(async (req, res) => forward(res, await telkom.cancelSubscription(req.params.subscriptionId)));
exports.resendDoi          = wrap(async (req, res) => forward(res, await telkom.resendDoi(req.params.subscriptionId, req.body)));

// Ad hoc goes through the service so the local billing row + subscription row are tracked.
exports.createAdHocBill = wrap(async (req, res) => {
  const { msisdn, billing_rate, channel, doi_channel, svc_id } = req.body || {};
  const out = await svc.createAdHoc({ msisdn, billingRate: billing_rate, channel, doiChannel: doi_channel, svcId: svc_id });
  return res.status(out.ok ? 200 : out.httpStatus).json({ success: out.ok, ...out });
});
