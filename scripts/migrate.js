/**
 * Idempotent schema upgrade. Your existing `subscriptions` / `callback_events` tables were created from the
 * OLD models and sequelize.sync({alter:false}) never adds columns, so this script:
 *   1. creates missing tables (billings ...)
 *   2. adds any column that exists in a model but not in the DB
 *   3. relaxes a few old column types (ENUM -> VARCHAR, msisdn NOT NULL -> NULL)
 * Run automatically on start-up, or manually:  node scripts/migrate.js
 */
const { DataTypes } = require('sequelize');

const RELAX = {
  subscriptions: {
    msisdn: { type: DataTypes.STRING(30), allowNull: true },
    channel: { type: DataTypes.STRING(20), allowNull: true },
    doi_channel: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PENDING' }
  }
};

async function migrate(sequelize) {
  const qi = sequelize.getQueryInterface();
  await sequelize.sync({ alter: false });                         // create missing tables

  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    const existing = await qi.describeTable(table);

    for (const [attr, def] of Object.entries(model.rawAttributes)) {
      const column = def.field || attr;
      if (existing[column]) continue;
      console.log(`[migrate] ${table}: adding column ${column}`);
      await qi.addColumn(table, column, { type: def.type, allowNull: true, defaultValue: def.defaultValue });
    }

    for (const [column, spec] of Object.entries(RELAX[table] || {})) {
      if (existing[column]) await qi.changeColumn(table, column, spec);
    }

    // make sure model-declared indexes exist (ignore "duplicate" errors)
    for (const idx of model.options.indexes || []) {
      try { await qi.addIndex(table, idx.fields, { name: `idx_${table}_${idx.fields.join('_')}`.slice(0, 60) }); } catch { /* exists */ }
    }
    if (table === 'callback_events' && !existing.dedupe_key) {
      try { await qi.addIndex(table, ['dedupe_key'], { unique: true, name: 'uq_callback_events_dedupe' }); } catch { /* exists */ }
    }
    if (table === 'billings') {
      try { await qi.addIndex(table, ['billing_ref'], { unique: true, name: 'uq_billings_ref' }); } catch { /* exists */ }
    }
  }
}

module.exports = migrate;

if (require.main === module) {
  const { sequelize } = require('../models');
  sequelize.authenticate().then(() => migrate(sequelize)).then(() => { console.log('migrated'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
