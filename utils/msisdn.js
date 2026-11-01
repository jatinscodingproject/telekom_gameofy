const config = require('../config/env');

/** -> 27XXXXXXXXX (11 digits) or null. Accepts 0831234567, +27831234567, 27831234567, 0027... */
function normalizeMsisdn(input) {
  if (input === undefined || input === null) return null;
  let d = String(input).replace(/[^\d]/g, '');
  if (d.startsWith('0027')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '27' + d.slice(1);
  if (d.length === 9) d = '27' + d;               // 831234567
  return /^27\d{9}$/.test(d) ? d : null;
}

/** MSISDN injected by the network (header enrichment). Header names are configurable via MSISDN_HEADERS. */
function msisdnFromHeaders(headers) {
  for (const name of config.msisdnHeaders) {
    const v = headers[name.toLowerCase()];
    const n = normalizeMsisdn(v);
    if (n) return n;
  }
  return null;
}

module.exports = { normalizeMsisdn, msisdnFromHeaders };
