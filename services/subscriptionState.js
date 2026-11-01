/**
 * Pure state logic for subscription callbacks (no DB) so it can be unit-tested.
 *
 * IMPORTANT: the PDF's status_id table (2=ACTIVE,3=SUSPENDED,4=EXPIRED,8=CANCELLED)
 * contradicts its own examples (status_id 1 = "ACTIVATED"/"PENDING", 4 = "ACTIVE").
 * We therefore NEVER rely on status_id. We use the `Reason` header first and
 * status_name second.
 */
const S = Object.freeze({
  PENDING: 'PENDING', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED', DOI_FAILED: 'DOI_FAILED', FAILED: 'FAILED'
});

const REASON_TO_STATUS = {
  ACTIVATED: S.ACTIVE, ACTIVE: S.ACTIVE,
  SUSPENDED: S.SUSPENDED,
  EXPIRED: S.EXPIRED,
  CANCELLED: S.CANCELLED, CANCELED: S.CANCELLED,
  DOI_FAILED: S.DOI_FAILED,
  PENDING: S.PENDING
};

function resolveStatus(reason, payload = {}) {
  const r = String(reason || '').trim().toUpperCase();
  if (REASON_TO_STATUS[r]) return REASON_TO_STATUS[r];
  const n = String(payload.status_name || '').trim().toUpperCase();
  return REASON_TO_STATUS[n] || null;
}

// What each *incoming* status may replace.
const ALLOWED_FROM = {
  [S.PENDING]:    [null, S.PENDING],
  [S.ACTIVE]:     [null, S.PENDING, S.SUSPENDED, S.ACTIVE, S.FAILED],
  [S.SUSPENDED]:  [null, S.PENDING, S.ACTIVE, S.SUSPENDED],
  [S.EXPIRED]:    [null, S.PENDING, S.ACTIVE, S.SUSPENDED, S.EXPIRED],
  [S.CANCELLED]:  [null, S.PENDING, S.ACTIVE, S.SUSPENDED, S.CANCELLED],
  [S.DOI_FAILED]: [null, S.PENDING, S.FAILED, S.DOI_FAILED]
};

/** Telkom timestamps may be malformed in the PDF examples ("018-10-17..."). Never throw on them. */
function parseTs(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
}

/**
 * @returns {{apply:boolean, status:string|null, reason:string}}
 * Callbacks are retried for up to 6h, so old events can arrive after newer ones:
 * we ignore an event older than the last one we applied, and illegal transitions
 * (e.g. ACTIVATED after CANCELLED).
 */
function decide({ current, lastEventAt, reason, payload }) {
  const incoming = resolveStatus(reason, payload);
  if (!incoming) return { apply: false, status: current || null, reason: 'unknown_status' };

  const evTs = parseTs(payload && payload.updated_at);
  const last = lastEventAt ? new Date(lastEventAt) : null;
  if (evTs && last && evTs < last && incoming !== current) {
    return { apply: false, status: current, reason: 'stale_event' };
  }
  if (!ALLOWED_FROM[incoming].includes(current || null)) {
    return { apply: false, status: current, reason: 'illegal_transition' };
  }
  return { apply: true, status: incoming, reason: current === incoming ? 'refresh' : 'transition' };
}

const isEntitled = (status, entitled = ['ACTIVE']) => entitled.includes(status);

module.exports = { S, decide, resolveStatus, parseTs, isEntitled };
