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
