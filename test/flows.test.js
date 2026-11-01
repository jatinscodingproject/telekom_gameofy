/**
 * End-to-end flow tests: real Express app + real controllers/services + real routes,
 * with an in-memory stand-in for the Sequelize models (no MySQL needed) and a fake PartnerHUB HTTP API.
 * Covers: CLICK flow, WIFI (direct redirect) flow, callbacks (retry/duplicate/out-of-order), billing, cancel, ad hoc.
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const Module = require('node:module');

/* ---------- in-memory model fake ---------- */
function makeModel(name) {
  const rows = []; let seq = 1;
  const match = (row, where = {}) => Object.entries(where).every(([k, v]) =>
    Array.isArray(v) ? v.includes(row[k]) : v === null ? (row[k] === null || row[k] === undefined) : String(row[k]) === String(v));
  const wrap = data => {
    const row = { ...data };
    row.update = async patch => { Object.assign(row, patch, { updated_at: new Date() }); return row; };
    return row;
  };
  const M = {
    rows, name,
    async create(d) { const r = wrap({ id: seq++, status: 'PENDING', is_ad_hoc: false, created_at: new Date(), ...d }); rows.push(r); return r; },
    async findOne({ where, order } = {}) {
      const hit = rows.filter(r => match(r, where));
      return (order && order[0][1] === 'DESC' ? hit.reverse() : hit)[0] || null;
    },
    async findAll({ where } = {}) { return rows.filter(r => match(r, where)); },
    async findOrCreate({ where, defaults }) {
      const found = rows.find(r => match(r, where));
      if (found) return [found, false];
      return [await M.create({ ...where, ...defaults }), true];
    }
  };
  return M;
}
const fake = { Subscription: makeModel('Subscription'), Billing: makeModel('Billing'), CallbackEvent: makeModel('CallbackEvent') };
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (/(^|\/)models(\/index)?$/.test(request) && parent && !/node_modules/.test(parent.filename)) return { sequelize: {}, ...fake };
  return origLoad.call(this, request, parent, ...rest);
};

/* ---------- fake PartnerHUB API ---------- */
let telkomCalls = []; let nextSub = 5000;
const telkomSrv = http.createServer((req, res) => {
  let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
    const body = b ? JSON.parse(b) : {}; telkomCalls.push({ method: req.method, url: req.url, body, auth: req.headers.authorization });
    const json = (code, o, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url.endsWith('/subscription')) {
      if (body.msisdn === '27830000467') return json(467, { error_code: 467, error_message: 'Active Subscription Exists' });
      const id = nextSub++;
      return json(200, { subscription_id: id, user_id: 9, user_msisdn: body.msisdn, svc_id: body.svc_id, svc_name: 'demo', ext_ref: body.ext_ref, channel_name: 'WAP',
        status_id: 1, status_name: 'PENDING', renewal_type: 'AUTO', billing_rate: 700, billing_cycle: 'DAILY', created_at: new Date().toISOString() },
        body.doi_channel === 'WAP' ? { 'API-WAP-DOI-Location': `https://sdp-s-vas-payment.telkom.co.za/service/${body.svc_id}?msisdn=${body.msisdn}&amp;subscription_id=${id}&amp;ext_ref=${body.ext_ref}` } : {});
    }
    if (req.method === 'DELETE') return json(200, { subscription_id: 1, status_name: 'CANCELLED' });
    if (req.method === 'POST' && req.url.endsWith('/billing/ad-hoc'))
      return json(200, { amount: body.billing_rate, billing_ref: 777001, result_id: -5300, result_name: 'SCHEDULED', billing_type: 'AD_HOC',
        subscription: { subscription_id: nextSub++, user_msisdn: body.msisdn, svc_id: body.svc_id, ext_ref: body.ext_ref, renewal_type: 'NEVER', billing_cycle: 'ONCE', billing_rate: body.billing_rate, status_name: 'PENDING' } });
    json(404, { error_code: 404 });
  });
});

let app, base; const jar = {};
const call = async (method, path, { body, headers = {} } = {}) => {
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const r = await fetch(base + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }), ...headers }, body: body && JSON.stringify(body) });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (/Max-Age=0/.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, json, text, headers: r.headers };
};

