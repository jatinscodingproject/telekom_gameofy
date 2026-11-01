const config = require('../config/env');
const { signRequest, canonicalQueryFromObject, nowAmzDate } = require('../utils/awsV4');

function requireConfig() {
  for (const [name, value] of [
    ['TELKOM_ACCESS_KEY', config.accessKey],
    ['TELKOM_ACCESS_SECRET', config.accessSecret],
    ['TELKOM_API_KEY', config.apiKey]
  ]) {
    if (!value || String(value).startsWith('YOUR_')) throw new Error(`${name} is not configured`);
  }
}

/** The PDF shows header values HTML-escaped ("&amp;") and with a doubled scheme; clean both. */
function cleanConsentUrl(raw) {
  if (!raw) return null;
  let u = String(raw).trim().replace(/&amp;/g, '&').replace(/^(https?:\/\/)+/i, 'https://');
  try {
    const parsed = new URL(u);
    const ok = config.allowedConsentHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
    return parsed.protocol === 'https:' && ok ? parsed.toString() : null;   // open-redirect guard
  } catch { return null; }
}

async function request(method, path, body, query = {}, { baseUrlOverride } = {}) {
  requireConfig();
  const base = new URL(baseUrlOverride || config.baseUrl);
  const qs = canonicalQueryFromObject(query);
  const url = `${base.origin}${base.pathname.replace(/\/$/, '')}${path}${qs ? '?' + qs : ''}`;

  const rawBody = body === undefined || body === null ? '' : JSON.stringify(body);
  const amzDate = nowAmzDate();
  const signPath = config.signIncludeBasePath ? new URL(url).pathname : path;

  const { authorization } = signRequest({
    method, host: base.host, path: signPath, query: qs, body: rawBody,
    accessKey: config.accessKey, accessSecret: config.accessSecret,
    region: config.region, service: config.service, amzDate
  });

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
        'X-Amz-Date': amzDate,
        'x-api-key': config.apiKey
      },
      body: rawBody || undefined,
      signal: ctrl.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    const headers = Object.fromEntries(response.headers.entries());
    console.log(`[telkom] ${method} ${path} -> ${response.status} (${Date.now() - started}ms)`);   // never log secrets/body
    return {
      ok: response.ok,
      status: response.status,
      headers,
      data,
      errorCode: !response.ok && data && typeof data === 'object' ? data.error_code ?? response.status : null,
      consentUrl: cleanConsentUrl(headers['api-wap-doi-location'])
    };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : err.message;
    console.error(`[telkom] ${method} ${path} failed: ${reason}`);
    return { ok: false, status: 0, headers: {}, data: { error_message: `Network error: ${reason}` }, errorCode: 'NETWORK', consentUrl: null };
  } finally {
    clearTimeout(timer);
  }
}

const id = v => encodeURIComponent(String(v));

module.exports = {
  request, cleanConsentUrl,
  createSubscription: body => request('POST', '/subscription', body),
  getSubscription: sid => request('GET', `/subscription/${id(sid)}`),
  getPartner: (pid, expand) => request('GET', `/partner/${id(pid)}`, undefined, { expand }),
  getService: (sid, expand) => request('GET', `/service/${id(sid)}`, undefined, { expand }),
  cancelSubscription: sid => request('DELETE', `/subscription/${id(sid)}`),
  resendDoi: (sid, body = {}) => request('PATCH', `/subscription/${id(sid)}/doi`, body),
=======
const { signRequest } = require('../utils/awsV4');
const config = require('../config/env');

function requireConfig() {
  for (const [name, value] of [['TELKOM_ACCESS_KEY', config.accessKey], ['TELKOM_ACCESS_SECRET', config.accessSecret], ['TELKOM_API_KEY', config.apiKey]]) {
    if (!value) throw new Error(`${name} is not configured`);
  }
}

async function request(method, path, body, query = {}) {
  requireConfig();
  const url = new URL(config.baseUrl + path);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const rawBody = body === undefined || body === null ? '' : JSON.stringify(body);
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const { authorization } = signRequest({
    method, url, body: rawBody,
    accessKey: config.accessKey,
    accessSecret: config.accessSecret,
    region: config.region,
    service: config.service,
    amzDate
  });

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: authorization,
    'X-Amz-Date': amzDate,
    'x-api-key': config.apiKey
  };

  const response = await fetch(url, { method, headers, body: rawBody || undefined });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data
  };
}

module.exports = {
  createSubscription: body => request('POST', '/subscription', body),
  getSubscription: id => request('GET', `/subscription/${encodeURIComponent(id)}`),
  getPartner: (id, expand) => request('GET', `/partner/${encodeURIComponent(id)}`, undefined, { expand }),
  getService: (id, expand) => request('GET', `/service/${encodeURIComponent(id)}`, undefined, { expand }),
  cancelSubscription: id => request('DELETE', `/subscription/${encodeURIComponent(id)}`),
  resendDoi: (id, body = {}) => request('PATCH', `/subscription/${encodeURIComponent(id)}/doi`, body),
  createAdHocBill: body => request('POST', '/billing/ad-hoc', body)
};
