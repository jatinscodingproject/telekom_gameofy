const { sequelize } = require('../models');
const migrate = require('../scripts/migrate');

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('MySQL database connected successfully');

    // Creates missing tables and ADDS missing columns to existing ones (idempotent, never drops data).
    await migrate(sequelize);
    console.log('Database schema up to date');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
}

module.exports = initDatabase;
