const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Billing = sequelize.define('Billing', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

  billing_ref:     { type: DataTypes.STRING(150), allowNull: false, unique: true },   // idempotency key
  subscription_id: { type: DataTypes.STRING(100), allowNull: true },
  msisdn:          { type: DataTypes.STRING(30),  allowNull: true },
  svc_id:          { type: DataTypes.STRING(100), allowNull: true },
  ext_ref:         { type: DataTypes.STRING(150), allowNull: true },

  amount:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },        // cents
  result_id:   { type: DataTypes.INTEGER, allowNull: true },                          // 1 SUCCESS, -8, -256, -5200, -5300 SCHEDULED
  result_name: { type: DataTypes.STRING(50), allowNull: true },
  billing_type:{ type: DataTypes.STRING(30), allowNull: true },                       // NORMAL / AD_HOC / STEP_DOWN ...

  payload:   { type: DataTypes.JSON, allowNull: true },
  billed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'billings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['subscription_id'] }, { fields: ['msisdn'] }, { fields: ['result_id'] }]
});

module.exports = Billing;
