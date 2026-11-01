const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config/env');
const telkom = require('./telkomClient');
const { Subscription, Billing, CallbackEvent } = require('../models');
const { decide, resolveStatus, parseTs, S } = require('./subscriptionState');
const { normalizeMsisdn } = require('../utils/msisdn');
const newExtRef = require('../utils/extRef');

/* ------------------------------------------------------------------ */
/* Friendly messages for the Telkom return codes listed in the PDF     */
/* ------------------------------------------------------------------ */
const ERROR_MESSAGES = {
  452: 'Invalid API version.',
  454: 'Mobile number was not provided.',
  464: 'Subscription not found.',
  466: 'Service not found. Check TELKOM_SVC_ID.',
  467: 'You already have an active subscription.',
  468: 'This subscription is not waiting for confirmation.',
  470: 'Service is not linked to a billing channel.',
  472: 'Partner not found.',
  473: 'This service is Ad Hoc and cannot be subscribed to.',
  478: 'Invalid mobile number.',
  480: 'Invalid billing amount.',
  514: 'Could not send the confirmation request. Please try again.',
  515: 'Subscription is not active.',
  NETWORK: 'Could not reach the operator. Please try again.'
};
const explain = r => ERROR_MESSAGES[r.errorCode] || (r.data && r.data.error_message) || 'Operator request failed.';

const dateOrNull = v => parseTs(v);

/** Map a Telkom subscription data model -> our column names. */
function mapPayload(p = {}) {
  return {
    subscription_id: p.subscription_id != null ? String(p.subscription_id) : undefined,
    user_id: p.user_id != null ? String(p.user_id) : undefined,
    msisdn: normalizeMsisdn(p.user_msisdn) || undefined,
    svc_id: p.svc_id != null ? String(p.svc_id) : undefined,
    svc_name: p.svc_name,
    ext_ref: p.ext_ref != null && p.ext_ref !== '' ? String(p.ext_ref) : undefined,
    channel: p.channel_name,
    renewal_type: p.renewal_type,
    billing_cycle: p.billing_cycle,
    billing_rate: Number.isFinite(Number(p.billing_rate)) ? Number(p.billing_rate) : undefined,
    started_at: dateOrNull(p.subscription_started_at) || undefined,
    expires_at: dateOrNull(p.expires_at) || undefined,
    last_billed_at: dateOrNull(p.last_billed_at) || undefined,
    next_billing_at: dateOrNull(p.next_billing_at) || undefined
  };
}
const defined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Ad-hoc "subscriptions" are one-off bills: billing_cycle ONCE / renewal NEVER (PDF, Ad Hoc section). */
const isAdHocPayload = p => p && (p.billing_cycle === 'ONCE' || p.renewal_type === 'NEVER');

/* ------------------------------------------------------------------ */
/* Finders                                                             */
/* ------------------------------------------------------------------ */
const findByExtRef = ref => ref ? Subscription.findOne({ where: { ext_ref: String(ref) }, order: [['id', 'DESC']] }) : null;

async function findForCallback(p) {
  if (p.subscription_id != null) {
    const bySub = await Subscription.findOne({ where: { subscription_id: String(p.subscription_id) } });
    if (bySub) return bySub;
  }
  if (p.ext_ref != null && p.ext_ref !== '') {
    const byRef = await Subscription.findOne({
      where: { ext_ref: String(p.ext_ref), subscription_id: null }, order: [['id', 'DESC']]   // Wi-Fi/direct row waiting for its Telkom id
    }) || await findByExtRef(p.ext_ref);
    if (byRef && (!byRef.subscription_id || byRef.subscription_id === String(p.subscription_id))) return byRef;
  }
  return null;
}

async function getActiveFor(msisdn, svcId = config.svcId) {
  if (!msisdn) return null;
  return Subscription.findOne({ where: { msisdn, svc_id: String(svcId), status: config.entitledStatuses }, order: [['id', 'DESC']] });
}

