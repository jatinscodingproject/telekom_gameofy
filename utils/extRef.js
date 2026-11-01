const crypto = require('crypto');
/** Unique reference <= 30 chars (Telkom limit). "GO" + base36 time + 10 random hex = ~22 chars. */
module.exports = function newExtRef() {
  return ('GO' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex')).toUpperCase().slice(0, 30);
};
