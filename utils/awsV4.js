const crypto = require('crypto');

const sha256 = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');
const hmac = (key, v, enc) => crypto.createHmac('sha256', key).update(v, 'utf8').digest(enc);

// RFC 3986 encoding. Space -> %20 (never '+'), unreserved chars A-Za-z0-9 - _ . ~ untouched.
function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// Sort by character code point (NOT localeCompare, which is locale-aware and breaks signatures).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Build the canonical query string from an object / [k,v] list.
 * The SAME string is used for the signature and for the request URL, so what we
 * sign is exactly what goes over the wire (avoids the "double encoding" trap
 * the Telkom document warns about).
 */
function canonicalQueryFromPairs(pairs) {
  return pairs
    .map(([k, v]) => [awsEncode(k), awsEncode(v ?? '')])
    .sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function canonicalQueryFromObject(query = {}) {
  const pairs = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    pairs.push([k, v]);
  }
  return canonicalQueryFromPairs(pairs);
}

function canonicalUri(pathname) {
  return pathname.split('/').map(seg => awsEncode(decodeURIComponent(seg))).join('/') || '/';
}

/**
 * @param {object} p
 * @param {string} p.method      GET|POST|PUT|PATCH|DELETE (upper-cased here)
 * @param {string} p.host        e.g. sdp-s-apigw-partners.telkom.co.za
 * @param {string} p.path        path used for signing (e.g. /partner-vas-api/subscription/1)
 * @param {string} p.query       already-canonical query string ('' if none)
 * @param {string} p.body        raw body ('' if none)
 * @param {string} p.amzDate     YYYYMMDDTHHmmssZ (GMT)
 */
function signRequest({ method, host, path, query = '', body = '', accessKey, accessSecret, region, service, amzDate }) {
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const signedHeaders = 'host;x-amz-date';
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;

  // Step 3.1 - joined with "\n" only (never \r\n). The blank line between the
  // headers and the signed-header list comes from canonicalHeaders' trailing \n.
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(path),
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;       // Step 1
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n'); // Step 3.2

  const kDate = hmac(Buffer.from(`AWS4${accessSecret}`, 'utf8'), dateStamp);       // Step 2
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');                           // Step 4

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`; // Step 5
  return { authorization, signature, canonicalRequest, stringToSign, credentialScope };
}

const nowAmzDate = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

module.exports = { signRequest, canonicalQueryFromObject, canonicalQueryFromPairs, awsEncode, nowAmzDate, sha256 };