/* ------------------------------------------------------------------ */
/* START FLOWS                                                         */
/* ------------------------------------------------------------------ */

/**
 * CLICK flow (MSISDN already known) and SMS flow (typed number).
 * POST /subscription -> PENDING; user confirms via WAP consent gateway or SMS reply.
 */
async function startWithMsisdn({ msisdn, doiChannel = 'WAP', flow = 'CLICK' }) {
  const number = normalizeMsisdn(msisdn);
  if (!number) return { ok: false, httpStatus: 400, message: ERROR_MESSAGES[478] };

  const already = await getActiveFor(number);
  if (already) return { ok: true, alreadyActive: true, msisdn: number, extRef: already.ext_ref };

  const extRef = newExtRef();
  const row = await Subscription.create({
    msisdn: number, svc_id: config.svcId, ext_ref: extRef,
    channel: 'WAP', doi_channel: doiChannel, flow, status: S.PENDING
  });

  const res = await telkom.createSubscription({
    msisdn: number, svc_id: Number(config.svcId), ext_ref: extRef, channel: 'WAP', doi_channel: doiChannel
  });

  if (!res.ok) {
    await row.update({ status: S.FAILED, reason: `TELKOM_${res.errorCode}`, subscription_data: res.data });
    const httpStatus = res.errorCode === 467 ? 409 : res.status >= 500 || res.status === 0 ? 502 : 400;
    return { ok: false, httpStatus, errorCode: res.errorCode, message: explain(res) };
  }

  const data = res.data || {};
  await row.update({
    ...defined(mapPayload(data)),
    msisdn: number, ext_ref: extRef,               // keep ours even if Telkom echoes differently
    consent_url: res.consentUrl,
    subscription_data: data,
    status: resolveStatus(null, data) || S.PENDING
  });

  return {
    ok: true, extRef, subscriptionId: row.subscription_id,
    consentUrl: doiChannel === 'WAP' ? res.consentUrl : null,
    doiChannel
  };
}

/**
 * Wi-Fi / "straight browser redirect" flow (no MSISDN).
 * We only create a local PENDING row and send the browser to the Consent Gateway.
 * The gateway detects the MSISDN (header enrichment on mobile data, OTP on Wi-Fi),
 * asks for consent, and later Telkom sends an ACTIVATED callback carrying our ext_ref.
 */
async function startDirectConsent() {
  const extRef = newExtRef();
  await Subscription.create({
    msisdn: null, svc_id: config.svcId, ext_ref: extRef,
    channel: 'WAP', doi_channel: 'WAP', flow: 'WIFI', status: S.PENDING
  });
  const url = new URL(`/service/${encodeURIComponent(config.svcId)}`, config.consentBaseUrl);
  url.searchParams.set('ext_ref', extRef);
  return { ok: true, extRef, consentUrl: url.toString() };
}

/**
 * Browser came back from the Consent Gateway. Query parameter NAMES are not documented in the PDF
 * (only "msisdn" and "ext_ref" are mentioned). We store everything raw and accept common aliases.
 * This is NOT proof of payment - only the server-to-server callback activates a subscription.
 */
async function recordConsentReturn(query = {}) {
  const extRef = query.ext_ref || query.extRef || query.ext_reference || null;
  const msisdn = normalizeMsisdn(query.msisdn || query.user_msisdn);
  const row = await findByExtRef(extRef);
  if (!row) return { found: false, extRef, msisdn };

  const patch = { consent_return: query };
  if (msisdn && !row.msisdn) patch.msisdn = msisdn;
  await row.update(patch);
  return { found: true, row, extRef, msisdn };
}

/* ------------------------------------------------------------------ */
/* CALLBACKS                                                           */
/* ------------------------------------------------------------------ */
const eventKey = (type, reason, payload) =>
  crypto.createHash('sha256').update(`${type}|${reason || ''}|${JSON.stringify(payload)}`).digest('hex');