test.before(async () => {
  await new Promise(r => telkomSrv.listen(0, '127.0.0.1', r));
  Object.assign(process.env, {
    TELKOM_ENV: 'staging', NODE_ENV: 'test', TELKOM_ACCESS_KEY: 'AK', TELKOM_ACCESS_SECRET: 'SK', TELKOM_API_KEY: 'API', ADMIN_API_KEY: 'adminkey', CALLBACK_TOKEN: 'tok123',
    TELKOM_SVC_ID: '300000146', ALLOW_SMS_DOI: 'true', ENABLE_JOBS: 'false', TRUST_PROXY: '1',
    TELKOM_BASE_URL_OVERRIDE: `http://127.0.0.1:${telkomSrv.address().port}/partner-vas-api`
  });
  const express = require('express'); const path = require('node:path');
  app = express(); app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '../views')); app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/', require('../routes/subscribeRoutes'));
  app.use('/api/telkom', require('../routes/telkomRoutes'));
  app.use('/api/callbacks', require('../routes/callbackRoutes'));
  app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));
  await new Promise(r => { const s = app.listen(0, '127.0.0.1', r); app._srv = s; });
  base = `http://127.0.0.1:${app._srv.address().port}`;
});
test.after(() => { telkomSrv.close(); app._srv.close(); });

const cbSub = (reason, payload, token = 'tok123') => call('POST', `/api/callbacks/subscription/${token}`, { body: payload, headers: { Reason: reason } });

/* =============================== WIFI FLOW =============================== */
test('WIFI flow: start -> redirect to gateway -> return page -> ACTIVATED callback -> entitled', async () => {
  for (const k of Object.keys(jar)) delete jar[k];
  const start = await call('POST', '/api/subscribe/start', { body: {} });                    // no MSISDN header => direct flow
  assert.strictEqual(start.json.flow, 'WIFI');
  const u = new URL(start.json.redirectUrl);
  assert.strictEqual(u.origin, 'https://sdp-s-vas-payment.telkom.co.za');
  assert.strictEqual(u.pathname, '/service/300000146');
  const extRef = u.searchParams.get('ext_ref');
  assert.ok(extRef && extRef.length <= 30);
  assert.strictEqual(telkomCalls.length, 0, 'wifi flow must NOT call POST /subscription');

  // user is not entitled before the callback, even after the browser returns with params
  const ret = await call('GET', `/consent/return?msisdn=0831110001&ext_ref=${extRef}&anything=1`);
  assert.strictEqual(ret.status, 200);
  assert.strictEqual(fake.Subscription.rows.find(r => r.ext_ref === extRef).msisdn, '27831110001');
  assert.strictEqual((await call('GET', '/api/subscribe/status')).json.entitled, false);

  // forged callback attempts
  assert.strictEqual((await cbSub('ACTIVATED', { subscription_id: 1 }, 'wrong')).status, 403);

  // real callback (no msisdn needed beyond payload)
  const payload = { subscription_id: 91001, user_id: 5, user_msisdn: '27831110001', svc_id: 300000146, svc_name: 'GameOfy', ext_ref: extRef,
    channel_name: 'WAP', status_name: 'ACTIVE', renewal_type: 'AUTO', billing_rate: 700, billing_cycle: 'DAILY', updated_at: new Date().toISOString() };
  assert.strictEqual((await cbSub('ACTIVATED', payload)).status, 200);

  const st = await call('GET', '/api/subscribe/status');
  assert.strictEqual(st.json.state, 'ACTIVE'); assert.strictEqual(st.json.entitled, true);
  assert.ok(jar.gf_session, 'session cookie only issued after Telkom-confirmed ACTIVE');
  const row = fake.Subscription.rows.find(r => r.subscription_id === '91001');
  assert.strictEqual(row.ext_ref, extRef, 'matched the pending WIFI row by ext_ref (no duplicate row)');
  assert.strictEqual(fake.Subscription.rows.filter(r => r.ext_ref === extRef).length, 1);
});

test('consent/return alone (forged params, no callback) never grants access', async () => {
  for (const k of Object.keys(jar)) delete jar[k];
  const s = await call('POST', '/api/subscribe/start', { body: {} });
  const ref = new URL(s.json.redirectUrl).searchParams.get('ext_ref');
  await call('GET', `/consent/return?msisdn=27831110001&ext_ref=${ref}&status=success`);
  const st = await call('GET', '/api/subscribe/status');
  assert.strictEqual(st.json.entitled, false); assert.ok(!jar.gf_session);
});

