const test = require('node:test');
const assert = require('node:assert');
const { decide, resolveStatus, parseTs, S } = require('../services/subscriptionState');

test('Reason header wins; status_id is ignored (PDF table is self-contradictory)', () => {
  assert.strictEqual(resolveStatus('ACTIVATED', { status_id: 1, status_name: 'PENDING' }), S.ACTIVE);
  assert.strictEqual(resolveStatus(null, { status_name: 'ACTIVE' }), S.ACTIVE);
  assert.strictEqual(resolveStatus('SUSPENDED', {}), S.SUSPENDED);
  assert.strictEqual(resolveStatus('DOI_FAILED', {}), S.DOI_FAILED);
  assert.strictEqual(resolveStatus('???', {}), null);
});

test('happy path: PENDING -> ACTIVE -> SUSPENDED -> ACTIVE -> CANCELLED', () => {
  let cur = S.PENDING;
  for (const [reason, expect] of [['ACTIVATED', 'ACTIVE'], ['SUSPENDED', 'SUSPENDED'], ['ACTIVATED', 'ACTIVE'], ['CANCELLED', 'CANCELLED']]) {
    const d = decide({ current: cur, reason, payload: {} });
    assert.ok(d.apply, reason); assert.strictEqual(d.status, expect); cur = d.status;
  }
});

test('late ACTIVATED after CANCELLED is ignored (retry arriving out of order)', () => {
  const d = decide({ current: S.CANCELLED, reason: 'ACTIVATED', payload: {} });
  assert.strictEqual(d.apply, false); assert.strictEqual(d.reason, 'illegal_transition');
});

test('stale event (older updated_at than last applied) is ignored', () => {
  const d = decide({ current: S.SUSPENDED, lastEventAt: '2026-11-01T10:00:00Z', reason: 'ACTIVATED', payload: { updated_at: '2026-11-01T09:00:00Z' } });
  assert.strictEqual(d.apply, false); assert.strictEqual(d.reason, 'stale_event');
});

test('DOI_FAILED only from PENDING; EXPIRED from ACTIVE/SUSPENDED', () => {
  assert.ok(decide({ current: S.PENDING, reason: 'DOI_FAILED', payload: {} }).apply);
  assert.ok(!decide({ current: S.ACTIVE, reason: 'DOI_FAILED', payload: {} }).apply);
  assert.ok(decide({ current: S.SUSPENDED, reason: 'EXPIRED', payload: {} }).apply);
});

test('duplicate delivery of the same status is a harmless refresh', () => {
  const d = decide({ current: S.ACTIVE, reason: 'ACTIVATED', payload: {} });
  assert.ok(d.apply); assert.strictEqual(d.reason, 'refresh');
});

test('malformed timestamp from the PDF example ("018-10-17...") does not throw', () => {
  assert.strictEqual(parseTs('018-10-17T13:05:50+02:00'), null);
  assert.ok(decide({ current: S.PENDING, reason: 'ACTIVATED', payload: { updated_at: '018-10-17T13:05:50+02:00' } }).apply);
});
