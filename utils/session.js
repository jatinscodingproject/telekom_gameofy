const jwt = require('jsonwebtoken');
const config = require('../config/env');

const PENDING = 'gf_pending';   // ties this browser to the ext_ref it started (1 day)
const SESSION = 'gf_session';   // proves this browser has an ACTIVE subscription (30 days)

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const i = p.indexOf('=');
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    })
  );
}

function setCookie(res, name, payload, maxAgeSec) {
  const token = jwt.sign(payload, config.sessionSecret, { expiresIn: maxAgeSec });
  const parts = [`${name}=${encodeURIComponent(token)}`, 'Path=/', `Max-Age=${maxAgeSec}`, 'HttpOnly', 'SameSite=Lax'];
  if (config.isProd) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(prev || [], parts.join('; ')));
}

function readCookie(req, name) {
  const raw = parseCookies(req.headers.cookie || '')[name];
  if (!raw) return null;
  try { return jwt.verify(raw, config.sessionSecret); } catch { return null; }
}

function clearCookie(res, name) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(prev || [], `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`));
}

module.exports = {
  PENDING, SESSION,
  setPending: (res, extRef) => setCookie(res, PENDING, { extRef }, 86400),
  getPending: req => readCookie(req, PENDING),
  setSession: (res, data) => setCookie(res, SESSION, data, 30 * 86400),
  getSession: req => readCookie(req, SESSION),
  clearSession: res => clearCookie(res, SESSION)
};
