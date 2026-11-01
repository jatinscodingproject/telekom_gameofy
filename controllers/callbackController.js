const svc = require('../services/subscriptionService');

/**
 * Contract with PartnerHUB (PDF section "Notification API"):
 *  - Reply 2xx quickly => notification considered delivered.
 *  - Anything else => Telkom retries ~every 30 min for 6 h (12 attempts).
 *
 * Our policy:
 *  1. Store the raw event first (dedupe by content hash).
 *  2. Process it. If processing throws (DB down) => 500 so Telkom retries later.
 *  3. Business "ignore" outcomes (stale / illegal transition) are still 200 - retrying cannot fix them.
 */
exports.subscription = async (req, res) => {
  const reason = (req.get('Reason') || '').trim().toUpperCase() || null;   // ACTIVATED | SUSPENDED | EXPIRED | CANCELLED | DOI_FAILED
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || payload.subscription_id == null) {
    return res.status(400).json({ success: false, message: 'Invalid subscription payload' });
  }

  let event;
  try {
    const box = await svc.inbox('SUBSCRIPTION', reason, payload, req.ip);
    event = box.event;
    if (box.duplicate) return res.status(200).json({ received: true, duplicate: true });

    const { verdict } = await svc.applySubscriptionCallback(reason, payload);
    await event.update({ processed: true, processed_at: new Date(), process_result: verdict.reason, error_message: null });
    console.log(`[callback:subscription] sub=${payload.subscription_id} reason=${reason} -> ${verdict.reason} (${verdict.status})`);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[callback:subscription] processing failed:', err.message);
    if (event) await event.update({ error_message: err.message }).catch(() => {});
    return res.status(500).json({ received: false });          // => Telkom will retry
  }
};

exports.billing = async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || payload.billing_ref == null) {
    return res.status(400).json({ success: false, message: 'Invalid billing payload' });
  }

  let event;
  try {
    const box = await svc.inbox('BILLING', null, payload, req.ip);
    event = box.event;
    if (box.duplicate) return res.status(204).send();

    const out = await svc.applyBillingCallback(payload);
    await event.update({ processed: true, processed_at: new Date(), process_result: out.skipped || (out.created ? 'created' : 'updated'), error_message: null });
    console.log(`[callback:billing] ref=${payload.billing_ref} amount=${payload.amount} result=${payload.result_name}`);
    return res.status(204).send();
  } catch (err) {
    console.error('[callback:billing] processing failed:', err.message);
    if (event) await event.update({ error_message: err.message }).catch(() => {});
    return res.status(500).json({ received: false });
  }
};
