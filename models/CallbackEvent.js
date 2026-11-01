const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/** Raw inbox of every callback. Stored FIRST, processed second, so nothing is ever lost. */
const CallbackEvent = sequelize.define('CallbackEvent', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

  dedupe_key:      { type: DataTypes.STRING(64), allowNull: true, unique: true },     // sha256(type|reason|payload)
  event_type:      { type: DataTypes.STRING(50), allowNull: false },                  // SUBSCRIPTION | BILLING
  reason:          { type: DataTypes.STRING(50), allowNull: true },
  subscription_id: { type: DataTypes.STRING(100), allowNull: true },
  billing_ref:     { type: DataTypes.STRING(150), allowNull: true },
  msisdn:          { type: DataTypes.STRING(30), allowNull: true },
  payload:         { type: DataTypes.JSON, allowNull: false },
  source_ip:       { type: DataTypes.STRING(64), allowNull: true },

  processed:     { type: DataTypes.BOOLEAN, defaultValue: false },
  process_result:{ type: DataTypes.STRING(50), allowNull: true },                     // transition / stale_event / illegal_transition ...
  processed_at:  { type: DataTypes.DATE, allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'callback_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['event_type'] }, { fields: ['subscription_id'] }, { fields: ['billing_ref'] }, { fields: ['processed'] }]
});

module.exports = CallbackEvent;
