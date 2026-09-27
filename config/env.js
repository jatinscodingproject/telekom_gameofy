const dotenv = require('dotenv');
dotenv.config();

const env = process.env.TELKOM_ENV === 'production' ? 'production' : 'staging';
const baseUrls = {
  staging: 'https://sdp-s-apigw-partners.telkom.co.za/partner-vas-api',
  production: 'https://sdp-p-apigw-partners.telkom.co.za/partner-vas-api'
};

module.exports = {
  port: Number(process.env.PORT || 3000),
  telkomEnv: env,
  baseUrl: baseUrls[env],
  accessKey: process.env.TELKOM_ACCESS_KEY,
  accessSecret: process.env.TELKOM_ACCESS_SECRET,
  apiKey: process.env.TELKOM_API_KEY,
  region: process.env.TELKOM_REGION || 'eu-west-1',
  service: process.env.TELKOM_SERVICE || 'execute-api',
  callbackIps: (process.env.TELKOM_CALLBACK_IPS || '').split(',').map(v => v.trim()).filter(Boolean)
};
