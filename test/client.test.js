const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// Point the client at a throw-away local server and inspect exactly what it sends.
process.env.TELKOM_ENV = 'staging'; process.env.TELKOM_ACCESS_KEY = 'AKTEST'; process.env.TELKOM_ACCESS_SECRET = 'secret'; process.env.TELKOM_API_KEY = 'apikey';
process.env.TELKOM_BASE_URL_OVERRIDE = 'http://127.0.0.1:0/partner-vas-api';

test('client sends signed headers, canonical query on the wire, and parses consent header', async () => {
  let seen;
  const server = http.createServer((req, res) => {
    seen = { method: req.method, url: req.url, headers: req.headers };
    res.writeHead(200, { 'Content-Type': 'application/json', 'API-WAP-DOI-Location': 'https://sdp-s-vas-payment.telkom.co.za/service/1?a=1&amp;b=2' });
    res.end(JSON.stringify({ subscription_id: 5 }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.TELKOM_BASE_URL_OVERRIDE = `http://127.0.0.1:${server.address().port}/partner-vas-api`;
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('../services/telkomClient')];
  const telkom = require('../services/telkomClient');

  const r = await telkom.getPartner(1, 'subscription(status=Active, page=1)');
  server.close();

  assert.strictEqual(r.status, 200);
  assert.strictEqual(seen.url, '/partner-vas-api/partner/1?expand=subscription%28status%3DActive%2C%20page%3D1%29');
  assert.match(seen.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKTEST\/\d{8}\/eu-west-1\/execute-api\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[0-9a-f]{64}$/);
  assert.match(seen.headers['x-amz-date'], /^\d{8}T\d{6}Z$/);
  assert.strictEqual(seen.headers['x-api-key'], 'apikey');
  assert.strictEqual(seen.headers.accept, 'application/json');
  assert.strictEqual(r.consentUrl, 'https://sdp-s-vas-payment.telkom.co.za/service/1?a=1&b=2');   // &amp; decoded
});

test('network failure returns a structured error instead of throwing', async () => {
  process.env.TELKOM_BASE_URL_OVERRIDE = 'http://127.0.0.1:1/partner-vas-api';
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('../services/telkomClient')];
  const telkom = require('../services/telkomClient');
  const r = await telkom.getSubscription(1);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.errorCode, 'NETWORK');
});
