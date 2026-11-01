const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Subscription = sequelize.define('Subscription', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

  subscription_id: { type: DataTypes.STRING(100), allowNull: true, unique: true },   // Telkom id
  msisdn:          { type: DataTypes.STRING(30),  allowNull: true },                  // null until known (Wi-Fi flow)
  svc_id:          { type: DataTypes.STRING(100), allowNull: false },
  ext_ref:         { type: DataTypes.STRING(150), allowNull: true },                  // OUR unique reference (<=30 chars)

  channel:     { type: DataTypes.STRING(20), allowNull: true },                       // WAP / SMS / USSD
  doi_channel: { type: DataTypes.STRING(20), allowNull: true },                       // WAP / SMS
  flow:        { type: DataTypes.STRING(20), allowNull: true },                       // CLICK / WIFI / SMS / EXTERNAL / AD_HOC

  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PENDING' },
  reason: { type: DataTypes.STRING(50), allowNull: true },                            // last Reason header

  user_id:       { type: DataTypes.STRING(50),  allowNull: true },
  svc_name:      { type: DataTypes.STRING(150), allowNull: true },
  renewal_type:  { type: DataTypes.STRING(20),  allowNull: true },
  billing_cycle: { type: DataTypes.STRING(20),  allowNull: true },
  billing_rate:  { type: DataTypes.INTEGER,     allowNull: true },                    // cents
  is_ad_hoc:     { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },

  subscription_data: { type: DataTypes.JSON, allowNull: true },                       // last full Telkom payload
  consent_url:       { type: DataTypes.TEXT, allowNull: true },
  consent_return:    { type: DataTypes.JSON, allowNull: true },                       // raw query received on /consent/return

  started_at:      { type: DataTypes.DATE, allowNull: true },
  expires_at:      { type: DataTypes.DATE, allowNull: true },
  last_billed_at:  { type: DataTypes.DATE, allowNull: true },
  next_billing_at: { type: DataTypes.DATE, allowNull: true },
  activated_at:    { type: DataTypes.DATE, allowNull: true },
  suspended_at:    { type: DataTypes.DATE, allowNull: true },
  expired_at:      { type: DataTypes.DATE, allowNull: true },
  cancelled_at:    { type: DataTypes.DATE, allowNull: true },
  doi_failed_at:   { type: DataTypes.DATE, allowNull: true },
  last_callback_at:{ type: DataTypes.DATE, allowNull: true },
  last_event_at:   { type: DataTypes.DATE, allowNull: true }                          // Telkom's updated_at of last applied event
}, {
  tableName: 'subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['msisdn'] }, { fields: ['svc_id'] }, { fields: ['status'] },
    { fields: ['ext_ref'] }, { fields: ['msisdn', 'svc_id', 'status'] }
  ]
});

module.exports = Subscription;