/** Store-first inbox. Returns {event, duplicate}. */
async function inbox(type, reason, payload, sourceIp) {
  const key = eventKey(type, reason, payload);
  const sub = type === 'BILLING' ? (payload.subscription || {}) : payload;
  const [event, created] = await CallbackEvent.findOrCreate({
    where: { dedupe_key: key },
    defaults: {
      event_type: type, reason: reason || null, payload, source_ip: sourceIp || null,
      subscription_id: sub.subscription_id != null ? String(sub.subscription_id) : null,
      billing_ref: payload.billing_ref != null ? String(payload.billing_ref) : null,
      msisdn: normalizeMsisdn(sub.user_msisdn)
    }
  });
  return { event, duplicate: !created && event.processed };
}

async function applySubscriptionCallback(reason, payload) {
  let row = await findForCallback(payload);
  const mapped = defined(mapPayload(payload));
  const adHoc = isAdHocPayload(payload);

  if (!row) {
    // Subscription we did not start here (e.g. acquired in Telkom's own portal - no ext_ref).
    row = await Subscription.create({
      ...mapped, svc_id: mapped.svc_id || config.svcId, flow: adHoc ? 'AD_HOC' : 'EXTERNAL',
      status: S.PENDING, is_ad_hoc: adHoc
    });
  }

  const verdict = decide({ current: row.status, lastEventAt: row.last_event_at, reason, payload });
  const now = new Date();
  const patch = { last_callback_at: now, reason: reason || row.reason };

  if (verdict.apply) {
    Object.assign(patch, mapped, {
      msisdn: mapped.msisdn || row.msisdn,
      ext_ref: row.ext_ref || mapped.ext_ref,              // never overwrite our own reference
      status: verdict.status, is_ad_hoc: adHoc || row.is_ad_hoc,
      subscription_data: payload,
      last_event_at: parseTs(payload.updated_at) || now
    });
    if (verdict.status !== row.status) {
      const stamp = { ACTIVE: 'activated_at', SUSPENDED: 'suspended_at', EXPIRED: 'expired_at', CANCELLED: 'cancelled_at', DOI_FAILED: 'doi_failed_at' }[verdict.status];
      if (stamp) patch[stamp] = now;
    }
  }
  await row.update(patch);
  return { row, verdict };
}

async function applyBillingCallback(payload) {
  const ref = payload.billing_ref != null ? String(payload.billing_ref) : null;
  if (!ref) return { skipped: 'no_billing_ref' };

  const sub = payload.subscription || {};
  const values = {
    billing_ref: ref,
    subscription_id: sub.subscription_id != null ? String(sub.subscription_id) : null,
    msisdn: normalizeMsisdn(sub.user_msisdn),
    svc_id: sub.svc_id != null ? String(sub.svc_id) : null,
    ext_ref: sub.ext_ref != null ? String(sub.ext_ref) : null,
    amount: Number(payload.amount) || 0,
    result_id: payload.result_id != null ? Number(payload.result_id) : null,
    result_name: payload.result_name || null,
    billing_type: payload.billing_type || null,
    payload, billed_at: new Date()
  };

  const [bill, created] = await Billing.findOrCreate({ where: { billing_ref: ref }, defaults: values });
  if (!created) await bill.update(values);      // e.g. ad-hoc SCHEDULED(-5300) -> SUCCESS(1)

  // Keep dates fresh but NEVER change status from a billing callback
  // (the PDF's billing example even carries status "PENDING" inside a SUCCESS bill).
  if (values.subscription_id && values.result_id === 1) {
    const row = await Subscription.findOne({ where: { subscription_id: values.subscription_id } });
    if (row) {
      const m = mapPayload(sub);
      await row.update(defined({ last_billed_at: m.last_billed_at || new Date(), next_billing_at: m.next_billing_at, expires_at: m.expires_at }));
    }
  }
  return { bill, created };
}

