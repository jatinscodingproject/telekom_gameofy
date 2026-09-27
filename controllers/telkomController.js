const telkom = require('../services/telkomClient');

function forward(res, result) {
  const extra = {};
  if (result.headers['api-wap-doi-location']) extra.consentUrl = result.headers['api-wap-doi-location'];
  return res.status(result.status).json({ success: result.ok, data: result.data, ...extra });
}

exports.createSubscription = async (req, res, next) => {
  try { return forward(res, await telkom.createSubscription(req.body)); } catch (e) { next(e); }
};
exports.getSubscription = async (req, res, next) => {
  try { return forward(res, await telkom.getSubscription(req.params.subscriptionId)); } catch (e) { next(e); }
};
exports.getPartner = async (req, res, next) => {
  try { return forward(res, await telkom.getPartner(req.params.partnerId, req.query.expand)); } catch (e) { next(e); }
};
exports.getService = async (req, res, next) => {
  try { return forward(res, await telkom.getService(req.params.svcId, req.query.expand)); } catch (e) { next(e); }
};
exports.cancelSubscription = async (req, res, next) => {
  try { return forward(res, await telkom.cancelSubscription(req.params.subscriptionId)); } catch (e) { next(e); }
};
exports.resendDoi = async (req, res, next) => {
  try { return forward(res, await telkom.resendDoi(req.params.subscriptionId, req.body)); } catch (e) { next(e); }
};
exports.createAdHocBill = async (req, res, next) => {
  try { return forward(res, await telkom.createAdHocBill(req.body)); } catch (e) { next(e); }
};
