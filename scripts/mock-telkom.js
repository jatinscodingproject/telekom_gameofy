/**
 * Local fake of the PartnerHUB VAS API + a callback sender, for development without staging access.
 *   TELKOM_ENV=staging is overridden by pointing the client at this server:
 *   node scripts/mock-telkom.js            # API on :4999
 * and in .env (dev only):  TELKOM_BASE_URL_OVERRIDE=http://localhost:4999/partner-vas-api
 *
 * Simulate the user confirming (sends a real callback to your app):
 *   curl -X POST localhost:4999/_simulate -d '{"subscription_id":111,"reason":"ACTIVATED"}' -H 'content-type: application/json'
 */
const http = require('http');

const PORT = Number(process.env.MOCK_PORT || 4999);
const APP = process.env.APP_URL || 'http://localhost:4011';
const TOKEN = process.env.CALLBACK_TOKEN ? `/${process.env.CALLBACK_TOKEN}` : '';
const subs = new Map();
let nextId = 111;

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : {})); });
const iso = () => new Date().toISOString();

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace('/partner-vas-api', '');

  // Fail like the real gateway if auth headers are missing
  if (!path.startsWith('/_') && !(req.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=')) {
    return send(res, 403, { message: 'Missing Authentication Token' });
  }

  if (req.method === 'POST' && path === '/subscription') {
    const b = await readBody(req);
    if (!b.msisdn) return send(res, 454, { error_code: 454, error_message: 'MSISDN not provided' });
    const id = nextId++;
    const sub = {
      subscription_id: id, user_id: 2222222, user_msisdn: b.msisdn, svc_id: b.svc_id, svc_name: 'demo service',
      ext_ref: String(b.ext_ref), channel_name: b.channel, status_id: 1, status_name: 'PENDING',
      renewal_type: 'AUTO', billing_rate: 700, billing_cycle: 'DAILY', created_at: iso()
    };
    subs.set(id, sub);
    const h = b.doi_channel === 'WAP'
      ? { 'API-WAP-DOI-Location': `https://sdp-s-vas-payment.telkom.co.za/service/${b.svc_id}?msisdn=${b.msisdn}&amp;subscription_id=${id}&amp;ext_ref=${b.ext_ref}` }
      : {};
    return send(res, 200, sub, h);
  }

  const m = path.match(/^\/subscription\/(\d+)$/);
  if (m && req.method === 'GET') { const s = subs.get(Number(m[1])); return s ? send(res, 200, s) : send(res, 464, { error_code: 464, error_message: 'Subscription Not Found' }); }
  if (m && req.method === 'DELETE') {
    const s = subs.get(Number(m[1]));
    if (!s) return send(res, 464, { error_code: 464, error_message: 'Subscription Not Found' });
    if (s.status_name !== 'ACTIVE') return send(res, 515, { error_code: 515, error_message: 'Subscription not active' });
    s.status_name = 'CANCELLED'; return send(res, 200, s);
  }
  if (req.method === 'PATCH' && /\/doi$/.test(path)) return send(res, 200, subs.get(Number(path.split('/')[2])) || {});

  if (req.method === 'POST' && path === '/billing/ad-hoc') {
    const b = await readBody(req);
    return send(res, 200, { amount: b.billing_rate, billing_ref: Date.now(), result_id: -5300, result_name: 'SCHEDULED', billing_type: 'AD_HOC',
      subscription: { subscription_id: nextId++, user_msisdn: b.msisdn, svc_id: b.svc_id, ext_ref: b.ext_ref, status_name: 'PENDING', renewal_type: 'NEVER', billing_cycle: 'ONCE', billing_rate: b.billing_rate } });
  }

  // ---- dev helper: push a callback to the app, exactly like PartnerHUB would
  if (req.method === 'POST' && path === '/_simulate') {
    const { subscription_id, reason = 'ACTIVATED', billing } = await readBody(req);
    const s = subs.get(Number(subscription_id));
    if (!s) return send(res, 404, { error: 'unknown subscription' });
    s.status_name = reason === 'ACTIVATED' ? 'ACTIVE' : reason; s.updated_at = iso();
    const target = billing ? `${APP}/api/callbacks/billing${TOKEN}` : `${APP}/api/callbacks/subscription${TOKEN}`;
    const payload = billing ? { amount: 700, billing_ref: Date.now(), result_id: 1, result_name: 'SUCCESS', billing_type: 'NORMAL', subscription: s } : s;
    const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', Reason: reason }, body: JSON.stringify(payload) });
    return send(res, 200, { delivered_to: target, app_status: r.status });
  }

  send(res, 404, { message: 'not mocked' });
}).listen(PORT, () => console.log(`Mock PartnerHUB on :${PORT}`));