/* ------------------------------------------------------------------ */
/* USER ACTIONS                                                        */
/* ------------------------------------------------------------------ */
async function cancel(row) {
  if (!row || !row.subscription_id) return { ok: false, httpStatus: 404, message: ERROR_MESSAGES[464] };
  const res = await telkom.cancelSubscription(row.subscription_id);
  if (!res.ok) {
    if (res.errorCode === 515) await row.update({ status: S.CANCELLED, cancelled_at: new Date() }); // already not active at Telkom
    return { ok: false, httpStatus: res.errorCode === 515 ? 409 : 400, message: explain(res) };
  }
  // The CANCELLED callback is the source of truth, but update now so the UI reacts instantly.
  await row.update({ status: S.CANCELLED, cancelled_at: new Date(), reason: 'CANCELLED', subscription_data: res.data });
  return { ok: true };
}

async function resendDoi(row, doiChannel = 'SMS') {
  if (!row || !row.subscription_id) return { ok: false, httpStatus: 404, message: ERROR_MESSAGES[464] };
  const res = await telkom.resendDoi(row.subscription_id, { doi_channel: doiChannel });
  return res.ok ? { ok: true } : { ok: false, httpStatus: 400, message: explain(res) };
}

/** Ask Telkom for the truth and apply it as if it were a callback (used by reconcile job). */
async function syncFromTelkom(row) {
  if (!row.subscription_id) return { synced: false, why: 'no_subscription_id' };
  const res = await telkom.getSubscription(row.subscription_id);
  if (!res.ok || !res.data) return { synced: false, why: `telkom_${res.errorCode}` };
  const status = resolveStatus(null, res.data);
  if (!status) return { synced: false, why: 'unknown_status' };
  const { verdict } = await applySubscriptionCallback(status, { ...res.data, updated_at: res.data.updated_at });
  return { synced: true, verdict };
}

/** Ad hoc one-off bill (admin/server use). Needs a pre-configured billing_rate. */
async function createAdHoc({ msisdn, billingRate, channel = 'WAP', doiChannel = 'SMS', svcId }) {
  const number = normalizeMsisdn(msisdn);
  if (!number) return { ok: false, httpStatus: 400, message: ERROR_MESSAGES[478] };
  const extRef = newExtRef();
  const body = { msisdn: number, ext_ref: extRef, channel, doi_channel: doiChannel, billing_rate: Number(billingRate) };
  if (svcId || config.svcId) body.svc_id = Number(svcId || config.svcId);

  const res = await telkom.createAdHocBill(body);
  if (!res.ok) return { ok: false, httpStatus: 400, errorCode: res.errorCode, message: explain(res) };

  const d = res.data || {};
  if (d.billing_ref != null) {
    await Billing.findOrCreate({
      where: { billing_ref: String(d.billing_ref) },
      defaults: {
        billing_ref: String(d.billing_ref), msisdn: number, ext_ref: extRef,
        subscription_id: d.subscription && d.subscription.subscription_id != null ? String(d.subscription.subscription_id) : null,
        svc_id: String(body.svc_id), amount: Number(d.amount) || body.billing_rate,
        result_id: d.result_id, result_name: d.result_name, billing_type: d.billing_type || 'AD_HOC', payload: d
      }
    });
  }
  if (d.subscription && d.subscription.subscription_id != null) {
    await applySubscriptionCallback('PENDING', { ...d.subscription, ext_ref: extRef }).catch(() => {});
  }
  return { ok: true, data: d, consentUrl: res.consentUrl, extRef };
}

/* ------------------------------------------------------------------ */
/* Queries used by pages / status API                                  */
/* ------------------------------------------------------------------ */
async function latestForMsisdn(msisdn) {
  if (!msisdn) return null;
  return Subscription.findOne({ where: { msisdn, svc_id: config.svcId, is_ad_hoc: false }, order: [['id', 'DESC']] });
}

module.exports = {
  ERROR_MESSAGES, explain, mapPayload,
  startWithMsisdn, startDirectConsent, recordConsentReturn,
  inbox, applySubscriptionCallback, applyBillingCallback,
  cancel, resendDoi, syncFromTelkom, createAdHoc,
  findByExtRef, getActiveFor, latestForMsisdn, Op
};
