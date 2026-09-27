const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

// RFC3986 encoding required by the PartnerHUB signing rules.
function awsEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function canonicalQuery(url) {
  const pairs = [];
  for (const [key, value] of url.searchParams.entries()) {
    pairs.push([awsEncode(key), awsEncode(value)]);
  }
  pairs.sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

function canonicalHeaders(headers) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase().trim()] = String(value).trim().replace(/\s+/g, ' ');
  }
  const names = Object.keys(normalized).sort();
  const canonical = names.map(k => `${k}:${normalized[k]}\n`).join('');
  return { canonical, signedHeaders: names.join(';') };
}

function signRequest({ method, url, body = '', accessKey, accessSecret, region, service, amzDate }) {
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = {
    host: url.host,
    'x-amz-date': amzDate
  };
  const { canonical: canonicalHeadersString, signedHeaders } = canonicalHeaders(headers);

  // URL pathname must be encoded in AWS canonical URI form. Existing %XX sequences are kept.
  const canonicalUri = url.pathname.split('/').map(segment => awsEncode(decodeURIComponent(segment))).join('/');
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri || '/',
    canonicalQuery(url),
    canonicalHeadersString,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const kDate = hmac(Buffer.from(`AWS4${accessSecret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, amzDate };
}

module.exports = { signRequest };
