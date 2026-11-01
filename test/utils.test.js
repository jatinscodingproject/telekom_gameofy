const test = require('node:test');
const assert = require('node:assert');
const { normalizeMsisdn, msisdnFromHeaders } = require('../utils/msisdn');
const newExtRef = require('../utils/extRef');
const { cleanConsentUrl } = require('../services/telkomClient');

test('msisdn normalisation to 27XXXXXXXXX', () => {
  for (const v of ['0831234567', '+27 83 123 4567', '27831234567', '0027831234567', '831234567']) assert.strictEqual(normalizeMsisdn(v), '27831234567', v);
  for (const v of ['', null, '12345', '2783123456', '278312345678', 'abc']) assert.strictEqual(normalizeMsisdn(v), null, String(v));
});

test('msisdn from enrichment header', () => {
  assert.strictEqual(msisdnFromHeaders({ 'x-msisdn': '27831234567' }), '27831234567');
  assert.strictEqual(msisdnFromHeaders({ host: 'x' }), null);
});

test('ext_ref is <=30 chars and unique', () => {
  const s = new Set(Array.from({ length: 2000 }, newExtRef));
  assert.strictEqual(s.size, 2000);
  for (const r of s) assert.ok(r.length <= 30);
});

test('consent url: &amp; decoded, duplicated scheme fixed, foreign hosts rejected', () => {
  assert.strictEqual(
    cleanConsentUrl('https://https://sdp-s-vaspayment.telkom.co.za/service/1?msisdn=27833334444&amp;subscription_id=111&amp;ext_ref=1289'),
    'https://sdp-s-vaspayment.telkom.co.za/service/1?msisdn=27833334444&subscription_id=111&ext_ref=1289');
  assert.strictEqual(cleanConsentUrl('https://evil.example.com/x'), null);
  assert.strictEqual(cleanConsentUrl('https://telkom.co.za.evil.com/x'), null);
  assert.strictEqual(cleanConsentUrl('http://sdp-s-vas-payment.telkom.co.za/x'), 'https://sdp-s-vas-payment.telkom.co.za/x');   // upgraded to https
});