/* =============================== CLICK FLOW ============================== */
test('CLICK flow: MSISDN header -> POST /subscription (WAP DOI) -> consent URL -> callback activates', async () => {
  for (const k of Object.keys(jar)) delete jar[k]; telkomCalls = [];
  const start = await call('POST', '/api/subscribe/start', { body: {}, headers: { 'x-msisdn': '0832220002' } });
  assert.strictEqual(start.json.flow, 'CLICK');
  assert.strictEqual(telkomCalls[0].method, 'POST');
  assert.deepStrictEqual(Object.keys(telkomCalls[0].body).sort(), ['channel', 'doi_channel', 'ext_ref', 'msisdn', 'svc_id']);
  assert.strictEqual(telkomCalls[0].body.msisdn, '27832220002');
  assert.strictEqual(typeof telkomCalls[0].body.svc_id, 'number');
  assert.match(telkomCalls[0].auth, /^AWS4-HMAC-SHA256 Credential=AK\//);
  assert.ok(start.json.redirectUrl.includes('&subscription_id=') && !start.json.redirectUrl.includes('&amp;'));

  const row = fake.Subscription.rows.find(r => r.msisdn === '27832220002');
  assert.strictEqual(row.status, 'PENDING'); assert.ok(row.subscription_id);

  await cbSub('ACTIVATED', { subscription_id: Number(row.subscription_id), user_msisdn: '27832220002', svc_id: 300000146, ext_ref: row.ext_ref, status_name: 'ACTIVE', billing_cycle: 'DAILY', renewal_type: 'AUTO', updated_at: new Date().toISOString() });
  assert.strictEqual((await call('GET', '/api/subscribe/status')).json.entitled, true);

  // starting again while ACTIVE does not hit Telkom
  telkomCalls = [];
  const again = await call('POST', '/api/subscribe/start', { body: {}, headers: { 'x-msisdn': '0832220002' } });
  assert.strictEqual(again.json.alreadyActive, true); assert.strictEqual(telkomCalls.length, 0);
});

test('Telkom 467 (active subscription exists) is surfaced as 409 with a friendly message', async () => {
  for (const k of Object.keys(jar)) delete jar[k];
  const r = await call('POST', '/api/subscribe/start', { body: {}, headers: { 'x-msisdn': '27830000467' } });
  assert.strictEqual(r.status, 409); assert.match(r.json.message, /already have an active subscription/);
  assert.strictEqual(fake.Subscription.rows.find(x => x.msisdn === '27830000467').status, 'FAILED');
});

test('SMS flow: typed number, DOI by SMS, no redirect; bad number rejected', async () => {
  for (const k of Object.keys(jar)) delete jar[k]; telkomCalls = [];
  const bad = await call('POST', '/api/subscribe/start', { body: { mode: 'sms', msisdn: '123' } });
  assert.strictEqual(bad.status, 400);
  const ok = await call('POST', '/api/subscribe/start', { body: { mode: 'sms', msisdn: '0833330003' } });
  assert.strictEqual(ok.json.flow, 'SMS'); assert.strictEqual(ok.json.redirectUrl, null); assert.strictEqual(ok.json.awaitingSms, true);
  assert.strictEqual(telkomCalls[0].body.doi_channel, 'SMS');
});

/* ============================ CALLBACK ROBUSTNESS ======================== */
test('callbacks: duplicate delivery, suspend/reactivate, late event after cancel, expiry', async () => {
  const base = { subscription_id: 92001, user_msisdn: '27834440004', svc_id: 300000146, status_name: 'ACTIVE', billing_cycle: 'DAILY', renewal_type: 'AUTO' };
  const t = n => new Date(Date.UTC(2026, 10, 1, 10, 0, n)).toISOString();
  const sub = () => fake.Subscription.rows.find(r => r.subscription_id === '92001');

  assert.strictEqual((await cbSub('ACTIVATED', { ...base, updated_at: t(1) })).status, 200);       // unknown-to-us subscription (Telkom portal) => created
  assert.strictEqual(sub().flow, 'EXTERNAL'); assert.strictEqual(sub().status, 'ACTIVE');

  const dup = await cbSub('ACTIVATED', { ...base, updated_at: t(1) });                              // Telkom retry of the very same event
  assert.strictEqual(dup.status, 200); assert.strictEqual(dup.json.duplicate, true);
  assert.strictEqual(fake.Subscription.rows.filter(r => r.subscription_id === '92001').length, 1);

  await cbSub('SUSPENDED', { ...base, status_name: 'SUSPENDED', updated_at: t(5) });
  assert.strictEqual(sub().status, 'SUSPENDED'); assert.ok(sub().suspended_at);
  await cbSub('ACTIVATED', { ...base, updated_at: t(9) });
  assert.strictEqual(sub().status, 'ACTIVE');

  await cbSub('CANCELLED', { ...base, status_name: 'CANCELLED', updated_at: t(20) });
  assert.strictEqual(sub().status, 'CANCELLED'); assert.ok(sub().cancelled_at);

  const late = await cbSub('SUSPENDED', { ...base, status_name: 'SUSPENDED', updated_at: t(12) });  // old retry arrives after cancel
  assert.strictEqual(late.status, 200, 'still 2xx so Telkom stops retrying');
  assert.strictEqual(sub().status, 'CANCELLED', 'state not regressed');
  const ev = fake.CallbackEvent.rows.filter(e => e.subscription_id === '92001');
  assert.ok(ev.every(e => e.processed), 'every event kept in the inbox');
  assert.ok(ev.some(e => e.process_result === 'stale_event'));
});

test('callback with an invalid payload is rejected 400; unknown token 403', async () => {
  assert.strictEqual((await cbSub('ACTIVATED', {})).status, 400);
  assert.strictEqual((await cbSub('ACTIVATED', { subscription_id: 1 }, 'nope')).status, 403);
});

test('billing callback: stored once (idempotent on billing_ref), 204, never changes subscription status', async () => {
  const sub = fake.Subscription.rows.find(r => r.subscription_id === '91001');
  const bill = { amount: 700, billing_ref: 160654, result_id: 1, result_name: 'SUCCESS', billing_type: 'NORMAL',
    subscription: { subscription_id: 91001, user_msisdn: '27831110001', svc_id: 300000146, status_name: 'PENDING', next_billing_at: '2026-11-02T10:00:00+02:00' } };
  const r1 = await call('POST', '/api/callbacks/billing/tok123', { body: bill });
  const r2 = await call('POST', '/api/callbacks/billing/tok123', { body: bill });
  assert.strictEqual(r1.status, 204); assert.strictEqual(r2.status, 204);
  assert.strictEqual(fake.Billing.rows.filter(b => b.billing_ref === '160654').length, 1);
  assert.strictEqual(sub.status, 'ACTIVE', 'billing payload carried status PENDING but must not downgrade');
  assert.ok(sub.next_billing_at instanceof Date);
});

/* ================================ CANCEL ================================= */
test('user cancel: calls DELETE /subscription/{id}, clears session', async () => {
  for (const k of Object.keys(jar)) delete jar[k]; telkomCalls = [];
  const s = await call('POST', '/api/subscribe/start', { body: {}, headers: { 'x-msisdn': '0835550005' } });
  const row = fake.Subscription.rows.find(r => r.msisdn === '27835550005');
  await cbSub('ACTIVATED', { subscription_id: Number(row.subscription_id), user_msisdn: '27835550005', svc_id: 300000146, ext_ref: row.ext_ref, status_name: 'ACTIVE', billing_cycle: 'DAILY', renewal_type: 'AUTO', updated_at: new Date().toISOString() });
  await call('GET', '/api/subscribe/status');                                                      // issues gf_session
  telkomCalls = [];
  const c = await call('POST', '/api/subscribe/cancel');
  assert.strictEqual(c.json.success, true);
  assert.strictEqual(telkomCalls[0].method, 'DELETE'); assert.ok(telkomCalls[0].url.endsWith(`/subscription/${row.subscription_id}`));
  assert.strictEqual(row.status, 'CANCELLED'); assert.ok(!jar.gf_session);
});

/* ============================ ADMIN / AD HOC ============================= */
test('admin proxy is locked; ad hoc bill creates local billing + ONCE subscription (not entitling)', async () => {
  assert.strictEqual((await call('POST', '/api/telkom/billing/ad-hoc', { body: { msisdn: '0836660006', billing_rate: 200 } })).status, 401);
  assert.strictEqual((await call('DELETE', '/api/telkom/subscriptions/1')).status, 401);

  const r = await call('POST', '/api/telkom/billing/ad-hoc', { headers: { 'x-admin-key': 'adminkey' }, body: { msisdn: '0836660006', billing_rate: 200 } });
  assert.strictEqual(r.status, 200);
  const b = fake.Billing.rows.find(x => x.billing_ref === '777001');
  assert.strictEqual(b.result_name, 'SCHEDULED'); assert.strictEqual(b.amount, 200);
  const adhoc = fake.Subscription.rows.find(x => x.msisdn === '27836660006');
  assert.strictEqual(adhoc.is_ad_hoc, true);

  // later: DOI confirmed + billed => callback flips SCHEDULED -> SUCCESS on the SAME billing row
  await call('POST', '/api/callbacks/billing/tok123', { body: { amount: 200, billing_ref: 777001, result_id: 1, result_name: 'SUCCESS', billing_type: 'AD_HOC', subscription: { subscription_id: Number(adhoc.subscription_id), user_msisdn: '27836660006', billing_cycle: 'ONCE', renewal_type: 'NEVER' } } });
  assert.strictEqual(fake.Billing.rows.filter(x => x.billing_ref === '777001').length, 1);
  assert.strictEqual(b.result_name, 'SUCCESS');
});
