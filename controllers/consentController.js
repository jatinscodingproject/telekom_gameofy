const svc = require('../services/subscriptionService');
const session = require('../utils/session');

/**
 * GET /consent/return  <- Telkom Consent Gateway sends the browser here after the user accepts/declines
 * ("doi return url configured for the service", PDF section 5). Give Telkom this URL:
 *      <PUBLIC_BASE_URL>/consent/return
 *
 * The PDF does not document the query parameter names beyond msisdn + ext_ref, so we keep the raw
 * query. NOTHING here activates a subscription: the page just waits for the server-to-server
 * ACTIVATED / DOI_FAILED callback and polls /api/subscribe/status.
 */
exports.consentReturn = async (req, res, next) => {
  try {
    console.log('[consent/return] query:', req.query);
    const r = await svc.recordConsentReturn(req.query);
    if (r.found) session.setPending(res, r.row.ext_ref);   // re-bind in case cookie was lost (e.g. different in-app browser)
    return res.render('pages/consent-result', { title: 'Confirming your subscription', found: r.found });
  } catch (e) { next(e); }
};
