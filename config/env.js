const dotenv = require('dotenv');
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const telkomEnv = process.env.TELKOM_ENV === 'production' ? 'production' : 'staging';

const apiBaseUrls = {
  staging: 'https://sdp-s-apigw-partners.telkom.co.za/partner-vas-api',
  production: 'https://sdp-p-apigw-partners.telkom.co.za/partner-vas-api'
};

// Consent Gateway (browser redirects). NOT the same host as the REST API.
// NOTE: the PDF spells this host two ways ("vas-payment" in section 5,
// "vaspayment" in the example response header). Override with
// TELKOM_CONSENT_BASE_URL if Telkom confirms a different value.
const consentBaseUrls = {
  staging: 'https://sdp-s-vas-payment.telkom.co.za',
  production: 'https://sdp-p-vas-payment.telkom.co.za'
};

const list = (v, d = '') => (v ?? d).split(',').map(s => s.trim()).filter(Boolean);

const config = {
  isProd,
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),

  // ---- Telkom PartnerHUB ----
  telkomEnv,
  baseUrl: (!isProd && process.env.TELKOM_BASE_URL_OVERRIDE) || apiBaseUrls[telkomEnv],   // override = local mock only
  consentBaseUrl: (process.env.TELKOM_CONSENT_BASE_URL || consentBaseUrls[telkomEnv]).replace(/\/$/, ''),
  accessKey: process.env.TELKOM_ACCESS_KEY,
  accessSecret: process.env.TELKOM_ACCESS_SECRET,
  apiKey: process.env.TELKOM_API_KEY,
  region: process.env.TELKOM_REGION || 'eu-west-1',
  service: process.env.TELKOM_SERVICE || 'execute-api',
  requestTimeoutMs: Number(process.env.TELKOM_TIMEOUT_MS || 20000),
  // The PDF says "Request path e.g. /subscription/12345" but the real URL path is
  // /partner-vas-api/subscription/12345. Default signs the full path (standard API
  // Gateway behaviour). If staging answers 403 "signature mismatch", set to false.
  signIncludeBasePath: process.env.TELKOM_SIGN_INCLUDE_BASE_PATH !== 'false',

  // ---- Our service ----
  svcId: String(process.env.TELKOM_SVC_ID || '300000146'),
  supportContact: process.env.SUPPORT_CONTACT || '',
  cancelInstructions: process.env.CANCEL_INSTRUCTIONS || '',

  // ---- Security ----
  adminApiKey: process.env.ADMIN_API_KEY || '',
  callbackToken: process.env.CALLBACK_TOKEN || '',       // appended to callback URL: /api/callbacks/subscription/<token>
  callbackIps: list(process.env.TELKOM_CALLBACK_IPS),
  sessionSecret: process.env.SESSION_SECRET || '',
  trustProxy: process.env.TRUST_PROXY || '1',             // number of proxy hops in front of the app
  allowedConsentHosts: list(process.env.ALLOWED_CONSENT_HOSTS, 'telkom.co.za'),

  // ---- Behaviour ----
  msisdnHeaders: list(process.env.MSISDN_HEADERS, 'x-msisdn,msisdn,x-up-calling-line-id,x-wap-msisdn,x-nokia-msisdn'),
  allowSmsDoi: process.env.ALLOW_SMS_DOI === 'true',      // typed-number flow with DOI by SMS
  entitledStatuses: list(process.env.ENTITLED_STATUSES, 'ACTIVE'),
  enableJobs: process.env.ENABLE_JOBS !== 'false'
};

if (isProd && !config.sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production');
}
if (!config.sessionSecret) config.sessionSecret = 'dev-only-secret-change-me';

module.exports = config;